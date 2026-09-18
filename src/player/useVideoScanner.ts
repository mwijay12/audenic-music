import { registerPlugin, Capacitor } from "@capacitor/core";
import { useState, useEffect, useCallback } from "react";
import {
  classifyVideo,
  VideoCategory,
  VideoClassification,
  CATEGORY_META,
  RawVideoData,
} from "./videoClassifier";

export interface LocalVideo extends RawVideoData {
  src: string;
  thumbnail: string;
  rawThumbnail: string;
  formattedDuration: string;
  formattedSize: string;
  classification: VideoClassification;
  manualCategory: VideoCategory | null;
  effectiveCategory: VideoCategory;
  isLocal: true;
}

interface RawVideoFromPlugin {
  id: string;
  title: string;
  displayName: string;
  duration: number;
  size: number;
  path: string;
  contentUri: string;
  thumbnail: string;
  dateAdded: number;
  width: number;
  height: number;
  aspectRatio: number;
  mimeType: string;
  bucket: string;
  bitrate: number;
}

interface VideoScannerPlugin {
  scanVideos(): Promise<{ videos: RawVideoFromPlugin[]; total: number }>;
  clearThumbCache(): Promise<{ cleared: boolean }>;
}

export interface VideoLibrary {
  all: LocalVideo[];
  byCategory: Record<VideoCategory, LocalVideo[]>;
  totalFound: number;
}

export interface UseVideoScannerReturn {
  library: VideoLibrary;
  isScanning: boolean;
  scanError: string | null;
  scanVideos: () => Promise<void>;
  rescan: () => Promise<void>;
  overrideCategory: (videoId: string, category: VideoCategory) => void;
  clearCache: () => void;
  getCategoryCount: (cat: VideoCategory) => number;
}

const VideoScanner = registerPlugin<VideoScannerPlugin>("VideoScanner", {
  web: {
    async scanVideos() { return { videos: [], total: 0 }; },
    async clearThumbCache() { return { cleared: true }; },
  },
});

const CACHE_KEY = "au.localVideos.v2";
const CACHE_TIME_KEY = "au.localVideos.timestamp.v2";
const OVERRIDE_KEY = "au.videoOverrides.v1";
const CACHE_TTL = 12 * 60 * 60 * 1000;

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  if (s < 3600) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + " MB";
  return (bytes / 1024 ** 3).toFixed(2) + " GB";
}

function buildEmptyLibrary(): VideoLibrary {
  const byCategory = {} as Record<VideoCategory, LocalVideo[]>;
  const cats: VideoCategory[] = ["reel", "music_video", "concert", "movie", "tutorial", "my_video", "other"];
  for (const c of cats) byCategory[c] = [];
  return { all: [], byCategory, totalFound: 0 };
}

function safeConvertFileSrc(path: string | null | undefined): string {
  if (!path) return "";
  try {
    const sanitized = path.replace(/%(?![0-9A-Fa-f]{2})/g, "%25");
    return Capacitor.convertFileSrc(sanitized);
  } catch (err) {
    return path || "";
  }
}

function normalizeVideo(raw: RawVideoFromPlugin, overrides: Record<string, VideoCategory>): LocalVideo {
  const src = safeConvertFileSrc(raw.contentUri || raw.path);
  const thumbnail = raw.thumbnail ? safeConvertFileSrc(raw.thumbnail) : "";

  const rawData: RawVideoData = {
    id: raw.id, title: raw.title, displayName: raw.displayName,
    duration: raw.duration, size: raw.size, aspectRatio: raw.aspectRatio,
    width: raw.width, height: raw.height, bucket: raw.bucket,
    bitrate: raw.bitrate, mimeType: raw.mimeType,
  };

  const classification = classifyVideo(rawData);
  const manualCategory = overrides[raw.id] ?? null;
  const effectiveCategory = manualCategory ?? classification.category;

  return {
    ...rawData,
    src,
    thumbnail,
    rawThumbnail: raw.thumbnail,
    formattedDuration: formatDuration(raw.duration),
    formattedSize: formatSize(raw.size),
    classification,
    manualCategory,
    effectiveCategory,
    isLocal: true,
  };
}

function groupByCategory(videos: LocalVideo[]): VideoLibrary {
  const byCategory = {} as Record<VideoCategory, LocalVideo[]>;
  const cats: VideoCategory[] = ["reel", "music_video", "concert", "movie", "tutorial", "my_video", "other"];
  for (const c of cats) byCategory[c] = [];

  for (const v of videos) {
    byCategory[v.effectiveCategory].push(v);
  }

  return { all: videos, byCategory, totalFound: videos.length };
}

export function useVideoScanner(): UseVideoScannerReturn {
  const [library, setLibrary] = useState<VideoLibrary>(buildEmptyLibrary());
  const [isScanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  function loadOverrides(): Record<string, VideoCategory> {
    try {
      const raw = localStorage.getItem(OVERRIDE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  function saveOverrides(overrides: Record<string, VideoCategory>) {
    try {
      localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
    } catch { /* storage quota */ }
  }

  useEffect(() => {
    initScanner();
  }, []);

  function initScanner() {
    try {
      const ts = localStorage.getItem(CACHE_TIME_KEY);
      const age = ts ? Date.now() - parseInt(ts, 10) : Infinity;

      if (age < CACHE_TTL) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const videos: LocalVideo[] = JSON.parse(cached);
          if (videos.length > 0) {
            const overrides = loadOverrides();
            const updated = videos.map((v) => ({
              ...v,
              manualCategory: overrides[v.id] ?? null,
              effectiveCategory: overrides[v.id] ?? v.classification.category,
            }));
            setLibrary(groupByCategory(updated));
            return;
          }
        }
      }
    } catch { /* fall through */ }

    if (Capacitor.isNativePlatform()) {
      scanVideos();
    }
  }

  const scanVideos = useCallback(async (): Promise<void> => {
    if (!Capacitor.isNativePlatform() || isScanning) return;

    setScanning(true);
    setScanError(null);

    try {
      const { videos: raw } = await VideoScanner.scanVideos();
      const overrides = loadOverrides();
      const normalized = raw.map((r) => normalizeVideo(r, overrides));
      const lib = groupByCategory(normalized);

      setLibrary(lib);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(normalized));
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch { /* storage quota */ }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setScanError(
        msg.includes("PERMISSION_DENIED")
          ? "Video permission denied. Check Settings > Apps > Audenic > Permissions"
          : "Could not scan videos. Please try again."
      );
    } finally {
      setScanning(false);
    }
  }, [isScanning]);

  const rescan = useCallback(async (): Promise<void> => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
    try { await VideoScanner.clearThumbCache(); } catch { /* ignore */ }
    setLibrary(buildEmptyLibrary());
    await scanVideos();
  }, [scanVideos]);

  const overrideCategory = useCallback((videoId: string, category: VideoCategory) => {
    const overrides = loadOverrides();
    overrides[videoId] = category;
    saveOverrides(overrides);

    setLibrary((prev) => {
      const updated = prev.all.map((v) =>
        v.id === videoId ? { ...v, manualCategory: category, effectiveCategory: category } : v
      );
      return groupByCategory(updated);
    });
  }, []);

  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
    setLibrary(buildEmptyLibrary());
  }, []);

  const getCategoryCount = useCallback(
    (cat: VideoCategory) => library.byCategory[cat]?.length ?? 0,
    [library]
  );

  return {
    library,
    isScanning,
    scanError,
    scanVideos,
    rescan,
    overrideCategory,
    clearCache,
    getCategoryCount,
  };
}

import { registerPlugin, Capacitor } from "@capacitor/core";
import { useState, useCallback } from "react";

export interface LocalTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  rawContentUri?: string;
  rawAlbumArt?: string;
  /** Raw file:// path to cached cover art — usable by native notification without Capacitor URL conversion */
  albumArtFilePath?: string;
  src: string;
  cover: string;
  size: number;
  dateAdded: number;
  mimeType: string;
  genre: string;
  year: string;
  bitrate: number;
  trackNumber: number;
  isLocal: true;
  source: "mediastore" | "filesystem";
  formattedDuration: string;
  formattedSize: string;
  formattedBitrate: string;
  avatarLetter: string;
  avatarColor: string;
}

interface RawTrackFromPlugin {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  path: string;
  contentUri: string;
  albumArt: string;
  albumArtFilePath?: string;
  size: number;
  dateAdded: number;
  mimeType: string;
  genre?: string;
  year?: string;
  bitrate?: number;
  trackNumber?: number;
}

interface MediaScannerPlugin {
  checkPermission(): Promise<{ granted: boolean; needed: string; sdkVersion: number }>;
  scanAudio(): Promise<{ tracks: RawTrackFromPlugin[]; total: number; source: string }>;
  triggerMediaScan(options?: { path?: string }): Promise<{ triggered: boolean }>;
  clearArtCache(): Promise<{ cleared: boolean; deletedFiles: number }>;
}

const MediaScanner = registerPlugin<MediaScannerPlugin>("MediaScanner", {
  web: {
    async checkPermission() {
      return { granted: false, needed: "web", sdkVersion: 0 };
    },
    async scanAudio() {
      return { tracks: [], total: 0, source: "web" };
    },
    async triggerMediaScan() {
      return { triggered: false };
    },
    async clearArtCache() {
      return { cleared: true, deletedFiles: 0 };
    },
  },
});

const LOCAL_STORAGE_KEY = "au.localTracks";

export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}:${remMins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function formatBitrate(bps: number): string {
  if (!bps || bps <= 0) return "";
  if (bps >= 1000) return `${Math.round(bps / 1000)} kbps`;
  return `${bps} bps`;
}

const AVATAR_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#10B981", "#06B6D4",
  "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899", "#F43F5E"
];

export function getAvatarColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Pre-sanitize a raw native path/URI before handing it to Capacitor.
 * Escapes stray "%" (not already part of a valid %XX sequence), "#" and "?"
 * so WebView-side URI decoding never throws "URI malformed" — mirrors the
 * same proactive sanitization already used in nativeBridge.ts/useVideoScanner.ts.
 */
function sanitizeNativePath(path: string): string {
  return path
    .replace(/%(?![0-9A-Fa-f]{2})/g, "%25")
    .replace(/#/g, "%23")
    .replace(/\?/g, "%3F");
}

export function safeConvertFileSrc(path: string): string {
  if (!path) return "";
  try {
    if (
      path.startsWith("http://") ||
      path.startsWith("https://") ||
      path.startsWith("data:") ||
      path.startsWith("blob:")
    ) {
      return path;
    }
    // Always sanitize BEFORE the first convertFileSrc call — a stray "%"/"#"/"?"
    // in a content:// or file path can make the WebView throw "URI malformed"
    // asynchronously while loading, not just synchronously here, so we must not
    // wait for a catch block to fix it.
    const sanitized = sanitizeNativePath(path);
    try {
      return Capacitor.convertFileSrc(sanitized);
    } catch {
      try {
        return Capacitor.convertFileSrc(path);
      } catch {
        return path;
      }
    }
  } catch (err) {
    return path || "";
  }
}

export function getSafeAudioSrc(track: Partial<LocalTrack> & { src?: string; rawContentUri?: string }): string {
  if (!track) return "";
  if (track.rawContentUri && track.rawContentUri.startsWith("content://")) {
    return safeConvertFileSrc(track.rawContentUri);
  }
  if (track.src) {
    if (track.src.startsWith("http://localhost/_capacitor_") || track.src.startsWith("https://localhost/_capacitor_")) {
      return track.src;
    }
    return safeConvertFileSrc(track.src);
  }
  return "";
}

export function getSafeCoverSrc(track: Partial<LocalTrack> & { cover?: string; rawAlbumArt?: string }): string {
  if (!track) return "";
  const rawArt = track.rawAlbumArt || "";
  if (rawArt.length > 5 && !rawArt.includes("unsplash")) {
    return safeConvertFileSrc(rawArt);
  }
  if (track.cover && !track.cover.includes("unsplash")) {
    return safeConvertFileSrc(track.cover);
  }
  return "";
}

export function normalizeTrack(raw: RawTrackFromPlugin, sourceName = "mediastore"): LocalTrack {
  const playableSrc = raw.contentUri || raw.path;
  const src = safeConvertFileSrc(playableSrc);
  const cover = raw.albumArt ? safeConvertFileSrc(raw.albumArt) : "";

  const titleClean = raw.title || "Unknown Track";
  const letter = titleClean.trim().charAt(0).toUpperCase() || "A";

  return {
    id: raw.id,
    title: titleClean,
    artist: raw.artist || "Unknown Artist",
    album: raw.album || "Unknown Album",
    duration: raw.duration || 0,
    rawContentUri: playableSrc,
    rawAlbumArt: raw.albumArt || "",
    albumArtFilePath: raw.albumArtFilePath || "",
    src,
    cover,
    size: raw.size || 0,
    dateAdded: raw.dateAdded || Date.now(),
    mimeType: raw.mimeType || "audio/mpeg",
    genre: raw.genre || "",
    year: raw.year || "",
    bitrate: raw.bitrate || 0,
    trackNumber: raw.trackNumber || 0,
    isLocal: true,
    source: (sourceName === "filesystem" ? "filesystem" : "mediastore") as any,
    formattedDuration: formatDuration(raw.duration || 0),
    formattedSize: formatSize(raw.size || 0),
    formattedBitrate: formatBitrate(raw.bitrate || 0),
    avatarLetter: letter,
    avatarColor: getAvatarColor(titleClean + (raw.artist || "")),
  };
}

export function useMediaScanner() {
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!cached) return [];
      const parsed: LocalTrack[] = JSON.parse(cached);
      return parsed.map((tr) => normalizeTrack({
        id: tr.id,
        title: tr.title,
        artist: tr.artist,
        album: tr.album,
        duration: tr.duration,
        path: (tr as any).path || tr.src,
        contentUri: tr.rawContentUri || tr.src,
        albumArt: tr.rawAlbumArt || tr.cover,
        albumArtFilePath: tr.albumArtFilePath || "",
        size: tr.size,
        dateAdded: tr.dateAdded,
        mimeType: tr.mimeType,
        genre: tr.genre || "",
        year: tr.year || "",
        bitrate: tr.bitrate || 0,
        trackNumber: tr.trackNumber || 0,
      }, tr.source));
    } catch {
      return [];
    }
  });

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSource, setScanSource] = useState<string | null>(null);

  const scanLocalMusic = useCallback(async (): Promise<LocalTrack[]> => {
    setIsScanning(true);
    setScanError(null);

    if (!Capacitor.isNativePlatform()) {
      setIsScanning(false);
      return [];
    }

    try {
      const res = await MediaScanner.scanAudio();
      const rawList = res?.tracks || [];
      setScanSource(res?.source || "mediastore");

      const formatted: LocalTrack[] = rawList.map((tr) => normalizeTrack(tr, res?.source));
      formatted.sort((a, b) => b.dateAdded - a.dateAdded);

      setLocalTracks(formatted);

      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formatted));
      } catch {
        /* storage quota */
      }

      return formatted;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setScanError(msg);
      return [];
    } finally {
      setIsScanning(false);
    }
  }, []);

  const clearLocalTracks = useCallback(() => {
    setLocalTracks([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    localTracks,
    isScanning,
    scanError,
    scanSource,
    scanLocalMusic,
    clearLocalTracks,
  };
}

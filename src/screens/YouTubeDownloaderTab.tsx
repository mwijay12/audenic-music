import { useEffect, useState } from "react";
import {
  downloadYouTubeMedia,
  getDefaultDownloadDirs,
  listenTauri,
  openInExplorer,
  pickFolder,
  pickVideoFiles,
  convertVideoToAudio,
  DownloadProgressPayload,
  DownloadCompletePayload,
  toAssetUrl,
  isDesktop,
} from "../player/tauriBridge";
import { usePlayer } from "../player/PlayerContext";
import {
  Download,
  Music,
  Film,
  Folder,
  CheckCircle,
  ExternalLink,
  Play,
  Sparkles,
  Trash2,
  Gear,
  ChevronDown,
  ChevronUp,
  Search,
  X,
} from "../components/Icons";

interface DownloadHistoryItem {
  id: string;
  url: string;
  title: string;
  artist?: string;
  format: "audio" | "video";
  filePath?: string;
  thumbnailPath?: string;
  coverUrl?: string;
  lyrics?: string[];
  syncedLyrics?: string;
  timestamp: number;
  status: "downloading" | "completed" | "error";
  progress?: DownloadProgressPayload;
  error?: string;
}

/** Fetches official album cover art via iTunes and synchronized/plain lyrics via LRCLIB */
async function resolveMetadataAndLyrics(query: string): Promise<{
  cover?: string;
  lyrics?: string[];
  syncedLyrics?: string;
  artist?: string;
  title?: string;
}> {
  let cover: string | undefined;
  let lyrics: string[] | undefined;
  let syncedLyrics: string | undefined;
  let artist: string | undefined;
  let title: string | undefined;

  const clean = query
    .replace(/[\(\[](?:official|music|video|audio|lyrics|hd|4k|visualizer|acoustic|remastered)[^\)\]]*[\)\]]/gi, "")
    .replace(/ft\.|feat\./gi, "")
    .trim();

  // Try iTunes Search API for official 800x800 album art
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&entity=song&limit=1`);
    if (res.ok) {
      const data = await res.json();
      if (data.results?.[0]) {
        const it = data.results[0];
        cover = (it.artworkUrl100 || "").replace("100x100bb", "800x800bb");
        artist = it.artistName;
        title = it.trackName;
      }
    }
  } catch {}

  // Try LRCLIB for synced & plain lyrics
  try {
    const lrcUrl = artist && title
      ? `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
      : `https://lrclib.net/api/search?q=${encodeURIComponent(clean)}`;

    const lrcRes = await fetch(lrcUrl);
    if (lrcRes.ok) {
      const lrcData = await lrcRes.json();
      const match = Array.isArray(lrcData) ? lrcData[0] : lrcData;
      if (match) {
        if (match.syncedLyrics) {
          syncedLyrics = match.syncedLyrics;
          lyrics = match.syncedLyrics
            .split("\n")
            .map((l: string) => l.replace(/\[\d+:\d+\.\d+\]/, "").trim())
            .filter(Boolean);
        } else if (match.plainLyrics) {
          lyrics = match.plainLyrics.split("\n").map((l: string) => l.trim()).filter(Boolean);
        }
      }
    }
  } catch {}

  return { cover, lyrics, syncedLyrics, artist, title };
}

export function YouTubeDownloaderTab({
  onPlayVideo,
}: {
  onPlayVideo?: (filePath: string) => void;
}) {
  const { playExternal, addLocalTrack, addDesktopVideos } = usePlayer();
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<"audio" | "video">("audio");
  const [customFolder, setCustomFolder] = useState<string>("");
  const [defaultMusicDir, setDefaultMusicDir] = useState<string>("");
  const [defaultVideoDir, setDefaultVideoDir] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<DownloadProgressPayload | null>(null);

  const [history, setHistory] = useState<DownloadHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem("audenic_yt_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("audenic_yt_history", JSON.stringify(history));
    } catch {}
  }, [history]);

  // Load default directories
  useEffect(() => {
    if (!isDesktop()) return;
    getDefaultDownloadDirs()
      .then(([music, video]) => {
        setDefaultMusicDir(music);
        setDefaultVideoDir(video);
      })
      .catch((err) => console.warn("Failed to get download dirs:", err));
  }, []);

  // Listen for real-time download progress events
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenComplete: (() => void) | undefined;

    listenTauri<DownloadProgressPayload>("yt-download-progress", (payload) => {
      setCurrentProgress(payload);
      setHistory((prev) =>
        prev.map((item) =>
          item.url === payload.url
            ? { ...item, progress: payload, status: "downloading" }
            : item
        )
      );
    }).then((un) => {
      unlistenProgress = un;
    });

    listenTauri<DownloadCompletePayload>("yt-download-complete", async (payload) => {
      setIsDownloading(false);
      setCurrentProgress(null);

      let resolvedCover: string | undefined;
      let lyrics: string[] | undefined;
      let syncedLyrics: string | undefined;
      let resolvedArtist: string | undefined;

      const titleQuery = payload.title || "";
      if (titleQuery && payload.success) {
        try {
          const meta = await resolveMetadataAndLyrics(titleQuery);
          if (meta.cover) resolvedCover = meta.cover;
          if (meta.lyrics) lyrics = meta.lyrics;
          if (meta.syncedLyrics) syncedLyrics = meta.syncedLyrics;
          if (meta.artist) resolvedArtist = meta.artist;
        } catch (e) {
          console.warn("Could not fetch online metadata:", e);
        }
      }

      const finalCover = resolvedCover || (payload.thumbnail_path ? toAssetUrl(payload.thumbnail_path) : undefined);

      if (payload.success && payload.file_path) {
        if (payload.media_type === "audio") {
          addLocalTrack({
            id: `yt-${Date.now()}`,
            title: payload.title || titleQuery || "YouTube Track",
            artist: resolvedArtist || "YouTube Download",
            album: "Audenic Downloads",
            cover: finalCover || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80",
            src: toAssetUrl(payload.file_path),
            songs: 1,
            source: "local",
            tags: ["youtube", "download"],
            duration: 0,
            lyrics,
          });
        } else {
          addDesktopVideos([{
            id: `yt-vid-${Date.now()}`,
            title: payload.title || titleQuery || "YouTube Video",
            src: toAssetUrl(payload.file_path),
            cover: finalCover || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600",
            size: 0,
            kind: "video",
          }]);
        }
      }

      setHistory((prev) =>
        prev.map((item) =>
          item.url === payload.url
            ? {
                ...item,
                status: payload.success ? "completed" : "error",
                filePath: payload.file_path,
                title: payload.title || item.title,
                artist: resolvedArtist || "YouTube Download",
                thumbnailPath: payload.thumbnail_path,
                coverUrl: finalCover,
                lyrics,
                syncedLyrics,
                error: payload.error,
              }
            : item
        )
      );
    }).then((un) => {
      unlistenComplete = un;
    });

    return () => {
      unlistenProgress?.();
      unlistenComplete?.();
    };
  }, []);

  // Dedicated settings & persistent preferences
  const [customMusicFolder, setCustomMusicFolder] = useState<string>(() => {
    return localStorage.getItem("audenic_yt_music_dir") || "";
  });
  const [customVideoFolder, setCustomVideoFolder] = useState<string>(() => {
    return localStorage.getItem("audenic_yt_video_dir") || "";
  });
  const [audioQuality, setAudioQuality] = useState<"320k" | "192k" | "128k">(() => {
    return (localStorage.getItem("audenic_yt_audio_quality") as any) || "320k";
  });
  const [videoQuality, setVideoQuality] = useState<"1080p" | "720p" | "480p">(() => {
    return (localStorage.getItem("audenic_yt_video_quality") as any) || "1080p";
  });
  const [autoLyrics, setAutoLyrics] = useState<boolean>(() => {
    return localStorage.getItem("audenic_yt_auto_lyrics") !== "false";
  });
  const [autoPlay, setAutoPlay] = useState<boolean>(() => {
    return localStorage.getItem("audenic_yt_auto_play") === "true";
  });

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState("");

  useEffect(() => {
    localStorage.setItem("audenic_yt_audio_quality", audioQuality);
  }, [audioQuality]);

  useEffect(() => {
    localStorage.setItem("audenic_yt_video_quality", videoQuality);
  }, [videoQuality]);

  const [isBulk, setIsBulk] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [convertNotice, setConvertNotice] = useState<string | null>(null);

  const handlePickCustomFolder = async () => {
    const f = await pickFolder();
    if (f) {
      setCustomFolder(f);
      if (format === "audio") {
        setCustomMusicFolder(f);
        localStorage.setItem("audenic_yt_music_dir", f);
      } else {
        setCustomVideoFolder(f);
        localStorage.setItem("audenic_yt_video_dir", f);
      }
    }
  };

  const handleConvertVideo = async (filePath: string) => {
    if (!isDesktop()) return;
    setIsConverting(true);
    setConvertNotice("Extracting crystal-clear MP3 with FFmpeg...");
    try {
      const destFolder = customFolder || defaultMusicDir;
      const mp3Path = await convertVideoToAudio(filePath, destFolder, audioQuality);
      const filename = mp3Path.split(/[\\/]/).pop() || "converted.mp3";
      const title = filename.replace(/\.[^/.]+$/, "");

      const newItem: DownloadHistoryItem = {
        id: `conv-${Date.now()}`,
        url: `file://${mp3Path}`,
        title,
        artist: "Converted MP3",
        format: "audio",
        filePath: mp3Path,
        timestamp: Date.now(),
        status: "completed",
      };
      setHistory((prev) => [newItem, ...prev]);
      setConvertNotice("✔ MP3 conversion complete! Added to library.");
      setTimeout(() => setConvertNotice(null), 3500);
    } catch (err: any) {
      console.error("Conversion failed:", err);
      setConvertNotice(`Conversion failed: ${err}`);
      setTimeout(() => setConvertNotice(null), 4000);
    } finally {
      setIsConverting(false);
    }
  };

  const handlePickAndConvertLocal = async () => {
    if (!isDesktop()) return;
    const files = await pickVideoFiles();
    if (files.length > 0) {
      await handleConvertVideo(files[0]);
    }
  };

  const handleStartBulkDownload = async () => {
    const lines = bulkUrls
      .split(/[\n,]/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("http://") || l.startsWith("https://"));

    if (!lines.length) return;

    // Immediately wipe bulk textarea so user can move on pasting more
    setBulkUrls("");

    // Deduplicate within the batch
    const uniqueBatch = lines.filter((u, idx, arr) => arr.indexOf(u) === idx);

    // Check for already completed downloads
    const alreadyDownloaded = uniqueBatch.filter((u) =>
      history.some((h) => h.url === u && h.status === "completed")
    );
    const toDownload = uniqueBatch.filter(
      (u) => !history.some((h) => h.url === u && h.status === "completed")
    );

    if (alreadyDownloaded.length > 0) {
      setConvertNotice(`Skipped ${alreadyDownloaded.length} duplicate URL(s) already downloaded.`);
      setTimeout(() => setConvertNotice(null), 3500);
    }

    if (!toDownload.length) {
      setConvertNotice(`ℹ All ${uniqueBatch.length} URL(s) were already downloaded earlier.`);
      setTimeout(() => setConvertNotice(null), 4000);
      return;
    }

    setIsDownloading(true);
    const destFolder =
      customFolder || (format === "audio" ? defaultMusicDir : defaultVideoDir);

    let successCount = 0;
    for (let i = 0; i < toDownload.length; i++) {
      const currentUrl = toDownload[i];
      const newItem: DownloadHistoryItem = {
        id: `dl-${Date.now()}-${i}`,
        url: currentUrl,
        title: currentUrl,
        format,
        timestamp: Date.now(),
        status: "downloading",
      };
      setHistory((prev) => [newItem, ...prev]);
      setCurrentProgress({
        url: currentUrl,
        percent: 0,
        speed: `Batch ${i + 1}/${toDownload.length}`,
        eta: "--",
        status: `Downloading item ${i + 1} of ${toDownload.length}...`,
      });

      try {
        const res = await downloadYouTubeMedia({
          url: currentUrl,
          format,
          quality: format === "audio" ? audioQuality : videoQuality,
          output_folder: destFolder,
        });
        if (res.success) successCount++;
      } catch (err) {
        console.warn(`Bulk download error on item ${i + 1}:`, err);
      }
    }

    setIsDownloading(false);
    setCurrentProgress(null);
    setConvertNotice(`Download batch complete: ${successCount} item(s) saved to library.`);
    setTimeout(() => setConvertNotice(null), 6000);
  };

  const handleStartDownload = async () => {
    if (isBulk) {
      return handleStartBulkDownload();
    }

    const trimmed = url.trim();
    if (!trimmed) return;

    // Check duplicate
    const alreadyDone = history.find(
      (h) => h.url === trimmed && h.status === "completed"
    );
    if (alreadyDone) {
      if (!window.confirm(`"${alreadyDone.title}" was already downloaded earlier. Download again?`)) {
        return;
      }
    }

    const destFolder =
      customFolder || (format === "audio" ? defaultMusicDir : defaultVideoDir);

    const newItem: DownloadHistoryItem = {
      id: `dl-${Date.now()}`,
      url: trimmed,
      title: trimmed,
      format,
      timestamp: Date.now(),
      status: "downloading",
    };

    setHistory((prev) => [newItem, ...prev]);
    setIsDownloading(true);
    setCurrentProgress({
      url: trimmed,
      percent: 0,
      speed: "Initializing...",
      eta: "--",
      status: "Connecting to YouTube...",
    });

    try {
      const res = await downloadYouTubeMedia({
        url: trimmed,
        format,
        quality: format === "audio" ? audioQuality : videoQuality,
        output_folder: destFolder,
      });

      if (res.success && res.file_path) {
        setUrl("");
        setConvertNotice(`✔ Download finished! Added to your library.`);
        setTimeout(() => setConvertNotice(null), 4500);
      }
    } catch (err: any) {
      console.error("Download failed:", err);
      setConvertNotice(`Download error: ${err}`);
      setTimeout(() => setConvertNotice(null), 5000);
      setIsDownloading(false);
      setCurrentProgress(null);
    }
  };

  const handlePlayDownloaded = (item: DownloadHistoryItem) => {
    if (!item.filePath) return;
    if (item.format === "audio") {
      const resolvedCover =
        item.coverUrl ||
        (item.thumbnailPath ? toAssetUrl(item.thumbnailPath) : "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80");

      playExternal({
        id: `yt-download-${item.id}`,
        title: item.title,
        artist: item.artist || "YouTube Download",
        album: "Audenic Downloads",
        url: toAssetUrl(item.filePath),
        cover: resolvedCover,
        duration: 0,
        lyrics: item.lyrics,
      });
    } else {
      onPlayVideo?.(item.filePath);
    }
  };

  const handleDeleteItem = (id: string) => {
    setHistory((prev) => prev.filter((it) => it.id !== id));
  };

  const activeDestination =
    format === "audio"
      ? (customMusicFolder || customFolder || defaultMusicDir)
      : (customVideoFolder || customFolder || defaultVideoDir);

  const bulkCount = bulkUrls
    .split(/[\n,]/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("http://") || l.startsWith("https://")).length;

  const filteredHistory = history.filter((item) => {
    if (!searchHistoryQuery.trim()) return true;
    const q = searchHistoryQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.artist && item.artist.toLowerCase().includes(q)) ||
      item.format.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full w-full flex-col gap-4 text-white min-h-0 overflow-hidden">
      {/* Dedicated YouTube Downloader Settings Modal */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fade-in"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#0F0F14] p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)]/20 text-[var(--accent)] shadow-md">
                  <Gear size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">YouTube Studio Preferences & Paths</h3>
                  <p className="text-[11px] text-white/50">Configure default qualities, folder destinations & metadata</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="grid h-8 w-8 place-items-center rounded-xl text-white/40 hover:bg-white/10 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Audio Settings */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-white/60">
                Default Audio Quality (MP3)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "320k", label: "320 kbps", desc: "Studio Master" },
                  { id: "192k", label: "192 kbps", desc: "High Quality" },
                  { id: "128k", label: "128 kbps", desc: "Standard" },
                ].map((q) => (
                  <button
                    key={q.id}
                    onClick={() => setAudioQuality(q.id as any)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition ${
                      audioQuality === q.id
                        ? "border-[var(--accent)] bg-[var(--accent)]/15 text-white shadow"
                        : "border-white/8 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="text-xs font-bold">{q.label}</span>
                    <span className="text-[10px] text-white/40">{q.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Video Settings */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-white/60">
                Default Video Quality (MP4)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "1080p", label: "1080p", desc: "Full HD" },
                  { id: "720p", label: "720p", desc: "Standard HD" },
                  { id: "480p", label: "480p", desc: "Fast SD" },
                ].map((q) => (
                  <button
                    key={q.id}
                    onClick={() => setVideoQuality(q.id as any)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition ${
                      videoQuality === q.id
                        ? "border-purple-500 bg-purple-500/15 text-white shadow"
                        : "border-white/8 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="text-xs font-bold">{q.label}</span>
                    <span className="text-[10px] text-white/40">{q.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Folder Paths */}
            <div className="space-y-3 pt-1 border-t border-white/[0.06]">
              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">
                  Music Download Folder
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-mono text-white/80 truncate">
                    {customMusicFolder || defaultMusicDir || "Default Windows Music folder"}
                  </div>
                  <button
                    onClick={async () => {
                      const f = await pickFolder();
                      if (f) {
                        setCustomMusicFolder(f);
                        localStorage.setItem("audenic_yt_music_dir", f);
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 transition shrink-0"
                  >
                    <Folder size={14} /> Browse
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">
                  Video / Course Download Folder
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-mono text-white/80 truncate">
                    {customVideoFolder || defaultVideoDir || "Default Windows Video folder"}
                  </div>
                  <button
                    onClick={async () => {
                      const f = await pickFolder();
                      if (f) {
                        setCustomVideoFolder(f);
                        localStorage.setItem("audenic_yt_video_dir", f);
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 transition shrink-0"
                  >
                    <Folder size={14} /> Browse
                  </button>
                </div>
              </div>
            </div>

            {/* Features Toggles */}
            <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">Auto-Fetch Album Art & Synced Lyrics</p>
                  <p className="text-[10px] text-white/40">Query iTunes & LRCLIB for lyrics and 800x800 artwork</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoLyrics}
                  onChange={(e) => {
                    setAutoLyrics(e.target.checked);
                    localStorage.setItem("audenic_yt_auto_lyrics", String(e.target.checked));
                  }}
                  className="h-4 w-4 accent-[var(--accent)] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">Auto-Play When Download Completes</p>
                  <p className="text-[10px] text-white/40">Immediately start playing freshly downloaded song or video</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoPlay}
                  onChange={(e) => {
                    setAutoPlay(e.target.checked);
                    localStorage.setItem("audenic_yt_auto_play", String(e.target.checked));
                  }}
                  className="h-4 w-4 accent-[var(--accent)] cursor-pointer"
                />
              </div>
            </div>

            {/* Done Button */}
            <div className="pt-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-xs font-bold text-black hover:opacity-90 transition"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Downloader Studio Card - Collapsible */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0A0A0D]/80 backdrop-blur-md transition-all duration-200 shrink-0 overflow-hidden">
        {isHeaderCollapsed ? (
          /* Ultra-compact collapsed bar */
          <div className="flex items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#E81123] to-[#FF61C7] text-white shadow-md">
                <Download size={16} />
              </div>
              <span className="text-xs font-bold text-white hidden sm:inline">YouTube Studio</span>
            </div>

            <div className="flex flex-1 items-center gap-2 max-w-2xl">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube URL..."
                disabled={isDownloading}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder-white/35 outline-none transition focus:border-[var(--accent)]"
              />
              <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.04] p-0.5 text-[11px]">
                <button
                  onClick={() => setFormat("audio")}
                  className={`rounded px-2 py-1 font-semibold transition ${
                    format === "audio" ? "bg-[var(--accent)] text-black" : "text-white/60"
                  }`}
                >
                  MP3
                </button>
                <button
                  onClick={() => setFormat("video")}
                  className={`rounded px-2 py-1 font-semibold transition ${
                    format === "video" ? "bg-[var(--accent)] text-black" : "text-white/60"
                  }`}
                >
                  MP4
                </button>
              </div>
              <button
                onClick={handleStartDownload}
                disabled={isDownloading || !url.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-black hover:opacity-90 active:scale-95 disabled:opacity-40 transition shrink-0"
              >
                <Download size={14} />
                {isDownloading ? "..." : "Download"}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="grid h-7 w-7 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition"
                title="Download Settings & Paths"
              >
                <Gear size={15} />
              </button>
              <button
                onClick={() => setIsHeaderCollapsed(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition"
                title="Expand Downloader Studio Header"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* Full Header View */
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#E81123] to-[#FF61C7] text-white shadow-lg">
                  <Download size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    YouTube Media Studio Pro
                  </h2>
                  <p className="text-xs text-white/50">
                    High-speed MP3/MP4 downloader with automatic album art & synced lyrics
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Convert MP4 to MP3 */}
                <button
                  onClick={handlePickAndConvertLocal}
                  disabled={isConverting}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-bold text-[var(--accent)] transition hover:bg-[var(--accent)]/20 active:scale-95 disabled:opacity-50"
                  title="Pick video file on PC and extract 320kbps MP3 audio"
                >
                  <Music size={13} />
                  {isConverting ? "Converting..." : "Convert MP4 to MP3"}
                </button>

                {/* Bulk mode toggle */}
                <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.04] p-1 text-xs">
                  <button
                    onClick={() => setIsBulk(false)}
                    className={`rounded-lg px-2.5 py-1 font-medium transition ${
                      !isBulk ? "bg-[var(--accent)] text-black font-bold" : "text-white/60 hover:text-white"
                    }`}
                  >
                    Single URL
                  </button>
                  <button
                    onClick={() => setIsBulk(true)}
                    className={`rounded-lg px-2.5 py-1 font-medium transition ${
                      isBulk ? "bg-[var(--accent)] text-black font-bold" : "text-white/60 hover:text-white"
                    }`}
                  >
                    Bulk Links
                  </button>
                </div>

                {/* Dedicated Settings Button */}
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition"
                  title="Configure download paths and quality defaults"
                >
                  <Gear size={14} />
                  Settings
                </button>

                {/* Collapse Button */}
                <button
                  onClick={() => setIsHeaderCollapsed(true)}
                  className="grid h-8 w-8 place-items-center rounded-xl text-white/40 hover:bg-white/10 hover:text-white transition"
                  title="Collapse header for maximum recent downloads view"
                >
                  <ChevronUp size={16} />
                </button>
              </div>
            </div>

            {convertNotice && (
              <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)] animate-fade-in">
                {convertNotice}
              </div>
            )}

            {/* Input Box */}
            <div className="flex flex-col gap-3">
              {!isBulk ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste YouTube Video or Music URL (e.g. https://www.youtube.com/watch?v=...)"
                    disabled={isDownloading}
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-white/35 outline-none transition focus:border-[var(--accent)] focus:bg-white/[0.07]"
                  />
                  <button
                    onClick={handleStartDownload}
                    disabled={isDownloading || !url.trim()}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-black transition hover:opacity-90 active:scale-95 disabled:opacity-40"
                  >
                    <Download size={16} />
                    {isDownloading ? "Downloading..." : "Start Download"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <textarea
                    rows={3}
                    value={bulkUrls}
                    onChange={(e) => setBulkUrls(e.target.value)}
                    placeholder="Paste multiple YouTube links here (one URL per line or separated by commas)..."
                    disabled={isDownloading}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white placeholder-white/35 outline-none transition focus:border-[var(--accent)] focus:bg-white/[0.07]"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">
                      {bulkCount} valid link{bulkCount === 1 ? "" : "s"} detected
                    </span>
                    <button
                      onClick={handleStartBulkDownload}
                      disabled={isDownloading || bulkCount === 0}
                      className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2 text-sm font-bold text-black transition hover:opacity-90 active:scale-95 disabled:opacity-40"
                    >
                      <Download size={16} />
                      {isDownloading ? "Downloading Batch..." : `Download All (${bulkCount})`}
                    </button>
                  </div>
                </div>
              )}

              {/* Streamlined Quick Options Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs">
                {/* Format selection */}
                <div className="flex items-center gap-2">
                  <span className="text-white/50 font-semibold">Format:</span>
                  <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
                    <button
                      onClick={() => setFormat("audio")}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition ${
                        format === "audio"
                          ? "bg-[var(--accent)] text-black font-bold"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      <Music size={12} />
                      MP3
                    </button>
                    <button
                      onClick={() => setFormat("video")}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition ${
                        format === "video"
                          ? "bg-[var(--accent)] text-black font-bold"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      <Film size={12} />
                      MP4
                    </button>
                  </div>
                </div>

                {/* Quality selection */}
                <div className="flex items-center gap-2">
                  <span className="text-white/50 font-semibold">Quality:</span>
                  {format === "audio" ? (
                    <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.04] p-0.5 font-mono text-[11px]">
                      {(["320k", "192k", "128k"] as const).map((q) => (
                        <button
                          key={q}
                          onClick={() => setAudioQuality(q)}
                          className={`rounded px-2 py-1 font-semibold transition ${
                            audioQuality === q
                              ? "bg-white/20 text-white font-bold"
                              : "text-white/50 hover:text-white"
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.04] p-0.5 font-mono text-[11px]">
                      {(["1080p", "720p", "480p"] as const).map((q) => (
                        <button
                          key={q}
                          onClick={() => setVideoQuality(q)}
                          className={`rounded px-2 py-1 font-semibold transition ${
                            videoQuality === q
                              ? "bg-white/20 text-white font-bold"
                              : "text-white/50 hover:text-white"
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Folder Path & Change Button */}
                <div className="flex items-center gap-2">
                  <span className="text-white/40">Folder:</span>
                  <span className="rounded-lg bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-white/70 truncate max-w-[200px]" title={activeDestination}>
                    {activeDestination.split(/[\\/]/).pop() || "Default"}
                  </span>
                  <button
                    onClick={handlePickCustomFolder}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/80 hover:bg-white/10 transition"
                  >
                    <Folder size={12} />
                    Change
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Download Progress Card */}
      {isDownloading && currentProgress && (
        <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white">
              {currentProgress.status}
            </span>
            <div className="flex items-center gap-3 font-mono text-[11px] text-white/70">
              <span>⚡ {currentProgress.speed}</span>
              <span>⏳ ETA: {currentProgress.eta}</span>
              <span className="font-bold text-[var(--accent)]">
                {Math.round(currentProgress.percent)}%
              </span>
            </div>
          </div>

          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-200"
              style={{ width: `${Math.max(5, currentProgress.percent)}%` }}
            />
          </div>
        </div>
      )}

      {/* Download History & Queue - Rich Preview and Expanded Space */}
      <div className="flex flex-1 flex-col rounded-2xl border border-white/[0.06] bg-[#0A0A0D]/70 p-4 sm:p-5 overflow-hidden min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Recent Downloads ({filteredHistory.length})
            </h3>
            {history.length > 0 && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60 font-mono">
                {history.length} total
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {history.length > 2 && (
              <div className="relative flex items-center">
                <Search size={13} className="absolute left-2.5 text-white/40 pointer-events-none" />
                <input
                  type="text"
                  value={searchHistoryQuery}
                  onChange={(e) => setSearchHistoryQuery(e.target.value)}
                  placeholder="Filter downloads..."
                  className="w-40 sm:w-56 rounded-xl border border-white/10 bg-white/[0.04] pl-8 pr-2.5 py-1 text-xs text-white placeholder-white/30 outline-none focus:border-[var(--accent)] transition"
                />
              </div>
            )}

            {history.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm("Clear all download history? (Downloaded files on disk will NOT be deleted)")) {
                    setHistory([]);
                  }
                }}
                className="text-xs text-white/40 hover:text-rose-400 transition"
              >
                Clear History
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-1 min-h-0">
          {filteredHistory.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center text-xs text-white/40">
              <Download size={32} className="mb-2 text-white/20" />
              <p>{searchHistoryQuery ? "No matching downloads found." : "No downloads yet."}</p>
              <p className="pt-1 text-white/30">
                Paste any YouTube URL above to download tracks or courses.
              </p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const hasThumbnail = Boolean(item.coverUrl || item.thumbnailPath);
              const thumbSrc = item.coverUrl || (item.thumbnailPath ? toAssetUrl(item.thumbnailPath) : "");

              return (
                <div
                  key={item.id}
                  className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 transition hover:border-white/10 hover:bg-white/[0.05]"
                >
                  {/* Left: Thumbnail & Info */}
                  <div className="flex items-center gap-3.5 overflow-hidden min-w-[240px] flex-1">
                    {/* Thumbnail with quick hover play overlay */}
                    <div
                      onClick={() => handlePlayDownloaded(item)}
                      className="group/thumb relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-md"
                    >
                      {hasThumbnail ? (
                        <img
                          src={thumbSrc}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-white/60">
                          {item.format === "audio" ? <Music size={20} /> : <Film size={20} />}
                        </div>
                      )}
                      <div className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover/thumb:opacity-100">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent)] text-black shadow-lg">
                          <Play size={13} className="ml-0.5" />
                        </span>
                      </div>
                    </div>

                    {/* Metadata Details */}
                    <div className="overflow-hidden min-w-0 flex-1">
                      <p
                        className="truncate text-xs font-semibold text-white group-hover:text-[var(--accent)] transition cursor-pointer"
                        title={item.title}
                        onClick={() => handlePlayDownloaded(item)}
                      >
                        {item.title}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {/* Format Badge */}
                        <span
                          className={`rounded-md px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${
                            item.format === "audio"
                              ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30"
                              : "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                          }`}
                        >
                          {item.format}
                        </span>

                        {/* Status */}
                        {item.status === "completed" && (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)]">
                            <CheckCircle size={12} /> Ready
                          </span>
                        )}

                        {item.status === "downloading" && (
                          <span className="text-[11px] font-mono text-[var(--accent)] animate-pulse">
                            Downloading...
                          </span>
                        )}

                        {item.status === "error" && (
                          <span className="text-[11px] text-red-400">
                            Failed: {item.error || "Error"}
                          </span>
                        )}

                        {/* Timestamp */}
                        <span className="text-[10px] text-white/35 font-mono">
                          {new Date(item.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })} • {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>

                        {/* Lyrics Badge */}
                        {item.lyrics && item.lyrics.length > 0 && (
                          <span className="rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 px-2 py-0.2 text-[9px] font-bold text-[var(--accent)]">
                            Lyrics
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === "completed" && (
                      <>
                        {item.format === "video" && item.filePath && isDesktop() && (
                          <button
                            onClick={() => handleConvertVideo(item.filePath!)}
                            disabled={isConverting}
                            className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 active:scale-95 transition disabled:opacity-50"
                            title="Extract 320kbps MP3 audio from this video"
                          >
                            <Music size={12} />
                            To MP3
                          </button>
                        )}

                        <button
                          onClick={() => handlePlayDownloaded(item)}
                          className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-black hover:opacity-90 active:scale-95 transition shadow-md"
                        >
                          <Play size={13} className="ml-0.5" />
                          Play Now
                        </button>

                        {item.filePath && (
                          <button
                            onClick={() => openInExplorer(item.filePath!)}
                            className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
                            title="Reveal in Windows File Explorer"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                      </>
                    )}

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/40 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30 transition"
                      title="Remove from history"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

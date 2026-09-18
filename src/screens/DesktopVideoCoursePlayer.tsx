import { useEffect, useRef, useState, useCallback } from "react";
import {
  toAssetUrl,
  openInExplorer,
} from "../player/tauriBridge";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Folder,
  Film,
  Sparkles,
  Clock,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronUp,
  Disc,
} from "../components/Icons";
import { useCourseVideo } from "../player/CourseVideoContext";

export function DesktopVideoCoursePlayer() {
  const {
    videos,
    activeVideo,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    playNext,
    playPrev,
    deleteVideo,
    scanFolder,
    pickFiles,
    isScanning,
    progressMemory,
    setProgressMemory,
    bookmarks,
    addBookmark,
    removeBookmark,
    isAudioOnly,
    toggleAudioOnly,
  } = useCourseVideo();

  const [volume, setVolume] = useState(0.85);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newBookmarkNote, setNewBookmarkNote] = useState("");
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 5000);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      resetHideTimer();
    }
  }, [isPlaying, resetHideTimer]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Sync video play/pause with context state
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying && v.paused) {
      v.play().catch(() => {});
    } else if (!isPlaying && !v.paused) {
      v.pause();
    }
  }, [isPlaying]);

  // Video time tracking and auto-resume
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const handleLoadedMetadata = () => {
      setDuration(v.duration || 0);
      // Auto-resume where user left off
      if (activeVideo) {
        const savedTime = progressMemory[activeVideo.id];
        if (savedTime && savedTime > 5 && savedTime < v.duration - 10) {
          v.currentTime = savedTime;
        }
      }
      v.playbackRate = playbackRate;
      if (isPlaying) {
        v.play().catch(() => {});
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      if (activeVideo && Math.floor(v.currentTime) % 3 === 0) {
        setProgressMemory((prev) => ({
          ...prev,
          [activeVideo.id]: v.currentTime,
        }));
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      playNext();
    };

    v.addEventListener("loadedmetadata", handleLoadedMetadata);
    v.addEventListener("timeupdate", handleTimeUpdate);
    v.addEventListener("ended", handleEnded);

    return () => {
      v.removeEventListener("loadedmetadata", handleLoadedMetadata);
      v.removeEventListener("timeupdate", handleTimeUpdate);
      v.removeEventListener("ended", handleEnded);
    };
  }, [activeVideo, playbackRate]);

  // Playback hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const v = videoRef.current;
      if (!v) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        playNext();
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        playPrev();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 5);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        v.currentTime = Math.max(0, v.currentTime - 5);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        setVolume((prev) => Math.min(1, prev + 0.05));
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        setVolume((prev) => Math.max(0, prev - 0.05));
      } else if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      } else if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        toggleAudioOnly();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "[") {
        e.preventDefault();
        changeSpeed(-0.25);
      } else if (e.key === "]") {
        e.preventDefault();
        changeSpeed(0.25);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeVideo, isPlaying, playNext, playPrev]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const changeSpeed = (delta: number) => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5];
    const currentIndex = speeds.indexOf(playbackRate);
    if (delta > 0 && currentIndex < speeds.length - 1) {
      const nextSpeed = speeds[currentIndex + 1];
      setPlaybackRate(nextSpeed);
      if (videoRef.current) videoRef.current.playbackRate = nextSpeed;
    } else if (delta < 0 && currentIndex > 0) {
      const prevSpeed = speeds[currentIndex - 1];
      setPlaybackRate(prevSpeed);
      if (videoRef.current) videoRef.current.playbackRate = prevSpeed;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) videoRef.current.currentTime = val;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await v.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("PiP error:", err);
    }
  };

  const handleSaveBookmark = () => {
    if (!newBookmarkNote.trim()) return;
    addBookmark(newBookmarkNote.trim());
    setNewBookmarkNote("");
  };

  const formatTime = (s: number) => {
    if (isNaN(s) || s <= 0) return "0:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = Math.floor(s % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? "0" : ""}${m}:${r < 10 ? "0" : ""}${r}`;
    }
    return `${m}:${r < 10 ? "0" : ""}${r}`;
  };

  const activeBookmarks = (activeVideo && bookmarks[activeVideo.id]) || [];

  return (
    <div className="flex h-full w-full flex-col gap-4 text-white min-h-0">
      {/* Top Header Bar - Collapsible to give video maximum vertical height */}
      <div className={`flex shrink-0 items-center justify-between gap-2 rounded-2xl border border-white/[0.06] bg-[#0A0A0D]/80 backdrop-blur-md transition-all duration-200 ${
        isHeaderCollapsed ? "px-3 py-1.5" : "flex-wrap p-3.5 gap-3"
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`grid place-items-center rounded-xl bg-gradient-to-br from-[#8B3BFF] to-[#3B6BFF] text-white shadow-lg transition-all ${
            isHeaderCollapsed ? "h-7 w-7" : "h-10 w-10"
          }`}>
            <Film size={isHeaderCollapsed ? 14 : 20} />
          </div>
          <div>
            <h2 className={`font-bold text-white transition-all ${isHeaderCollapsed ? "text-xs" : "text-base"}`}>
              Course & Video Studio
            </h2>
            {!isHeaderCollapsed && (
              <p className="text-xs text-white/50">
                Hardware-accelerated playback • Course Hierarchy in right panel • Zero interference
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={scanFolder}
            disabled={isScanning}
            className={`flex items-center gap-1.5 rounded-xl bg-[var(--accent)] font-bold text-black transition hover:opacity-90 active:scale-95 disabled:opacity-50 ${
              isHeaderCollapsed ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-2 text-xs"
            }`}
          >
            <Folder size={isHeaderCollapsed ? 13 : 15} />
            {isScanning ? "Scanning..." : isHeaderCollapsed ? "Scan" : "Scan Course Folder"}
          </button>

          <button
            onClick={pickFiles}
            className={`flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] font-semibold text-white/90 transition hover:bg-white/10 active:scale-95 ${
              isHeaderCollapsed ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-2 text-xs"
            }`}
          >
            <Film size={isHeaderCollapsed ? 13 : 15} />
            {isHeaderCollapsed ? "Open" : "Open Video File"}
          </button>

          <button
            onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
            className="grid h-7 w-7 place-items-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition ml-1"
            title={isHeaderCollapsed ? "Expand Studio Banner" : "Collapse banner for larger video preview"}
          >
            {isHeaderCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {/* Main Container: Full Width Video Canvas & Learning Notes */}
      <div className="flex flex-1 flex-col gap-3 min-h-0 overflow-y-auto pr-1">
        {/* Full-width Video Container */}
        <div
          ref={containerRef}
          onMouseMove={resetHideTimer}
          onMouseEnter={resetHideTimer}
          className={`group relative flex aspect-video w-full flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shrink-0 ${
            !controlsVisible && isPlaying ? "cursor-none" : ""
          }`}
        >
          {/* Overlaid Top Video Details */}
          {activeVideo && (
            <div
              className={`absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent p-4 transition-opacity duration-300 ${
                controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 pr-4">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#8B3BFF] to-[#3B6BFF] text-white shrink-0 shadow-md">
                  <Film size={16} />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-white drop-shadow">
                    {activeVideo.title}
                  </h3>
                  <p className="truncate text-xs text-white/60">
                    {activeVideo.folder_name ? `${activeVideo.folder_name} • ` : ""}
                    <span className="font-mono text-white/50">{formatTime(currentTime)} / {formatTime(duration)}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded-lg bg-white/10 border border-white/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[var(--accent)]">
                  {isAudioOnly ? "AUDIO ONLY" : "HD 1080p"}
                </span>
                <button
                  onClick={toggleFullscreen}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-black/40 text-white/80 hover:bg-white/15 hover:text-white transition"
                  title="Toggle Fullscreen (F)"
                >
                  {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                </button>
              </div>
            </div>
          )}

          {activeVideo ? (
            <>
              <video
                ref={videoRef}
                src={toAssetUrl(activeVideo.path)}
                onClick={togglePlay}
                className={`h-full w-full object-contain ${
                  isAudioOnly ? "opacity-0 pointer-events-none absolute inset-0" : "cursor-pointer"
                }`}
                playsInline
              />

              {isAudioOnly && (
                <div
                  onClick={togglePlay}
                  className="flex h-full w-full flex-col items-center justify-center p-8 text-center cursor-pointer select-none bg-gradient-to-b from-[#150d27] via-[#0A0A0D] to-[#0A0A0D]"
                >
                  <div className="relative mb-6">
                    <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-[#8B3BFF]/40 via-[var(--accent)]/30 to-[#3B6BFF]/25 blur-3xl animate-pulse" />
                    <div
                      className={`relative grid h-44 w-44 place-items-center rounded-full border-4 border-white/10 bg-black/80 shadow-2xl transition-transform ${
                        isPlaying ? "animate-spin duration-[8000ms]" : ""
                      }`}
                    >
                      <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[#8B3BFF] to-[#3B6BFF] text-white shadow-inner">
                        <Disc size={32} />
                      </div>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3.5 py-1 text-xs font-semibold text-[var(--accent)]">
                    <Sparkles size={14} />
                    <span>MP3 Audio-Only Mode Active</span>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-white max-w-lg truncate drop-shadow">
                    {activeVideo.title}
                  </h3>
                  <p className="mt-1 text-xs text-white/50 max-w-sm">
                    Decoding stream stopped for maximum battery & performance • Pure studio sound
                  </p>

                  <div className="mt-6 flex items-end gap-1.5 h-8">
                    {[35, 75, 55, 90, 65, 85, 45, 95, 70, 50, 80, 60, 90, 40].map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 rounded-full bg-gradient-to-t from-[var(--accent)] to-[#8B3BFF]"
                        style={{
                          height: isPlaying ? `${Math.max(15, h * 0.9)}%` : "15%",
                          animation: isPlaying ? `pulse 1.${(i % 5) + 2}s ease-in-out infinite alternate` : "none",
                          animationDelay: `${i * 60}ms`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-white/50">
              <Film size={48} className="text-white/20 mb-3" />
              <p className="text-base font-semibold text-white">No video loaded</p>
              <p className="text-xs text-white/40 mt-1 max-w-md">
                Click "Scan Course Folder" or "Open Video File" above to load your tutorials or lectures. The hierarchy is organized in the right sidebar.
              </p>
            </div>
          )}

          {/* Overlaid Bottom Controls */}
          {activeVideo && (
            <div
              className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-opacity duration-300 ${
                controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Progress Bar & Timestamp */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-white/75">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--accent)]"
                />
                <span className="text-[11px] font-mono text-white/75">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Control Buttons */}
              <div className="mt-3 flex items-center justify-between">
                {/* Left Controls */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={playPrev}
                    className="text-white/80 transition hover:text-white"
                    title="Previous (P)"
                  >
                    <SkipBack size={18} />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="grid h-9 w-9 place-items-center rounded-full bg-white text-black transition hover:scale-105 active:scale-95"
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                  </button>
                  <button
                    onClick={playNext}
                    className="text-white/80 transition hover:text-white"
                    title="Next (N)"
                  >
                    <SkipForward size={18} />
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-2 pl-2">
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="text-white/70 hover:text-white"
                    >
                      {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setVolume(val);
                        setIsMuted(false);
                        if (videoRef.current) videoRef.current.volume = val;
                      }}
                      className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--accent)]"
                    />
                  </div>
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-2.5">
                  {/* Speed Selector */}
                  <div className="flex items-center rounded-lg border border-white/10 bg-white/[0.08] px-2 py-0.5 text-xs font-semibold text-white">
                    <button
                      onClick={() => changeSpeed(-0.25)}
                      className="px-1 text-white/50 hover:text-white"
                      title="Speed Down ([)"
                    >
                      −
                    </button>
                    <span className="px-1 font-mono text-[11px] text-[var(--accent)]">
                      {playbackRate}x
                    </span>
                    <button
                      onClick={() => changeSpeed(0.25)}
                      className="px-1 text-white/50 hover:text-white"
                      title="Speed Up (])"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={toggleAudioOnly}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
                      isAudioOnly
                        ? "border-[var(--accent)] bg-[var(--accent)] text-black font-bold shadow-md"
                        : "border-white/10 bg-white/[0.08] text-white/80 hover:bg-white/20"
                    }`}
                    title="Toggle MP3 / Audio-Only Mode (A)"
                  >
                    {isAudioOnly ? "Audio Active" : "Audio Only"}
                  </button>

                  <button
                    onClick={togglePiP}
                    className="rounded-lg border border-white/10 bg-white/[0.08] px-2.5 py-1 text-xs text-white/80 transition hover:bg-white/20"
                    title="Picture in Picture (P)"
                  >
                    PiP
                  </button>

                  <button
                    onClick={toggleFullscreen}
                    className="rounded-lg border border-white/10 bg-white/[0.08] p-1.5 text-white/80 transition hover:bg-white/20"
                    title="Fullscreen (F)"
                  >
                    {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Active Video Title & Quick Actions */}
        {activeVideo && (
          <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-[#0A0A0D]/70 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                  {activeVideo.folder_name}
                </span>
                <h3 className="pt-1 text-base font-bold text-white">
                  {activeVideo.title}
                </h3>
                <p className="pt-0.5 text-xs text-white/40 font-mono truncate max-w-xl">
                  {activeVideo.path}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openInExplorer(activeVideo.path)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition"
                  title="Reveal in Windows Explorer"
                >
                  <ExternalLink size={13} />
                  Reveal File
                </button>

                <button
                  onClick={() => deleteVideo(activeVideo.id)}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/20 transition"
                  title="Remove this video from course studio"
                >
                  <Trash2 size={13} />
                  Remove
                </button>
              </div>
            </div>

            {/* Bookmark Creator */}
            <div className="flex items-center gap-2 border-t border-white/[0.06] pt-3">
              <span className="text-xs font-semibold text-white/60">
                Bookmark @ {formatTime(currentTime)}:
              </span>
              <input
                type="text"
                value={newBookmarkNote}
                onChange={(e) => setNewBookmarkNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveBookmark()}
                placeholder="Type a key takeaway or code timestamp..."
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={handleSaveBookmark}
                className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 active:scale-95"
              >
                Save Note
              </button>
            </div>

            {/* Saved Bookmarks List */}
            {activeBookmarks.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {activeBookmarks.map((bm, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-white/80 transition hover:border-[var(--accent)]"
                  >
                    <button
                      onClick={() => {
                        if (videoRef.current) videoRef.current.currentTime = bm.time;
                      }}
                      className="flex items-center gap-1.5 hover:text-white"
                    >
                      <Clock size={11} className="text-[var(--accent)]" />
                      <span className="font-mono text-[11px] font-bold text-[var(--accent)]">
                        {formatTime(bm.time)}
                      </span>
                      <span className="text-white/60 truncate max-w-[240px]">
                        {bm.note}
                      </span>
                    </button>
                    <button
                      onClick={() => removeBookmark(i)}
                      className="ml-1 text-white/30 hover:text-rose-400"
                      title="Delete bookmark"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

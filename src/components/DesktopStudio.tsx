import React, { useEffect, useState } from "react";
import { usePlayer } from "../player/PlayerContext";
import { useCourseVideo } from "../player/CourseVideoContext";
import type { Tab } from "./BottomBar";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Heart,
  Bot,
  Sliders,
  Maximize,
  Minimize,
  Radio,
  Music,
  Compass,
  Film,
  Settings as SettingsIcon,
  BarChart2,
  Award,
  Sparkles,
  Shield,
  BookOpen,
  Download,
  Disc,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronUp,
} from "./Icons";
import { MarqueeText } from "./Marquee";
import { isAdminEmail } from "../player/PlayerContext";
import { DesktopTitleBar } from "./DesktopTitleBar";

interface DesktopStudioProps {
  currentTab: Tab;
  currentOverlay?: string | null;
  onSelectTab: (tab: Tab) => void;
  onOpenOverlay: (overlayName: string) => void;
  viewMode: "desktop" | "mobile";
  onToggleViewMode: (mode: "desktop" | "mobile") => void;
  isPlayerOverlay?: boolean;
  onToggleMiniPlayer?: () => void;
  onOpenSimpleMode?: () => void;
  children: React.ReactNode;
}

function CourseHierarchyRightPanel({ onCollapse }: { onCollapse?: () => void }) {
  const {
    videos,
    activeVideo,
    selectedFolder,
    setSelectedFolder,
    folders,
    filteredVideos,
    selectVideo,
    deleteVideo,
    clearAllVideos,
    moveVideo,
    isPlaying,
  } = useCourseVideo();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-[var(--accent)]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            Course Hierarchy ({filteredVideos.length})
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          {videos.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm("Remove all videos from course list?")) {
                  clearAllVideos();
                }
              }}
              className="text-[10px] text-white/40 hover:text-rose-400 transition mr-1"
              title="Clear all videos"
            >
              Clear All
            </button>
          )}

          {onCollapse && (
            <button
              onClick={onCollapse}
              className="grid h-6 w-6 place-items-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition"
              title="Collapse Course Hierarchy to expand video area"
            >
              <PanelRightClose size={15} />
            </button>
          )}
        </div>
      </div>

      {folders.length > 1 && (
        <div className="mt-3">
          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#121216] px-3 py-1.5 text-xs text-white/80 outline-none"
          >
            <option value="all">All Folders ({videos.length})</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Videos List */}
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1 min-h-0">
        {filteredVideos.length === 0 ? (
          <div className="py-16 text-center text-xs text-white/40">
            No course videos found.<br />
            Scan a folder in the main area to load courses.
          </div>
        ) : (
          filteredVideos.map((video, idx) => {
            const isActive = activeVideo?.id === video.id;
            return (
              <div
                key={video.id}
                onClick={() => selectVideo(video)}
                className={`group flex cursor-pointer items-center justify-between gap-2.5 rounded-xl border p-2.5 transition ${
                  isActive
                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-white"
                    : "border-white/[0.05] bg-white/[0.02] text-white/70 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[11px] font-mono text-white/50 group-hover:text-white">
                    {isActive && isPlaying ? (
                      <span className="text-[var(--accent)] font-bold">▶</span>
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <div className="overflow-hidden">
                    <p className="truncate text-xs font-semibold leading-tight">
                      {video.title}
                    </p>
                    <p className="text-[10px] text-white/40 truncate pt-0.5">
                      {video.folder_name} • {video.format.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex flex-col opacity-40 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveVideo(video.id, -1);
                      }}
                      className="grid h-3.5 w-4 place-items-center rounded text-white/70 hover:text-white hover:bg-white/15 disabled:opacity-20 transition"
                      title="Move Up"
                    >
                      <ChevronUp size={11} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === filteredVideos.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveVideo(video.id, 1);
                      }}
                      className="grid h-3.5 w-4 place-items-center rounded text-white/70 hover:text-white hover:bg-white/15 disabled:opacity-20 transition"
                      title="Move Down"
                    >
                      <ChevronDown size={11} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteVideo(video.id);
                    }}
                    className="grid h-6 w-6 place-items-center rounded-lg opacity-40 hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-400 transition ml-0.5"
                    title="Remove video from list"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function DesktopStudio({
  currentTab,
  currentOverlay,
  onSelectTab,
  onOpenOverlay,
  viewMode,
  onToggleViewMode,
  isPlayerOverlay,
  onToggleMiniPlayer,
  onOpenSimpleMode,
  children,
}: DesktopStudioProps) {
  const {
    current,
    isPlaying,
    toggle,
    next,
    prev,
    duration,
    progress,
    seek,
    liked,
    toggleLike,
    volume,
    setVolume,
    tracks,
    profile,
  } = usePlayer();

  const [muted, setMuted] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [isPlayerCollapsed, setIsPlayerCollapsed] = useState(false);

  // Auto-collapse right sidebar when DJ overlay is open, so rotating turntable & mixer have full width
  useEffect(() => {
    if (currentOverlay === "dj") {
      setIsRightSidebarCollapsed(true);
    }
  }, [currentOverlay]);

  useEffect(() => {
    const handleFull = () => setFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFull);
    return () => document.removeEventListener("fullscreenchange", handleFull);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // Keyboard shortcuts for Desktop
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

      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        seek(Math.min(duration, progress + 5));
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        seek(Math.max(0, progress - 5));
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        setVolume(Math.min(1, volume + 0.05));
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        setVolume(Math.max(0, volume - 0.05));
      } else if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        setMuted(!muted);
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullScreen();
      } else if (e.key === "\\" || (e.ctrlKey && e.key.toLowerCase() === "b")) {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle, seek, duration, progress, setVolume, volume, setMuted, muted]);

  const navItems: { id: Tab | string; label: string; icon: React.ReactNode; overlay?: string }[] = [
    { id: "home", label: "Discover", icon: <Music size={18} /> },
    { id: "music", label: "My Library", icon: <Radio size={18} /> },
    { id: "courses", label: "Courses & Videos", icon: <BookOpen size={18} /> },
    { id: "downloader", label: "YouTube Studio", icon: <Download size={18} /> },
    { id: "explore", label: "Explore & Radio", icon: <Compass size={18} /> },
    { id: "reels", label: "Reels", icon: <Film size={18} /> },
    { id: "dj", label: "DJ Studio & FX", icon: <Disc size={18} />, overlay: "dj" },
    { id: "settings", label: "Settings & EQ", icon: <SettingsIcon size={18} /> },
  ];

  if (isAdminEmail(profile?.email)) {
    navItems.push({ id: "admin", label: "Admin Panel", icon: <Shield size={18} />, overlay: "admin" });
  }

  const formatTime = (s: number) => {
    if (isNaN(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r < 10 ? "0" : ""}${r}`;
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0A0A0D] text-white">
      {/* Single Unified Desktop Frameless Titlebar & Top Controls */}
      <DesktopTitleBar
        onOpenEqualizer={() => onOpenOverlay("equalizer")}
        onOpenProfile={() => onOpenOverlay("profile")}
        profileName={profile?.name || "Guest"}
        onToggleMiniPlayer={onToggleMiniPlayer}
        onOpenSimpleMode={onOpenSimpleMode}
      />

      {/* Main Content Workspace */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Navigation Sidebar */}
        <aside
          className={`flex shrink-0 flex-col border-r border-white/[0.06] bg-[#0A0A0D]/50 transition-all duration-300 ${
            isSidebarCollapsed ? "w-16 px-2 py-4 items-center" : "w-60 px-3 py-4"
          }`}
        >
          {/* Header & Toggle */}
          <div className="flex items-center justify-between w-full px-2 pb-2">
            {!isSidebarCollapsed && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                Navigation
              </p>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="grid h-7 w-7 place-items-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition ml-auto"
              title={isSidebarCollapsed ? "Expand Sidebar (\\)" : "Collapse Sidebar (\\)"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>

          <nav className="mt-1 space-y-1 w-full">
            {navItems.map((item) => {
              const active = item.overlay
                ? currentOverlay === item.overlay
                : !currentOverlay && currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.overlay) {
                      onOpenOverlay(item.overlay);
                    } else {
                      onSelectTab(item.id as Tab);
                    }
                  }}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`flex items-center rounded-xl py-2.5 text-xs font-medium transition ${
                    isSidebarCollapsed
                      ? "w-full justify-center px-0"
                      : "w-full gap-3 px-3.5"
                  } ${
                    active
                      ? "bg-[var(--accent)] text-black font-semibold shadow-[0_4px_16px_-4px_color-mix(in_srgb,var(--accent)_50%,transparent)]"
                      : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer: Mini Player Dock or Quick Controls */}
          {!isSidebarCollapsed ? (
            isPlayerCollapsed ? (
              <div className="mt-auto overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#15151C] to-[#0D0D12] p-3 shadow-2xl backdrop-blur-xl transition-all duration-300">
                {current ? (
                  <>
                    {/* Header: Track Cover & Details */}
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => onOpenOverlay("player")}
                        className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-md transition hover:scale-105 active:scale-95"
                        title="Open Now Playing"
                      >
                        <img src={current.cover} alt="" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                          <Maximize size={13} className="text-white" />
                        </div>
                      </button>
                      <div className="min-w-0 flex-1">
                        <MarqueeText
                          text={current.title || "Untitled"}
                          className="text-xs font-bold text-white leading-tight"
                        />
                        <p className="truncate pt-0.5 text-[10px] text-white/50">{current.artist || "Unknown"}</p>
                      </div>
                      <button
                        onClick={() => toggleLike(current.id)}
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition ${
                          liked.includes(current.id) ? "text-rose-400" : "text-white/40 hover:text-white"
                        }`}
                        title="Favorite"
                      >
                        <Heart size={13} filled={liked.includes(current.id)} />
                      </button>
                    </div>

                    {/* Progress Slider */}
                    <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[9px] text-white/40">
                      <span className="w-7 text-right">{formatTime(progress)}</span>
                      <div
                        className="group relative flex h-3 flex-1 items-center cursor-pointer"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                          seek(pct * (duration || 1));
                        }}
                      >
                        <div className="h-1 w-full rounded-full bg-white/10 transition-all group-hover:h-1.5" />
                        <div
                          className="absolute left-0 h-1 rounded-full bg-gradient-to-r from-[var(--accent)] to-[#47eed8] shadow-[0_0_6px_var(--accent)] transition-all group-hover:h-1.5"
                          style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-7">{formatTime(duration)}</span>
                    </div>

                    {/* Player Controls & Restore Button */}
                    <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={prev}
                          className="grid h-6 w-6 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition active:scale-95"
                          title="Previous"
                        >
                          <SkipBack size={13} />
                        </button>
                        <button
                          onClick={toggle}
                          className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-black shadow-md transition hover:scale-105 active:scale-95"
                          title={isPlaying ? "Pause" : "Play"}
                        >
                          {isPlaying ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
                        </button>
                        <button
                          onClick={next}
                          className="grid h-6 w-6 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition active:scale-95"
                          title="Next"
                        >
                          <SkipForward size={13} />
                        </button>
                      </div>

                      <button
                        onClick={() => setIsPlayerCollapsed(false)}
                        className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-medium text-white/70 hover:bg-white/15 hover:text-white transition"
                        title="Restore Full Bottom Bar"
                      >
                        <ChevronUp size={12} />
                        <span>Expand</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-2 text-center">
                    <p className="text-xs font-semibold text-white/60">Bottom Player Hidden</p>
                    <button
                      onClick={() => setIsPlayerCollapsed(false)}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-white/20 transition"
                    >
                      <ChevronUp size={11} />
                      <span>Restore Player</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-auto flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 text-white/50">
                <button
                  onClick={() => onOpenOverlay("ai")}
                  className="flex items-center gap-2 text-left hover:text-white transition"
                  title="Audenic AI Assistant"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
                    <Bot size={13} />
                  </span>
                  <span className="text-[11px] font-medium text-white/70">Audenic AI</span>
                </button>
                <button
                  onClick={() => setIsPlayerCollapsed(true)}
                  className="grid h-6 w-6 place-items-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition"
                  title="Collapse bottom player into sidebar"
                >
                  <ChevronDown size={13} />
                </button>
              </div>
            )
          ) : (
            /* Collapsed Sidebar Dock */
            <div className="mt-auto flex flex-col items-center gap-2 py-2">
              {isPlayerCollapsed ? (
                current ? (
                  <>
                    <button
                      onClick={toggle}
                      className="group relative h-9 w-9 overflow-hidden rounded-xl border border-white/15 shadow-lg transition active:scale-95"
                      title={isPlaying ? `Pause: ${current.title}` : `Play: ${current.title}`}
                    >
                      <img src={current.cover} alt="" className="h-full w-full object-cover" />
                      <div className={`absolute inset-0 grid place-items-center bg-black/40 transition ${
                        isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-90"
                      }`}>
                        {isPlaying ? <Pause size={13} className="text-white" /> : <Play size={13} className="text-white ml-0.5" />}
                      </div>
                    </button>
                    <button
                      onClick={() => setIsPlayerCollapsed(false)}
                      className="grid h-6 w-6 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition"
                      title="Restore Bottom Player Bar"
                    >
                      <ChevronUp size={13} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsPlayerCollapsed(false)}
                    className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition"
                    title="Restore Bottom Player"
                  >
                    <Music size={14} />
                  </button>
                )
              ) : (
                <button
                  onClick={() => onOpenOverlay("ai")}
                  className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.04] text-white/50 hover:bg-white/10 hover:text-[var(--accent)] transition"
                  title="Audenic AI Assistant"
                >
                  <Bot size={15} />
                </button>
              )}
            </div>
          )}
        </aside>

        {/* Central Screen Area */}
        <main className="relative flex-1 min-h-0 overflow-hidden bg-[#08080A] flex flex-col">
          <div
            className={`mx-auto w-full ${
              currentTab === "courses" || currentTab === "dj" || currentOverlay === "dj" ? "max-w-none" : "max-w-6xl"
            } flex-1 flex flex-col min-h-0 p-3 lg:p-5 overflow-hidden`}
          >
            {children}
          </div>
        </main>

        {/* Right Side Panel: Course Hierarchy on Courses tab, Music Now Playing on others */}
        {!isPlayerOverlay && (
          <aside
            className={`hidden shrink-0 flex-col border-l border-white/[0.06] bg-[#0A0A0D]/60 transition-all duration-300 xl:flex overflow-hidden ${
              isRightSidebarCollapsed ? "w-14 items-center py-4 px-1" : "w-80 p-4"
            }`}
          >
            {isRightSidebarCollapsed ? (
              <div className="flex h-full w-full flex-col items-center gap-4">
                <button
                  onClick={() => setIsRightSidebarCollapsed(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition"
                  title={currentTab === "courses" ? "Expand Course Hierarchy" : "Expand Now Playing"}
                >
                  <PanelRightOpen size={16} />
                </button>
                <button
                  onClick={() => setIsRightSidebarCollapsed(false)}
                  className="flex-1 flex flex-col items-center justify-center gap-2 cursor-pointer hover:opacity-80 transition group w-full"
                  title="Click to expand"
                >
                  {currentTab === "courses" ? (
                    <BookOpen size={16} className="text-[var(--accent)] group-hover:scale-110 transition" />
                  ) : (
                    <Music size={16} className="text-[var(--accent)] group-hover:scale-110 transition" />
                  )}
                  <span className="text-[10px] uppercase font-bold tracking-widest text-white/40 [writing-mode:vertical-lr] rotate-180 select-none">
                    {currentTab === "courses" ? "Course Hierarchy" : "Now Playing"}
                  </span>
                </button>
              </div>
            ) : currentTab === "courses" ? (
              <CourseHierarchyRightPanel onCollapse={() => setIsRightSidebarCollapsed(true)} />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white/35">Now Playing</h2>
                  <button
                    onClick={() => setIsRightSidebarCollapsed(true)}
                    className="grid h-6 w-6 place-items-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition"
                    title="Collapse sidebar"
                  >
                    <PanelRightClose size={15} />
                  </button>
                </div>
                {current ? (
                  <div className="mt-4 flex flex-col items-center text-center overflow-y-auto pr-1">
                    <div className="group relative h-48 w-48 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl shrink-0">
                      <img
                        src={current.cover}
                        alt={current.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      {isPlaying && (
                        <div className="absolute inset-0 flex items-end justify-center gap-1 bg-black/30 pb-3">
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className="w-1 rounded-full bg-[var(--accent)]"
                              style={{
                                animation: `eq .8s ${i * 0.15}s ease-in-out infinite alternate`,
                                height: 16,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 w-full">
                      <MarqueeText
                        text={current.title}
                        className="text-base font-bold text-white clamp-1"
                      />
                      <p className="pt-0.5 text-xs text-white/50">{current.artist}</p>
                      <p className="pt-0.5 text-[11px] text-[var(--accent)] font-medium">
                        {(current as any).album || "Audenic Collection"}
                      </p>
                    </div>

                    {/* Quick Action Badges */}
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <button
                        onClick={() => toggleLike(current.id)}
                        className={`grid h-9 w-9 place-items-center rounded-full border border-white/10 transition ${
                          liked.includes(current.id)
                            ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                            : "bg-white/5 text-white/60 hover:text-white"
                        }`}
                      >
                        <Heart size={16} filled={liked.includes(current.id)} />
                      </button>
                      <button
                        onClick={() => onOpenOverlay("player")}
                        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 transition"
                      >
                        Full View
                      </button>
                    </div>

                    {/* Queue List Preview */}
                    <div className="mt-6 w-full border-t border-white/[0.06] pt-4 text-left">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Up Next</p>
                      <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                        {tracks.slice(0, 5).map((track: any, idx: number) => (
                          <div
                            key={`${track.id}-${idx}`}
                            className="flex items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-white/[0.04]"
                          >
                            <img
                              src={track.cover}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-lg object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-white/90 clamp-1">{track.title}</p>
                              <p className="text-[10px] text-white/40 clamp-1">{track.artist}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-12 text-center text-white/40 text-xs">
                    No track currently loaded. Select a song to begin listening.
                  </div>
                )}
              </>
            )}
          </aside>
        )}
      </div>

      {/* Floating Restore Button when Bottom Player is Collapsed */}
      {isPlayerCollapsed && !isPlayerOverlay && (
        <button
          onClick={() => setIsPlayerCollapsed(false)}
          className="fixed bottom-4 right-6 z-50 flex items-center gap-2 rounded-full border border-white/15 bg-[#0A0A0D]/95 px-4 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur transition hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-95"
          title="Restore Player Bar"
        >
          <Music size={14} className="text-[var(--accent)]" />
          <span>{current ? current.title : "Show Player"}</span>
          <ChevronUp size={14} />
        </button>
      )}

      {/* Sticky Bottom Desktop Player Controls */}
      {!isPlayerCollapsed && !isPlayerOverlay && (
        <footer className="flex h-20 shrink-0 items-center justify-between border-t border-white/[0.08] bg-[#0A0A0D] px-6 transition-all duration-200">
          {/* Left Track Info */}
          <div className="flex w-64 items-center gap-3">
            {current ? (
              <>
                <button
                  onClick={() => onOpenOverlay("player")}
                  className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5 border border-white/10 hover:opacity-90 transition"
                >
                  <img src={current.cover} alt="" className="h-full w-full object-cover" />
                </button>
                <div className="min-w-0">
                  <MarqueeText
                    text={current.title}
                    className="text-xs font-bold text-white clamp-1"
                  />
                  <p className="text-[11px] text-white/40 clamp-1">{current.artist}</p>
                </div>
                <button
                  onClick={() => toggleLike(current.id)}
                  className={`ml-1 text-white/40 hover:text-white transition ${
                    liked.includes(current.id) ? "text-rose-400" : ""
                  }`}
                >
                  <Heart size={16} filled={liked.includes(current.id)} />
                </button>
              </>
            ) : (
              <div className="text-xs text-white/40">Select a song</div>
            )}
          </div>

          {/* Center Player Controls & Progress */}
          <div className="flex flex-1 max-w-2xl flex-col items-center px-4">
            <div className="flex items-center gap-4">
              <button
                onClick={prev}
                className="text-white/60 hover:text-white transition active:scale-95"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={toggle}
                className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-black shadow-lg hover:scale-105 active:scale-95 transition"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
              </button>
              <button
                onClick={next}
                className="text-white/60 hover:text-white transition active:scale-95"
              >
                <SkipForward size={18} />
              </button>
            </div>

            <div className="mt-2 flex w-full items-center gap-3 text-[11px] text-white/50 font-mono">
              <span className="w-10 text-right">{formatTime(progress)}</span>
              {(() => {
                const progressPct = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;
                return (
                  <div className="group relative flex h-6 flex-1 items-center cursor-pointer">
                    <div className="h-1.5 w-full rounded-full bg-white/15 transition-all group-hover:h-2" />
                    <div
                      className="absolute left-0 h-1.5 rounded-full bg-gradient-to-r from-[var(--accent)] to-[#47eed8] shadow-[0_0_10px_var(--accent)] transition-all group-hover:h-2"
                      style={{ width: `${progressPct}%` }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={progress}
                      onChange={(e) => seek(Number(e.target.value))}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <div
                      className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_var(--accent),0_2px_5px_rgba(0,0,0,0.6)] transition-transform duration-75 group-hover:scale-125"
                      style={{ left: `${progressPct}%` }}
                    />
                  </div>
                );
              })()}
              <span className="w-10">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Volume, EQ & Collapse Tools */}
          <div className="flex w-64 items-center justify-end gap-2.5">
            <button
              onClick={() => onOpenOverlay("dj")}
              className="text-white/60 hover:text-[var(--accent)] transition"
              title="DJ Studio & Mixer"
            >
              <Disc size={18} />
            </button>
            <button
              onClick={() => onOpenOverlay("equalizer")}
              className="text-white/60 hover:text-white transition"
              title="Audio Effects & EQ"
            >
              <Sliders size={18} />
            </button>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMuted(!muted)}
                className="text-white/60 hover:text-white transition"
              >
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              {(() => {
                const volumePct = muted ? 0 : Math.min(100, Math.max(0, volume * 100));
                return (
                  <div className="group relative flex h-6 w-20 items-center cursor-pointer">
                    <div className="h-1.5 w-full rounded-full bg-white/15 transition-all group-hover:h-2" />
                    <div
                      className="absolute left-0 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)] transition-all group-hover:h-2"
                      style={{ width: `${volumePct}%` }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={muted ? 0 : volume}
                      onChange={(e) => {
                        setMuted(false);
                        setVolume(Number(e.target.value));
                      }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <div
                      className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_6px_var(--accent)] transition-transform group-hover:scale-125"
                      style={{ left: `${volumePct}%` }}
                    />
                  </div>
                );
              })()}
            </div>

            {/* Collapse Player Bar Button */}
            <button
              onClick={() => setIsPlayerCollapsed(true)}
              className="grid h-7 w-7 place-items-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition ml-1"
              title="Collapse Player Bar to gain more screen space"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

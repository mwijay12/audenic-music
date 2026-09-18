import { useEffect, useState } from "react";
import {
  isDesktop,
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  isWindowMaximized,
} from "../player/tauriBridge";
import { usePlayer } from "../player/PlayerContext";
import { Search, Sliders, User, Car, AppWindow } from "./Icons";

interface DesktopTitleBarProps {
  onSearch?: (query: string) => void;
  searchQuery?: string;
  onOpenEqualizer?: () => void;
  onOpenProfile?: () => void;
  onToggleMiniPlayer?: () => void;
  onOpenSimpleMode?: () => void;
  profileName?: string;
}

export function DesktopTitleBar({
  onSearch,
  searchQuery = "",
  onOpenEqualizer,
  onOpenProfile,
  onToggleMiniPlayer,
  onOpenSimpleMode,
  profileName = "Guest",
}: DesktopTitleBarProps) {
  const [maximized, setMaximized] = useState(false);
  const { isPlaying, current } = usePlayer();
  const desktop = isDesktop();

  useEffect(() => {
    if (!desktop) return;
    const checkMax = async () => {
      try {
        const isMax = await isWindowMaximized();
        setMaximized(isMax);
      } catch {}
    };
    checkMax();
    const interval = setInterval(checkMax, 1000);
    return () => clearInterval(interval);
  }, [desktop]);

  const handleToggleMaximize = async () => {
    const isNowMax = await toggleMaximizeWindow();
    setMaximized(isNowMax);
  };

  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={handleToggleMaximize}
      className="relative flex h-12 w-full select-none items-center justify-between border-b border-white/[0.06] bg-[#070709] px-4 text-xs text-white/70 z-50 shrink-0"
    >
      {/* App Branding & Badges */}
      <div data-tauri-drag-region className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--accent)] text-black shadow-[0_2px_12px_-2px_color-mix(in_srgb,var(--accent)_60%,transparent)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" fill="currentColor" />
              <circle cx="18" cy="16" r="3" fill="currentColor" />
            </svg>
          </span>
          <span className="font-extrabold tracking-tight text-white text-[14px]">
            Audenic <span className="font-semibold text-white/50">Studio</span>
          </span>
        </div>

        <span className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[10px] font-bold text-[var(--accent)] tracking-wider uppercase border border-white/5">
          Desktop Pro
        </span>

        <span
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase transition ${
            online
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}
          title={online ? "Connected to Internet • Streaming & AI online" : "Offline Mode • Local Library & Saved Music active"}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-amber-400"}`} />
          {online ? "Online" : "Offline"}
        </span>

        {isPlaying && current && (
          <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] text-white/80 lg:flex max-w-[240px]">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]"></span>
            </span>
            <span className="truncate font-medium">
              {current.title}
            </span>
          </div>
        )}
      </div>

      {/* Center Search Input */}
      {onSearch && (
        <div data-tauri-drag-region className="flex flex-1 items-center justify-center px-4">
          <div className="relative w-full max-w-md">
            <Search
              size={13}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search tracks, courses, albums, artists..."
              className="w-full rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-9 pr-4 text-[12px] text-white placeholder-white/35 outline-none transition focus:border-[var(--accent)] focus:bg-white/[0.08]"
            />
          </div>
        </div>
      )}

      {/* Right Controls: Equalizer, Profile & Frameless Window Controls */}
      <div className="flex items-center gap-2">
        {onOpenSimpleMode && (
          <button
            onClick={onOpenSimpleMode}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10 hover:text-white transition active:scale-95"
            title="Launch Simple / Driver's Mode"
          >
            <Car size={13} className="text-amber-400" />
            <span>Simple Mode</span>
          </button>
        )}

        {onToggleMiniPlayer && (
          <button
            onClick={onToggleMiniPlayer}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10 hover:text-white transition active:scale-95"
            title="Toggle Floating Desktop Mini Player"
          >
            <AppWindow size={13} className="text-[var(--accent)]" />
            <span>Mini Player</span>
          </button>
        )}

        {onOpenEqualizer && (
          <button
            onClick={onOpenEqualizer}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10 hover:text-white transition active:scale-95"
            title="Open Audio Effects & Equalizer"
          >
            <Sliders size={13} className="text-[var(--accent)]" />
            <span>Equalizer</span>
          </button>
        )}

        {onOpenProfile && (
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] pl-1.5 pr-3 py-1 text-xs font-medium text-white/85 hover:bg-white/10 transition active:scale-95"
            title="User Profile & Settings"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-black text-xs font-bold">
              {profileName?.[0]?.toUpperCase() || <User size={12} />}
            </span>
            <span className="max-w-[85px] truncate font-medium">
              {profileName || "Guest"}
            </span>
          </button>
        )}

        {/* Windows Native Window Controls */}
        <div className="ml-2 flex items-center border-l border-white/10 pl-2">
          <button
            onClick={minimizeWindow}
            aria-label="Minimize"
            title="Minimize"
            className="grid h-8 w-10 place-items-center rounded text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
              <rect width="10" height="1" />
            </svg>
          </button>

          <button
            onClick={handleToggleMaximize}
            aria-label={maximized ? "Restore" : "Maximize"}
            title={maximized ? "Restore" : "Maximize"}
            className="grid h-8 w-10 place-items-center rounded text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            {maximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="2" y="0.5" width="7.5" height="7.5" />
                <polyline points="0.5,2.5 0.5,9.5 7.5,9.5" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="0.5" y="0.5" width="9" height="9" />
              </svg>
            )}
          </button>

          <button
            onClick={() => {
              if (isPlaying) {
                minimizeWindow();
              } else {
                closeWindow();
              }
            }}
            aria-label="Close"
            title={isPlaying ? "Minimize to background (Music playing)" : "Close"}
            className="grid h-8 w-10 place-items-center rounded text-white/70 transition hover:bg-[#E81123] hover:text-white"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

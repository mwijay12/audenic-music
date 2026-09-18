import { useEffect, useState } from "react";
import { usePlayer, fmt } from "../player/PlayerContext";
import { useClock } from "../components/Shell";
import {
  Next,
  Pause,
  Play,
  Prev,
  Heart,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
} from "../components/Icons";

export default function DriveMode({ onExit }: { onExit: () => void }) {
  const {
    current,
    isPlaying,
    toggle,
    next,
    prev,
    progress,
    duration,
    seek,
    volume,
    setVolume,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
    liked,
    toggleLike,
    sleepRemaining,
    buzz,
  } = usePlayer();

  const clock = useClock();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keyboard shortcut listener for Driver / Simple mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        next();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle, next, prev, onExit]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const isCurrentLiked = current ? liked.includes(current.id) : false;
  const h = clock.getHours();
  const m = clock.getMinutes();
  const timeStr = `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col justify-between bg-[#070709] px-6 py-6 md:px-16 md:py-10 select-none overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Background Ambient Glow */}
      {current?.cover && (
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center opacity-20 blur-[100px] scale-125"
          style={{ backgroundImage: `url(${current.cover})` }}
        />
      )}

      {/* Top Cockpit Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        {/* Digital Clock */}
        <div className="flex items-center gap-4">
          <p className="text-3xl md:text-4xl font-extrabold tracking-tight text-white font-mono">
            {timeStr}
          </p>
          {sleepRemaining > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-300">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>{fmt(sleepRemaining)}</span>
            </span>
          )}
        </div>

        {/* Status Mode Badge */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span>Desktop Simple Mode • Driving Cockpit</span>
        </div>

        {/* Window Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/15 hover:text-white transition"
            title="Fullscreen Toggle (F)"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button
            onClick={onExit}
            className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.08] px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-300 active:scale-95 transition"
            title="Exit Simple Mode (Esc)"
          >
            <X size={16} />
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* Main Expansive Cockpit Area */}
      <div className="flex flex-1 flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 py-6 min-h-0">
        {/* Left Side: Giant Album Art & Vinyl Disc */}
        <div className="relative flex shrink-0 items-center justify-center">
          <div
            className={`relative h-56 w-56 sm:h-72 sm:w-72 lg:h-96 lg:w-96 overflow-hidden rounded-full border-4 border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.9)] ${
              isPlaying ? "animate-spin-slow" : ""
            }`}
          >
            {current?.cover ? (
              <img
                src={current.cover}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-[var(--accent)]/20 text-5xl font-black text-[var(--accent)]">
                ♪
              </div>
            )}
            {/* Center Spindle Hole */}
            <div className="absolute inset-0 m-auto h-16 w-16 rounded-full border-4 border-[#070709] bg-[#121218] shadow-inner flex items-center justify-center">
              <span className="h-4 w-4 rounded-full bg-[var(--accent)]" />
            </div>
          </div>
        </div>

        {/* Right Side: Big Typography, Sliders & Massive Controls */}
        <div className="flex flex-1 flex-col justify-center w-full max-w-2xl">
          {current ? (
            <div>
              <span className="rounded-full bg-white/[0.08] px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[var(--accent)]">
                NOW STREAMING
              </span>
              <h1 className="mt-3 truncate text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
                {current.title}
              </h1>
              <p className="mt-1.5 truncate text-lg sm:text-xl lg:text-2xl font-semibold text-white/60">
                {current.artist}
              </p>
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-bold text-white/40">No Track Selected</h1>
              <p className="text-sm text-white/25 pt-1">Music from your library will appear here</p>
            </div>
          )}

          {/* Huge Progress Slider */}
          <div className="mt-6 sm:mt-8">
            <div className="flex items-center justify-between text-sm sm:text-base font-mono font-bold text-white/50 pb-2">
              <span>{fmt(progress)}</span>
              <span>{fmt(duration)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={progress}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="h-3 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[var(--accent)] shadow-md"
            />
          </div>

          {/* Giant Tactile Playback Transport */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            {/* Secondary Controls: Like & Shuffle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (current) toggleLike(current.id);
                  buzz();
                }}
                className={`grid h-14 w-14 place-items-center rounded-2xl border transition active:scale-95 ${
                  isCurrentLiked
                    ? "border-rose-500/40 bg-rose-500/20 text-rose-400"
                    : "border-white/10 bg-white/[0.06] text-white/50 hover:text-white"
                }`}
                title="Like Track"
              >
                <Heart size={24} filled={isCurrentLiked} />
              </button>

              <button
                onClick={() => setShuffle(!shuffle)}
                className={`grid h-14 w-14 place-items-center rounded-2xl border transition active:scale-95 ${
                  shuffle
                    ? "border-[var(--accent)]/40 bg-[var(--accent)]/20 text-[var(--accent)]"
                    : "border-white/10 bg-white/[0.06] text-white/50 hover:text-white"
                }`}
                title="Shuffle Toggle"
              >
                <Shuffle size={22} />
              </button>
            </div>

            {/* Primary Transport (Prev / Big Play / Next) */}
            <div className="flex items-center gap-4 sm:gap-6">
              <button
                onClick={prev}
                className="grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-3xl border border-white/10 bg-white/[0.07] text-white hover:bg-white/15 active:scale-90 transition shadow-lg"
                title="Previous (P)"
              >
                <Prev size={28} />
              </button>

              <button
                onClick={toggle}
                className="grid h-20 w-20 sm:h-24 sm:w-24 place-items-center rounded-3xl bg-[var(--accent)] text-black shadow-[0_15px_45px_color-mix(in_srgb,var(--accent)_65%,transparent)] hover:scale-105 active:scale-90 transition"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? <Pause size={36} /> : <Play size={36} />}
              </button>

              <button
                onClick={next}
                className="grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-3xl border border-white/10 bg-white/[0.07] text-white hover:bg-white/15 active:scale-90 transition shadow-lg"
                title="Next (N)"
              >
                <Next size={28} />
              </button>
            </div>

            {/* Secondary Controls: Repeat & Volume */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRepeat(!repeat)}
                className={`grid h-14 w-14 place-items-center rounded-2xl border transition active:scale-95 ${
                  repeat
                    ? "border-[var(--accent)]/40 bg-[var(--accent)]/20 text-[var(--accent)]"
                    : "border-white/10 bg-white/[0.06] text-white/50 hover:text-white"
                }`}
                title="Repeat Toggle"
              >
                <Repeat size={22} />
              </button>

              <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <button
                  onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                  className="text-white/60 hover:text-white"
                >
                  {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="h-2 w-20 cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--accent)]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Keyboard Hotkeys Guide */}
      <div className="flex items-center justify-between border-t border-white/[0.08] pt-4 text-xs text-white/40 font-mono">
        <div className="flex items-center gap-4">
          <span><kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">Space</kbd> Play/Pause</span>
          <span><kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">N</kbd> Next</span>
          <span><kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">P</kbd> Prev</span>
          <span><kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">Esc</kbd> Exit</span>
        </div>
        <div>
          <span>Audenic Studio Drivers Engine</span>
        </div>
      </div>
    </div>
  );
}

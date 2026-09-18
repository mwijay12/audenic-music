import React, { useEffect, useState, useMemo } from "react";
import { Battery, Cell, Wifi, Play, Pause } from "./Icons";
import { usePlayer, svgCover } from "../player/PlayerContext";
import type { Track } from "../data/tracks";
import { MarqueeText } from "./Marquee";
import { isNative } from "../player/nativeBridge";
import { isDesktop } from "../player/tauriBridge";

/**
 * Immersive (edge-to-edge) when the viewport is phone-sized, OR when we're on a
 * touch device in portrait up to tablet width — an iPad/Android tablet held
 * upright should get the real app, not a tiny phone mock-up. Landscape tablets
 * and desktops keep the framed presentation.
 */
export function useIsMobile(bp = 1024) {
  const compute = () => {
    if (typeof window === "undefined") return false;
    if (isDesktop()) return false;
    if (isNative()) return true;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (w < bp || touch || (h >= w && w <= 1180)) return true;
    return false;
  };
  const [m, setM] = useState(compute);
  useEffect(() => {
    const r = () => setM(compute());
    window.addEventListener("resize", r);
    window.addEventListener("orientationchange", r);
    return () => { window.removeEventListener("resize", r); window.removeEventListener("orientationchange", r); };
  }, [bp]);
  return m;
}

export function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return t;
}

export function StatusBar() {
  const isMobile = useIsMobile();
  const { isPlaying, isRecording } = usePlayer();
  const clock = useClock();
  const h = clock.getHours(); const m = clock.getMinutes();
  const timeStr = `${h}:${m.toString().padStart(2, "0")}`;

  // On Desktop View Mode, hide the fake mobile phone status bar
  if (!isMobile && !isNative()) {
    return null;
  }

  // On native mobile devices, the OS already renders the system status bar (time/battery).
  // We supply a clean top inset spacer so app headers never overlap native system icons.
  if (isNative()) {
    return (
      <div
        className="shrink-0 w-full"
        style={{
          height: "max(44px, env(safe-area-inset-top, 44px))",
          minHeight: "44px",
        }}
      />
    );
  }

  return (
    <div className="relative z-20 flex h-11 shrink-0 items-center justify-between bg-[#0A0A0D]/60 px-6 text-white backdrop-blur-sm">
      {/* Left side: Time + notification shade shortcuts */}
      <div className="flex items-center gap-1.5">
        <span className="text-[14px] font-bold tracking-tight">{timeStr}</span>
        <span className="text-[10px] opacity-40">·</span>
        <div className="flex items-center gap-1 text-[11px] opacity-50">
          <span>💬</span>
          {isPlaying && <span className="animate-pulse">🎵</span>}
          {isRecording && <span className="text-rose-400">🎙️</span>}
        </div>
      </div>

      {/* Right side: Green Privacy Dot + Cellular/Wi-Fi/Battery */}
      <div className="flex items-center gap-2">
        {(isRecording || isPlaying) && (
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" title="Media / Audio Active" />
        )}
        <div className="flex items-center gap-1.5 opacity-90">
          <Cell />
          <Wifi size={14} />
          <Battery />
        </div>
      </div>
    </div>
  );
}

export function PhoneShell({ children, className = "", immersive = true }: { children: React.ReactNode; className?: string; immersive?: boolean }) {
  if (immersive) {
    return (
      <div className={`relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0A0A0D] ${className}`}>
        {children}
      </div>
    );
  }
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[#0A0A0D]">
      <div
        className={`relative flex h-full w-full max-w-[440px] flex-col overflow-hidden rounded-[36px] border-[4px] border-[#1b1b20] bg-[#0A0A0D] shadow-2xl ${className}`}
        style={{ maxHeight: "min(96vh, 920px)" }}
      >
        {children}
      </div>
    </div>
  );
}

export function IconButton({ children, onClick, className = "", active, label }: { children: React.ReactNode; onClick?: () => void; className?: string; active?: boolean; label?: string }) {
  return <button onClick={onClick} aria-label={label} className={`grid h-11 w-11 min-h-[44px] min-w-[44px] cursor-pointer place-items-center rounded-full backdrop-blur transition active:scale-90 touch-manipulation pointer-events-auto ${active ? "bg-[var(--accent)] text-black" : "bg-white/10 text-white hover:bg-white/20"} ${className}`}>{children}</button>;
}

export function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium transition active:scale-95 ${active ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/70 hover:bg-white/[0.13]"}`}>{label}</button>;
}

/** Thick, glowing, value-filled slider used across Settings & players. */
export function FillSlider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative mt-2.5 h-6 w-full">
      <div className="absolute top-1/2 h-[7px] w-full -translate-y-1/2 rounded-full bg-white/12" />
      <div className="absolute top-1/2 h-[7px] -translate-y-1/2 rounded-full bg-gradient-to-r from-[var(--accent-soft)] to-[var(--accent)] transition-[width] duration-100" style={{ width: `${pct}%` }} />
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      <div className="pointer-events-none absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_0_5px_color-mix(in_srgb,var(--accent)_22%,transparent),0_3px_8px_rgba(0,0,0,.4)] transition-[left] duration-100" style={{ left: `${pct}%` }} />
    </div>
  );
}

export function SafeImage({ src, fallbackText = "Song", className = "", style, alt = "" }: { src?: string; fallbackText?: string; className?: string; style?: React.CSSProperties; alt?: string }) {
  const fallbackSrc = useMemo(() => svgCover(fallbackText, 0), [fallbackText]);
  const [imgSrc, setImgSrc] = useState(src || fallbackSrc);

  useEffect(() => {
    setImgSrc(src || fallbackSrc);
  }, [src, fallbackSrc]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      onError={() => {
        if (imgSrc !== fallbackSrc) {
          setImgSrc(fallbackSrc);
        }
      }}
    />
  );
}

export function TrackRow({
  track,
  onOpen,
  compact,
  onOpenDetails,
  onOpenArtist,
  selectable,
  selected,
  onToggleSelect,
  onContextMenu,
}: {
  track: Track;
  onOpen?: () => void;
  compact?: boolean;
  onOpenDetails?: (id: string) => void;
  onOpenArtist?: (n: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const { playTrack, current, isPlaying, liked, toggleLike } = usePlayer();
  const active = current?.id === track.id;
  const openMain = () => {
    if (selectable && onToggleSelect) {
      onToggleSelect({} as any);
      return;
    }
    if (onOpenDetails) onOpenDetails(track.id);
    else onOpen?.();
  };

  return (
    <div
      data-track-id={track.id}
      onContextMenu={onContextMenu}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || (selectable && onToggleSelect)) {
          e.preventDefault();
          onToggleSelect?.(e);
        }
      }}
      className={`group flex items-center gap-3 rounded-2xl pr-1 transition select-none ${
        selected
          ? "bg-[var(--accent)]/15 border border-[var(--accent)]/35 shadow-[0_0_20px_-5px_color-mix(in_srgb,var(--accent)_20%,transparent)]"
          : "hover:bg-white/[0.04]"
      } ${compact ? "py-1.5 px-1.5" : "py-2 px-2"}`}
    >
      {/* Multi-Select Checkbox */}
      {selectable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(e);
          }}
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-lg border transition ${
            selected
              ? "border-[var(--accent)] bg-[var(--accent)] text-black"
              : "border-white/25 bg-white/5 text-transparent hover:border-white/50"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      )}

      <button onClick={openMain} className={`relative shrink-0 overflow-hidden rounded-2xl bg-white/5 ${compact ? "h-10 w-10 rounded-xl" : "h-[52px] w-[52px]"}`}>
        <SafeImage src={track.cover} fallbackText={track.title} alt="" className="h-full w-full object-cover" />
        {active && isPlaying && <div className="absolute inset-0 flex items-end justify-center gap-[3px] bg-black/45 pb-1.5">{[0,1,2].map(i=><span key={i} className="w-[3px] rounded-full bg-[var(--accent)]" style={{animation:`eq .9s ${i*.15}s ease-in-out infinite alternate`,height:8}}/>)}</div>}
      </button>
      <div className="min-w-0 flex-1">
        <button onClick={openMain} className="block w-full text-left">
          <MarqueeText text={track.title} className={`clamp-1 font-semibold leading-snug ${active ? "text-[var(--accent)]" : "text-white"} ${compact ? "text-[12.5px]" : "text-[13.5px]"}`} />
        </button>
        <p className={`clamp-1 pt-0.5 text-white/45 ${compact ? "text-[10px]" : "text-[11px]"}`}>
          <button onClick={() => onOpenArtist?.(track.artist)} className={onOpenArtist ? "hover:text-[var(--accent)]" : ""}>{track.artist}</button>
          <span className="mx-0.5">•</span> {track.source === "local" ? "On device" : `${track.songs} Songs`}
        </p>
      </div>
      {!compact && <button onClick={e=>{e.stopPropagation();toggleLike(track.id)}} className={`grid h-7 w-7 place-items-center rounded-full transition active:scale-90 ${liked.includes(track.id)?"text-rose-300":"text-white/30"}`}><svg width="14" height="14" viewBox="0 0 24 24" fill={liked.includes(track.id)?"currentColor":"none"} stroke="currentColor" strokeWidth="1.8"><path d="M12 20s-7-4.35-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.65 12 20 12 20Z"/></svg></button>}
      <button onClick={e=>{e.stopPropagation();playTrack(track.id)}} className={`grid shrink-0 place-items-center rounded-full bg-white/[0.08] text-white transition hover:bg-white/20 active:scale-90 ${compact?"h-7 w-7":"h-9 w-9"}`}>
        {active && isPlaying ? <Pause size={compact?11:14}/> : <Play size={compact?11:14}/>}
      </button>
    </div>
  );
}

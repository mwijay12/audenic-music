import { useEffect, useRef, useState } from "react";
import { MarqueeText } from "./Marquee";
import { usePlayer } from "../player/PlayerContext";
import { useGestures } from "../hooks/useGestures";
import { Compass, Disc, Film, Gear, Home, Next, Pause, Play, Prev } from "./Icons";

import { SafeImage } from "./Shell";

export type Tab = "home" | "music" | "explore" | "reels" | "settings" | "courses" | "downloader";

const ITEMS: { id: Tab; icon: typeof Home }[] = [
  { id: "home", icon: Home },
  { id: "music", icon: Disc },
  { id: "explore", icon: Compass },
  { id: "reels", icon: Film },
  { id: "settings", icon: Gear },
];

const COLLAPSE_MS = 5000;

export function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const { current, isPlaying, toggle, next, prev, progress, duration, gesturesOn, buzz } = usePlayer();
  const [expanded, setExpanded] = useState(true);
  const timer = useRef<number | null>(null);

  const bump = () => {
    setExpanded(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setExpanded(false), COLLAPSE_MS);
  };

  useEffect(() => { bump(); return () => { if (timer.current) window.clearTimeout(timer.current); }; }, [current?.id, isPlaying]);

  const openGesture = useGestures({
    enabled: gesturesOn,
    onSwipeUp: () => { buzz(14); onOpen(); },
    threshold: 30,
  });

  if (!current) return null;
  const pct = duration ? (progress / duration) * 100 : 0;

  if (!expanded) {
    return (
      <div className="mx-6 mb-2 flex justify-end">
        <button onClick={bump} {...openGesture} className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-white/10 bg-[#17171c] shadow-[0_-8px_26px_rgba(0,0,0,.65)] transition active:scale-90">
          <SafeImage src={current.cover} fallbackText={current.title} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
          <span className="absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 0 2px color-mix(in srgb, var(--accent) ${isPlaying ? 70 : 20}%, transparent)` }} />
          <span className="relative grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white">{isPlaying ? <Pause size={13} /> : <Play size={13} />}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      {...openGesture}
      onMouseMove={(e) => { bump(); openGesture.onMouseMove?.(e); }}
      onTouchStart={(e) => { bump(); openGesture.onTouchStart?.(e); }}
      className="mx-8 flex items-center gap-2.5 rounded-t-[24px] rounded-b-[10px] border border-white/12 border-b-0 bg-[#121216] p-2 pr-3 shadow-[0_-12px_36px_rgba(0,0,0,0.95)] transition-all duration-300 md:mx-14"
      style={{ touchAction: "pan-x" }}
    >
      <button onClick={() => { bump(); onOpen(); }} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl">
        <SafeImage src={current.cover} fallbackText={current.title} alt="" className="h-full w-full object-cover" />
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44">
          <rect x="2" y="2" width="40" height="40" rx="14" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="2.8" />
          <rect x="2" y="2" width="40" height="40" rx="14" fill="none" stroke="var(--accent)" strokeWidth="2.8" strokeDasharray="136" strokeDashoffset={136 * (1 - pct / 100)} strokeLinecap="round" />
        </svg>
      </button>
      <button onClick={() => { bump(); onOpen(); }} className="min-w-0 flex-1 text-left">
        <MarqueeText text={current.title} className="text-[12.5px] font-semibold text-white" />
        <p className="clamp-1 text-[10.5px] text-white/40">{current.artist}</p>
      </button>
      <button onClick={() => { bump(); prev(); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/70 transition hover:bg-white/10 active:scale-90"><Prev size={13} /></button>
      <button onClick={() => { bump(); toggle(); }} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-black transition active:scale-90">{isPlaying ? <Pause size={15} /> : <Play size={15} />}</button>
      <button onClick={() => { bump(); next(); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/70 transition hover:bg-white/10 active:scale-90"><Next size={13} /></button>
    </div>
  );
}

export function BottomNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div className="px-4 pt-0" style={{ paddingBottom: "max(12px, calc(6px + env(safe-area-inset-bottom, 6px)))" }}>
      <div className="flex items-center justify-between rounded-full border border-white/12 bg-[#121216] px-3 py-2 shadow-[0_-12px_32px_rgba(0,0,0,0.95)]">
        {ITEMS.map(({ id, icon: Icon }) => {
          const active = tab === id;
          return <button key={id} onClick={() => onTab(id)} className={`grid h-11 w-11 place-items-center rounded-full transition active:scale-90 ${active ? "bg-[var(--accent)] text-black shadow-[0_6px_18px_-4px_color-mix(in_srgb,var(--accent)_60%,transparent)]" : "text-white/55 hover:text-white"}`}><Icon size={20} /></button>;
        })}
      </div>
    </div>
  );
}

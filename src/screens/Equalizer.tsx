import { useEffect, useRef, useState } from "react";
import { usePlayer } from "../player/PlayerContext";
import { EQ_FREQS, EQ_PRESETS, engine } from "../player/audioEngine";
import { useGestures } from "../hooks/useGestures";
import { Back } from "../components/Icons";

const LABELS = ["60", "250", "1k", "4k", "12k"];

/** Real-time bars driven by the AnalyserNode. */
function LiveSpectrum({ bars = 30 }: { bars?: number }) {
  const { isPlaying } = usePlayer();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const data = engine.getSpectrum(bars, isPlaying);
      const el = ref.current;
      if (el) {
        const kids = el.children;
        for (let i = 0; i < kids.length; i++) {
          const h = Math.max(4, data[i] * 100);
          (kids[i] as HTMLElement).style.height = `${h}%`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [bars, isPlaying]);

  return (
    <div ref={ref} className="flex h-24 items-end justify-between gap-[3px]">
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} className="flex-1 rounded-full transition-[height] duration-75"
          style={{ height: "4%", background: `linear-gradient(to top, var(--accent-soft), var(--accent))` }} />
      ))}
    </div>
  );
}

export function Equalizer({ onClose }: { onClose: () => void }) {
  const { equalizer, setEqualizer, current, speed, setSpeed, reverb, setReverb, bassBoost, setBassBoost, isPlaying, buzz, gesturesOn } = usePlayer();
  const [preset, setPreset] = useState<string | null>(null);

  const gestures = useGestures({
    enabled: gesturesOn,
    onSwipeDown: () => { onClose(); buzz(14); },
    threshold: 60,
  });

  useEffect(() => {
    const m = EQ_PRESETS.find(p => p.eq.every((v, i) => v === equalizer[i]));
    setPreset(m?.name ?? null);
  }, [equalizer]);

  const setBand = (i: number, v: number) => {
    const next = equalizer.map((x, ix) => (ix === i ? v : x));
    setEqualizer(next);
  };

  const reset = () => { setEqualizer([0, 0, 0, 0, 0]); setReverb(0); setBassBoost(0); setSpeed(1); buzz(20); };

  return (
    <div className="fade-in flex h-full flex-col overflow-hidden">
      <div {...gestures} className="shrink-0" style={{ touchAction: "pan-x" }}>
        <div className="mx-auto mt-1.5 h-1 w-10 rounded-full bg-white/15" />
        <div className="flex items-center justify-between px-5 pb-2 pt-2">
          <button onClick={onClose} className="press grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"><Back size={18} /></button>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-white">Audio Effects</p>
            {gesturesOn && <p className="text-[9px] text-white/25">swipe down to close</p>}
          </div>
          <button onClick={reset} className="press rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/70">Reset</button>
        </div>
      </div>

      <div className="no-scrollbar smooth-scroll flex-1 overflow-y-auto px-5 pb-10">
        {/* Live spectrum */}
        <div className="slide-up rounded-3xl border border-white/8 bg-gradient-to-b from-white/[0.06] to-transparent p-4">
          <div className="flex items-center justify-between pb-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Live spectrum</p>
            <span className={`text-[9.5px] font-semibold ${isPlaying ? "text-[var(--accent)]" : "text-white/25"}`}>{isPlaying ? "● LIVE" : "IDLE"}</span>
          </div>
          <LiveSpectrum />
          <p className="mt-2 truncate text-[11px] text-white/45">{current ? `${current.title} — ${current.artist}` : "Play something to see it move"}</p>
        </div>

        {/* Presets */}
        <p className="slide-up mb-2 mt-5 text-[10px] uppercase tracking-[0.18em] text-white/35">Presets</p>
        <div className="no-scrollbar slide-up -mx-5 flex gap-2 overflow-x-auto px-5">
          {EQ_PRESETS.map(p => (
            <button key={p.name} onClick={() => { setEqualizer(p.eq); buzz(12); }}
              className={`press shrink-0 rounded-full px-3.5 py-2 text-[11.5px] font-semibold transition ${preset === p.name ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/60"}`}>
              {p.name}
            </button>
          ))}
        </div>

        {/* 5-band EQ */}
        <p className="slide-up mb-1 mt-5 text-[10px] uppercase tracking-[0.18em] text-white/35">5-Band Equalizer</p>
        <div className="slide-up rounded-3xl border border-white/8 bg-white/[0.03] px-3 py-4">
          <div className="flex items-end justify-between">
            {LABELS.map((l, i) => {
              const v = equalizer[i] ?? 0;
              return (
                <div key={l} className="flex flex-1 flex-col items-center gap-2">
                  <span className={`text-[10px] font-bold tabular-nums ${v > 0 ? "text-[var(--accent)]" : v < 0 ? "text-rose-300" : "text-white/25"}`}>
                    {v > 0 ? "+" : ""}{v}
                  </span>
                  <input
                    type="range" min={-12} max={12} step={1} value={v}
                    onChange={e => setBand(i, Number(e.target.value))}
                    className="eq-vert"
                    aria-label={`${EQ_FREQS[i]} Hz`}
                  />
                  <span className="text-[10px] font-semibold text-white/55">{l}</span>
                  <span className="text-[8.5px] text-white/25">Hz</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Effects */}
        <p className="slide-up mb-2 mt-5 text-[10px] uppercase tracking-[0.18em] text-white/35">Effects</p>
        <div className="slide-up space-y-2.5">
          <FX label="Playback speed" value={speed} min={0.5} max={2} step={0.05} display={`${speed.toFixed(2)}×`} onChange={setSpeed}
            marks={[0.75, 1, 1.25, 1.5, 2]} onMark={setSpeed} fmtMark={(m) => `${m}×`} />
          <FX label="Bass boost" value={bassBoost} min={0} max={100} step={1} display={`${bassBoost}%`} onChange={setBassBoost} />
          <FX label="Reverb / space" value={reverb} min={0} max={100} step={1} display={`${reverb}%`} onChange={setReverb} />
        </div>

        <p className="slide-up mt-4 rounded-2xl bg-white/[0.03] px-4 py-3 text-[11px] leading-relaxed text-white/40">
          These run through a real Web Audio graph — 5 biquad filters, a low-shelf bass stage and a convolution reverb.
          Changes are audible immediately while a track plays.
        </p>
      </div>
    </div>
  );
}

function FX({ label, value, min, max, step, display, onChange, marks, onMark, fmtMark }: {
  label: string; value: number; min: number; max: number; step: number; display: string;
  onChange: (v: number) => void; marks?: number[]; onMark?: (v: number) => void; fmtMark?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="rounded-2xl bg-white/[0.04] p-3.5">
      <div className="flex items-center justify-between pb-2.5">
        <span className="text-[12.5px] font-medium text-white">{label}</span>
        <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--accent)]">{display}</span>
      </div>
      <div className="relative h-4">
        <div className="absolute top-1/2 h-[5px] w-full -translate-y-1/2 rounded-full bg-white/10" />
        <div className="absolute top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-[var(--accent)] transition-[width] duration-75" style={{ width: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        <div className="pointer-events-none absolute top-1/2 h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_0_5px_color-mix(in_srgb,var(--accent)_20%,transparent)]" style={{ left: `${pct}%` }} />
      </div>
      {marks && (
        <div className="mt-2.5 flex gap-1.5">
          {marks.map(m => (
            <button key={m} onClick={() => onMark?.(m)} className={`press rounded-full px-2 py-1 text-[10px] font-semibold ${Math.abs(value - m) < 0.01 ? "bg-[var(--accent)] text-black" : "bg-white/[0.06] text-white/45"}`}>
              {fmtMark ? fmtMark(m) : m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

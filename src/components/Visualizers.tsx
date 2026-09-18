import { useEffect, useRef } from "react";
import { engine } from "../player/audioEngine";
import type { VizStyle, ArtShape } from "../player/PlayerContext";

export const VIZ_STYLES: { id: VizStyle; label: string; emoji: string }[] = [
  { id: "bars", label: "Bars", emoji: "📊" },
  { id: "ring", label: "Ring", emoji: "💿" },
  { id: "wave", label: "Wave", emoji: "🌊" },
  { id: "orbit", label: "Orbit", emoji: "🪐" },
  { id: "pulse", label: "Pulse", emoji: "💗" },
  { id: "off", label: "Off", emoji: "🚫" },
];

export const ART_SHAPES: { id: ArtShape; label: string; cls: string }[] = [
  { id: "circle", label: "Circle", cls: "rounded-full" },
  { id: "squircle", label: "Squircle", cls: "rounded-[34px]" },
  { id: "square", label: "Square", cls: "rounded-xl" },
];

export function shapeClass(s: ArtShape) {
  return ART_SHAPES.find((x) => x.id === s)?.cls ?? "rounded-[34px]";
}

/** Standalone bar spectrum (used when art is not the focus). */
export function BarsViz({ playing, bars = 30, className = "" }: { playing: boolean; bars?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = ref.current;
      if (el) {
        const data = engine.getSpectrum(el.children.length, playing);
        for (let i = 0; i < el.children.length; i++) {
          const h = playing ? Math.max(5, data[i] * 100) : 6;
          (el.children[i] as HTMLElement).style.height = `${h}%`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return (
    <div ref={ref} className={`flex h-16 items-end justify-center gap-[3px] px-6 ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} className="flex-1 rounded-full transition-[height] duration-75"
          style={{ height: "6%", background: "linear-gradient(to top, var(--accent-soft), var(--accent))", opacity: playing ? 0.95 : 0.25 }} />
      ))}
    </div>
  );
}

/** Smooth mirrored waveform with gradient fills and glowing audio paths. */
export function WaveViz({ playing }: { playing: boolean }) {
  const ref = useRef<SVGPolylineElement>(null);
  const ref2 = useRef<SVGPolylineElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    let raf = 0;
    const N = 48;
    const loop = () => {
      const data = engine.getSpectrum(N, playing);
      const pts: string[] = [];
      const pts2: string[] = [];
      let dPath = `M 0 50 `;

      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * 100;
        const v = playing ? data[i] : 0.04;
        const yTop = 50 - v * 42;
        const yBot = 50 + v * 42;
        pts.push(`${x},${yTop}`);
        pts2.push(`${x},${yBot}`);
        dPath += `L ${x} ${yTop} `;
      }

      // Close polygon for gradient area fill
      for (let i = N - 1; i >= 0; i--) {
        const x = (i / (N - 1)) * 100;
        const v = playing ? data[i] : 0.04;
        const yBot = 50 + v * 42;
        dPath += `L ${x} ${yBot} `;
      }
      dPath += `Z`;

      ref.current?.setAttribute("points", pts.join(" "));
      ref2.current?.setAttribute("points", pts2.join(" "));
      pathRef.current?.setAttribute("d", dPath);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-24 w-full px-5 overflow-visible">
      <defs>
        <linearGradient id="waveFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity={playing ? "0.35" : "0.08"} />
          <stop offset="50%" stopColor="var(--accent-soft)" stopOpacity={playing ? "0.15" : "0.02"} />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity={playing ? "0.35" : "0.08"} />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <path ref={pathRef} fill="url(#waveFill)" className="transition-opacity duration-300" />
      <polyline ref={ref} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" opacity="0.95" filter="url(#glow)" />
      <polyline ref={ref2} fill="none" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/**
 * Artwork with the spectrum wrapped *around* it — ring bars, orbiting dots or
 * a breathing glow, depending on the chosen style.
 */
export function ArtworkViz({
  cover, playing, style, shape, size = 220,
}: { cover: string; playing: boolean; style: VizStyle; shape: ArtShape; size?: number }) {
  const ringRef = useRef<SVGGElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (style !== "ring" && style !== "orbit" && style !== "pulse") return;
    let raf = 0;
    const N = style === "orbit" ? 18 : 56;
    const loop = () => {
      const data = engine.getSpectrum(N, playing);
      if (style === "ring" && ringRef.current) {
        const kids = ringRef.current.children;
        for (let i = 0; i < kids.length; i++) {
          const v = playing ? data[i] : 0.05;
          (kids[i] as SVGLineElement).setAttribute("y2", `${18 - Math.max(1.5, v * 15)}`);
          (kids[i] as SVGLineElement).style.opacity = `${0.25 + v * 0.75}`;
        }
      }
      if (style === "orbit" && orbitRef.current) {
        const kids = orbitRef.current.children;
        for (let i = 0; i < kids.length; i++) {
          const v = playing ? data[i] : 0.05;
          const r = 1 + v * 3.4;
          (kids[i] as SVGCircleElement).setAttribute("r", `${r}`);
          (kids[i] as SVGCircleElement).style.opacity = `${0.3 + v * 0.7}`;
        }
      }
      if (style === "pulse" && glowRef.current) {
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const s = playing ? 1 + avg * 0.5 : 1;
        glowRef.current.style.transform = `scale(${s})`;
        glowRef.current.style.opacity = `${playing ? 0.25 + avg * 0.65 : 0.12}`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, style]);

  const artCls = shapeClass(shape);
  const spin = style === "ring" && shape === "circle" && playing ? "spin-slow" : "";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* breathing glow */}
      <div
        ref={glowRef}
        className="absolute -inset-6 rounded-full blur-2xl transition-transform duration-100"
        style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 68%)", opacity: playing ? 0.3 : 0.1 }}
      />

      {/* ring bars around the art */}
      {style === "ring" && (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute -inset-3 h-[calc(100%+24px)] w-[calc(100%+24px)]">
          <g ref={ringRef}>
            {Array.from({ length: 56 }).map((_, i) => {
              const a = (i / 56) * 360;
              return (
                <line key={i} x1="50" y1="3" x2="50" y2="16" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"
                  transform={`rotate(${a} 50 50)`} />
              );
            })}
          </g>
        </svg>
      )}

      {/* orbiting dots */}
      {style === "orbit" && (
        <svg viewBox="0 0 100 100" className={`pointer-events-none absolute -inset-4 h-[calc(100%+32px)] w-[calc(100%+32px)] ${playing ? "spin-slow" : ""}`}>
          <g ref={orbitRef}>
            {Array.from({ length: 18 }).map((_, i) => {
              const a = ((i / 18) * 360 * Math.PI) / 180;
              const cx = 50 + Math.cos(a) * 45;
              const cy = 50 + Math.sin(a) * 45;
              return <circle key={i} cx={cx} cy={cy} r="2" fill="var(--accent)" />;
            })}
          </g>
        </svg>
      )}

      <div className={`relative h-full w-full overflow-hidden border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,.9)] transition-all duration-500 ${artCls} ${spin} ${playing ? "scale-100" : "scale-95"}`}>
        <img src={cover} alt="" className="h-full w-full object-cover" onError={(e) => { const t = e.currentTarget; if (!t.dataset.fallback) { t.dataset.fallback = "1"; t.src = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#2a2a35"/><text x="100" y="120" font-family="Arial" font-size="64" font-weight="700" fill="#C8F249" text-anchor="middle">♪</text></svg>')}`; } }} />
        {shape === "circle" && <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/15 bg-black/70" />}
      </div>
    </div>
  );
}

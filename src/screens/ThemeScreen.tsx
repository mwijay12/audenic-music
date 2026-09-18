import { THEMES, usePlayer } from "../player/PlayerContext";
import { IconButton, StatusBar } from "../components/Shell";
import { Back, Check, Palette } from "../components/Icons";

export default function ThemeScreen({ onBack }: { onBack: () => void }) {
  const { theme, setTheme, volume, setVolume, crossfade, setCrossfade, fadeMs, setFadeMs } =
    usePlayer();
  const volumePct = Math.round(volume * 100);
  const fadePct = Math.min(100, Math.round((fadeMs / 4000) * 100));

  return (
    <div className="fade-in flex h-full flex-col overflow-y-auto min-h-0 pb-16">
      <StatusBar />
      <div className="flex items-center justify-between px-6 pt-3 shrink-0">
        <IconButton onClick={onBack} label="Back">
          <Back size={20} />
        </IconButton>
        <p className="text-[15px] font-semibold text-white">Customize</p>
        <span className="w-10" />
      </div>

      <div className="mx-6 mt-3 overflow-hidden rounded-3xl shrink-0">
        <div
          className="relative h-28"
          style={{
            background: `radial-gradient(circle at 20% 30%, ${theme.gradientA} 0%, transparent 50%),
                         radial-gradient(circle at 80% 20%, ${theme.gradientB} 0%, transparent 50%),
                         radial-gradient(circle at 50% 80%, ${theme.gradientC} 0%, transparent 50%)`,
          }}
        >
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-[#0A0A0D]" />
          <p className="absolute bottom-3 left-4 text-[12px] font-bold text-white">
            Preview • {theme.name}
          </p>
        </div>
      </div>

      <div className="px-6 pt-5 shrink-0">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Palette size={14} className="text-white/55" />
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Accent & Themes
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto no-scrollbar pr-1">
          {THEMES.map((t) => {
            const active = theme.name === t.name;
            return (
              <button
                key={t.name}
                onClick={() => setTheme(t)}
                className={`relative overflow-hidden rounded-2xl border p-3 text-left transition active:scale-95 ${
                  active ? "border-[var(--accent)]" : "border-white/8"
                }`}
                style={{
                  background: t.mode === "light"
                    ? `linear-gradient(135deg, ${t.accentSoft}, #FFFFFF)`
                    : `linear-gradient(135deg, ${t.gradientA}40, ${t.gradientB}30)`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-1">
                    <p className={`text-[12px] font-bold ${t.mode === "light" ? "text-slate-900" : "text-white"}`}>{t.name}</p>
                    <span className={`inline-block text-[9px] font-semibold ${t.mode === "light" ? "text-purple-600" : "text-white/50"}`}>{t.mode === "light" ? "☀️ Light" : "🌙 Dark"}</span>
                  </div>
                  <span
                    className="h-5 w-5 shrink-0 rounded-full"
                    style={{
                      background: t.accent,
                      boxShadow: `0 0 0 2px color-mix(in srgb, ${t.accent} 35%, transparent)`,
                    }}
                  />
                </div>
                <div className="mt-2 flex gap-1">
                  {[t.gradientA, t.gradientB, t.gradientC, t.accent].map((c, i) => (
                    <span
                      key={i}
                      className="h-2 flex-1 rounded-full"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                {active && (
                  <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] text-black shadow-md">
                    <Check size={12} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-6 mt-5 rounded-2xl bg-white/[0.04] p-4 shrink-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Volume
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="w-10 text-[11px] text-white/55 font-mono">{volumePct}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="studio-slider flex-1"
            style={{
              background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${volumePct}%, rgba(255,255,255,0.14) ${volumePct}%, rgba(255,255,255,0.14) 100%)`,
            }}
          />
        </div>
      </div>

      <div className="mx-6 mt-3 rounded-2xl bg-white/[0.04] p-4 shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-white">Crossfade</p>
          <button
            onClick={() => setCrossfade(!crossfade)}
            className={`relative h-6 w-11 rounded-full transition ${
              crossfade ? "bg-[var(--accent)]" : "bg-white/15"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                crossfade ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
        <p className="pt-1 text-[11px] text-white/45">
          Smoothly fade songs in and out
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="w-12 text-[11px] text-white/55 font-mono">{fadeMs}ms</span>
          <input
            type="range"
            min={0}
            max={4000}
            step={100}
            value={fadeMs}
            onChange={(e) => setFadeMs(Number(e.target.value))}
            className="studio-slider flex-1"
            style={{
              background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${fadePct}%, rgba(255,255,255,0.14) ${fadePct}%, rgba(255,255,255,0.14) 100%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

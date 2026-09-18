import { useMemo } from "react";
import { usePlayer, type Achievement } from "../player/PlayerContext";
import { StatusBar, IconButton } from "../components/Shell";
import { Back, Trophy, Flame, Disc, Heart, Compass } from "../components/Icons";

function AchievementBadgeIcon({ category, done }: { category: Achievement["category"]; done: boolean }) {
  const iconProps = { size: 20, className: done ? "text-[var(--accent)]" : "text-white/40" };
  switch (category) {
    case "listen":
      return <Disc {...iconProps} />;
    case "library":
      return <Heart {...iconProps} />;
    case "social":
      return <Flame {...iconProps} />;
    case "explore":
      return <Compass {...iconProps} />;
    case "custom":
    default:
      return <Trophy {...iconProps} />;
  }
}

const CATEGORY_LABEL: Record<Achievement["category"], string> = {
  listen: "Listening", library: "Library", social: "Social", explore: "Explore", custom: "Personal",
};

export default function AchievementsScreen({ onBack }: { onBack: () => void }) {
  const { achievements, unlockedIds, progressFor } = usePlayer();

  const grouped = useMemo(() => {
    const g: Record<string, Achievement[]> = {};
    for (const a of achievements) (g[a.category] ??= []).push(a);
    return g;
  }, [achievements]);

  const pctUnlocked = Math.round((unlockedIds.length / achievements.length) * 100);

  return (
    <div className="fade-in flex h-full flex-col">
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-1">
        <IconButton onClick={onBack} label="Back"><Back size={20} /></IconButton>
        <p className="text-[14px] font-semibold text-white">Achievements</p>
        <span className="w-10" />
      </div>

      {/* Hero card */}
      <div className="mx-5 mt-3 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[var(--accent)]/25 via-[var(--ga)]/15 to-transparent p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Your progress</p>
            <p className="pt-1 text-[36px] font-extrabold leading-none text-white">
              {unlockedIds.length}
              <span className="text-[16px] font-medium text-white/45"> / {achievements.length}</span>
            </p>
            <p className="pt-1 text-[12px] text-white/60 flex items-center gap-1.5">
              <span>{pctUnlocked}% complete · keep the streak alive</span>
              <Flame size={14} className="text-amber-400 inline" />
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
            <Trophy size={36} />
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${pctUnlocked}%` }} />
        </div>
      </div>

      <div className="no-scrollbar smooth-scroll flex-1 space-y-4 overflow-y-auto px-5 pb-32 pt-4">
        {Object.entries(grouped).map(([cat, list]) => (
          <section key={cat}>
            <p className="pb-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/40">
              {CATEGORY_LABEL[cat as Achievement["category"]] ?? cat}
            </p>
            <div className="grid grid-cols-2 gap-2.5 stagger">
              {list.map((a) => {
                const done = unlockedIds.includes(a.id);
                const progress = Math.min(a.goal, progressFor(a.id));
                const pct = Math.round((progress / a.goal) * 100);
                return (
                  <div
                    key={a.id}
                    className={`relative overflow-hidden rounded-2xl border p-3 transition ${
                      done ? "border-[var(--accent)]/40 bg-[var(--accent)]/[0.08]" : "border-white/8 bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${done ? "bg-[var(--accent)]/20 border border-[var(--accent)]/30" : "bg-white/[0.06] border border-white/10 opacity-60"}`}>
                        <AchievementBadgeIcon category={a.category} done={done} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`clamp-1 text-[12.5px] font-bold ${done ? "text-white" : "text-white/70"}`}>{a.name}</p>
                        <p className="clamp-2 pt-0.5 text-[10.5px] leading-snug text-white/45">{a.desc}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div className={`h-full rounded-full transition-[width] duration-500 ${done ? "bg-[var(--accent)]" : "bg-white/40"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[9.5px] tabular-nums text-white/45">{Math.floor(progress)} / {a.goal} {a.unit}</span>
                        {done && <span className="text-[9.5px] font-bold text-[var(--accent)]">UNLOCKED</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

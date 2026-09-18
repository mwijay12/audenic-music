import { useEffect } from "react";
import { usePlayer } from "../player/PlayerContext";
import { nativeNotify, nativeVibrate } from "../player/nativeBridge";
import { speakWithElevenLabs } from "../player/elevenLabs";
import { X, Award } from "./Icons";

/**
 * Floating banner that pops down from the top whenever a new achievement
 * unlocks. Auto-dismisses on animation end, or when the user taps it.
 */
export function AchievementToast() {
  const { achievementToast, dismissAchievementToast } = usePlayer();

  useEffect(() => {
    if (!achievementToast) return;
    nativeVibrate(28);
    nativeNotify("Achievement unlocked", `${achievementToast.emoji} ${achievementToast.name} — ${achievementToast.desc}`);
    speakWithElevenLabs(`Achievement unlocked! ${achievementToast.name}. ${achievementToast.desc}`);
    const id = window.setTimeout(dismissAchievementToast, 4500);
    return () => window.clearTimeout(id);
  }, [achievementToast, dismissAchievementToast]);

  if (!achievementToast) return null;

  return (
    <div
      className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,36px)+12px)] z-[999] flex justify-center px-4 pointer-events-none"
    >
      <div
        className="pointer-events-auto flex max-w-[92vw] sm:max-w-md items-center gap-3.5 rounded-2xl border border-[var(--accent)]/50 bg-[#121217]/95 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_24px_color-mix(in_srgb,var(--accent)_35%,transparent)] backdrop-blur-2xl transition-all duration-300 animate-slide-down"
      >
        <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/20 text-[24px]">
          {achievementToast.emoji}
          <div className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--accent)] text-[#0A0A0D]">
            <Award size={10} />
          </div>
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent)]">
              Achievement Unlocked
            </p>
          </div>
          <p className="truncate text-[13.5px] font-bold text-white pt-0.5">
            {achievementToast.name}
          </p>
          <p className="truncate text-[11px] text-white/60">
            {achievementToast.desc}
          </p>
        </div>
        <button
          onClick={dismissAchievementToast}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition active:scale-95"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Sparkles, Disc } from "./Icons";

interface AppSplashScreenProps {
  onFinish: () => void;
  durationMs?: number;
}

const BOOT_STAGES = [
  { at: 0.1, text: "Initializing WebAudio 96kHz DSP engine..." },
  { at: 0.35, text: "Calibrating harmonic crossfade & transition curves..." },
  { at: 0.65, text: "Scanning acoustic profiles & library cache..." },
  { at: 0.88, text: "Synchronizing studio equalizers & visuals..." },
  { at: 0.98, text: "Ready for high fidelity playback" },
];

export function AppSplashScreen({ onFinish, durationMs = 3800 }: AppSplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Powering on Audenic Studio...");
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    let frameId: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const ratio = Math.min(1, elapsed / durationMs);
      const easedProgress = Math.min(100, Math.round(ratio * 100));
      setProgress(easedProgress);

      const currentStage = [...BOOT_STAGES].reverse().find((stage) => ratio >= stage.at);
      if (currentStage) {
        setStatusText(currentStage.text);
      }

      if (ratio >= 1) {
        setIsFadingOut(true);
        setTimeout(() => {
          onFinish();
        }, 600);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    const handleSkip = (e: KeyboardEvent | MouseEvent) => {
      if ("code" in e && e.code !== "Escape" && e.code !== "Space" && e.code !== "Enter") return;
      cancelAnimationFrame(frameId);
      setProgress(100);
      setIsFadingOut(true);
      setTimeout(onFinish, 300);
    };

    window.addEventListener("keydown", handleSkip);
    window.addEventListener("mousedown", handleSkip);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", handleSkip);
      window.removeEventListener("mousedown", handleSkip);
    };
  }, [durationMs, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#07070A] select-none transition-opacity duration-700 ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-[#8B3BFF]/25 via-[#3B6BFF]/20 to-[#FF61C7]/15 blur-[120px] animate-pulse" />
        <div className="absolute bottom-10 right-1/4 h-[350px] w-[350px] rounded-full bg-[#D9F27E]/10 blur-[140px]" />
      </div>

      {/* Main Splash Card */}
      <div className="relative z-10 flex flex-col items-center max-w-sm px-6 text-center">
        {/* Animated Glowing Vinyl / Logo Emblem */}
        <div className="relative mb-6">
          <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-[#8B3BFF] via-[#FF61C7] to-[#D9F27E] opacity-50 blur-xl animate-spin duration-[10000ms]" />
          <div className="relative grid h-24 w-24 place-items-center rounded-3xl border border-white/20 bg-black/60 shadow-2xl backdrop-blur-xl">
            <div className="relative flex items-center justify-center">
              <Disc size={46} className="text-[var(--accent)] animate-spin duration-[6000ms]" />
              <Sparkles size={20} className="absolute text-white animate-bounce" />
            </div>
          </div>
        </div>

        {/* App Title & Subtitle */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
          AUDENIC <span className="bg-gradient-to-r from-[#8B3BFF] via-[#FF61C7] to-[#D9F27E] bg-clip-text text-transparent">MUSIC</span>
        </h1>
        <p className="mt-1 text-xs font-medium text-white/50 tracking-wider uppercase">
          Studio Grade Audio & Cinematic Video
        </p>

        {/* Animated Frequency Bars */}
        <div className="mt-6 flex items-end justify-center gap-1.5 h-8">
          {[40, 75, 55, 90, 65, 85, 45, 95, 70, 50, 80, 60, 90, 40].map((h, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-gradient-to-t from-[var(--accent)] to-[#8B3BFF]"
              style={{
                height: `${Math.max(15, (h * (0.4 + (progress / 100) * 0.6)))}%`,
                animation: `pulse 1.${(i % 5) + 2}s ease-in-out infinite alternate`,
                animationDelay: `${i * 70}ms`,
              }}
            />
          ))}
        </div>

        {/* Loading Progress Bar */}
        <div className="mt-6 w-full">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10 p-0.5 border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8B3BFF] via-[#FF61C7] to-[#D9F27E] transition-all duration-150 ease-out shadow-[0_0_12px_rgba(217,242,126,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-white/40">
            <span className="truncate pr-2 text-left">{statusText}</span>
            <span className="shrink-0 font-bold text-white/80">{progress}%</span>
          </div>
        </div>

        {/* Skip Tip */}
        <p className="mt-8 text-[11px] text-white/30 hover:text-white/60 transition cursor-pointer">
          Click anywhere or press Esc to skip
        </p>
      </div>
    </div>
  );
}

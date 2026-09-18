import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "../player/PlayerContext";
import { IconButton, StatusBar } from "../components/Shell";
import { useGestures } from "../hooks/useGestures";
import { HoldZones } from "../components/HoldZones";
import {
  Back,
  Next,
  Pause,
  Play,
  Prev,
  Volume,
  Video,
  Trash,
  Eye,
  EyeOff,
  Headphones,
} from "../components/Icons";

export default function VideoPlayer({ onBack }: { onBack: () => void }) {
  const { localVideos, addLocalVideos, clearVideos, theme, gesturesOn, buzz } = usePlayer();
  const [activeId, setActiveId] = useState<string | null>(
    localVideos[0]?.id || null
  );
  const [isPlaying, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [audioOnly, setAudioOnly] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [vSpeed, setVSpeed] = useState(1);
  const [hint, setHint] = useState<string | null>(null);
  const ref = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Landscape videos live here; portrait 9:16s went to Reels automatically.
  const hVideos = useMemo(() => localVideos.filter((v) => v.kind !== "reel"), [localVideos]);
  const active = hVideos.find((v) => v.id === activeId) || hVideos[0] || null;

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const t = () => setProgress(v.currentTime);
    const m = () => setDuration(v.duration || 0);
    const onE = () => setPlaying(false);
    v.addEventListener("timeupdate", t);
    v.addEventListener("loadedmetadata", m);
    v.addEventListener("ended", onE);
    return () => {
      v.removeEventListener("timeupdate", t);
      v.removeEventListener("loadedmetadata", m);
      v.removeEventListener("ended", onE);
    };
  }, [activeId]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.volume = volume;
  }, [volume]);

  // keep the chosen playback rate applied across track changes / reloads
  useEffect(() => {
    const v = ref.current;
    if (v) v.playbackRate = vSpeed;
  }, [vSpeed, activeId]);

  const flash = (m: string) => { setHint(m); window.setTimeout(() => setHint(null), 900); };

  const gestures = useGestures({
    enabled: gesturesOn,
    onSwipeDown: () => onBack(),
    onDoubleTap: (x, w) => {
      const v = ref.current; if (!v) return;
      if (x < w * 0.33) { v.currentTime = Math.max(0, v.currentTime - 10); flash("−10s"); }
      else if (x > w * 0.67) { v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); flash("+10s"); }
      else { if (v.paused) v.play(); else v.pause(); }
    },
    onSingleTap: () => { const v = ref.current; if (!v) return; if (v.paused) v.play(); else v.pause(); },
  });

  if (!active) {
    return (
      <div className="fade-in flex h-full flex-col">
        <StatusBar />
        <div className="flex items-center justify-between px-6 pt-3">
          <IconButton onClick={onBack} label="Back">
            <Back size={20} />
          </IconButton>
          <p className="text-[15px] font-semibold text-white">Video Player</p>
          <span className="w-10" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div
            className="grid h-20 w-20 place-items-center rounded-3xl"
            style={{ background: theme.accent + "22" }}
          >
            <Video size={36} className="text-[var(--accent)]" />
          </div>
          <p className="pt-4 text-[18px] font-bold text-white">No videos yet</p>
          <p className="pt-2 text-[12px] text-white/50">
            Scan video files from your device — they play right here.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-6 rounded-full bg-[var(--accent)] px-5 py-2.5 text-[13px] font-bold text-black active:scale-95"
          >
            Scan video files
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            multiple
            hidden
            onChange={(e) => {
              addLocalVideos(e.target.files);
              setActiveId(null);
              setTimeout(() => {
                const arr = e.target.files;
                if (arr && arr.length) setActiveId(`vid-${Date.now()}-0`);
              }, 200);
            }}
          />
        </div>
      </div>
    );
  }

  const pct = duration ? (progress / duration) * 100 : 0;

  return (
    <div className="fade-in relative flex h-full flex-col overflow-hidden bg-black">
      <div {...gestures} className="relative flex-1 overflow-hidden bg-black" style={{ touchAction: "pan-y" }}>
        <video
          ref={ref}
          src={active.src}
          poster={active.cover}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${audioOnly ? "opacity-0" : "opacity-100"}`}
        />

        {/* Audio-only overlay: video keeps playing/producing sound underneath */}
        {audioOnly && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black">
            <img src={active.cover} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-3xl" />
            <div className="relative flex flex-col items-center">
              <div className={`grid h-24 w-24 place-items-center rounded-[30px] bg-[var(--accent)]/15 text-[var(--accent)] ${isPlaying ? "pulse-soft" : ""}`}>
                <Headphones size={38} />
              </div>
              <p className="mt-4 max-w-[220px] truncate text-center text-[15px] font-bold text-white">{active.title}</p>
              <p className="mt-1 text-[12px] text-white/40">Audio-only mode</p>
              <div className="mt-5 flex h-8 items-end gap-[3px]">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span key={i} className="w-[3px] rounded-full bg-[var(--accent)]" style={{ height: "40%", opacity: isPlaying ? 0.9 : 0.25, animation: isPlaying ? `viz ${0.4 + (i % 5) * 0.08}s ${i * 0.04}s ease-in-out infinite` : undefined }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Hold zones: left = rewind, right = 2x speed */}
        <HoldZones
          enabled={gesturesOn}
          onHoldStart={(side) => { const v = ref.current; if (!v) return; if (side === "right") { v.playbackRate = Math.min(4, vSpeed * 2); buzz(16); } }}
          onHoldTick={(side) => { const v = ref.current; if (!v || side !== "left") return; v.currentTime = Math.max(0, v.currentTime - 1); }}
          onHoldEnd={(side) => { const v = ref.current; if (!v || side !== "right") return; v.playbackRate = vSpeed; }}
          indicatorLeft={<><span className="text-[20px]">⏪</span><span className="text-[10px] font-semibold">Rewind</span></>}
          indicatorRight={<><span className="text-[20px]">⏩</span><span className="text-[10px] font-semibold">2× speed</span></>}
        />

        {!isPlaying && !audioOnly && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-black/55 text-white">
              <Play size={28} />
            </span>
          </div>
        )}
        {hint && <div className="pointer-events-none absolute left-1/2 top-[10%] z-20 -translate-x-1/2 pop-in rounded-full bg-black/70 px-3.5 py-1.5 text-[11.5px] font-semibold text-white backdrop-blur">{hint}</div>}
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/60 transition-opacity duration-300 ${chromeHidden ? "opacity-0" : "opacity-100"}`} />
        <div className={`absolute left-0 right-0 top-0 flex items-center justify-between p-4 pt-4 text-white transition-opacity duration-300 ${chromeHidden ? "pointer-events-none opacity-0" : "opacity-100"}`} style={{ paddingTop: "max(16px, env(safe-area-inset-top, 16px))" }}>
          <button onClick={onBack} className="press flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/45 backdrop-blur active:scale-95">
            <Back size={20} />
          </button>
          <p className="truncate px-2 text-[13.5px] font-semibold drop-shadow">{active.title}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => { setAudioOnly(a => !a); buzz(14); }} className={`press flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full backdrop-blur active:scale-95 ${audioOnly ? "bg-[var(--accent)] text-black" : "bg-black/45 text-white"}`} title="Audio only">
              <Headphones size={18} />
            </button>
            <button onClick={clearVideos} className="press flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/45 backdrop-blur active:scale-95">
              <Trash size={18} />
            </button>
          </div>
        </div>

        {/* Cinema-mode toggle, always reachable */}
        <button onClick={() => { setChromeHidden(h => !h); buzz(14); }} className="press absolute right-4 z-30 grid h-11 w-11 min-h-[44px] min-w-[44px] place-items-center rounded-full bg-black/40 text-white backdrop-blur active:scale-95" style={{ top: chromeHidden ? "max(12px, env(safe-area-inset-top, 12px))" : "max(72px, calc(env(safe-area-inset-top, 16px) + 56px))" }} title="Hide controls">
          {chromeHidden ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {/* controls */}
      {!chromeHidden && (
        <div className="bg-[#0A0A0D] px-5 pb-6 pt-3">
          <p className="truncate text-[12.5px] font-semibold text-white">
            {active.title}
          </p>
          <p className="text-[10.5px] text-white/40">
            {(active.size / 1048576).toFixed(1)} MB • local {audioOnly ? "• audio-only" : ""}
            {vSpeed !== 1 ? ` • ${vSpeed}×` : ""}
          </p>

          {/* Playback speed */}
          <div className="mt-2.5 flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/35">Speed</span>
            <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => { setVSpeed(s); buzz(10); }}
                  className={`press shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold transition ${vSpeed === s ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/55"}`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="w-10 text-right text-[10.5px] text-white/55">
              {fmt(progress)}
            </span>
            <div className="relative h-6 flex-1">
              <div className="absolute top-1/2 h-[7px] w-full -translate-y-1/2 rounded-full bg-white/12" />
              <div
                className="absolute top-1/2 h-[7px] -translate-y-1/2 rounded-full bg-gradient-to-r from-[var(--accent-soft)] to-[var(--accent)] transition-[width] duration-150"
                style={{ width: `${pct}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={progress}
                onChange={(e) => {
                  const v = ref.current!;
                  v.currentTime = Number(e.target.value);
                  setProgress(v.currentTime);
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div
                className="pointer-events-none absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_0_5px_color-mix(in_srgb,var(--accent)_22%,transparent)] transition-[left] duration-150"
                style={{ left: `${pct}%` }}
              />
            </div>
            <span className="w-10 text-[10.5px] text-white/55">{fmt(duration)}</span>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume size={16} className="text-white/55 shrink-0" />
              <div className="relative h-6 w-24 min-w-[80px] sm:w-32">
                <div className="absolute top-1/2 h-[6px] w-full -translate-y-1/2 rounded-full bg-white/12" />
                <div className="absolute top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[var(--accent)]" style={{ width: `${volume * 100}%` }} />
                <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                <div className="pointer-events-none absolute top-1/2 h-[16px] w-[16px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_20%,transparent)]" style={{ left: `${volume * 100}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const ix = hVideos.findIndex((v) => v.id === activeId);
                  const prev = hVideos[(ix - 1 + hVideos.length) % hVideos.length];
                  setActiveId(prev.id);
                }}
                className="press grid h-10 w-10 place-items-center rounded-full bg-white/[0.08] text-white"
              >
                <Prev size={16} />
              </button>
              <button
                onClick={() => {
                  const v = ref.current!;
                  if (v.paused) v.play();
                  else v.pause();
                  setPlaying(!v.paused);
                }}
                className="press grid h-14 w-14 place-items-center rounded-full bg-[var(--accent)] text-black"
              >
                {isPlaying ? <Pause size={22} /> : <Play size={22} />}
              </button>
              <button
                onClick={() => {
                  const ix = hVideos.findIndex((v) => v.id === activeId);
                  const nxt = hVideos[(ix + 1) % hVideos.length];
                  setActiveId(nxt.id);
                }}
                className="press grid h-10 w-10 place-items-center rounded-full bg-white/[0.08] text-white"
              >
                <Next size={16} />
              </button>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="press rounded-full bg-white/[0.08] px-3 py-1.5 text-[10.5px] font-medium text-white"
            >
              + Add
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              multiple
              hidden
              onChange={(e) => addLocalVideos(e.target.files)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

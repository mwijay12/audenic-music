import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { usePlayer } from "../player/PlayerContext";
import { audioEffectsRack } from "../player/audioEffects";
import {
  checkHarmonicMatch,
  analyzeTrackAudio,
  type TrackDJMetadata,
} from "../player/djEngine";
import {
  smartAutomix,
  rankHarmonicCandidates,
  getTrackMeta,
  type TransitionStyle,
  type HarmonicCandidate,
  getStoredTransitionStyle,
  setStoredTransitionStyle,
  TRANSITION_STYLES,
} from "../player/smartAutomix";
import {
  Play,
  Pause,
  Disc,
  Zap,
  RotateCcw,
  Check,
} from "../components/Icons";
import type { Track } from "../data/tracks";

export function DJMixerScreen({ onClose }: { onClose: () => void }) {
  const {
    current,
    isPlaying,
    toggle,
    duration,
    progress,
    seek,
    setSpeed,
    tracks,
    playTrack,
    getAudioElement,
  } = usePlayer();

  // Selected Incoming Track for Next Mix
  const [selectedNextTrack, setSelectedNextTrack] = useState<Track | null>(null);

  // Transition Settings
  const [transitionStyle, setTransitionStyleState] = useState<TransitionStyle>(getStoredTransitionStyle());
  const setTransitionStyle = (s: TransitionStyle) => {
    setTransitionStyleState(s);
    setStoredTransitionStyle(s);
  };
  const [transitionBars, setTransitionBars] = useState<number>(4); // 2, 4, 8 bars
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionProgress, setTransitionProgress] = useState<number>(0);
  const [autoPilot, setAutoPilot] = useState<boolean>(false);
  const [isHarmonicCollapsed, setIsHarmonicCollapsed] = useState<boolean>(false);

  // FX States
  const [filterVal, setFilterVal] = useState(0);
  const [reverbVal, setReverbVal] = useState(0);
  const [delayVal, setDelayVal] = useState(0);
  const [lowKill, setLowKill] = useState(false);
  const [midKill, setMidKill] = useState(false);
  const [highKill, setHighKill] = useState(false);

  // Pitch Fader (-16% .. +16%) & Pitch Bender
  const [pitch, setPitch] = useState(0);
  const [keyLock, setKeyLock] = useState(false);
  const [isBending, setIsBending] = useState<-1 | 0 | 1>(0);

  const toggleKeyLock = useCallback(() => {
    setKeyLock((prev) => {
      const next = !prev;
      const audio = document.querySelector("audio");
      if (audio) {
        (audio as any).preservesPitch = next;
        (audio as any).mozPreservesPitch = next;
        (audio as any).webkitPreservesPitch = next;
      }
      return next;
    });
  }, []);

  const handlePitchChange = useCallback((val: number) => {
    setPitch(val);
    setSpeed(1 + val / 100);
    const audio = document.querySelector("audio");
    if (audio) {
      (audio as any).preservesPitch = keyLock || val === 0;
      (audio as any).mozPreservesPitch = keyLock || val === 0;
      (audio as any).webkitPreservesPitch = keyLock || val === 0;
    }
  }, [keyLock, setSpeed]);

  // CUE Point & Preview State
  const [cuePoint, setCuePoint] = useState<number>(0);
  const cueHoldRef = useRef<boolean>(false);

  // Real Analyzed Metadata States
  const [realCurrentMeta, setRealCurrentMeta] = useState<TrackDJMetadata | null>(null);
  const [realIncomingMeta, setRealIncomingMeta] = useState<TrackDJMetadata | null>(null);

  // Metadata for current playing track
  const currentMeta: TrackDJMetadata = useMemo(() => {
    if (realCurrentMeta && realCurrentMeta.id === current?.id) {
      return realCurrentMeta;
    }
    if (!current) {
      return { id: "", bpm: 120, key: "Am", camelot: "8A", confidence: 0.9 };
    }
    return getTrackMeta(current);
  }, [current, realCurrentMeta]);

  // Run real audio decoding and BPM/Key detection in background when track loads
  useEffect(() => {
    if (current) {
      analyzeTrackAudio(current).then((meta) => {
        setRealCurrentMeta(meta);
      });
    }
  }, [current?.id]);

  // Ranked list of harmonically compatible songs
  const compatibleCandidates: HarmonicCandidate[] = useMemo(() => {
    if (!current || !tracks.length) return [];
    return rankHarmonicCandidates(current, tracks);
  }, [current, tracks]);

  // Default next track if none explicitly selected
  const activeIncomingTrack: Track | null = useMemo(() => {
    if (selectedNextTrack && selectedNextTrack.id !== current?.id) {
      return selectedNextTrack;
    }
    return compatibleCandidates[0]?.track || null;
  }, [selectedNextTrack, current?.id, compatibleCandidates]);

  // Run real audio analysis on incoming candidate
  useEffect(() => {
    if (activeIncomingTrack) {
      analyzeTrackAudio(activeIncomingTrack).then((meta) => {
        setRealIncomingMeta(meta);
      });
    }
  }, [activeIncomingTrack?.id]);

  // Metadata for incoming track
  const incomingMeta: TrackDJMetadata | null = useMemo(() => {
    if (realIncomingMeta && realIncomingMeta.id === activeIncomingTrack?.id) {
      return realIncomingMeta;
    }
    if (!activeIncomingTrack) return null;
    return getTrackMeta(activeIncomingTrack);
  }, [activeIncomingTrack, realIncomingMeta]);

  // Harmonic match evaluation between current and incoming
  const harmonicMatch = useMemo(() => {
    if (!currentMeta.camelot || !incomingMeta?.camelot) {
      return { compatible: false, type: "none" as const, description: "Unknown key" };
    }
    return checkHarmonicMatch(currentMeta.camelot, incomingMeta.camelot);
  }, [currentMeta.camelot, incomingMeta?.camelot]);

  // CUE Handlers (Authentic CDJ / VirtualDJ behavior)
  const handleCueClick = () => {
    if (isPlaying) {
      seek(cuePoint);
      toggle();
    } else {
      setCuePoint(progress);
    }
  };

  const handleCueMouseDown = () => {
    if (!isPlaying) {
      cueHoldRef.current = true;
      seek(cuePoint);
      toggle();
    }
  };

  const handleCueMouseUp = () => {
    if (cueHoldRef.current) {
      cueHoldRef.current = false;
      toggle();
      seek(cuePoint);
    }
  };

  // FX Handlers
  const handleFilterChange = (val: number) => {
    setFilterVal(val);
    audioEffectsRack.setDJFilter(val);
  };

  const handleReverbChange = (val: number) => {
    setReverbVal(val);
    audioEffectsRack.setReverb(val, "hall");
  };

  const handleDelayChange = (val: number) => {
    setDelayVal(val);
    audioEffectsRack.setDelay(val);
  };

  const toggleKill = (band: "low" | "mid" | "high") => {
    if (band === "low") {
      const next = !lowKill;
      setLowKill(next);
      audioEffectsRack.setKill("low", next);
    } else if (band === "mid") {
      const next = !midKill;
      setMidKill(next);
      audioEffectsRack.setKill("mid", next);
    } else if (band === "high") {
      const next = !highKill;
      setHighKill(next);
      audioEffectsRack.setKill("high", next);
    }
  };

  const resetAllFX = () => {
    handleFilterChange(0);
    handleReverbChange(0);
    handleDelayChange(0);
    setLowKill(false);
    setMidKill(false);
    setHighKill(false);
    audioEffectsRack.setKill("low", false);
    audioEffectsRack.setKill("mid", false);
    audioEffectsRack.setKill("high", false);
    setPitch(0);
    setSpeed(1);
  };

  // Trigger Smart Automix Overlapping Morph Transition
  const triggerAutomix = useCallback(async () => {
    if (!activeIncomingTrack || isTransitioning) return;
    setIsTransitioning(true);
    setTransitionProgress(0);

    const durationMs = transitionBars * 2000; // 4 bars = 8s, 2 bars = 4s, 8 bars = 16s
    const audioEl = getAudioElement() || document.querySelector("audio");

    await smartAutomix.executeTransition({
      style: transitionStyle,
      durationMs,
      incomingTrack: activeIncomingTrack,
      outgoingAudio: audioEl,
      onProgress: (pct) => setTransitionProgress(pct),
      onComplete: (incomingPosSec) => {
        playTrack(activeIncomingTrack.id, incomingPosSec);
        setSelectedNextTrack(null);
      },
    });

    setIsTransitioning(false);
    setTransitionProgress(0);
  }, [activeIncomingTrack, isTransitioning, transitionBars, transitionStyle, playTrack, seek]);

  // Auto-Pilot: automatically initiate smart transition when outro is reached (<14s remaining)
  useEffect(() => {
    if (!autoPilot || !isPlaying || isTransitioning || !duration || !progress) return;
    const remaining = duration - progress;
    if (remaining > 0 && remaining <= 13 && activeIncomingTrack) {
      triggerAutomix();
    }
  }, [autoPilot, isPlaying, isTransitioning, duration, progress, activeIncomingTrack, triggerAutomix]);

  const formatTime = (s: number) => {
    if (isNaN(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r < 10 ? "0" : ""}${r}`;
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#070709] text-white select-none min-h-0">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-cyan-400 text-black shadow-lg">
            <Disc size={18} />
          </span>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              Audenic Virtual DJ & Automix Station
              <span className="rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 px-2 py-0.5 text-[9px] font-bold text-[var(--accent)]">
                HARMONIC MIXER
              </span>
            </h1>
            <p className="text-[11px] text-white/40">
              Camelot key blending · Resonant DSP transitions · Beat-synced auto-flow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={resetAllFX}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition"
          >
            <RotateCcw size={13} />
            <span>Reset FX</span>
          </button>

          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition"
            title="Close DJ Studio"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Main Studio Body: Grid Layout */}
      <div className="flex flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6 gap-5 w-full max-w-full">
        {/* ================= LEFT / HERO: ACTIVE DECK ================= */}
        <div className="flex flex-1 min-w-0 flex-col rounded-3xl border border-white/10 bg-gradient-to-b from-[#121217] to-[#0A0A0D] p-5 shadow-2xl min-h-0">
          {/* Deck Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-[var(--accent)] px-2.5 py-0.5 text-[10px] font-black tracking-wider text-black uppercase">
                ON AIR
              </span>
              <span className="text-xs font-semibold text-white/50">Active Deck</span>
            </div>

            {/* Key & BPM Badges */}
            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-3 py-1 text-xs font-mono font-bold text-[var(--accent)]">
                {currentMeta.bpm} BPM
              </span>
              <span className="rounded-xl border border-purple-500/40 bg-purple-500/15 px-3 py-1 text-xs font-mono font-bold text-purple-300">
                {currentMeta.camelot} · {currentMeta.key}
              </span>
            </div>
          </div>

          {/* Turntable Vinyl Center Stage */}
          <div className="my-4 flex items-center justify-center">
            <div className="relative flex items-center justify-center p-3 rounded-full bg-[#08080C] border border-white/[0.07] shadow-inner">
              {/* Vinyl Groove Outer Disc with Ambient Glow */}
              <div
                className={`relative grid h-44 w-44 sm:h-48 sm:w-48 lg:h-52 lg:w-52 place-items-center rounded-full border-[6px] border-[#181820] bg-[#0A0A0E] shadow-[0_0_45px_rgba(0,0,0,0.9),0_0_20px_color-mix(in_srgb,var(--accent)_15%,transparent)] transition-transform duration-300 ${
                  isPlaying ? "animate-[spin_4.5s_linear_infinite]" : ""
                }`}
                style={{
                  backgroundImage:
                    "radial-gradient(circle, transparent 28%, rgba(255,255,255,0.04) 29%, transparent 30%, transparent 48%, rgba(255,255,255,0.04) 49%, transparent 50%, transparent 68%, rgba(255,255,255,0.04) 69%, transparent 70%)",
                }}
              >
                {/* Center Record Label */}
                <div className="h-20 w-20 sm:h-22 sm:w-22 overflow-hidden rounded-full border-2 border-black shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]">
                  <img
                    src={current?.cover || ""}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                {/* Stylized vinyl reflection sheen */}
                <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/[0.04] to-transparent" />
                {/* Spindle */}
                <div className="absolute h-4 w-4 rounded-full border border-white/40 bg-gradient-to-br from-white via-neutral-300 to-neutral-700 shadow-md" />
              </div>
            </div>
          </div>

          {/* Track Info */}
          <div className="text-center min-w-0">
            <h2 className="truncate text-lg font-bold text-white">
              {current?.title || "No Track Loaded"}
            </h2>
            <p className="truncate text-xs text-white/50 pt-0.5">
              {current?.artist || "Select a song from library"}
            </p>
          </div>

          {/* Progress & Time */}
          <div className="mt-4 flex items-center gap-3 font-mono text-[11px] text-white/40">
            <span>{formatTime(progress)}</span>
            <div className="relative flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-150"
                style={{
                  width: `${duration > 0 ? (progress / duration) * 100 : 0}%`,
                }}
              />
            </div>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Deck Controls: Pitch Bender & Transport */}
          <div className="mt-auto pt-3 space-y-2.5">
            {/* Pitch Bender Section */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/60">
                    PITCH BENDER
                  </span>
                  <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded ${
                    keyLock
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                      : "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40"
                  }`}>
                    {keyLock ? "KEY LOCKED" : "VINYL PITCH"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleKeyLock}
                    className={`rounded-lg px-2 py-0.5 text-[9.5px] font-bold transition ${
                      keyLock
                        ? "bg-purple-500/30 text-purple-300 border border-purple-500/50"
                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                    }`}
                    title="Key Lock: When ON, tempo changes without pitch. When OFF, pitch bends like real vinyl."
                  >
                    KEY LOCK
                  </button>

                  <button
                    onClick={() => handlePitchChange(0)}
                    className="text-[10px] font-mono font-bold text-[var(--accent)] hover:underline"
                    title="Reset pitch to 0%"
                  >
                    {pitch > 0 ? `+${pitch}` : pitch}% [RESET]
                  </button>
                </div>
              </div>

              {/* Slider & Nudge Buttons */}
              <div className="flex items-center gap-2">
                {/* Bend Down Momentary Button */}
                <button
                  onMouseDown={() => {
                    setSpeed(1 + (pitch - 6) / 100);
                    setIsBending(-1);
                  }}
                  onMouseUp={() => {
                    setSpeed(1 + pitch / 100);
                    setIsBending(0);
                  }}
                  onMouseLeave={() => {
                    if (isBending === -1) {
                      setSpeed(1 + pitch / 100);
                      setIsBending(0);
                    }
                  }}
                  onTouchStart={() => {
                    setSpeed(1 + (pitch - 6) / 100);
                    setIsBending(-1);
                  }}
                  onTouchEnd={() => {
                    setSpeed(1 + pitch / 100);
                    setIsBending(0);
                  }}
                  className={`rounded-xl px-2.5 py-1 text-[9.5px] font-black transition active:scale-95 select-none ${
                    isBending === -1
                      ? "bg-amber-400 text-black shadow-lg"
                      : "bg-white/[0.08] text-white/70 hover:bg-white/15 hover:text-white"
                  }`}
                  title="Hold to momentarily bend pitch down (-6%)"
                >
                  - BEND
                </button>

                <input
                  type="range"
                  min="-16"
                  max="16"
                  step="0.2"
                  value={pitch}
                  onChange={(e) => handlePitchChange(Number(e.target.value))}
                  className="flex-1 accent-[var(--accent)] cursor-pointer h-1.5"
                />

                {/* Bend Up Momentary Button */}
                <button
                  onMouseDown={() => {
                    setSpeed(1 + (pitch + 6) / 100);
                    setIsBending(1);
                  }}
                  onMouseUp={() => {
                    setSpeed(1 + pitch / 100);
                    setIsBending(0);
                  }}
                  onMouseLeave={() => {
                    if (isBending === 1) {
                      setSpeed(1 + pitch / 100);
                      setIsBending(0);
                    }
                  }}
                  onTouchStart={() => {
                    setSpeed(1 + (pitch + 6) / 100);
                    setIsBending(1);
                  }}
                  onTouchEnd={() => {
                    setSpeed(1 + pitch / 100);
                    setIsBending(0);
                  }}
                  className={`rounded-xl px-2.5 py-1 text-[9.5px] font-black transition active:scale-95 select-none ${
                    isBending === 1
                      ? "bg-[var(--accent)] text-black shadow-lg"
                      : "bg-white/[0.08] text-white/70 hover:bg-white/15 hover:text-white"
                  }`}
                  title="Hold to momentarily bend pitch up (+6%)"
                >
                  + BEND
                </button>
              </div>
            </div>

            {/* Transport Buttons */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleCueClick}
                onMouseDown={handleCueMouseDown}
                onMouseUp={handleCueMouseUp}
                onMouseLeave={handleCueMouseUp}
                title={isPlaying ? "Jump to CUE point and pause" : `Set CUE point (${formatTime(cuePoint)}) or hold to preview`}
                className={`rounded-2xl px-5 py-2 text-xs font-bold transition active:scale-95 ${
                  cuePoint > 0
                    ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40 shadow-[0_0_12px_rgba(200,242,73,0.2)]"
                    : "bg-white/[0.08] text-white hover:bg-white/15"
                }`}
              >
                CUE
              </button>
              <button
                onClick={toggle}
                className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent)] text-black shadow-lg transition active:scale-90 hover:brightness-110"
              >
                {isPlaying ? (
                  <Pause size={18} />
                ) : (
                  <Play size={18} />
                )}
              </button>
              <button
                onClick={triggerAutomix}
                disabled={isTransitioning || !activeIncomingTrack}
                className="rounded-2xl bg-white/[0.08] px-4 py-2 text-xs font-bold text-white hover:bg-white/15 transition active:scale-95 disabled:opacity-40"
              >
                NEXT MIX
              </button>
            </div>
          </div>
        </div>

        {/* ================= CENTER: SMART AUTOMIX TRANSITION HUB ================= */}
        <div className="flex w-72 shrink-0 flex-col rounded-3xl border border-white/10 bg-[#0C0C10] p-4 shadow-2xl min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <p className="text-[11px] font-black uppercase tracking-wider text-white/40">
              DSP AUTOMIX PROCESSOR
            </p>
            {/* Auto-Pilot Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer" title="Auto-mix at song outro">
              <span className="text-[10px] font-semibold text-white/50">Auto-Pilot</span>
              <input
                type="checkbox"
                checked={autoPilot}
                onChange={(e) => setAutoPilot(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer"
              />
            </label>
          </div>

          {/* Transition Style Selector */}
          <div className="mt-3">
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5">
              TRANSITION STYLE
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {TRANSITION_STYLES.map((style) => {
                const isSelected = transitionStyle === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => setTransitionStyle(style.id)}
                    className={`flex flex-col text-left rounded-xl px-3 py-2 border transition ${
                      isSelected
                        ? "border-[var(--accent)]/60 bg-[var(--accent)]/10 text-white shadow-[0_0_15px_color-mix(in_srgb,var(--accent)_15%,transparent)]"
                        : "border-white/[0.06] bg-white/[0.02] text-white/70 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-2">
                        <span className="grid h-5 w-5 place-items-center rounded-lg bg-white/5 shrink-0">
                          {style.iconId === "filter" && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isSelected ? "text-[var(--accent)]" : "text-white/70"}>
                              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                            </svg>
                          )}
                          {style.iconId === "echo" && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isSelected ? "text-cyan-300" : "text-white/70"}>
                              <path d="M11 5L6 9H2v6h4l5 4V5z" />
                              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                          )}
                          {style.iconId === "reverb" && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isSelected ? "text-purple-300" : "text-white/70"}>
                              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                            </svg>
                          )}
                          {style.iconId === "loop" && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isSelected ? "text-amber-300" : "text-white/70"}>
                              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </svg>
                          )}
                          {style.iconId === "fade" && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isSelected ? "text-[var(--accent)]" : "text-white/70"}>
                              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                            </svg>
                          )}
                        </span>
                        <span>{style.name}</span>
                      </span>
                    </div>
                    <span className="text-[10px] text-white/40 pl-7">{style.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transition Duration */}
          <div className="mt-3">
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1.5">
              LENGTH
            </p>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {[
                { bars: 2, label: "2 Bars (4s)" },
                { bars: 4, label: "4 Bars (8s)" },
                { bars: 8, label: "8 Bars (16s)" },
              ].map((item) => (
                <button
                  key={item.bars}
                  onClick={() => setTransitionBars(item.bars)}
                  className={`rounded-xl py-1.5 font-bold border transition ${
                    transitionBars === item.bars
                      ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                      : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Big Tactile "MIX NOW" Trigger */}
          <div className="mt-4 pt-3 border-t border-white/[0.06]">
            <button
              onClick={triggerAutomix}
              disabled={isTransitioning || !activeIncomingTrack}
              className={`relative overflow-hidden flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-black uppercase tracking-wider shadow-xl transition active:scale-95 disabled:opacity-40 ${
                isTransitioning
                  ? "bg-gradient-to-r from-purple-600 to-[var(--accent)] text-white"
                  : "bg-[var(--accent)] text-black hover:brightness-110"
              }`}
            >
              {isTransitioning && (
                <div
                  className="absolute left-0 inset-y-0 bg-white/25 transition-all duration-100"
                  style={{ width: `${transitionProgress}%` }}
                />
              )}
              <Zap size={15} />
              <span>
                {isTransitioning
                  ? `TRANSITIONING ${transitionProgress}%`
                  : activeIncomingTrack
                  ? `MIX NOW ➔ ${activeIncomingTrack.title.slice(0, 14)}...`
                  : "SELECT NEXT TRACK"}
              </span>
            </button>
          </div>

          {/* Master DSP Knobs */}
          <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-3">
            {/* Filter Sweep Knob */}
            <div>
              <div className="flex justify-between items-center mb-1 text-[10px] font-bold text-white/60">
                <span>FILTER SWEEP</span>
                <span className="font-mono text-[var(--accent)]">
                  {filterVal < 0 ? `LP ${filterVal}` : filterVal > 0 ? `HP +${filterVal}` : "BYPASS"}
                </span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={filterVal}
                onChange={(e) => handleFilterChange(Number(e.target.value))}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
            </div>

            {/* Delay & Reverb row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-center mb-1 text-[10px] font-bold text-white/60">
                  <span>ECHO</span>
                  <span className="font-mono text-cyan-300">{delayVal}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={delayVal}
                  onChange={(e) => handleDelayChange(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1 text-[10px] font-bold text-white/60">
                  <span>REVERB</span>
                  <span className="font-mono text-purple-300">{reverbVal}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={reverbVal}
                  onChange={(e) => handleReverbChange(Number(e.target.value))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
              </div>
            </div>

            {/* EQ Kills */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                onClick={() => toggleKill("high")}
                className={`rounded-lg py-1 text-[9px] font-black transition ${
                  highKill ? "bg-rose-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}
              >
                HI KILL
              </button>
              <button
                onClick={() => toggleKill("mid")}
                className={`rounded-lg py-1 text-[9px] font-black transition ${
                  midKill ? "bg-rose-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}
              >
                MID KILL
              </button>
              <button
                onClick={() => toggleKill("low")}
                className={`rounded-lg py-1 text-[9px] font-black transition ${
                  lowKill ? "bg-rose-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}
              >
                LOW KILL
              </button>
            </div>
          </div>
        </div>

        {/* ================= RIGHT: HARMONIC NEXT TRACK SELECTOR ================= */}
        {isHarmonicCollapsed ? (
          <div
            onClick={() => setIsHarmonicCollapsed(false)}
            title="Expand Harmonic Match Candidates"
            className="flex w-12 shrink-0 flex-col items-center justify-between rounded-3xl border border-white/10 bg-[#0A0A0D]/90 py-4 px-1 shadow-2xl cursor-pointer hover:border-[var(--accent)]/40 hover:bg-[#0E0E14] transition group select-none"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsHarmonicCollapsed(false);
              }}
              className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 group-hover:bg-[var(--accent)] group-hover:text-black text-white/70 transition"
              title="Expand Harmonic Matches"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div className="flex-1 flex items-center justify-center my-4">
              <span className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold tracking-widest uppercase text-white/50 group-hover:text-[var(--accent)] transition whitespace-nowrap">
                HARMONIC MATCHES ({compatibleCandidates.length})
              </span>
            </div>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[9px] font-bold text-[var(--accent)]">
              {compatibleCandidates.length}
            </span>
          </div>
        ) : (
          <div className="flex w-80 shrink-0 flex-col rounded-3xl border border-white/10 bg-[#0A0A0D]/90 p-4 shadow-2xl min-h-0">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-white/40">
                  HARMONIC MATCH CANDIDATES
                </p>
                <p className="text-[10px] text-white/40">
                  Ranked by VirtualDJ Camelot compatibility & tempo
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {activeIncomingTrack && (
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                    Target: {activeIncomingTrack.title.slice(0, 10)}
                  </span>
                )}
                <button
                  onClick={() => setIsHarmonicCollapsed(true)}
                  title="Collapse Harmonic Matches panel"
                  className="grid h-7 w-7 place-items-center rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Active Target Banner */}
            {activeIncomingTrack && incomingMeta && (
              <div className="my-3 flex items-center justify-between rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <img
                    src={activeIncomingTrack.cover}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-xl object-cover border border-white/10"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {activeIncomingTrack.title}
                    </p>
                    <p className="text-[10.5px] text-white/50 truncate">
                      {activeIncomingTrack.artist}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 pl-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-[var(--accent)]">
                      {incomingMeta.bpm} BPM
                    </span>
                    <span className="font-mono text-xs font-bold text-purple-300">
                      {incomingMeta.camelot}
                    </span>
                  </div>
                  <span className="text-[9.5px] text-white/50 pt-0.5">
                    {harmonicMatch.description}
                  </span>
                </div>
              </div>
            )}

            {/* Candidate Songs Scrollable List */}
            <div className="flex-1 space-y-2 overflow-y-auto pr-1 min-h-0">
              {compatibleCandidates.length === 0 ? (
                <div className="py-20 text-center text-xs text-white/40">
                  No other songs in library to match with.
                </div>
              ) : (
                compatibleCandidates.map((cand) => {
                  const isSelected = activeIncomingTrack?.id === cand.track.id;
                  return (
                    <div
                      key={cand.track.id}
                      onClick={() => setSelectedNextTrack(cand.track)}
                      className={`group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-2.5 transition ${
                        isSelected
                          ? "border-[var(--accent)]/70 bg-[var(--accent)]/10 text-white shadow-lg"
                          : "border-white/[0.06] bg-white/[0.02] text-white/70 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <img
                          src={cand.track.cover}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-xl object-cover"
                        />
                        <div className="overflow-hidden">
                          <p className="truncate text-xs font-semibold leading-tight">
                            {cand.track.title}
                          </p>
                          <p className="text-[10px] text-white/40 truncate pt-0.5">
                            {cand.track.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Compatibility Badge */}
                        <div className="flex flex-col items-end text-right">
                          <span
                            className={`rounded-lg px-2 py-0.5 text-[9.5px] font-bold ${
                              cand.harmonicScore >= 95
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : cand.harmonicScore >= 85
                                ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30"
                                : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            }`}
                          >
                            {cand.totalScore}% · {cand.meta.camelot}
                          </span>
                          <span className="text-[9px] font-mono text-white/40 pt-0.5">
                            {cand.meta.bpm} BPM
                          </span>
                        </div>

                        {isSelected ? (
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-black">
                            <Check size={12} />
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedNextTrack(cand.track);
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/60 hover:text-white transition"
                          >
                            Cue
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

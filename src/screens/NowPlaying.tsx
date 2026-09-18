import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, usePlayer } from "../player/PlayerContext";
import { IconButton, StatusBar, SafeImage } from "../components/Shell";
import { Equalizer } from "./Equalizer";
import { useGestures } from "../hooks/useGestures";
import { HoldZones } from "../components/HoldZones";
import { ArtworkViz, BarsViz, WaveViz, VIZ_STYLES, ART_SHAPES } from "../components/Visualizers";
import { LANGUAGES, translateLines } from "../player/gemini";
import { Back, Equalizer as EqIcon, Heart, Next, Pause, Play, Prev, Queue, Repeat as RepeatIcon, Share, Shuffle, Sparkle, Target, Timer as TimerIcon, Trash, ChevronUp, ChevronDown, Check } from "../components/Icons";
import { nativeVibrate, nativeShare, shareImage } from "../player/nativeBridge";
import { fetchLyricsViaGemini, transcribeViaGemini } from "../player/lyricsService";
import { useLrcLyrics } from "../player/useLrcLyrics";
import SyncedLyrics from "../components/SyncedLyrics";
import { MarqueeText } from "../components/Marquee";
import { renderShareCard, type ShareTemplate } from "../player/recommend";
import ScrollReveal from "../components/ScrollReveal";

type Sheet = null | "queue" | "lyrics" | "viz" | "timer" | "share";

export default function NowPlaying({ onBack, onOpenSettings, onOpenArtist: _onOpenArtist }: { onBack: () => void; onOpenSettings: () => void; onOpenArtist: (n: string) => void }) {
  const {
    current, isPlaying, toggle, next, prev, progress, duration, seek, seekBy,
    shuffle, setShuffle, repeat, setRepeat, liked, toggleLike, loadingSrc,
    tracks, playTrack, crossfade, setCrossfade, geminiKey, translateLang, setTranslateLang,
    showLyrics: _showLyrics, sleepTimer, setSleepTimer, sleepRemaining, gesturesOn, buzz,
    setHoldSpeed,
    vizStyle, setVizStyle, artShape, setArtShape,
    queueIds, moveInQueue, removeFromQueue, resetQueue,
    customLyrics, setTrackLyrics, theme, spectrum,
  } = usePlayer();

  const [sheet, setSheet] = useState<Sheet>(null);
  const [showEq, setShowEq] = useState(false);
  const [translateOn, setTranslateOn] = useState(false);
  const [translated, setTranslated] = useState<string[] | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateErr, setTranslateErr] = useState<string | null>(null);
  const [burst, setBurst] = useState<{ x: number; heart: boolean } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [lyricTab, setLyricTab] = useState<"read" | "translate" | "edit" | "sing" | "settings">("read");
  const [lyricDraft, setLyricDraft] = useState("");
  const [locateFlash, setLocateFlash] = useState(false);
  const [shareTpl, setShareTpl] = useState<ShareTemplate>("pulse");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  // Dedicated lyrics settings
  const [lyricFontSize, setLyricFontSize] = useState<"sm" | "md" | "lg" | "xl">(() => {
    return (localStorage.getItem("audenic_lyric_font_size") as any) || "md";
  });
  const [lyricFontFamily, setLyricFontFamily] = useState<"sans" | "serif" | "mono">(() => {
    return (localStorage.getItem("audenic_lyric_font_family") as any) || "sans";
  });
  const [enableScrollReveal, setEnableScrollReveal] = useState<boolean>(() => {
    return localStorage.getItem("audenic_lyric_reveal") !== "false";
  });

  // Tier 2 & Tier 3 Lyrics States
  const [aiLyrics, setAiLyrics] = useState<string[] | null>(null);
  const [aiLyricsLoading, setAiLyricsLoading] = useState(false);
  const [aiLyricsHidden, setAiLyricsHidden] = useState(false);
  const [aiLyricsReported, setAiLyricsReported] = useState(false);

  const [singingActive, setSingingActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [performanceUrl, setPerformanceUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const lrc = useLrcLyrics({
    audioPath: (current as any)?.path || null,
    audioElement: null,
    isPlaying,
    isLocalTrack: (current as any)?.isLocal || false,
  });

  const queueRef = useRef<HTMLDivElement>(null);
  const currentRowRef = useRef<HTMLDivElement>(null);

  // Resolve lyrics: user-edited (highest priority) → track defaults
  const lyrics = current ? (customLyrics[current.id] ?? current.lyrics ?? []) : [];
  const isCustomLyrics = current ? !!customLyrics[current.id] : false;

  useEffect(() => { setTranslated(null); setTranslateErr(null); }, [current?.id]);
  useEffect(() => { setLyricDraft(lyrics.join("\n")); }, [current?.id]);

  // Tier 2 — AI Lyrics Fallback when track has no local .lrc
  useEffect(() => {
    setAiLyrics(null);
    setAiLyricsHidden(false);
    setAiLyricsReported(false);
    if (!current || lyrics.length > 0) return;
    let abort = false;
    setAiLyricsLoading(true);
    fetchLyricsViaGemini(current.title, current.artist, geminiKey).then((res) => {
      if (abort) return;
      setAiLyricsLoading(false);
      if (res.found && res.lyrics) {
        setAiLyrics(res.lyrics.split("\n").map((l) => l.trim()).filter(Boolean));
      }
    });
    return () => { abort = true; };
  }, [current?.id, lyrics.length, geminiKey]);

  const startSingAlong = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      setLiveTranscript([]);
      setPerformanceUrl(null);
      setSingingActive(true);

      const mimeType = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/aac";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          setTranscribing(true);
          const reader = new FileReader();
          reader.readAsDataURL(e.data);
          reader.onloadend = async () => {
            const base64 = reader.result as string;
            const text = await transcribeViaGemini(base64, mimeType, geminiKey);
            setTranscribing(false);
            if (text) setLiveTranscript((prev) => [...prev, text]);
          };
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setPerformanceUrl(URL.createObjectURL(fullBlob));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(4000);
      flash("Sing-Along active");
    } catch {
      flash("Microphone access denied");
    }
  };

  const stopSingAlong = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setSingingActive(false);
    flash("Sing-Along stopped");
  };

  useEffect(() => {
    if (!translateOn || !current) return;
    let abort = false; setTranslating(true); setTranslateErr(null);
    translateLines(lyrics, translateLang, geminiKey).then((res) => {
      if (abort) return; setTranslating(false);
      if (res.error === "no-key") { setTranslateErr("no-key"); setTranslated(null); }
      else if (res.error) { setTranslateErr(res.error); setTranslated(null); }
      else setTranslated(res.lines);
    });
    return () => { abort = true; };
  }, [translateOn, translateLang, current?.id, lyrics.length]);

  // Render the share card whenever the studio opens or the template changes.
  useEffect(() => {
    if (sheet !== "share" || !current) return;
    let live = true;
    setRendering(true);
    const idx = duration > 0 ? Math.min(lyrics.length - 1, Math.floor((progress / duration) * lyrics.length)) : 0;
    renderShareCard(
      { title: current.title, artist: current.artist, cover: current.cover },
      lyrics[idx] ?? null,
      shareTpl,
      theme.accent,
      spectrum(),
    ).then((url) => { if (live) { setShareUrl(url); setRendering(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, shareTpl, current?.id]);

  const flash = (msg: string) => { setHint(msg); window.setTimeout(() => setHint(null), 900); };

  const openSheet = (s: Sheet) => { setSheet(s); nativeVibrate(12); };

  const gestures = useGestures({
    enabled: gesturesOn && !showEq && !sheet,
    onSwipeLeft: () => { next(); flash("Next ›"); },
    onSwipeRight: () => { prev(); flash("‹ Previous"); },
    onSwipeUp: () => { openSheet("queue"); flash("Queue"); },
    onSwipeDown: () => { onBack(); },
    onDoubleTap: () => {
      if (current) {
        toggleLike(current.id);
        setBurst({ x: 50, heart: true });
        flash(liked.includes(current.id) ? "Unliked" : "Liked ❤️");
      }
      window.setTimeout(() => setBurst(null), 750);
    },
    onSingleTap: () => { toggle(); },
  });

  const locateCurrent = () => {
    if (queueRef.current && currentRowRef.current) {
      const parent = queueRef.current;
      const child = currentRowRef.current;
      const top = child.offsetTop - parent.offsetTop - (parent.clientHeight / 2) + (child.clientHeight / 2);
      parent.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
    setLocateFlash(true);
    buzz(14);
    window.setTimeout(() => setLocateFlash(false), 900);
  };

  if (!current) return null;
  const pct = duration ? (progress / duration) * 100 : 0;

  if (showEq) return <div className="relative flex h-full flex-col overflow-hidden"><StatusBar /><Equalizer onClose={() => setShowEq(false)} /></div>;

  const queueTracks = queueIds.map((id) => tracks.find((t) => t.id === id)).filter(Boolean) as typeof tracks;

  return (
    <div className="fade-in relative flex h-full flex-col overflow-hidden">
      {/* backdrop */}
      <SafeImage src={current.cover} fallbackText={current.title} alt="" className="absolute inset-x-0 top-0 h-[62%] w-full scale-125 object-cover opacity-40 blur-2xl transition-opacity duration-700" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-[#0A0A0D]/88 to-[#0A0A0D]" />

      {/* hint bubble — dead-centre, same motion language as the achievement toast */}
      {hint && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-10">
          <div className="pointer-events-none absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
          <div className="toast-center relative rounded-2xl border border-[var(--accent)]/40 bg-[#141418]/95 px-5 py-3.5 text-center shadow-[0_20px_60px_-18px_color-mix(in_srgb,var(--accent)_55%,transparent)]">
            <p className="text-[13px] font-bold text-white">{hint}</p>
          </div>
        </div>
      )}

      <div className="relative flex h-full flex-col">
        <StatusBar />

        {/* Header: Back | Title/Artist | Timer | Like */}
        <div className="flex shrink-0 items-center gap-2 px-5 pt-1">
          <IconButton onClick={onBack} label="Back"><Back size={20} /></IconButton>
          <div className="min-w-0 flex-1 px-1 text-center">
            <MarqueeText text={current.title} className="text-[13px] font-bold text-white" />
            <p className="clamp-1 text-[10px] text-[var(--accent)]">{current.artist}</p>
          </div>
          <button
            onClick={() => openSheet(sheet === "timer" ? null : "timer")}
            className={`press relative grid h-10 w-10 place-items-center rounded-full backdrop-blur transition ${sleepTimer ? "bg-[var(--accent)] text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
            title="Sleep timer"
          >
            <TimerIcon size={16} />
            {sleepTimer && <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-rose-400 ring-2 ring-black" />}
          </button>
          <div className="flex items-center gap-2">
            <IconButton onClick={() => openSheet("share")} label="Share"><Share size={17} /></IconButton>
            <IconButton onClick={() => toggleLike(current.id)} label="Like"><Heart size={18} filled={liked.includes(current.id)} /></IconButton>
          </div>
        </div>

        {/* Gesture surface */}
        <div {...gestures} className="relative flex min-h-0 flex-1 flex-col" style={{ touchAction: "pan-y" }}>
          <HoldZones
            enabled={gesturesOn && !sheet}
            onHoldStart={(side) => { if (side === "right") { setHoldSpeed(2); buzz(16); } }}
            onHoldTick={(side) => { if (side === "left") seekBy(-1); }}
            onHoldEnd={(side) => { if (side === "right") setHoldSpeed(null); }}
            indicatorLeft={<><span className="text-[20px]">⏪</span><span className="text-[10px] font-semibold">Rewind</span></>}
            indicatorRight={<><span className="text-[20px]">⏩</span><span className="text-[10px] font-semibold">2× speed</span></>}
          />

          {burst && (
            <div className="pointer-events-none absolute top-[34%] z-20 -translate-x-1/2" style={{ left: `${burst.x}%` }}>
              {burst.heart
                ? <span className="heart-burst block text-[64px]">❤️</span>
                : <span className="ripple block h-16 w-16 rounded-full bg-white/25" />}
            </div>
          )}

          {/* Artwork + spectrum */}
          <div className="flex justify-center px-8 pt-5">
            <div className="relative">
              <ArtworkViz cover={current.cover} playing={isPlaying} style={vizStyle} shape={artShape} size={216} />
              {loadingSrc && <span className="absolute inset-x-0 -bottom-5 text-center text-[10.5px] text-[var(--accent)] pulse-soft">buffering…</span>}
            </div>
          </div>

          {/* Content — visualizer always, lyrics via the button */}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
            {vizStyle === "wave" ? (
              <div className="w-full"><WaveViz playing={isPlaying} /></div>
            ) : vizStyle === "off" ? (
              <p className="text-[11px] text-white/25">Visualizer off — long-press the Visualizer button to customize</p>
            ) : (
              <div className="w-full"><BarsViz playing={isPlaying} /></div>
            )}
          </div>
        </div>

        {/* Sleep countdown bubble (non-intrusive) */}
        {sleepRemaining > 0 && !sheet && (
          <div className="mb-1 flex justify-center">
            <span className="rounded-full bg-white/[0.07] px-3 py-1 text-[10px] text-white/45">Sleep in {fmt(sleepRemaining)}</span>
          </div>
        )}

        {/* Progress */}
        <div className="px-7 pt-2" onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="relative h-6">
            <div className="absolute top-1/2 h-[9px] w-full -translate-y-1/2 rounded-full bg-white/12" />
            <div className="absolute top-1/2 h-[9px] -translate-y-1/2 rounded-full bg-gradient-to-r from-[var(--accent-soft)] to-[var(--accent)] transition-[width] duration-150" style={{ width: `${pct}%` }} />
            <input type="range" min={0} max={duration || 100} step={0.1} value={progress} onInput={(e) => seek(Number(e.currentTarget.value))} onChange={(e) => seek(Number(e.currentTarget.value))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" style={{ touchAction: "none" }} />
            <div className="pointer-events-none absolute top-1/2 h-[20px] w-[20px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_0_6px_color-mix(in_srgb,var(--accent)_22%,transparent),0_4px_10px_rgba(0,0,0,.45)] transition-[left] duration-150" style={{ left: `${pct}%` }} />
          </div>
          <div className="flex justify-between pt-1.5 text-[10px] font-medium tabular-nums text-white/40">
            <span>{fmt(progress)}</span>
            {crossfade && <span className="text-[var(--accent)]/70">⇄ smooth fade</span>}
            <span>-{fmt(Math.max(0, duration - progress))}</span>
          </div>
        </div>

        {/* Main controls */}
        <div className="flex items-center justify-between px-7 pb-4 pt-2">
          <button onClick={() => { setShuffle(!shuffle); buzz(); }} className={`press transition ${shuffle ? "text-[var(--accent)]" : "text-white/45"}`}><Shuffle size={19} /></button>
          <button onClick={prev} className="press grid h-11 w-11 place-items-center rounded-full bg-white/[0.08] text-white"><Prev size={17} /></button>
          <button onClick={toggle} className="press grid h-[58px] w-[58px] place-items-center rounded-full bg-[var(--accent)] text-black shadow-[0_12px_34px_-8px_color-mix(in_srgb,var(--accent)_65%,transparent)]">
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <button onClick={next} className="press grid h-11 w-11 place-items-center rounded-full bg-white/[0.08] text-white"><Next size={17} /></button>
          <button onClick={() => setShowEq(true)} className="press text-white/45"><EqIcon size={19} /></button>
        </div>

        {/* Bottom action pills */}
        <div className="mx-4 mb-5 grid grid-cols-5 gap-1 rounded-2xl bg-white/[0.05] p-1.5 backdrop-blur">
          <BigPill active={sheet === "queue"} onClick={() => openSheet(sheet === "queue" ? null : "queue")} label="Queue" icon={<Queue size={16} />} />
          <BigPill active={sheet === "lyrics"} onClick={() => openSheet(sheet === "lyrics" ? null : "lyrics")} label="Lyrics" icon={<Sparkle size={16} />} />
          <BigPill active={sheet === "viz"} onClick={() => openSheet(sheet === "viz" ? null : "viz")} label="Viz" icon={<EqIcon size={16} />} />
          <BigPill active={repeat} onClick={() => { setRepeat(!repeat); buzz(); }} label="Repeat" icon={<RepeatIcon size={16} />} />
          <BigPill active={crossfade} onClick={() => { setCrossfade(!crossfade); buzz(); }} label="Fade" icon={<Queue size={16} className="rotate-90" />} />
        </div>
      </div>

      {/* ─── Sheets ─── */}

      {/* QUEUE SHEET */}
      {sheet === "queue" && (
        <SheetFrame onClose={() => setSheet(null)} titleUp>
          <div className="flex items-center justify-between pb-3">
            <div>
              <p className="text-[15px] font-bold text-white">Up next · {queueTracks.length}</p>
              <p className="text-[10.5px] text-white/35">Hold arrows to reorder, ✕ to remove</p>
            </div>
            <div className="flex gap-1.5">
              <button onClick={(e) => { e.stopPropagation(); locateCurrent(); }} className={`press grid h-9 w-9 place-items-center rounded-full transition ${locateFlash ? "bg-[var(--accent)] text-black" : "bg-white/[0.08] text-white/60"}`} title="Find playing song"><Target size={15} /></button>
              <button onClick={(e) => { e.stopPropagation(); resetQueue(); }} className="press rounded-full bg-white/[0.08] px-3 py-1.5 text-[10.5px] font-semibold text-white/60">Reset</button>
            </div>
          </div>
          <div ref={queueRef} className="no-scrollbar smooth-scroll min-h-0 flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            {queueTracks.map((t, i) => {
              const isCur = t.id === current?.id;
              return (
                <div
                  key={`${t.id}-${i}`}
                  ref={isCur ? currentRowRef : undefined}
                  className={`flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition ${isCur ? "bg-[var(--accent)]/12" : ""}`}
                >
                  <button onClick={(e) => { e.stopPropagation(); playTrack(t.id); flash(`Playing "${t.title}"`); }} className="press flex min-w-0 flex-1 items-center gap-3 text-left">
                    <img src={t.cover} className="h-10 w-10 rounded-xl object-cover" alt="" />
                    <span className="min-w-0">
                      <span className={`clamp-1 block text-[13px] font-semibold ${isCur ? "text-[var(--accent)]" : "text-white"}`}>{t.title}</span>
                      <span className="clamp-1 block text-[10px] text-white/35">{t.artist}</span>
                    </span>
                  </button>
                  {isCur && isPlaying && (
                    <span className="flex items-end gap-[2px]">{[0,1,2].map((j) => <span key={j} className="w-[2px] rounded-full bg-[var(--accent)]" style={{ animation: `eq .85s ${j*.14}s ease-in-out infinite alternate`, height: 9 }} />)}</span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); moveInQueue(i, i - 1); }} disabled={i === 0} className="press grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/60 disabled:opacity-25"><ChevronUp size={15} /></button>
                  <button onClick={(e) => { e.stopPropagation(); moveInQueue(i, i + 1); }} disabled={i === queueTracks.length - 1} className="press grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/60 disabled:opacity-25"><ChevronDown size={15} /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeFromQueue(t.id); flash(`Removed "${t.title}"`); }} className="press grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/50 hover:text-rose-300"><Trash size={13} /></button>
                </div>
              );
            })}
            <div className="h-4" />
          </div>
        </SheetFrame>
      )}

      {/* LYRICS SHEET */}
      {sheet === "lyrics" && (
        <SheetFrame onClose={() => setSheet(null)} titleUp>
          <div className="flex items-center justify-between pb-2">
            <div>
              <p className="text-[15px] font-bold text-white">Lyrics</p>
              {isCustomLyrics ? (
                <span className="rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[9px] font-bold text-[var(--accent)]">CUSTOM</span>
              ) : lyrics.length === 0 && aiLyrics && !aiLyricsHidden ? (
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[9px] font-bold text-purple-300">AI UNSYNCED</span>
              ) : null}
            </div>
            <div className="flex gap-1 rounded-full bg-white/[0.07] p-0.5">
              {(["read", "translate", "sing", "edit", "settings"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLyricTab(tab)}
                  className={`press rounded-full px-2.5 py-1 text-[10px] font-bold capitalize transition ${lyricTab === tab ? "bg-[var(--accent)] text-black" : "text-white/55"}`}
                >
                  {tab === "translate" ? "Translate" : tab === "sing" ? "Sing" : tab === "settings" ? "Style" : tab}
                </button>
              ))}
            </div>
          </div>

          {lyricTab === "read" && (
            <div className="flex min-h-0 flex-1 flex-col">
              {lrc.hasLyrics ? (
                <SyncedLyrics
                  lines={lrc.lines}
                  activeLineIndex={lrc.activeLineIndex}
                  isEnhanced={lrc.isEnhanced}
                  matchType={lrc.matchType}
                  currentTimeMs={progress * 1000}
                  onSeekToLine={(idx) => {
                    const line = lrc.lines[idx];
                    if (line) seek(line.time / 1000);
                  }}
                  accentColor="var(--accent)"
                />
              ) : lyrics.length > 0 ? (
                <LyricsScroll
                  lines={lyrics}
                  progress={progress}
                  duration={duration}
                  fontSize={lyricFontSize}
                  fontFamily={lyricFontFamily}
                  enableScrollReveal={enableScrollReveal}
                />
              ) : aiLyricsLoading ? (
                <div className="py-10 text-center">
                  <p className="pulse-soft text-[12px] text-[var(--accent)]">Searching AI lyrics via Gemini…</p>
                </div>
              ) : aiLyrics && !aiLyricsHidden ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  {/* Disclaimer banner */}
                  <div className="mb-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-2.5 text-center">
                    <p className="text-[10.5px] text-amber-200">Lyrics generated by AI — may not be 100% accurate</p>
                    <div className="mt-1.5 flex justify-center gap-2">
                      <button
                        onClick={() => {
                          setAiLyricsReported(true);
                          flash("Lyrics report submitted ✔");
                        }}
                        disabled={aiLyricsReported}
                        className="rounded-full bg-white/10 px-2.5 py-1 text-[9.5px] font-semibold text-white/70 hover:bg-white/20 disabled:opacity-50"
                      >
                        {aiLyricsReported ? "Reported ✔" : "Report incorrect lyrics"}
                      </button>
                      <button
                        onClick={() => setAiLyricsHidden(true)}
                        className="rounded-full bg-white/10 px-2.5 py-1 text-[9.5px] font-semibold text-white/70 hover:bg-white/20"
                      >
                        Hide lyrics
                      </button>
                    </div>
                  </div>
                  <LyricsScroll
                    lines={aiLyrics}
                    progress={progress}
                    duration={duration}
                    fontSize={lyricFontSize}
                    fontFamily={lyricFontFamily}
                    enableScrollReveal={enableScrollReveal}
                  />
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-[12px] text-white/35">No lyrics for this track yet.</p>
                  <button onClick={() => setLyricTab("edit")} className="press mt-2 rounded-full bg-white/[0.08] px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)]">Add your own →</button>
                </div>
              )}
            </div>
          )}

          {lyricTab === "translate" && (
            <div className="pb-2">
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-2">
                {LANGUAGES.map((l) => (
                  <button key={l.code} onClick={() => { setTranslateLang(l.code); setTranslateOn(true); }} className={`press shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-semibold transition ${translateLang === l.code ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/55"}`}>{l.label}</button>
                ))}
              </div>
              {translateErr === "no-key" ? (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] p-3">
                  <p className="text-[11px] text-amber-200">Add a Gemini API key in Settings → AI Translation to translate lyrics live.</p>
                  <button onClick={onOpenSettings} className="press mt-2 rounded-full bg-white/15 px-3 py-1.5 text-[10.5px] font-bold text-[var(--accent)]">Open Settings →</button>
                </div>
              ) : translating ? (
                <p className="py-2 text-center text-[11px] text-white/40 pulse-soft">Translating to {translateLang}…</p>
              ) : translateOn && translated ? (
                <LyricsScroll lines={translated} progress={progress} duration={duration} />
              ) : (
                <p className="py-2 text-center text-[11px] text-white/35">Pick a language above to translate these lyrics.</p>
              )}
            </div>
          )}

          {lyricTab === "sing" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-3 flex items-center justify-between rounded-2xl bg-white/[0.04] p-3">
                <div>
                  <p className="text-[13px] font-bold text-white">Sing-Along Live Transcription</p>
                  <p className="text-[10.5px] text-white/40">Sing with the track — mic audio is transcribed live</p>
                </div>
                {singingActive ? (
                  <button onClick={stopSingAlong} className="press flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white">
                    <span className="h-2 w-2 animate-ping rounded-full bg-white" /> Stop
                  </button>
                ) : (
                  <button onClick={startSingAlong} className="press flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[11px] font-bold text-black">
                    Start Recording
                  </button>
                )}
              </div>

              {transcribing && (
                <p className="pb-2 text-center text-[10.5px] text-[var(--accent)] pulse-soft">Transcribing your voice via Gemini…</p>
              )}

              <div className="no-scrollbar smooth-scroll min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-white/8 bg-black/30 p-4 text-center">
                {liveTranscript.length > 0 ? (
                  liveTranscript.map((t, idx) => (
                    <p key={idx} className="text-[14px] font-bold text-[var(--accent)] animate-fade-in">
                      {t}
                    </p>
                  ))
                ) : (
                  <p className="py-8 text-[11.5px] text-white/30">
                    {singingActive ? "Listening… Sing into your mic!" : "Tap Start to capture your singing live."}
                  </p>
                )}
              </div>

              {performanceUrl && (
                <div className="mt-3 flex justify-center">
                  <a
                    href={performanceUrl}
                    download={`singalong-${current.title}.webm`}
                    className="press flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-[11.5px] font-bold text-black"
                  >
                    Save Performance
                  </a>
                </div>
              )}
            </div>
          )}

          {lyricTab === "edit" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <p className="pb-2 text-[11px] text-white/40">One lyric per line. Empty to reset to the original track lyrics.</p>
              <textarea
                value={lyricDraft}
                onChange={(e) => setLyricDraft(e.target.value)}
                rows={8}
                className="no-scrollbar flex-1 resize-none rounded-2xl border border-white/10 bg-black/25 p-4 text-[13px] leading-relaxed text-white outline-none focus:border-[var(--accent)]"
                placeholder="Type or paste your own lyrics here…"
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    const lines = lyricDraft.split("\n").map((l) => l.trim()).filter(Boolean);
                    setTrackLyrics(current.id, lines.length ? lines : null);
                    flash(lines.length ? "Lyrics saved ✔" : "Lyrics reset to original");
                    setLyricTab("read");
                  }}
                  className="press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] py-2.5 text-[12px] font-bold text-black"
                >
                  <Check size={14} /> Save lyrics
                </button>
                {isCustomLyrics && (
                  <button onClick={() => { setTrackLyrics(current.id, null); setLyricDraft((current.lyrics ?? []).join("\n")); flash("Reset to original lyrics"); }} className="press rounded-full border border-white/15 px-3 py-2.5 text-[11px] font-semibold text-white/60">
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {lyricTab === "settings" && (
            <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto pr-1 py-1 text-xs">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">Font Size</p>
                    <p className="text-[10px] text-white/40">Adjust lyrics reading scale</p>
                  </div>
                  <div className="flex rounded-lg border border-white/10 bg-white/[0.04] p-0.5 text-[11px]">
                    {(["sm", "md", "lg", "xl"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setLyricFontSize(s);
                          localStorage.setItem("audenic_lyric_font_size", s);
                        }}
                        className={`rounded px-2.5 py-1 font-semibold uppercase transition ${
                          lyricFontSize === s ? "bg-[var(--accent)] text-black font-bold" : "text-white/50 hover:text-white"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <div>
                    <p className="font-bold text-white">Typography Style</p>
                    <p className="text-[10px] text-white/40">Choose lyrics font personality</p>
                  </div>
                  <div className="flex rounded-lg border border-white/10 bg-white/[0.04] p-0.5 text-[11px]">
                    {(["sans", "serif", "mono"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          setLyricFontFamily(f);
                          localStorage.setItem("audenic_lyric_font_family", f);
                        }}
                        className={`rounded px-2.5 py-1 font-semibold capitalize transition ${
                          lyricFontFamily === f ? "bg-[var(--accent)] text-black font-bold" : "text-white/50 hover:text-white"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <div>
                    <p className="font-bold text-white">React Bits ScrollReveal Effect</p>
                    <p className="text-[10px] text-white/40">GSAP word-by-word blur & opacity animations</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableScrollReveal}
                    onChange={(e) => {
                      setEnableScrollReveal(e.target.checked);
                      localStorage.setItem("audenic_lyric_reveal", String(e.target.checked));
                    }}
                    className="h-4 w-4 accent-[var(--accent)] cursor-pointer"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 space-y-2">
                <p className="font-bold text-white">Translation & Speech AI</p>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Multi-model language translation is enabled with live auto-failover. Switch to the Translate tab to view these lyrics in your preferred language.
                </p>
              </div>
            </div>
          )}
        </SheetFrame>
      )}

      {/* VISUALIZER SHEET */}
      {sheet === "viz" && (
        <SheetFrame onClose={() => setSheet(null)}>
          <p className="pb-1 text-[15px] font-bold text-white">Customize visualizer</p>
          <p className="pb-4 text-[11.5px] text-white/40">Pick a style and the shape of your cover art.</p>
          <p className="pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Style</p>
          <div className="grid grid-cols-3 gap-2 pb-4">
            {VIZ_STYLES.map((v) => (
              <button key={v.id} onClick={() => { setVizStyle(v.id); buzz(12); }} className={`press flex flex-col items-center gap-1 rounded-2xl border py-3 transition ${vizStyle === v.id ? "border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--accent)]" : "border-white/8 bg-white/[0.04] text-white/60"}`}>
                <span className="text-[18px]">{v.emoji}</span>
                <span className="text-[10.5px] font-semibold">{v.label}</span>
              </button>
            ))}
          </div>
          <p className="pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Cover art shape</p>
          <div className="grid grid-cols-3 gap-2">
            {ART_SHAPES.map((s) => (
              <button key={s.id} onClick={() => { setArtShape(s.id); buzz(12); }} className={`press flex flex-col items-center gap-2 rounded-2xl border py-3 transition ${artShape === s.id ? "border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--accent)]" : "border-white/8 bg-white/[0.04] text-white/60"}`}>
                <span className={`h-7 w-7 bg-current opacity-70 ${s.cls === "rounded-[34px]" ? "rounded-[10px]" : s.cls}`} />
                <span className="text-[10.5px] font-semibold">{s.label}</span>
              </button>
            ))}
          </div>
        </SheetFrame>
      )}

      {/* SLEEP TIMER SHEET */}
      {sheet === "timer" && (
        <SheetFrame onClose={() => setSheet(null)} small>
          <p className="pb-1 text-[15px] font-bold text-white">Sleep timer</p>
          <p className="pb-3 text-[11.5px] text-white/40">{sleepTimer ? `Pauses in ${fmt(sleepRemaining)}` : "Playback stops automatically."}</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[5, 15, 30, 45, 60, 90].map((m) => (
              <button key={m} onClick={() => { setSleepTimer(m); buzz(12); setSheet(null); flash(`Sleep timer set for ${m}m`); }} className={`press rounded-full px-4 py-2 text-[12px] font-bold transition ${sleepTimer === m ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/60"}`}>{m}m</button>
            ))}
          </div>
          {sleepTimer && (
            <button onClick={() => { setSleepTimer(null); setSheet(null); flash("Sleep timer cancelled"); }} className="press w-full rounded-full bg-rose-500/20 py-2.5 text-[12px] font-semibold text-rose-300">Cancel timer</button>
          )}
        </SheetFrame>
      )}

      {/* SHARE CARD STUDIO */}
      {sheet === "share" && current && (
        <SheetFrame onClose={() => setSheet(null)} titleUp>
          <div className="flex items-center justify-between pb-2">
            <div>
              <p className="text-[15px] font-bold text-white">Share card</p>
              <p className="text-[11px] text-white/40">Pick a design, then share the picture.</p>
            </div>
            <span className="rounded-full bg-[var(--accent)]/15 px-2.5 py-1 text-[9.5px] font-bold text-[var(--accent)]">9:16</span>
          </div>
          <div className="mb-3 flex gap-1.5">
            {([["pulse", "Pulse"], ["lyric", "Lyric"], ["poster", "Poster"]] as [ShareTemplate, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setShareTpl(id)} className={`press flex-1 rounded-full py-2 text-[11.5px] font-bold transition ${shareTpl === id ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/55"}`}>{label}</button>
            ))}
          </div>
          <div className="relative mx-auto w-[172px] overflow-hidden rounded-2xl border border-white/10" style={{ aspectRatio: "9 / 16" }}>
            {shareUrl ? <img src={shareUrl} alt="share card preview" className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-white/5" />}
            {rendering && <div className="absolute inset-0 grid place-items-center bg-black/50"><span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-[var(--accent)]" /></div>}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={async () => {
                if (!shareUrl) return;
                const ok = await shareImage(shareUrl, `audenic-${current.title}.png`, `“${current.title}” — ${current.artist} on Audenic`);
                flash(ok ? "Card shared ✔" : "Saved to downloads");
              }}
              className="press flex-1 rounded-full bg-[var(--accent)] py-3 text-[13px] font-extrabold text-black"
            >
              Share picture
            </button>
            <button onClick={() => { nativeShare({ title: `${current.title} — ${current.artist}`, text: `Listening to “${current.title}” by ${current.artist} on Audenic` }); flash("Share sheet opened"); }} className="press rounded-full bg-white/10 px-4 text-[12px] font-semibold text-white">Text</button>
          </div>
        </SheetFrame>
      )}
    </div>
  );
}

function BigPill({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`press flex flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 transition ${active ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "text-white/45 hover:bg-white/5 hover:text-white/80"}`}>
      <span>{icon}</span>
      <span className="text-[9.5px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function SheetFrame({ children, onClose, small, titleUp }: { children: React.ReactNode; onClose: () => void; small?: boolean; titleUp?: boolean }) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        className={`slide-up relative rounded-t-3xl border-t border-white/10 bg-[#141418] p-5 pb-7 pt-3 ${small ? "max-h-[46%]" : titleUp ? "flex h-[62%] flex-col" : ""}`}
        onClick={stop}
        onPointerDown={stop}
        onTouchStart={stop}
        onTouchEnd={stop}
        onMouseDown={stop}
        onMouseUp={stop}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        {children}
      </div>
    </div>
  );
}

function LyricsScroll({
  lines,
  progress,
  duration,
  fontSize = "md",
  fontFamily = "sans",
  enableScrollReveal = true,
}: {
  lines: string[];
  progress: number;
  duration: number;
  fontSize?: "sm" | "md" | "lg" | "xl";
  fontFamily?: "sans" | "serif" | "mono";
  enableScrollReveal?: boolean;
}) {
  const parsed = useMemo(() => {
    return lines.map((l) => {
      const match = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
      if (match) {
        const min = parseFloat(match[1]);
        const sec = parseFloat(match[2]);
        return { time: min * 60 + sec, text: match[3].trim() };
      }
      return { time: null, text: l };
    });
  }, [lines]);

  const hasTimestamps = parsed.some((p) => p.time !== null);

  const lineIdx = useMemo(() => {
    if (!parsed.length) return -1;
    if (hasTimestamps) {
      let idx = 0;
      for (let i = 0; i < parsed.length; i++) {
        if (parsed[i].time !== null && progress >= parsed[i].time!) {
          idx = i;
        }
      }
      return idx;
    }
    return duration ? Math.min(parsed.length - 1, Math.floor((progress / duration) * parsed.length)) : -1;
  }, [parsed, hasTimestamps, progress, duration]);

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.children[Math.max(0, lineIdx)];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [lineIdx]);

  const fontClass = {
    sans: "font-sans",
    serif: "font-serif tracking-wide",
    mono: "font-mono",
  }[fontFamily];

  const sizeClassActive = {
    sm: "text-[14px]",
    md: "text-[17px]",
    lg: "text-[21px]",
    xl: "text-[26px]",
  }[fontSize];

  const sizeClassInactive = {
    sm: "text-[11.5px]",
    md: "text-[13px]",
    lg: "text-[15px]",
    xl: "text-[18px]",
  }[fontSize];

  if (!lines.length) return null;
  return (
    <div ref={ref} className={`no-scrollbar smooth-scroll min-h-0 flex-1 space-y-4 overflow-y-auto py-4 text-center ${fontClass}`} style={{ WebkitOverflowScrolling: "touch" }}>
      {parsed.map((item, i) => {
        const isActive = i === lineIdx;
        return (
          <div key={i} className="transition-all duration-300 px-4">
            {isActive && enableScrollReveal ? (
              <ScrollReveal
                scrollContainerRef={ref}
                enableBlur={true}
                blurStrength={5}
                baseOpacity={0.25}
                containerClassName="my-1"
                textClassName={`${sizeClassActive} font-bold text-[var(--accent)] drop-shadow-[0_0_16px_var(--accent)]`}
              >
                {item.text || "♪"}
              </ScrollReveal>
            ) : (
              <p
                className={`transition-all duration-300 ${
                  isActive
                    ? `${sizeClassActive} font-bold text-[var(--accent)] drop-shadow-[0_0_12px_var(--accent)] scale-105`
                    : `${sizeClassInactive} text-white/35 hover:text-white/60`
                }`}
              >
                {item.text || "♪"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

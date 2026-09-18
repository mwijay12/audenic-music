import { useRef, useState } from "react";
import { StatusBar, FillSlider } from "../components/Shell";
import { usePlayer } from "../player/PlayerContext";
import { LANGUAGES } from "../player/gemini";
import { DEFAULTS } from "../player/aiProviders";
import { isNative, hasOverlayPermission, requestOverlayPermission, toggleDynamicIsland } from "../player/nativeBridge";
import { Chart, Check, Palette, Sparkle, Trash, Video, Volume, Bot, Award } from "../components/Icons";
import {
  getStoredTransitionStyle,
  setStoredTransitionStyle,
  TRANSITION_STYLES,
  type TransitionStyle,
} from "../player/smartAutomix";

const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60, 90];

export function SettingsScreen({ onTheme, onAnalytics, onVideo, onDrive, onAI, onAchievements }: { onTheme: () => void; onAnalytics: () => void; onVideo: () => void; onDrive: () => void; onAI: () => void; onAchievements: () => void }) {
  const {
    localTracks, clearLocal, tracks, liked, theme, geminiKey, setGeminiKey, translateLang, setTranslateLang,
    scanNativeLibrary,
    addLocalFiles, addLocalVideos, sleepTimer, setSleepTimer, sleepRemaining, showLyrics, setShowLyrics,
    crossfade, setCrossfade, fadeMs, setFadeMs, volume, setVolume,
    replayGain, setReplayGain, smartQueue, setSmartQueue,
    reelLoops, setReelLoops, reelAutoScroll, setReelAutoScroll,
    gesturesOn, setGesturesOn, hapticsOn, setHapticsOn, notifyOn, setNotifyOn, buzz,
    aiGroqKey, setAiGroqKey, aiGroqModel, setAiGroqModel,
    aiOrKey, setAiOrKey, aiOrModel, setAiOrModel,
    aiOllamaKey, setAiOllamaKey, aiOllamaModel, setAiOllamaModel,
    aiOfflineOnly, setAiOfflineOnly,
    floatingAi, setFloatingAi,
  } = usePlayer();

  const [currentTransitionStyle, setCurrentTransitionStyle] = useState<TransitionStyle>(getStoredTransitionStyle());
  const [keyDraft, setKeyDraft] = useState(geminiKey);
  const [savedKey, setSavedKey] = useState(false);
  const [groqDraft, setGroqDraft] = useState(aiGroqKey);
  const [orDraft, setOrDraft] = useState(aiOrKey);
  const [ollamaDraft, setOllamaDraft] = useState(aiOllamaKey);
  const [aiSaved, setAiSaved] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string>(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const audioRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  const saveAIKeys = () => {
    setAiGroqKey(groqDraft.trim());
    setAiOrKey(orDraft.trim());
    setAiOllamaKey(ollamaDraft.trim());
    setAiSaved(true);
    window.setTimeout(() => setAiSaved(false), 1500);
  };

  const askNotifications = async () => {
    if (typeof Notification === "undefined") { setNotifStatus("unsupported"); return; }
    try { const p = await Notification.requestPermission(); setNotifStatus(p); if (p === "granted") setNotifyOn(true); } catch { /* */ }
  };

  const Toggle = ({ label, sub, val, on }: { label: string; sub?: string; val: boolean; on: () => void }) => (
    <button onClick={() => { on(); buzz(); }} className="press flex w-full items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-3.5 text-left">
      <span className="min-w-0 pr-3">
        <span className="block text-[13px] text-white">{label}</span>
        {sub && <span className="block pt-0.5 text-[10.5px] text-white/35">{sub}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${val ? "" : "bg-white/15"}`} style={val ? { background: theme.accent } : undefined}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-200 ${val ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );

  const Section = ({ children }: { children: string }) => (
    <p className="pt-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/40">{children}</p>
  );

  const [scrollTop, setScrollTop] = useState(0);
  const shrink = Math.min(1, scrollTop / 70);

  return (
    <div className="fade-in flex h-full flex-col">
      <StatusBar />
      <div className="px-6 transition-all duration-200" style={{ paddingTop: `${12 - shrink * 6}px`, paddingBottom: `${4 - shrink * 2}px` }}>
        <h1 className="font-bold text-white transition-all duration-200" style={{ fontSize: `${24 - shrink * 7}px` }}>Settings</h1>
      </div>
      <div onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} className="no-scrollbar smooth-scroll flex-1 space-y-2.5 overflow-y-auto px-6 pb-44 pt-2">
        <div className="grid grid-cols-4 gap-2">
          <Action icon={<Palette size={18} />} label="Theme" onClick={onTheme} />
          <Action icon={<Chart size={18} />} label="Insights" onClick={onAnalytics} />
          <Action icon={<Video size={18} />} label="Videos" onClick={onVideo} />
          <Action icon={<Bot size={18} />} label="Audenic AI" onClick={onAI} />
        </div>
        <button
          onClick={onDrive}
          className="press flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-[var(--accent)]/35 p-3.5 text-left shadow-lg"
          style={{ background: `linear-gradient(135deg, ${theme.accent}33, ${theme.gradientA}33)` }}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--accent)] text-black">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-extrabold text-white">Simple / Drive Mode</span>
            <span className="block text-[10.5px] text-white/60">Large controls, high visibility, distraction-free</span>
          </span>
          <span className="rounded-full bg-[var(--accent)] px-3.5 py-1 text-[11px] font-extrabold text-black">Launch →</span>
        </button>

        <button
          onClick={onAchievements}
          className="press flex w-full items-center gap-3 overflow-hidden rounded-2xl p-3.5 text-left"
          style={{ background: `linear-gradient(135deg, ${theme.accent}22, ${theme.gradientA}22)` }}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--accent)] text-black"><Award size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-white">Achievements</span>
            <span className="block text-[10.5px] text-white/50">Level up while you listen</span>
          </span>
          <span className="text-[11px] font-semibold text-[var(--accent)]">Open →</span>
        </button>

        <Section>Library</Section>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={async () => { if (isNative()) await scanNativeLibrary(); else dirRef.current?.click(); }} className="press rounded-2xl bg-white/[0.05] p-3 text-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span className="mt-1 block text-[10.5px] text-white">{isNative() ? "Scan device" : "Scan folder"}</span></button>
          <button onClick={() => audioRef.current?.click()} className="press rounded-2xl bg-white/[0.05] p-3 text-center"><Volume size={18} className="mx-auto text-[var(--accent)]" /><span className="mt-1 block text-[10.5px] text-white">Add songs</span></button>
          <button onClick={() => videoRef.current?.click()} className="press rounded-2xl bg-white/[0.05] p-3 text-center"><Video size={18} className="mx-auto text-[var(--accent)]" /><span className="mt-1 block text-[10.5px] text-white">Add videos</span></button>
        </div>
        <input ref={audioRef} type="file" accept="audio/*" multiple hidden onChange={e => addLocalFiles(e.target.files)} />
        <input ref={videoRef} type="file" accept="video/*" multiple hidden onChange={e => addLocalVideos(e.target.files)} />
        {/* @ts-expect-error directory attrs */}
        <input ref={dirRef} type="file" multiple hidden webkitdirectory="" directory="" onChange={e => addLocalFiles(e.target.files)} />

        <Section>Reels</Section>
        <div className="rounded-2xl bg-white/[0.05] p-4">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[13px] text-white">Loop each reel</span>
            <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--accent)]">{reelLoops}×</span>
          </div>
          <p className="pb-3 text-[10.5px] text-white/35">Plays {reelLoops} time{reelLoops > 1 ? "s" : ""}, then moves on</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 5, 99].map(n => (
              <button key={n} onClick={() => { setReelLoops(n); buzz(); }} className={`press flex-1 rounded-xl py-2 text-[11.5px] font-bold transition ${reelLoops === n ? "bg-[var(--accent)] text-black" : "bg-white/[0.06] text-white/50"}`}>
                {n === 99 ? "∞" : `${n}×`}
              </button>
            ))}
          </div>
        </div>
        <Toggle label="Auto-scroll to next reel" sub="After the loop count is reached" val={reelAutoScroll} on={() => setReelAutoScroll(!reelAutoScroll)} />

        <Section>Gestures &amp; Feedback</Section>
        <Toggle label="Gesture controls" sub="Swipe ↔ track · swipe ↕ queue · double-tap ±10s / like · hold = EQ" val={gesturesOn} on={() => setGesturesOn(!gesturesOn)} />
        <Toggle label="Haptic feedback" sub="Vibrate on taps and track changes" val={hapticsOn} on={() => setHapticsOn(!hapticsOn)} />

        <Section>Notifications &amp; Lock Screen</Section>
        <Toggle label="Media controls" sub="Show playback on lock screen & notification shade" val={notifyOn} on={() => setNotifyOn(!notifyOn)} />
        <button onClick={askNotifications} className="press flex w-full items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-3.5 text-left">
          <span>
            <span className="block text-[13px] text-white">System notification permission</span>
            <span className="block pt-0.5 text-[10.5px] text-white/35">Status: {notifStatus}</span>
          </span>
          <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${notifStatus === "granted" ? "bg-emerald-400/20 text-emerald-300" : "bg-[var(--accent)] text-black"}`}>
            {notifStatus === "granted" ? "Granted" : "Allow"}
          </span>
        </button>



        <Section>Playback</Section>
        <div className="rounded-2xl bg-white/[0.04] p-3.5">
          <div className="flex justify-between text-[12px]"><span className="text-white">Volume</span><span className="font-bold text-[var(--accent)]">{Math.round(volume * 100)}%</span></div>
          <FillSlider value={volume} min={0} max={1} step={0.01} onChange={setVolume} />
        </div>
        <Toggle label="Crossfade transitions" val={crossfade} on={() => setCrossfade(!crossfade)} />
        <Toggle label="Loudness normalization" sub="ReplayGain-style leveling across local files and streams" val={replayGain} on={() => setReplayGain(!replayGain)} />
        <Toggle label="Smart queue" sub="Avoid recent repeats and surface less-played songs" val={smartQueue} on={() => setSmartQueue(!smartQueue)} />
        {crossfade && (
          <div className="space-y-3 rounded-2xl bg-white/[0.04] p-3.5">
            <div className="flex justify-between text-[12px]"><span className="text-white/60">Fade duration</span><span className="font-bold text-[var(--accent)]">{fadeMs}ms</span></div>
            <FillSlider value={fadeMs} min={0} max={4000} step={100} onChange={setFadeMs} />

            <div className="pt-2 border-t border-white/5">
              <p className="text-[11px] font-semibold text-white/70 mb-2">Automix Transition Style</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {TRANSITION_STYLES.map((st) => {
                  const isSel = currentTransitionStyle === st.id;
                  return (
                    <button
                      key={st.id}
                      onClick={() => {
                        setCurrentTransitionStyle(st.id);
                        setStoredTransitionStyle(st.id);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition ${
                        isSel
                          ? "bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)] shadow-sm"
                          : "bg-white/[0.03] border-white/5 text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <span className="truncate">{st.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        <Toggle label="Show lyrics on Now Playing" val={showLyrics} on={() => setShowLyrics(!showLyrics)} />

        <Section>Audenic AI Assistant</Section>
        <button onClick={onAI} className="press flex w-full items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-3.5 text-left">
          <span className="flex items-center gap-2 text-[13px] text-white"><Bot size={15} className="text-[var(--accent)]" /> Open Audenic AI</span>
          <span className="text-[11px] text-[var(--accent)]">Chat →</span>
        </button>
        <Toggle label="Show floating AI button" sub="Adds a quick-access AI button over most tabs. It's hidden automatically on Reels and Settings." val={floatingAi} on={() => setFloatingAi(!floatingAi)} />
        <Toggle label="Force offline mode" sub="Skip online providers and use the built-in offline assistant" val={aiOfflineOnly} on={() => setAiOfflineOnly(!aiOfflineOnly)} />
        <div className="rounded-2xl bg-white/[0.05] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]">
                <Bot size={16} />
              </span>
              <div>
                <p className="text-[12.5px] font-bold text-white">Cloud AI &amp; Gemini Engine</p>
                <p className="text-[10px] font-semibold text-emerald-400">Active · Multi-Key Rotation Enabled</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">Online</span>
          </div>
          <p className="pt-2 text-[10.5px] leading-relaxed text-white/50">
            Powered by multi-key rotation pools (Gemini, Groq, OpenRouter &amp; Ollama). Keys rotate automatically for AI chat, smart playlists &amp; lyric translations.
          </p>
          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold text-white">Custom Gemini API Key (Optional)</span>
              <span className="text-[9.5px] text-white/40">aistudio.google.com</span>
            </div>
            <div className="mt-2 flex gap-2">
              <input type="password" value={keyDraft} onChange={e => setKeyDraft(e.target.value)} placeholder="AIza…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white outline-none focus:border-[var(--accent)]" />
              <button onClick={() => { setGeminiKey(keyDraft.trim()); setSavedKey(true); window.setTimeout(() => setSavedKey(false), 1500); }} className="press shrink-0 rounded-xl bg-[var(--accent)] px-3 text-[12px] font-bold text-black">{savedKey ? <Check size={14} /> : "Save"}</button>
            </div>
            <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
              {LANGUAGES.map(l => <button key={l.code} onClick={() => setTranslateLang(l.code)} className={`press shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-medium ${translateLang === l.code ? "bg-[var(--accent)] text-black" : "bg-white/[0.06] text-white/50"}`}>{l.label}</button>)}
            </div>
          </div>
        </div>

        <Section>Storage</Section>
        <div className="grid grid-cols-3 gap-2">
          {([["Tracks", tracks.length], ["Local", localTracks.length], ["Liked", liked.length]] as const).map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/[0.05] p-3 text-center"><p className="text-[18px] font-bold tabular-nums" style={{ color: theme.accent }}>{v}</p><p className="text-[10px] text-white/45">{k}</p></div>
          ))}
        </div>
        <button onClick={clearLocal} className="press flex w-full items-center justify-between rounded-2xl bg-rose-500/15 px-4 py-3.5 text-left"><span className="text-[13px] text-rose-300">Clear local files</span><Trash size={16} className="text-rose-300" /></button>
        <p className="pt-3 text-center text-[10.5px] text-white/25">Audenic v2.0 · Web Audio engine</p>
      </div>
    </div>
  );
}

function Action({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="press flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.05] p-3 text-center"><span className="text-[var(--accent)]">{icon}</span><span className="text-[11px] font-medium text-white">{label}</span></button>;
}

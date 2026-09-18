import { useEffect, useRef, useState } from "react";
import { usePlayer } from "../player/PlayerContext";
import { StatusBar, IconButton } from "../components/Shell";
import { useAIActions, type AINavTarget } from "../player/aiActions";
import {
  buildSystemPrompt, chatWithFallback, parseAIJson, OWNER_NAME, APP_NAME,
  type ChatMessage, type ProviderName,
} from "../player/aiProviders";
import { offlineReply } from "../player/aiOffline";
import { TAGS, IA_GENRES } from "../player/api";
import { Back, Bot, Send, Mic, CloudOff, Sparkle, Trash } from "../components/Icons";
import { TextEffect } from "../components/ui/text-effect";
import { speakWithElevenLabs } from "../player/elevenLabs";
import { ENV } from "../player/envKeys";

import ExperiencesScreen from "./ExperiencesScreen";

const SUGGESTIONS = [
  "Play something energetic",
  "How much have I listened?",
  "Switch to Ocean Mint theme",
  "Create a playlist called Roadtrip",
  "Play a chill radio station",
  "Set EQ to Bass+",
  "Sleep timer for 20 minutes",
  "Stop playing at 11:30 pm",
  "What can you do?",
];

const PROVIDER_LABEL: Record<ProviderName, string> = {
  gemini: "Audenic Gemini AI", puter: "Audenic AI", groq: "Audenic Fast AI", openrouter: "Audenic Smart AI", ollama: "Audenic Local AI",
  huggingface: "Audenic Cloud AI", offline: "Audenic AI (Offline)",
};

export default function AIScreen({
  onBack, onNavigate, onPlayExternal,
}: {
  onBack: () => void;
  onNavigate: (t: AINavTarget) => void;
  onPlayExternal: (track: Parameters<ReturnType<typeof useAIActions>["run"]>[0] extends { type: "play_external_track" } ? never : any) => void;
}) {
  const {
    profile, current, isPlaying, volume, shuffle, repeat, theme, liked, playlists,
    sleepTimer, analytics, tracks, localTracks, buzz, geminiKey,
    aiGroqKey, aiGroqModel, aiOrKey, aiOrModel, aiOllamaKey, aiOllamaModel, aiHfKey, aiHfModel, aiOfflineOnly,
    aiMessages, addAiMessage, clearAiMessages, stopAt,
  } = usePlayer();

  const { run } = useAIActions(onNavigate, onPlayExternal);
  const [aiTab, setAiTab] = useState<"chat" | "moments">("chat");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastProvider, setLastProvider] = useState<ProviderName | null>(null);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [aiMessages, busy]);

  useEffect(() => {
    const w = window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = false; rec.interimResults = false; rec.lang = "en-US";
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      const text = e.results?.[0]?.[0]?.transcript;
      if (text) setInput(text);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) return;
    if (listening) { recognitionRef.current.stop(); setListening(false); }
    else { setListening(true); buzz(12); try { recognitionRef.current.start(); } catch { /* already started */ } }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    buzz(10);
    addAiMessage({ id: `u-${Date.now()}`, role: "user", content: trimmed, ts: Date.now() });
    setBusy(true);

    const topTrack = analytics.topTracks[0] ? tracks.find((t) => t.id === analytics.topTracks[0].id) : null;
    const stopAtIso = stopAt ? new Date(stopAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
    const ctx = {
      userName: profile.name || OWNER_NAME,
      current: current ? { title: current.title, artist: current.artist } : null,
      isPlaying, volume, shuffle, repeat, themeName: theme.name,
      likedCount: liked.length, playlistNames: playlists.map((p) => p.name),
      sleepTimer, stopAt: stopAtIso,
      totalListens: analytics.totalListens, totalMinutes: analytics.totalMinutes,
      topTrackTitle: topTrack?.title || null,
      trackList: tracks.slice(0, 80).map((t) => `${t.title} — ${t.artist}`).join("; "),
      localTrackList: localTracks.map((t) => `${t.artist} - ${t.title}`).join("; ") || "empty",
      onlineTrackList: tracks.filter((t) => t.source === "online").slice(0, 80).map((t) => `${t.title} — ${t.artist}`).join("; ") || "empty",
      radioGenres: TAGS.map((t) => t.label).join(", "),
      archiveGenres: IA_GENRES.map((g) => g.label).join(", "),
    };

    const history: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt(ctx) },
      ...aiMessages.slice(-10).map((m): ChatMessage => ({ role: m.role, content: m.content })),
      { role: "user", content: trimmed },
    ];

    const keys = {
      groqKey: aiGroqKey, groqModel: aiGroqModel,
      orKey: aiOrKey, orModel: aiOrModel,
      ollamaKey: aiOllamaKey, ollamaModel: aiOllamaModel,
      hfKey: aiHfKey, hfModel: aiHfModel,
      geminiKey,
      offlineOnly: aiOfflineOnly,
    };

    let replyText = "";
    let provider: ProviderName = "offline";
    let actions: ReturnType<typeof parseAIJson>["actions"] = [];

    try {
      const result = await chatWithFallback(history, keys);
      if (result) {
        provider = result.provider;
        const parsed = parseAIJson(result.raw);
        replyText = parsed.reply;
        actions = parsed.actions;
      } else {
        const off = offlineReply(trimmed, profile.name, { tracks, playlists, current, isPlaying, theme, volume });
        replyText = off.reply;
        actions = off.actions;
        provider = "offline";
      }
    } catch {
      const off = offlineReply(trimmed, profile.name, { tracks, playlists, current, isPlaying, theme, volume });
      replyText = off.reply;
      actions = off.actions;
      provider = "offline";
    }

    const notes: Array<{ ok: boolean; note: string }> = [];
    for (const a of actions) {
      try { notes.push(await run(a)); } catch { notes.push({ ok: false, note: "failed" }); }
    }
    setLastProvider(provider);
    const failed = notes.filter((n) => !n.ok);
    const okSummary = notes.filter((n) => n.ok).map((n) => n.note).filter(Boolean);
    const suffix = [
      ...okSummary.filter((s, i, a) => a.indexOf(s) === i && !replyText.toLowerCase().includes(s.toLowerCase())),
      ...(failed.length ? [`⚠️ ${failed.map((f) => f.note).join(" ")}`] : []),
    ].join("\n");

    addAiMessage({
      id: `a-${Date.now()}`,
      role: "assistant",
      content: replyText + (suffix ? "\n\n" + suffix : ""),
      provider,
      ts: Date.now(),
    });
    setBusy(false);
  };

  const hasAnyKey = !!(aiGroqKey.trim() || aiOrKey.trim() || aiOllamaKey.trim());

  return (
    <div className="fade-in flex h-full flex-col">
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-1">
        <IconButton onClick={onBack} label="Back"><Back size={20} /></IconButton>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] p-1">
          <button onClick={() => setAiTab("chat")} className={`press flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition ${aiTab === "chat" ? "bg-[var(--accent)] text-black" : "text-white/60"}`}>
            <Bot size={13} />
            <span>AI Chat</span>
          </button>
          <button onClick={() => setAiTab("moments")} className={`press flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition ${aiTab === "moments" ? "bg-[var(--accent)] text-black" : "text-white/60"}`}>
            <Sparkle size={13} />
            <span>Moments</span>
          </button>
        </div>
        <IconButton onClick={clearAiMessages} label="Clear chat"><Trash size={16} /></IconButton>
      </div>

      {aiTab === "moments" ? (
        <div className="relative flex-1 overflow-hidden">
          <ExperiencesScreen onBack={() => setAiTab("chat")} onOpenPlayer={onBack} />
        </div>
      ) : (<>

      <div ref={scrollRef} className="no-scrollbar smooth-scroll flex-1 min-h-0 overflow-y-auto px-5 pb-3 pt-3">
        {!aiMessages.length && (
          <div className="fade-in flex flex-col items-center px-4 pb-6 pt-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-[26px] bg-[var(--accent)]/15 text-[var(--accent)]">
              <Sparkle size={28} />
            </div>
            <p className="pt-4 text-[16px] font-bold text-white">Hi {profile.name?.split(" ")[0] || OWNER_NAME.split(" ")[0]}, I'm Audenic AI</p>
            <p className="pt-1.5 max-w-[280px] text-[12.5px] leading-relaxed text-white/45">
              I can play a specific song, tune a radio station, manage playlists, swap themes &amp; EQ, and answer questions about {APP_NAME} — online or off.
            </p>
            <div className="mt-5 grid w-full grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s.replace(/^[^\s]+\s/, ""))} className="press rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left text-[11.5px] text-white/75">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="stagger space-y-3">
          {aiMessages.map((m) => (
            <AssistantMessage key={m.id} m={m} />
          ))}
          {busy && (
            <div className="flex justify-start">
              <span className="mr-2 mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]"><Bot size={14} /></span>
              <div className="flex items-center gap-1.5 rounded-2xl bg-white/[0.07] px-4 py-3">
                {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/50" style={{ animation: `pulse-soft 1s ${i * 0.15}s ease-in-out infinite` }} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {!(aiGroqKey || aiOrKey || aiOllamaKey || aiHfKey || ENV.groqKeys.length || ENV.geminiKeys.length || ENV.openRouterKeys.length || ENV.newsApiKeys.length) && !aiOfflineOnly && (
        <div className="mx-5 mb-2 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.08] px-3 py-2 text-[10.5px] text-amber-200">
          <CloudOff size={13} /> Add an AI API key in Settings to enable online conversational intelligence.
        </div>
      )}

      <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-[#0A0A0D]/95 border-t border-white/[0.08] backdrop-blur-md rounded-2xl shadow-lg">
        <button onClick={toggleMic} className={`press grid h-11 w-11 shrink-0 place-items-center rounded-full ${listening ? "bg-rose-500 text-white" : "bg-white/[0.08] text-white/60"}`} title="Voice input">
          <Mic size={17} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder={busy ? "Audenic AI is thinking…" : "Ask me anything, or give a command…"}
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-[var(--accent)]"
        />
        <button onClick={() => send(input)} disabled={busy || !input.trim()} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-black disabled:opacity-40">
          <Send size={16} />
        </button>
      </div>
      </>)}
    </div>
  );
}

type SpeechRecognitionEventLike = { results: { [i: number]: { [j: number]: { transcript: string } } } };

type Token = { type: "text" | "bold" | "header"; content: string };

function parseMarkdown(text: string): Token[] {
  const tokens: Token[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.startsWith("###")) {
      tokens.push({ type: "header", content: line.replace(/^###\s*/, "") });
      continue;
    }
    let remaining = line;
    while (remaining.includes("**")) {
      const start = remaining.indexOf("**");
      const end = remaining.indexOf("**", start + 2);
      if (end > -1) {
        if (start > 0) {
          tokens.push({ type: "text", content: remaining.slice(0, start) });
        }
        tokens.push({ type: "bold", content: remaining.slice(start + 2, end) });
        remaining = remaining.slice(end + 2);
      } else {
        break;
      }
    }
    if (remaining.length > 0) {
      tokens.push({ type: "text", content: remaining });
    }
    tokens.push({ type: "text", content: "\n" });
  }
  if (tokens.length && tokens[tokens.length - 1].content === "\n") {
    tokens.pop();
  }
  return tokens;
}

/**
 * One chat bubble. User messages render verbatim; assistant messages split
 * the reply from the execution notes and animate the reply with TextEffect
 * (character-by-character, fade preset) while parsing markdown (headers, bolds)
 * into beautiful, stylized, glowing tags with zero raw markdown syntax showing!
 */
function AssistantMessage({ m }: { m: { id: string; role: "user" | "assistant"; content: string; provider?: string; ts: number } }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] whitespace-pre-line rounded-2xl bg-[var(--accent)] px-3.5 py-2.5 text-[13px] leading-relaxed text-black">
          {m.content}
        </div>
      </div>
    );
  }

  const splitAt = m.content.indexOf("\n\n");
  const reply = splitAt > -1 ? m.content.slice(0, splitAt) : m.content;
  const notes = splitAt > -1 ? m.content.slice(splitAt + 2) : "";
  const tokens = parseMarkdown(reply);

  return (
    <div className="flex justify-start">
      <span className="mr-2 mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]"><Bot size={14} /></span>
      <div className="max-w-[78%] rounded-2xl bg-white/[0.07] px-3.5 py-2.5 text-[13px] leading-relaxed text-white/90">
        <div className="space-y-1">
          {tokens.map((tok, i) => {
            if (tok.content === "\n") return <br key={i} />;
            if (tok.type === "header") {
              return (
                <div key={i} className="pb-1.5 pt-1">
                  <TextEffect per="char" preset="fade" as="span" className="text-[14.5px] font-bold text-[var(--accent)] drop-shadow-[0_0_10px_color-mix(in_srgb,var(--accent)_45%,transparent)] block">
                    {"✨ " + tok.content}
                  </TextEffect>
                </div>
              );
            }
            if (tok.type === "bold") {
              return (
                <TextEffect key={i} per="char" preset="fade" as="span" className="font-extrabold text-[var(--accent)] drop-shadow-[0_0_8px_color-mix(in_srgb,var(--accent)_30%,transparent)] inline">
                  {tok.content}
                </TextEffect>
              );
            }
            return (
              <TextEffect key={i} per="char" preset="fade" as="span" className="text-white/90 inline">
                {tok.content}
              </TextEffect>
            );
          })}
        </div>
        {notes && (
          <p className="mt-2 border-t border-white/5 pt-1.5 whitespace-pre-line text-[11.5px] text-white/50">{notes}</p>
        )}
        <div className="mt-2 flex items-center justify-between pt-1">
          {m.provider ? (
            <p className="text-[9px] font-bold uppercase tracking-wide opacity-35">{PROVIDER_LABEL[m.provider as ProviderName] ?? m.provider}</p>
          ) : <span />}
          <button
            onClick={() => speakWithElevenLabs(reply)}
            className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--accent)] hover:underline opacity-80 hover:opacity-100"
            title="Read aloud with text-to-speech"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            <span>Read aloud</span>
          </button>
        </div>
      </div>
    </div>
  );
}
type SpeechRecognitionLike = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
};

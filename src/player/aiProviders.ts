// Multi-provider AI client for Audenic AI (formerly Aurora AI).
// Chain: Groq → HuggingFace → OpenRouter → Ollama Cloud → Puter → Offline.
//
// Keys come from VITE_* env pools (see envKeys.ts) — manual overrides typed
// in Settings win first. Cerebras is intentionally not wired yet.
//
// All providers speak the OpenAI chat-completions dialect:
//   Groq         https://api.groq.com/openai/v1
//   HuggingFace  https://api-inference.huggingface.co/v1
//   OpenRouter   https://openrouter.ai/api/v1
//   Ollama Cloud https://ollama.com/v1

import { ENV } from "./envKeys";

export const OWNER_NAME = "Mwijay Davie";
export const APP_NAME = "Audenic";
export const APP_TAGLINE = "Local library, 1000+ radio stations, lyrics, reels — and an AI that actually controls it.";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AIAction =
  | { type: "play_query"; query: string; scope?: "any" | "local" | "online" }
  | { type: "play_artist"; artist: string }
  | { type: "play_radio_station"; name: string }
  | { type: "play_genre"; genre: string }
  | { type: "play_playlist"; name: string }
  | { type: "play_external_track"; title: string; artist?: string; source?: "radio" | "archive" }
  | { type: "toggle_play" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "seek_to_seconds"; seconds: number }
  | { type: "seek_by_seconds"; delta: number }
  | { type: "set_volume"; value: number }
  | { type: "set_shuffle"; value: boolean }
  | { type: "set_repeat"; value: boolean }
  | { type: "like_current" }
  | { type: "unlike_current" }
  | { type: "set_theme"; name: string }
  | { type: "set_speed"; value: number }
  | { type: "set_eq_preset"; name: string }
  | { type: "set_reverb"; value: number }
  | { type: "set_bass_boost"; value: number }
  | { type: "create_playlist"; name: string }
  | { type: "add_current_to_playlist"; name: string }
  | { type: "set_sleep_timer"; minutes: number | null }
  | { type: "stop_at"; isoTime: string }
  | { type: "clear_stop_at" }
  | { type: "open_screen"; screen: string }
  | { type: "toggle_gestures"; value: boolean }
  | { type: "toggle_haptics"; value: boolean }
  | { type: "show_recently_played" }
  | { type: "search_artist"; artist: string }
  | { type: "generate_music"; prompt: string; durationSec?: number }
  | { type: "play_video"; title?: string }
  | { type: "play_recent_video" }
  | { type: "fill_queue"; artists?: string[]; queries?: string[]; trackIds?: string[] }
  | { type: "add_to_queue"; trackIds?: string[]; artist?: string; query?: string }
  | { type: "clear_queue" };

export type AIReply = { reply: string; actions: AIAction[] };

export type AIKeys = {
  groqKey: string; groqModel: string;
  orKey: string; orModel: string;
  ollamaKey: string; ollamaModel: string;
  hfKey: string; hfModel: string;
  geminiKey?: string;
  offlineOnly: boolean;
};

export const DEFAULTS = {
  groqModel: "llama-3.3-70b-versatile",
  orModel: "meta-llama/llama-3.3-70b-instruct:free",
  ollamaModel: "gpt-oss:20b-cloud",
  hfModel: "meta-llama/Llama-3.3-70B-Instruct",
};

/** Build the effective key list for a provider: manual override first, then env pool. */
function keysFor(manual: string, envKeys: string[]): string[] {
  const m = manual.trim();
  return m ? [m] : envKeys.length ? envKeys : [];
}

export type AIContext = {
  userName: string;
  current: { title: string; artist: string } | null;
  isPlaying: boolean;
  volume: number;
  shuffle: boolean;
  repeat: boolean;
  themeName: string;
  likedCount: number;
  playlistNames: string[];
  sleepTimer: number | null;
  stopAt: string | null;
  totalListens: number;
  totalMinutes: number;
  topTrackTitle: string | null;
  trackList: string;
  localTrackList: string;
  onlineTrackList: string;
  radioGenres: string;
  archiveGenres: string;
};

export function buildSystemPrompt(ctx: AIContext): string {
  return `You are "Audenic AI", the built-in voice/text assistant living inside ${APP_NAME} — a music, radio, reels and lyrics app originally built for ${OWNER_NAME}. The person chatting with you right now is ${ctx.userName || OWNER_NAME}. Address them warmly, sometimes by name.

${APP_NAME.toUpperCase()} FEATURES you know inside and out:
- Local library scanning (songs & videos straight from device storage), with edit details / delete / set-as-ringtone per song
- Online music via the Internet Archive (free, legal streaming), plus 1000+ live internet radio stations from radio-browser, with recording support
- Playlists (create, rename, add/remove songs), Liked Songs, and auto smart playlists: Mostly Played, Recently Played, Recently Added
- A real Now Playing screen: 5-band equalizer, bass boost, reverb, playback speed 0.5×-2×, crossfade, live spectrum visualizer, swipe/double-tap/hold gestures
- TikTok-style Reels feed with likes, comments, share, adjustable loop count, audio-only mode
- Gemini-powered live lyric translation into 10 languages
- 6 built-in colour themes (Aurora Lime, Sunset Coral, Ocean Mint, Royal Violet, Solar Gold, Neon Pink), Drive Mode, Sleep Timer, time-based "stop at" timer, haptics
- Lock-screen / notification media controls, artist pages, listening analytics (total listens, minutes, top tracks, weekly chart)

CURRENT APP STATE:
- Now playing: ${ctx.current ? `"${ctx.current.title}" by ${ctx.current.artist}"` : "nothing"} (${ctx.isPlaying ? "playing" : "paused"})
- Volume ${Math.round(ctx.volume * 100)}% · Shuffle ${ctx.shuffle ? "on" : "off"} · Repeat ${ctx.repeat ? "on" : "off"}
- Theme: ${ctx.themeName}
- Liked songs: ${ctx.likedCount}
- Playlists: ${ctx.playlistNames.length ? ctx.playlistNames.join(", ") : "none yet"}
- Sleep timer: ${ctx.sleepTimer ? `${ctx.sleepTimer} min` : "off"}
- Time-based stop: ${ctx.stopAt || "off"}
- Analytics: ${ctx.totalListens} listens, ${Math.round(ctx.totalMinutes)} min total${ctx.topTrackTitle ? `, top track "${ctx.topTrackTitle}"` : ""}

LOCAL LIBRARY (offline, "artist - title" per entry): ${ctx.localTrackList || "empty"}

ONLINE LIBRARY (radio-browser + Internet Archive curated tracks): ${ctx.onlineTrackList || "empty"}

LIVE RADIO GENRES available: ${ctx.radioGenres}
INTERNET ARCHIVE GENRES: ${ctx.archiveGenres}

SEARCH / PLAY RULES:
- To play an online radio station or live stream: ALWAYS use {type:"play_radio_station", name:"..."} or {type:"play_genre", genre:"..."}. NEVER match local songs or files when the user asks for radio or online stations.
- To play online music: use {type:"play_query", query:"...", scope:"online"}.
- To play a song the user names: emit {type:"play_query", query:"...", scope:"local"|"online"|"any"}. Default scope is "any" (local first, then online).
- To play a specific artist: prefer {type:"play_artist", artist:"..."}. If no match found in the local library, fall back to a play_query with the artist name so we can stream it.
- If the user asks to play a song and fill/populate the queue with one or more artists (e.g. "play a song by X... queue should be filled by songs by X and Y"): ALWAYS emit BOTH a play action (play_artist or play_query) AND a fill_queue action: {type:"fill_queue", artists:["artist1", "artist2"]}.
- To add a track or artist to the queue: use {type:"add_to_queue", artist:"..."} or {type:"add_to_queue", query:"..."}.
- To clear the queue: use {type:"clear_queue"}.
- To play a video or course tutorial: use {type:"play_video", title:"..."} or {type:"play_recent_video"}.
- To open Course & Video Studio: use {type:"open_screen", screen:"courses"}.
- To play an Internet Archive track: {type:"play_external_track", title:"...", artist:"...", source:"archive"|"radio"}.
- To open the user's recently played: {type:"show_recently_played"}.
- If a track is currently playing and the user asks to "seek to 1:30", "jump to 2 minutes", or "skip 30 seconds", emit a seek action.
- "stop at 11:30 pm" / "stop at 23:30" / "stop at 18:00" → {type:"stop_at", isoTime:"<ISO8601>"} (always same day, or next day if already past).
- "stop now", "cancel the stop" → {type:"clear_stop_at"}.

You can actually control the app. Respond with STRICT JSON ONLY — no markdown, no code fences, no commentary outside the JSON — in exactly this shape:
{"reply":"short, warm, conversational reply shown to the user","actions":[{"type":"ACTION_TYPE", ...params}]}

Available action shapes (omit any field the user didn't ask for):

play_query:     {type:"play_query", query:"...", scope?:"any"|"local"|"online"}
play_artist:    {type:"play_artist", artist:"..."}
fill_queue:     {type:"fill_queue", artists:["limoblaze", "blessed hango"]}
add_to_queue:   {type:"add_to_queue", artist?:"...", query?:"..."}
clear_queue:    {type:"clear_queue"}
play_radio_station: {type:"play_radio_station", name:"..."}
play_genre:     {type:"play_genre", genre:"..."}
play_playlist:  {type:"play_playlist", name:"..."}
play_external_track: {type:"play_external_track", title:"...", artist?:"...", source?:"radio"|"archive"}
toggle_play:    {type:"toggle_play"}
next:           {type:"next"}
prev:           {type:"prev"}
seek_to_seconds:{type:"seek_to_seconds", seconds:90}     (90 = 1:30)
seek_by_seconds:{type:"seek_by_seconds", delta:10}      (positive = forward)
set_volume:     {type:"set_volume", value:0-100}
set_shuffle:    {type:"set_shuffle", value:true|false}
set_repeat:     {type:"set_repeat", value:true|false}
like_current:   {type:"like_current"}
unlike_current: {type:"unlike_current"}
set_theme:      {type:"set_theme", name:"Aurora Lime|Sunset Coral|Ocean Mint|Royal Violet|Solar Gold|Neon Pink"}
set_speed:      {type:"set_speed", value:0.5-2}
set_eq_preset:  {type:"set_eq_preset", name:"Flat|Bass+|Vocal|Treble|Acoustic|Electronic|Rock|Jazz|Podcast|Night"}
set_reverb:     {type:"set_reverb", value:0-100}
set_bass_boost: {type:"set_bass_boost", value:0-100}
create_playlist:{type:"create_playlist", name:"..."}
add_current_to_playlist:{type:"add_current_to_playlist", name:"..."}
set_sleep_timer:{type:"set_sleep_timer", minutes:number-or-null}
stop_at:        {type:"stop_at", isoTime:"2025-01-01T23:30:00.000Z"}
clear_stop_at:  {type:"clear_stop_at"}
open_screen:    {type:"open_screen", screen:"home|library|courses|explore|reels|settings|profile|analytics|player"}
toggle_gestures:{type:"toggle_gestures", value:true|false}
toggle_haptics: {type:"toggle_haptics", value:true|false}
show_recently_played:{type:"show_recently_played"}
search_artist:  {type:"search_artist", artist:"..."}
play_video:     {type:"play_video", title?:"..."}
play_recent_video: {type:"play_recent_video"}
generate_music: {type:"generate_music", prompt:"a chill lo-fi beat, 90 BPM", durationSec:20}   (ElevenLabs generates a music bed)
text_to_speech:{type:"text_to_speech", text:"..."}   (ElevenLabs reads the text aloud)

If the user is just chatting, asking a question, or saying thank you, return "actions": []. Keep replies to 1-3 short sentences with personality. Never mention JSON or that you are an AI model — you are simply Audenic AI. Address the user by their first name when you know it.`;
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  extraHeaders?: Record<string, string>,
  timeoutMs = 16000
): Promise<string> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 600,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`http-${res.status}`);
    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content || !content.trim()) throw new Error("empty-response");
    return content;
  } finally {
    window.clearTimeout(timer);
  }
}

export type ProviderName = "gemini" | "puter" | "groq" | "openrouter" | "ollama" | "huggingface" | "offline";

async function callProviderPool(
  baseUrl: string,
  pool: string[],
  model: string,
  messages: ChatMessage[],
  extraHeaders?: Record<string, string>,
): Promise<string> {
  let lastErr: unknown = null;
  for (const key of pool) {
    try {
      return await callOpenAICompatible(baseUrl, key, model, messages, extraHeaders);
    } catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error("no-keys");
}

/* ─── Puter.js — free, keyless cloud AI loaded from the Puter CDN ─── */
let puterLoading: Promise<void> | null = null;

async function callGeminiPool(messages: ChatMessage[], userKey?: string): Promise<string> {
  const manual = userKey?.trim();
  const pool = Array.from(new Set(ENV.geminiKeys.map((k) => k.trim()).filter(Boolean)));
  const geminiKeys = manual ? [manual, ...pool.filter((k) => k !== manual)] : pool;
  if (!geminiKeys.length) throw new Error("no-gemini-key");

  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");

  const contents = chatMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const payload: any = {
    contents: contents.length ? contents : [{ role: "user", parts: [{ text: "Hello" }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 800,
      responseMimeType: "application/json",
    },
  };
  if (systemMsg) {
    payload.system_instruction = {
      parts: [{ text: systemMsg.content }],
    };
  }

  // Rotating keys against active Google Gemini models
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest"];

  for (const key of geminiKeys) {
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
            "Authorization": `Bearer ${key}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) continue;
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && typeof text === "string" && text.trim()) {
          return text;
        }
      } catch {
        continue;
      }
    }
  }
  throw new Error("all-gemini-keys-failed");
}

export async function chatWithFallback(
  messages: ChatMessage[],
  keys: AIKeys
): Promise<{ provider: ProviderName; raw: string } | null> {
  if (keys.offlineOnly) return null;

  // 1. Google Gemini pool (ultra-fast, native JSON support, AQ & AIza multi-key rotation)
  try {
    const raw = await callGeminiPool(messages, keys.geminiKey);
    return { provider: "gemini", raw };
  } catch { /* fall through */ }

  // 2. Groq pool
  {
    const pool = keysFor(keys.groqKey, ENV.groqKeys);
    if (pool.length) {
      try {
        const raw = await callProviderPool("https://api.groq.com/openai/v1", pool, keys.groqModel.trim() || DEFAULTS.groqModel, messages);
        return { provider: "groq", raw };
      } catch { /* fall through */ }
    }
  }

  // 3. HuggingFace Inference API
  {
    const pool = keysFor(keys.hfKey, ENV.huggingFaceKeys);
    if (pool.length) {
      try {
        const raw = await callProviderPool("https://api-inference.huggingface.co/v1", pool, keys.hfModel.trim() || DEFAULTS.hfModel, messages);
        return { provider: "huggingface", raw };
      } catch { /* fall through */ }
    }
  }

  // 4. OpenRouter pool
  {
    const pool = keysFor(keys.orKey, ENV.openRouterKeys);
    if (pool.length) {
      try {
        const raw = await callProviderPool(
          "https://openrouter.ai/api/v1",
          pool,
          keys.orModel.trim() || DEFAULTS.orModel,
          messages,
          typeof location !== "undefined" ? { "HTTP-Referer": location.origin, "X-Title": APP_NAME } : undefined
        );
        return { provider: "openrouter", raw };
      } catch { /* fall through */ }
    }
  }

  /* fall through to fully-offline music assistant */
  return null;
}

export function parseAIJson(raw: string): AIReply {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/, "")
    .trim();

  const tryParse = (s: string): AIReply | null => {
    try { return normalize(JSON.parse(s)); } catch { return null; }
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  // Extract the first balanced {...} block for models that add extra prose.
  const start = cleaned.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === "{") depth++;
      else if (cleaned[i] === "}") {
        depth--;
        if (depth === 0) {
          const slice = cleaned.slice(start, i + 1);
          const parsed = tryParse(slice);
          if (parsed) return parsed;
          break;
        }
      }
    }
  }

  return { reply: raw.trim() || "Sorry, I couldn't quite process that.", actions: [] };
}

const ALLOWED_ACTIONS = new Set<AIAction["type"]>([
  "play_query", "play_artist", "play_radio_station", "play_genre", "play_playlist", "play_external_track",
  "toggle_play", "next", "prev", "seek_to_seconds", "seek_by_seconds",
  "set_volume", "set_shuffle", "set_repeat",
  "like_current", "unlike_current",
  "set_theme", "set_speed", "set_eq_preset", "set_reverb", "set_bass_boost",
  "create_playlist", "add_current_to_playlist",
  "set_sleep_timer", "stop_at", "clear_stop_at",
  "open_screen", "toggle_gestures", "toggle_haptics",
  "show_recently_played", "search_artist",
  "fill_queue", "add_to_queue", "clear_queue",
  "play_video", "play_recent_video", "generate_music",
]);

function normalize(obj: unknown): AIReply {
  const o = (obj || {}) as Record<string, unknown>;
  const reply =
    typeof o.reply === "string" ? o.reply
    : typeof o.message === "string" ? (o.message as string)
    : typeof o.text === "string" ? (o.text as string)
    : "";
  const actions: AIAction[] = [];
  if (Array.isArray(o.actions)) {
    for (const raw of o.actions as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const a = raw as { type?: unknown } & Record<string, unknown>;
      if (typeof a.type !== "string" || !ALLOWED_ACTIONS.has(a.type as AIAction["type"])) continue;
      actions.push(a as unknown as AIAction);
    }
  }
  return { reply: reply || "Done!", actions };
}

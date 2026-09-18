// Fully offline, zero-network fallback for Audenic AI. Much richer than a
// keyword matcher — it can:
//   • Plan multiple actions from a single sentence
//   • Search the local library with fuzzy / token scoring
//   • Resolve a specific artist or song into a play action
//   • Parse "stop at 11:30 pm", "next", "shuffle on", "EQ to bass+", "theme sunset"
//   • Answer questions about the app and the user
//   • Time-based stop timers and creative tone-aware replies

import { OWNER_NAME, APP_NAME, type AIAction, type AIReply } from "./aiProviders";
import { THEMES } from "./PlayerContext";
import { EQ_PRESETS } from "./audioEngine";
import { TAGS } from "./api";

type Track = { id: string; title: string; artist: string; source: "online" | "local"; tags?: string[] };
type Playlist = { id: string; name: string; trackIds: string[] };
type Current = { title: string; artist: string } | null;
type ThemeT = { name: string };

export interface OfflineContext {
  tracks: Track[];
  playlists: Playlist[];
  current: Current;
  isPlaying: boolean;
  theme: ThemeT;
  volume: number;
}

const THEME_LOOKUP = THEMES.map((t) => t.name.toLowerCase());
const EQ_LOOKUP = EQ_PRESETS.map((p) => p.name.toLowerCase());
const RADIO_LOOKUP = TAGS.map((t) => t.label.toLowerCase());

/* ───────── scoring helpers ───────── */

function score(query: string, against: string): number {
  const q = query.trim().toLowerCase();
  const t = against.toLowerCase();
  if (!q || !t) return 0;
  if (t === q) return 1000;
  if (t.includes(q)) return 500;
  const qs = q.split(/\s+/);
  let s = 0;
  for (const w of qs) if (w && t.includes(w)) s += 80;
  return s;
}

export function findLocalSong(q: string, tracks: Track[]): Track | null {
  const ranked = tracks
    .map((t) => ({ t, s: Math.max(score(q, t.title), score(q, t.artist) * 0.9, score(q, t.title + " " + t.artist) * 0.8) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return ranked[0]?.t ?? null;
}

export function findLocalArtist(q: string, tracks: Track[]): Track[] {
  return tracks
    .map((t) => ({ t, s: score(q, t.artist) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t);
}

export function findLocalByTag(q: string, tracks: Track[]): Track[] {
  return tracks.filter((t) => (t.tags || []).some((tag) => tag.toLowerCase().includes(q.toLowerCase())));
}

export function findPlaylist(q: string, playlists: Playlist[]): Playlist | null {
  const ql = q.toLowerCase().trim();
  if (!ql) return null;
  const exact = playlists.find((p) => p.name.toLowerCase() === ql);
  if (exact) return exact;
  return playlists
    .map((p) => ({ p, s: p.name.toLowerCase().includes(ql) ? 1 : ql.includes(p.name.toLowerCase()) ? 0.5 : 0 }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)[0]?.p ?? null;
}

export function findThemeByName(q: string): { name: string } | null {
  const ql = q.toLowerCase().trim();
  if (!ql) return null;
  const exact = THEMES.find((t) => t.name.toLowerCase() === ql);
  if (exact) return exact;
  return THEMES.find((t) => t.name.toLowerCase().includes(ql) || ql.includes(t.name.toLowerCase())) ?? null;
}

export function findEqPreset(q: string): string | null {
  const ql = q.toLowerCase().trim();
  if (!ql) return null;
  return EQ_PRESETS.find((p) => p.name.toLowerCase() === ql)?.name ?? null;
}

export function findRadioTag(q: string): { id: string; label: string } | null {
  const ql = q.toLowerCase().trim();
  if (!ql) return null;
  return TAGS.find((t) => t.label.toLowerCase() === ql || t.id === ql) ?? null;
}

/* ───────── time parsing ───────── */

export function parseTimeToISO(text: string): string | null {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  const now = new Date();
  const t = new Date(now);
  t.setHours(h, min, 0, 0);
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
  return t.toISOString();
}

export function parseDurationMinutes(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("h")) return Math.round(n * 60);
  return Math.round(n);
}

function plural(n: number, s: string, p: string) { return `${n} ${n === 1 ? s : p}`; }

/* ───────── intent extraction ───────── */

function matchAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

function extractQuery(text: string, prefixRegex: RegExp[]): string | null {
  for (const r of prefixRegex) {
    const m = text.match(r);
    if (m && m[1] && m[1].trim().length >= 1) return m[1].trim();
  }
  return null;
}

function stripQuotes(s: string) { return s.replace(/^["'`]+|["'`]+$/g, "").trim(); }

/* ───────── the planner ───────── */

export function offlineReply(userText: string, userName: string, ctx: OfflineContext): AIReply {
  const t = userText.trim();
  const lower = t.toLowerCase();
  const actions: AIAction[] = [];
  const rawName = (userName || "").trim();
  const isGuest = !rawName || rawName.toLowerCase() === "guest";
  const firstName = isGuest ? "" : rawName.split(" ")[0];

  // Natural conversational voice — NEVER mechanically appending "Guest." or forcing a name
  const greet = (s: string) => {
    if (isGuest || !firstName) return s;
    if (s.endsWith("?")) return `${s.slice(0, -1)}, ${firstName}?`;
    return s;
  };

  if (!t) return { reply: greet("Tell me what to play"), actions: [] };

  /* ── meta: who are you / what's this app ── */
  if (/(who|what) (are|is) (you|this app|audenic|aurora)/.test(lower) || /(how does|how do|what can|can you|tell me about)/.test(lower) && /(work|you|app)/.test(lower) && !/(how do i play|how do i|play a song)/.test(lower)) {
    if (/what can|can you/.test(lower)) {
      return { reply: greet(`I'm Audenic AI. I can play a specific song, tune a radio station, manage playlists, change the theme & EQ, and answer questions about ${APP_NAME} — even offline.`), actions: [] };
    }
    return { reply: greet(`I'm Audenic AI, the built-in assistant for ${APP_NAME}. ${APP_NAME} is a local library, online radio and reels player originally built for ${OWNER_NAME}.`), actions: [] };
  }

  if (/who am i|my name|who is using/.test(lower)) {
    return { reply: greet(`You're ${userName || OWNER_NAME}. ${OWNER_NAME} originally built ${APP_NAME} — good to have you here.`), actions: [] };
  }
  if (/(thank|thanks|appreciate)/.test(lower)) {
    return { reply: greet("Anytime!") + " 🎧", actions: [] };
  }
  if (/how are you|how's it going|sup\b/.test(lower)) {
    return { reply: greet("All good, queue's clean. What shall we listen to?"), actions: [] };
  }

  /* ── greeting ── */
  if (/^(hi|hey|hello|yo|sup|hola|good (morning|afternoon|evening))\b/.test(lower) && t.length < 30) {
    return { reply: greet("What are we listening to today?"), actions: [] };
  }

  /* ── greeting by name ── */
  if (lower.includes("audenic") && /(open|launch|go to|take me to)/.test(lower)) {
    return { reply: greet("Welcome! What would you like to do first?"), actions: [] };
  }

  /* ── queue management: clear queue ── */
  if (/\bclear\s+(?:the\s+)?(?:que|queue)\b/i.test(lower)) {
    actions.push({ type: "clear_queue" });
    return { reply: greet("Cleared the playback queue."), actions };
  }

  /* ── compound: play song/artist AND fill queue with multiple artists ── */
  const compoundQueueRegex = /\b(?:the\s+)?(?:que|queue)\s+(?:should be|is)?\s*(?:filled|populated|loaded|set)\s+(?:by|with)\s+(?:songs?|tracks?|music)?\s*(?:by|from)?\s*(.+)$/i;
  const compoundMatch = lower.match(compoundQueueRegex);

  if (compoundMatch) {
    const queueTargetStr = compoundMatch[1]
      .replace(/\b(please|now|on audenic|in my library|in library)\b/gi, "")
      .trim();

    const playPart = lower.slice(0, compoundMatch.index).trim()
      .replace(/\b(now|please|in my library|in library)\b/gi, "")
      .trim();

    // Extract target artists for queue (e.g. "limoblaze and blessed hango")
    const queueArtists = queueTargetStr
      .split(/\s*(?:,|and|&|\+)\s*/)
      .map((s) => s.replace(/\b(songs?|tracks?|music|by)\b/gi, "").trim())
      .filter((s) => s.length > 1);

    // 1. Resolve what to play first
    const playArtistMatch = playPart.match(/\bplay\s+(?:a\s+song\s+by|songs?\s+by|some\s+)?(.+)$/i);
    const playCandidate = playArtistMatch ? playArtistMatch[1].trim() : playPart.replace(/^play\s+/i, "").trim();

    let firstTrack: Track | null = null;
    if (playCandidate) {
      const artMatches = findLocalArtist(playCandidate, ctx.tracks);
      if (artMatches.length) {
        firstTrack = artMatches[0];
        actions.push({ type: "play_query", query: firstTrack.title, scope: "local" });
      } else {
        const songMatch = findLocalSong(playCandidate, ctx.tracks);
        if (songMatch) {
          firstTrack = songMatch;
          actions.push({ type: "play_query", query: songMatch.title, scope: "local" });
        } else {
          actions.push({ type: "play_artist", artist: playCandidate });
        }
      }
    }

    // 2. Collect all matching tracks from library for the requested queue artists
    const allQueueIds: string[] = [];
    if (firstTrack) {
      allQueueIds.push(firstTrack.id);
    }

    for (const qArt of queueArtists) {
      const artMatches = findLocalArtist(qArt, ctx.tracks);
      for (const tr of artMatches) {
        if (!allQueueIds.includes(tr.id)) {
          allQueueIds.push(tr.id);
        }
      }
    }

    actions.push({
      type: "fill_queue",
      artists: queueArtists,
      trackIds: allQueueIds.length > 0 ? allQueueIds : undefined,
    });

    const displayArtists = queueArtists.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(" & ");
    const playDesc = firstTrack ? `"${firstTrack.title}" by ${firstTrack.artist}` : playCandidate;
    return {
      reply: greet(`Playing ${playDesc} and filled the queue with ${allQueueIds.length} songs by ${displayArtists}.`),
      actions,
    };
  }

  /* ── fill queue standalone ── */
  const fillQueueOnlyRegex = /\b(?:fill|populate|load)\s+(?:the\s+)?(?:que|queue)\s+with\s+(?:songs?|tracks?|music)?\s*(?:by|from)?\s*(.+)$/i;
  const fillOnlyMatch = lower.match(fillQueueOnlyRegex);
  if (fillOnlyMatch) {
    const queueTargetStr = fillOnlyMatch[1]
      .replace(/\b(please|now|on audenic|in my library|in library)\b/gi, "")
      .trim();
    const queueArtists = queueTargetStr
      .split(/\s*(?:,|and|&|\+)\s*/)
      .map((s) => s.replace(/\b(songs?|tracks?|music|by)\b/gi, "").trim())
      .filter((s) => s.length > 1);

    const allQueueIds: string[] = [];
    for (const qArt of queueArtists) {
      const artMatches = findLocalArtist(qArt, ctx.tracks);
      for (const tr of artMatches) {
        if (!allQueueIds.includes(tr.id)) allQueueIds.push(tr.id);
      }
    }

    actions.push({
      type: "fill_queue",
      artists: queueArtists,
      trackIds: allQueueIds.length > 0 ? allQueueIds : undefined,
    });
    const displayArtists = queueArtists.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(" & ");
    return {
      reply: greet(`Filled your queue with ${allQueueIds.length} tracks by ${displayArtists}.`),
      actions,
    };
  }

  /* ── play a specific song / search local ── */
  const playSong = extractQuery(lower, [
    /\b(?:play|find|search|put on|queue)\s+(?:a song\s+)?(?:called\s+)?["']?(.+?)["']?$/,
    /\b(?:play|find|search|queue)\s+(?:me\s+)?["'](.+?)["']/,
    /\bplay\s+(.+?)(?:\s+on audenic|\s+please|\s+now)?$/,
  ]);
  if (playSong && playSong.length > 0 && !/^(next|previous|prev|again|this|that|something|music|song)$/.test(playSong)) {
    // Video or course request
    if (/(video|course|lesson|tutorial)/i.test(playSong) || /(video|course|lesson|tutorial)/i.test(lower)) {
      const cleanVideo = playSong.replace(/\b(video|course|lesson|tutorial|play|watch)\b/gi, "").trim();
      actions.push({ type: "play_video", title: cleanVideo || undefined });
      return { reply: greet(cleanVideo ? `Playing video "${cleanVideo}"` : "Opening Course & Video Studio 🎬"), actions };
    }

    // Radio station or broadcast request
    if (/\b(radio|fm|station|broadcast)\b/i.test(playSong) || /\b(radio|fm|station|broadcast)\b/i.test(lower)) {
      const cleanStation = playSong.replace(/\b(play|radio|fm|station|online|stream)\b/gi, "").trim();
      actions.push({ type: "play_radio_station", name: cleanStation || playSong });
      return { reply: greet(`Tuning into online radio "${cleanStation || playSong}" 📻`), actions };
    }

    // Online music request
    if (/\bonline\b/i.test(playSong) || /\bonline\b/i.test(lower)) {
      const cleanQ = playSong.replace(/\bonline\b/gi, "").trim();
      actions.push({ type: "play_query", query: cleanQ, scope: "online" });
      return { reply: greet(`Searching online music for "${cleanQ}" 🌐`), actions };
    }

    // Special tokens
    if (/^something (energetic|chill|relaxing|happy|sad|loud)/.test(playSong)) {
      // pick something from the local library matching the mood tag
      const mood = playSong.split(" ")[1];
      const candidates = findLocalByTag(mood, ctx.tracks);
      if (candidates.length) { actions.push({ type: "play_query", query: candidates[0].title, scope: "any" }); return { reply: greet(`Cueing up "${candidates[0].title}" by ${candidates[0].artist}`), actions }; }
    }
    const local = findLocalSong(playSong, ctx.tracks);
    if (local) { actions.push({ type: "play_query", query: playSong, scope: "any" }); return { reply: greet(`Playing "${local.title}" by ${local.artist}`), actions }; }
    // No local match: try archive search
    actions.push({ type: "play_external_track", title: playSong, artist: "", source: "archive" });
    return { reply: greet(`Couldn't find "${playSong}" offline — streaming the first match from the Internet Archive`), actions };
  }

  /* ── play an artist ── */
  const playArtist = extractQuery(lower, [
    /\bplay\s+(?:some|songs?|music|tracks?)\s+by\s+([^"'].+?)$/,
    /\bplay\s+(.+?)\s+music$/,
    /\bsongs by\s+([^"'].+?)$/i,
    /\bartist\s+["']?([^"'].+?)["']?$/,
  ]);
  if (playArtist) {
    const a = playArtist.trim();
    // Heuristic: if user said "radio station X" — switch to play_radio_station
    if (/\bradio\b/.test(a) || /\bchannel\b/.test(a)) {
      actions.push({ type: "play_radio_station", name: a.replace(/\b(radio|channel)\b/g, "").trim() });
      return { reply: greet(`Tuning into ${a}`), actions };
    }
    const localMatches = findLocalArtist(a, ctx.tracks);
    if (localMatches.length) { actions.push({ type: "play_artist", artist: localMatches[0].artist }); return { reply: greet(`Playing ${localMatches[0].artist} — "${localMatches[0].title}"`), actions }; }
    actions.push({ type: "play_external_track", title: a, artist: a, source: "archive" });
    return { reply: greet(`Streaming ${a} from the Internet Archive`), actions };
  }

  /* ── play a radio station ── */
  const playStation = extractQuery(lower, [
    /\bplay (?:a |the )?(?:radio )?station\s+(?:called\s+)?["']?(.+?)["']?$/,
    /\btune (?:me )?in(?:to)?\s+(?:a )?(?:radio )?station\s+["']?(.+?)["']?$/,
    /\b(?:play|tune (?:me )?in(?:to)?)\s+["'](.+?)["']\s*(?:radio|station)?$/,
  ]);
  if (playStation) {
    actions.push({ type: "play_radio_station", name: playStation });
    return { reply: greet(`Tuning into ${playStation}…`), actions };
  }

  /* ── play a radio genre ── */
  if (/(?:play|open|tune to|show me)\s+(?:a )?(?:some )?([a-z\- ]+?)\s+(?:music|station|stations|radio)\b/.test(lower)) {
    const m = lower.match(/(?:play|open|tune to|show me)\s+(?:a )?(?:some )?([a-z\- ]+?)\s+(?:music|station|stations|radio)\b/);
    const genre = m?.[1]?.trim() || "";
    if (genre) { actions.push({ type: "play_genre", genre }); return { reply: greet(`Tuned to ${genre} radio`), actions }; }
  }
  if (RADIO_LOOKUP.some((g) => lower.includes(g.split(" ")[0]))) {
    const hit = RADIO_LOOKUP.find((g) => lower.includes(g));
    if (hit && /(radio|station|tune|music|play)/.test(lower)) {
      actions.push({ type: "play_genre", genre: hit });
      return { reply: greet(`Tuned to ${hit} radio`), actions };
    }
  }

  /* ── playlist playback & management ── */
  const playPlaylist = extractQuery(lower, [
    /\bplay (?:the )?playlist\s+["']?(.+?)["']?$/,
    /\bplay (?:my )?["']?(.+?)["']? playlist$/,
    /\bplay everything in\s+["']?(.+?)["']?$/,
  ]);
  if (playPlaylist) {
    const pl = findPlaylist(playPlaylist, ctx.playlists);
    if (pl) { actions.push({ type: "play_playlist", name: pl.name }); return { reply: greet(`Playing playlist "${pl.name}"`), actions }; }
    return { reply: greet(`Couldn't find a playlist called "${playPlaylist}"`), actions: [] };
  }

  const createPl = extractQuery(lower, [
    /\bcreate (?:a )?(?:new )?playlist\s+(?:called |named )?["']?(.+?)["']?$/,
    /\bmake (?:a )?(?:new )?playlist\s+["']?(.+?)["']?$/,
    /\bnew playlist\s+["']?(.+?)["']?$/,
  ]);
  if (createPl) {
    const name = stripQuotes(createPl);
    if (name.length > 0 && name.length < 60) {
      actions.push({ type: "create_playlist", name });
      return { reply: greet(`Created a new playlist called "${name}"`), actions };
    }
  }

  if (/(add (this|the current)( song)? to|put (this|the current)( song)? (in|on))\s+["']?(.+?)["']?$/.test(lower)) {
    const m = lower.match(/(?:add (this|the current)(?: song)? to|put (this|the current)(?: song)? (?:in|on))\s+["']?(.+?)["']?$/);
    const pl = m ? findPlaylist(m[3] || m[1] || "", ctx.playlists) : null;
    if (pl) { actions.push({ type: "add_current_to_playlist", name: pl.name }); return { reply: greet(`Added it to "${pl.name}"`), actions }; }
  }

  /* ── screen navigation & modes ── */
  if (/(courses|course|video studio|videos|tutorials|lessons)/.test(lower) && /(open|go to|take me|show)/.test(lower)) {
    actions.push({ type: "open_screen", screen: "courses" });
    return { reply: greet("Opening Course & Video Studio 🎬"), actions };
  }
  if (/(radio|radio place|go to radio|open radio|take me to radio)/.test(lower)) {
    actions.push({ type: "open_screen", screen: "radio" });
    return { reply: greet("Taking you straight to Radio 📻"), actions };
  }
  if (/(drive mode|simple mode|take me to drive mode|take me to simple mode|open drive mode|open simple mode|drive|simple)/.test(lower) && /(mode|take|open|go|launch)/.test(lower)) {
    actions.push({ type: "open_screen", screen: "simple_mode" });
    return { reply: greet("Launching Simple Mode 🚗"), actions };
  }

  /* ── playback transport ── */
  if (matchAny(lower, ["pause", "stop the music", "hold on"])) { actions.push({ type: "toggle_play" }); return { reply: greet("Paused."), actions }; }
  if (matchAny(lower, ["resume", "play", "unpause", "continue playing"])) {
    if (!ctx.current) actions.push({ type: "play_query", query: "energetic", scope: "any" });
    else actions.push({ type: "toggle_play" });
    return { reply: greet(ctx.current ? "Resuming playback." : "Picking something energetic…"), actions };
  }
  if (matchAny(lower, ["next", "skip"])) { actions.push({ type: "next" }); return { reply: greet("Skipping ahead."), actions }; }
  if (matchAny(lower, ["previous", "go back", "last song", "previous track"])) { actions.push({ type: "prev" }); return { reply: greet("Going back."), actions }; }
  if (matchAny(lower, ["shuffle on", "shuffle enable", "turn on shuffle", "shuffle is on", "shuffle it"])) { actions.push({ type: "set_shuffle", value: true }); return { reply: greet("Shuffle on 🔀"), actions }; }
  if (matchAny(lower, ["shuffle off", "turn off shuffle", "shuffle is off", "stop shuffling"])) { actions.push({ type: "set_shuffle", value: false }); return { reply: greet("Shuffle off."), actions }; }
  if (matchAny(lower, ["repeat on", "loop on", "turn on repeat", "repeat this song", "loop the song"])) { actions.push({ type: "set_repeat", value: true }); return { reply: greet("Repeat on 🔁"), actions }; }
  if (matchAny(lower, ["repeat off", "turn off repeat", "stop repeating"])) { actions.push({ type: "set_repeat", value: false }); return { reply: greet("Repeat off."), actions }; }
  if (matchAny(lower, ["like this", "i like this", "like the song", "favou?rite this"])) { actions.push({ type: "like_current" }); return { reply: greet("Added to liked songs ❤️"), actions }; }
  if (matchAny(lower, ["unlike", "remove from liked", "unfavou?rite"])) { actions.push({ type: "unlike_current" }); return { reply: greet("Removed from liked songs."), actions }; }

  /* ── seek ── */
  const seekTo = lower.match(/\b(?:go to|jump to|seek to|skip to)\s+(\d{1,2}):(\d{2})\b/);
  if (seekTo) {
    const seconds = parseInt(seekTo[1], 10) * 60 + parseInt(seekTo[2], 10);
    actions.push({ type: "seek_to_seconds", seconds });
    return { reply: greet(`Skipping to ${seekTo[1]}:${seekTo[2]}`), actions };
  }
  const seekToS = lower.match(/\b(?:go to|jump to|seek to|skip to)\s+(\d+)\s*(?:seconds|secs|s)\b/);
  if (seekToS) {
    const seconds = parseInt(seekToS[1], 10);
    actions.push({ type: "seek_to_seconds", seconds });
    return { reply: greet(`Skipping to ${seconds}s`), actions };
  }
  const seekByMatch = lower.match(/\b(skip|forward|jump|rewind|back)\s+(\d+)\s*(?:seconds|secs|s)?\b/);
  if (seekByMatch) {
    const v = parseInt(seekByMatch[2], 10);
    const delta = /rewind|back/.test(seekByMatch[1]) ? -v : v;
    actions.push({ type: "seek_by_seconds", delta });
    return { reply: greet(`${delta > 0 ? "Forward" : "Back"} ${Math.abs(delta)}s`), actions };
  }
  if (/restart|start over|from the (start|beginning)/.test(lower)) { actions.push({ type: "seek_to_seconds", seconds: 0 }); return { reply: greet("Restarted from the beginning."), actions }; }

  /* ── volume ── */
  const volMatch = lower.match(/\b(?:set )?volume\s*(?:to|at)?\s*(\d{1,3})\b/);
  if (volMatch) { const v = Math.max(0, Math.min(100, parseInt(volMatch[1], 10))); actions.push({ type: "set_volume", value: v }); return { reply: greet(`Volume → ${v}%`), actions }; }
  if (/(louder|turn it up|raise (the )?volume|pump it up)/.test(lower)) { actions.push({ type: "set_volume", value: 90 }); return { reply: greet("Turned it up 🔊"), actions }; }
  if (/(quieter|lower (the )?volume|turn it down|too loud)/.test(lower)) { actions.push({ type: "set_volume", value: 30 }); return { reply: greet("Turned it down a bit."), actions }; }
  if (/(mute|silence)/.test(lower)) { actions.push({ type: "set_volume", value: 0 }); return { reply: greet("Muted."), actions }; }
  if (/(unmute|restore volume|max volume|full volume)/.test(lower)) { actions.push({ type: "set_volume", value: 100 }); return { reply: greet("Volume at 100%."), actions }; }

  /* ── speed ── */
  const speedMatch = lower.match(/\b(?:play at|speed up|slow down|change speed to|set speed to)\s*(\d(?:\.\d+)?)\s*[x×]?/);
  if (speedMatch) {
    const v = Math.max(0.5, Math.min(2, parseFloat(speedMatch[1])));
    actions.push({ type: "set_speed", value: v });
    return { reply: greet(`Speed → ${v}×`), actions };
  }
  if (/(speed up|play faster)/.test(lower)) { actions.push({ type: "set_speed", value: 1.5 }); return { reply: greet("Speed → 1.5×"), actions }; }
  if (/(slow down|play slower)/.test(lower)) { actions.push({ type: "set_speed", value: 0.75 }); return { reply: greet("Speed → 0.75×"), actions }; }

  /* ── full screen / now playing preview ── */
  if (/(full\s*screen|fullscreen|open full screen|fungua full screen|onyesha player|show player|now playing|preview player|expand player)/.test(lower)) {
    actions.push({ type: "open_screen", screen: "player" });
    return { reply: greet("Opening Full Screen Now Playing view 🎵"), actions };
  }

  /* ── theme switching (Swahili & English) ── */
  if (/(theme|switch|change|set to|make it|badili|badilisha|muonekano)/.test(lower)) {
    for (const t of THEMES) {
      if (lower.includes(t.name.toLowerCase())) {
        actions.push({ type: "set_theme", name: t.name });
        return { reply: greet(`Theme switched to ${t.name} ✨`), actions };
      }
    }
  }
  const themeMatch = lower.match(/\b(?:switch (?:to )?the |change |set )?theme (?:to )?["']?([a-z ]+?)["']?(?:\s*theme)?$/i);
  if (themeMatch) {
    const t = findThemeByName(themeMatch[1].trim());
    if (t) { actions.push({ type: "set_theme", name: t.name }); return { reply: greet(`Theme → ${t.name}`), actions }; }
  }

  /* ── equalizer + audio effects (Voice, Vocal, Bass, Acoustic, Rock, Pop) ── */
  if (/(voice|vocal|sauti ya vocal|voice eq|eq in voice|set to voice|vocal boost)/.test(lower)) {
    actions.push({ type: "set_eq_preset", name: "Vocal Boost" });
    return { reply: greet("Equalizer set to Vocal / Voice Boost 🎙️"), actions };
  }
  if (/(bass|bass boost|set to bass|ongeza bass|bass up|pump the bass)/.test(lower)) {
    actions.push({ type: "set_eq_preset", name: "Bass Boost" });
    actions.push({ type: "set_bass_boost", value: 85 });
    return { reply: greet("Equalizer set to Bass Boost 🔊"), actions };
  }
  if (/(acoustic|set to acoustic)/.test(lower)) {
    actions.push({ type: "set_eq_preset", name: "Acoustic" });
    return { reply: greet("Equalizer set to Acoustic 🎸"), actions };
  }
  if (/(treble|treble boost|set to treble)/.test(lower)) {
    actions.push({ type: "set_eq_preset", name: "Treble Boost" });
    return { reply: greet("Equalizer set to Treble Boost 🎼"), actions };
  }
  if (/(rock|set to rock)/.test(lower)) {
    actions.push({ type: "set_eq_preset", name: "Rock" });
    return { reply: greet("Equalizer set to Rock 🎸"), actions };
  }
  if (/(pop|set to pop)/.test(lower)) {
    actions.push({ type: "set_eq_preset", name: "Pop" });
    return { reply: greet("Equalizer set to Pop 🎤"), actions };
  }
  if (/(jazz|set to jazz)/.test(lower)) {
    actions.push({ type: "set_eq_preset", name: "Jazz" });
    return { reply: greet("Equalizer set to Jazz 🎷"), actions };
  }
  if (/(electronic|set to electronic)/.test(lower)) {
    actions.push({ type: "set_eq_preset", name: "Electronic" });
    return { reply: greet("Equalizer set to Electronic ⚡"), actions };
  }
  if (/(reset (the )?eq|reset (the )?equalizer|reset effects|flat eq)/.test(lower)) { actions.push({ type: "set_eq_preset", name: "Flat" }); return { reply: greet("EQ reset to Flat."), actions }; }
  if (/(more reverb|more space|more echo|add reverb)/.test(lower)) { actions.push({ type: "set_reverb", value: 60 }); return { reply: greet("Added more reverb 🌌"), actions }; }
  if (/(less reverb|less echo|no reverb|turn off reverb)/.test(lower)) { actions.push({ type: "set_reverb", value: 0 }); return { reply: greet("Reverb off."), actions }; }

  /* ── sleep timer / stop at ── */
  const stopAt = lower.match(/\b(?:stop|pause|turn off) (?:the )?(?:music|playback|playing) at (.+)$/i)
                 || lower.match(/\b(?:stop|pause|turn off) at (.+)$/i)
                 || lower.match(/\bat (.+?) (?:stop|pause|turn off)\b/i);
  if (stopAt) {
    const iso = parseTimeToISO(stopAt[1]);
    if (iso) {
      const t = new Date(iso);
      actions.push({ type: "stop_at", isoTime: iso });
      return { reply: greet(`Will stop playback at ${t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`), actions };
    }
  }
  if (/cancel (?:the )?(?:stop|stop-at|timer)|clear (?:the )?stop|never ?mind/.test(lower)) {
    actions.push({ type: "clear_stop_at" });
    return { reply: greet("Time-based stop cancelled."), actions };
  }
  const timerDur = parseDurationMinutes(lower);
  if (timerDur && /(sleep|stop|pomodoro|timer)/.test(lower)) {
    actions.push({ type: "set_sleep_timer", minutes: timerDur });
    return { reply: greet(`Sleep timer set for ${plural(timerDur, "minute", "minutes")} 💤`), actions };
  }
  if (/(cancel sleep|stop sleep timer|turn off sleep)/.test(lower)) { actions.push({ type: "set_sleep_timer", minutes: null }); return { reply: greet("Sleep timer cancelled."), actions }; }

  /* ── navigation ── */
  if (/(open|go to|show me|navigate to)\s+(home)/.test(lower)) { actions.push({ type: "open_screen", screen: "home" }); return { reply: greet("On the home tab."), actions }; }
  if (/(open|go to|show me|navigate to)\s+(my music|library|playlists?)/.test(lower)) { actions.push({ type: "open_screen", screen: "library" }); return { reply: greet("In your library."), actions }; }
  if (/(open|go to|show me|navigate to)\s+(explore|discover|radio)/.test(lower)) { actions.push({ type: "open_screen", screen: "explore" }); return { reply: greet("Explore is open."), actions }; }
  if (/(open|go to|show me|navigate to)\s+(reels?)/.test(lower)) { actions.push({ type: "open_screen", screen: "reels" }); return { reply: greet("Reels is open."), actions }; }
  if (/(open|go to|show me|navigate to)\s+(settings|preferences)/.test(lower)) { actions.push({ type: "open_screen", screen: "settings" }); return { reply: greet("Settings is open."), actions }; }
  if (/(open|go to|show me|navigate to)\s+(profile|my account)/.test(lower)) { actions.push({ type: "open_screen", screen: "profile" }); return { reply: greet("Profile opened."), actions }; }
  if (/(open|go to|show me|navigate to)\s+(analytics|insights|stats|listening stats)/.test(lower)) { actions.push({ type: "open_screen", screen: "analytics" }); return { reply: greet("Analytics opened 📊"), actions }; }
  if (/(open|go to|show me|navigate to)\s+(now playing|player)/.test(lower)) { actions.push({ type: "open_screen", screen: "player" }); return { reply: greet("Now playing screen opened."), actions }; }
  if (/(show|open) (?:my )?recently played|recently played/.test(lower)) { actions.push({ type: "show_recently_played" }); return { reply: greet("Opening your recently played."), actions }; }

  /* ── gestures / haptics ── */
  if (/(gestures? on|enable gestures?|turn on gestures?)/.test(lower)) { actions.push({ type: "toggle_gestures", value: true }); return { reply: greet("Gestures on."), actions }; }
  if (/(gestures? off|disable gestures?|turn off gestures?)/.test(lower)) { actions.push({ type: "toggle_gestures", value: false }); return { reply: greet("Gestures off."), actions }; }
  if (/(haptics? on|enable haptics?|turn on haptics?|turn on vibration)/.test(lower)) { actions.push({ type: "toggle_haptics", value: true }); return { reply: greet("Haptics on."), actions }; }
  if (/(haptics? off|disable haptics?|turn off haptics?|turn off vibration)/.test(lower)) { actions.push({ type: "toggle_haptics", value: false }); return { reply: greet("Haptics off."), actions }; }

  /* ── app knowledge ── */
  if (/how (?:much|many) (?:have i )?(?:listened|been playing|do i|spent)/.test(lower) || /my stats|listening stats|my analytics/.test(lower)) {
    return { reply: greet("Tap the Analytics card in Settings, or ask me to open it and I'll take you there."), actions: [{ type: "open_screen", screen: "analytics" }] };
  }
  if (/(how does|explain) (?:the )?equalizer|audio effects/.test(lower)) {
    return { reply: greet("Open Now Playing and tap the EQ icon (or hold the artwork) to access the 5-band equalizer, bass boost, reverb and speed control."), actions: [] };
  }
  if (/(how|where) (do i|to) (scan|add) (?:local )?(?:songs|music|files)/.test(lower)) {
    return { reply: greet("Open My Music and tap the 'Scan device' card, or pick a folder from Settings ▸ Library ▸ Scan folder."), actions: [{ type: "open_screen", screen: "library" }] };
  }
  if (/reels? (?:how|where|what)/.test(lower) || /how (?:do|to) (?:use|watch) reels/.test(lower)) {
    return { reply: greet("Reels is the TikTok-style feed — open it from the bottom bar, double-tap to like, swipe up/down to navigate."), actions: [{ type: "open_screen", screen: "reels" }] };
  }
  if (/internet archive|free music|free tracks/.test(lower)) {
    return { reply: greet("Yes — Audenic streams free, legal audio from the Internet Archive inside Explore ▸ Online Music. Tap a track to start playing instantly."), actions: [] };
  }
  if (/online radio|radio stations|1000|live radio/.test(lower)) {
    return { reply: greet("There are 1000+ live radio stations in Explore. Pick a genre chip and tap any station to start streaming."), actions: [{ type: "open_screen", screen: "explore" }] };
  }
  if (/ai translation|translate lyrics|gemini/.test(lower)) {
    return { reply: greet("Open Now Playing, tap the ✨ AI button, choose a language and Audenic will translate the lyrics live using Gemini."), actions: [] };
  }

  /* ── library state queries ── */
  if (/what'?s playing|now playing|what song|what am i listening|what is this song/.test(lower)) {
    if (ctx.current) return { reply: greet(`That's "${ctx.current.title}" by ${ctx.current.artist}`), actions: [] };
    return { reply: greet("Nothing is playing right now — want me to pick something energetic?"), actions: [] };
  }
  if (/how many (?:songs|tracks)/.test(lower) && /(local|library|on my (?:phone|device)|in my)/.test(lower)) {
    const localCount = ctx.tracks.filter((t) => t.source === "local").length;
    return { reply: greet(`You have ${localCount} local ${plural(localCount, "track", "tracks")} in your library.`), actions: [] };
  }
  if (/(generate|make|create|cook up)\s+(?:a\s+)?(song|beat|track|music|instrumental|lo-?fi|ambient)\b/.test(lower) || /make me a (song|beat|track)/.test(lower)) {
    const prompt = lower
      .replace(/^(please\s+)?(generate|make|create|cook up)\s+(a\s+|an\s+)?/, "")
      .replace(/\b(song|beat|track|music|for me|please)\b/g, "")
      .trim() || "a chill lo-fi beat, 90 BPM, warm keys";
    const dur = /(\d{1,2})\s*(?:seconds?|secs?)/.exec(lower);
    actions.push({ type: "generate_music", prompt, durationSec: dur ? parseInt(dur[1], 10) : 20 });
    return { reply: greet("Cooking up a fresh beat with ElevenLabs — give it a few seconds."), actions };
  }
  if (/(say|read|speak|speak out|voice)\s+(?:this|the following|out)?[:\s]/.test(lower) && lower.length > 12) {
    const text = lower.replace(/^(please\s+)?(say|read|speak|speak out|voice)\s+(?:this|the following|out)?[:\s]*/, "").trim();
    if (text) { actions.push({ type: "text_to_speech", text }); return { reply: greet("Reading that out loud."), actions }; }
  }
  if (/how many playlists/.test(lower)) {
    return { reply: greet(`You have ${ctx.playlists.length} ${plural(ctx.playlists.length, "playlist", "playlists")}.`), actions: [] };
  }

  /* ── last-chance fuzzy: "play <artist> songs" or "play <anything>" ── */
  if (/\bplay\b/.test(lower) && ctx.tracks.length > 0) {
    const m = lower.match(/\bplay\s+(.+)$/);
    if (m) {
      const t = findLocalSong(m[1], ctx.tracks);
      if (t) { actions.push({ type: "play_query", query: t.title, scope: "any" }); return { reply: greet(`Playing "${t.title}"`), actions }; }
      // try archive
      actions.push({ type: "play_external_track", title: m[1], artist: "", source: "archive" });
      return { reply: greet(`Streaming "${m[1]}" from the Internet Archive`), actions };
    }
  }

  /* ── catch-all ── */
  if (ctx.tracks.length === 0) {
    return { reply: greet("Your library is empty. Scan a folder or upload songs from Settings ▸ Library first, and I can start playing them for you."), actions: [{ type: "open_screen", screen: "settings" }] };
  }
  return { reply: greet("I can play a specific song, tune a radio station, manage playlists, change the theme & EQ, set a sleep timer, and more. Try \"play Midnight Confessions\" or \"theme Sunset Coral\"."), actions: [] };
}

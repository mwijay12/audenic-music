import { useCallback } from "react";
import { usePlayer, THEMES } from "./PlayerContext";
import { EQ_PRESETS } from "./audioEngine";
import { TAGS, fetchStations, resolveArchiveStream, type Station, type ArchiveItem } from "./api";
import type { AIAction } from "./aiProviders";

export type AINavTarget = "home" | "library" | "courses" | "explore" | "radio" | "reels" | "settings" | "profile" | "analytics" | "player" | "simple_mode";

export type ActionOutcome = { ok: boolean; note: string };

const THEME_LOOKUP = THEMES.map((t) => t.name.toLowerCase());

/** Multi-pass fuzzy search across local + online libraries and playlists. */
export function findLocalTrack(query: string, tracks: ReturnType<typeof usePlayer>["tracks"]) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const tokens = q.split(/\s+/).filter(Boolean);
  const score = (s: string) => {
    const t = s.toLowerCase();
    if (t === q) return 1000;
    if (t.includes(q)) return 500;
    let m = 0;
    for (const tok of tokens) if (t.includes(tok)) m += 80;
    return m;
  };
  const ranked = tracks
    .map((t) => ({ t, s: Math.max(score(t.title), score(t.artist) * 0.9, score(t.title + " " + t.artist) * 0.8) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return ranked[0]?.t ?? null;
}

export function findPlaylistByName(name: string, playlists: ReturnType<typeof usePlayer>["playlists"]) {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  const exact = playlists.find((p) => p.name.toLowerCase() === q);
  if (exact) return exact;
  const partial = playlists
    .map((p) => ({ p, s: p.name.toLowerCase().includes(q) ? 1 : q.includes(p.name.toLowerCase()) ? 0.5 : 0 }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)[0];
  return partial?.p ?? null;
}

export function findTheme(name: string) {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  const exact = THEMES.find((t) => t.name.toLowerCase() === q);
  if (exact) return exact;
  return THEMES.find((t) => t.name.toLowerCase().includes(q) || q.includes(t.name.toLowerCase())) ?? null;
}

export function findRadioStation(name: string, stations: Station[]) {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  const exact = stations.find((s) => s.name.toLowerCase() === q);
  if (exact) return exact;
  return stations
    .map((s) => ({ s, score: s.name.toLowerCase().includes(q) ? 1 : q.split(/\s+/).some((w) => s.name.toLowerCase().includes(w)) ? 0.5 : 0 }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.s ?? null;
}

export function findRadioGenre(name: string) {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  return TAGS.find((t) => t.label.toLowerCase() === q || t.id === q || t.label.toLowerCase().includes(q)) ?? null;
}

export function findArchiveItem(name: string, items: ArchiveItem[]) {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  const exact = items.find((i) => i.title.toLowerCase() === q);
  if (exact) return exact;
  return items
    .map((i) => ({ i, score: i.title.toLowerCase().includes(q) ? 1 : q.split(/\s+/).some((w) => i.title.toLowerCase().includes(w)) ? 0.5 : 0 }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.i ?? null;
}

/** Parse "11:30 pm" / "23:30" / "18:00" into the next future ISO timestamp. */
export function parseStopAt(text: string): string | null {
  const m = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 24;
  const min = parseInt(m[2], 10) % 60;
  const ampm = m[3]?.toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (!ampm && h === 24) h = 0;
  const now = new Date();
  const target = new Date(now);
  target.setHours(h, min, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.toISOString();
}

export function useAIActions(
  navigate: (target: AINavTarget) => void,
  onPlayExternal?: (track: {
    id: string; title: string; artist: string; cover: string; src: string; source: "online";
    songs: number; tags: string[]; lyrics?: string[];
  }) => void
) {
  const {
    tracks, playTrack, toggle, next, prev, seek, seekBy,
    setVolume, setShuffle, setRepeat, toggleLike, liked, current,
    setTheme, setSpeed, setEqualizer, setReverb, setBassBoost,
    createPlaylist, addToPlaylist, playlists,
    setSleepTimer, setGesturesOn, setHapticsOn, setStopAt,
    addAiMessage, radioTab, setRadioTab,
    analytics, setQueue, addToQueue, resetQueue,
  } = usePlayer();

  const run = useCallback(
    async (action: AIAction): Promise<ActionOutcome> => {
      try {
        switch (action.type) {
          case "play_query": {
            const q = action.query.trim();
            if (!q) return { ok: false, note: "Empty search query" };
            const isRadioQuery = /\b(radio|fm|station|broadcast)\b/i.test(q);
            const forceOnline = action.scope === "online" || isRadioQuery;

            if (isRadioQuery) {
              const cleanStationName = q.replace(/\b(play|radio|fm|station|online|stream)\b/gi, "").trim();
              const tag = findRadioGenre(radioTab) ?? TAGS[0];
              const stations = await fetchStations(tag.id);
              const s = findRadioStation(cleanStationName || q, stations);
              if (s) {
                onPlayExternal?.({
                  id: s.stationuuid, title: s.name, artist: s.country || "Live radio",
                  cover: s.favicon?.startsWith("http") ? s.favicon : "",
                  src: s.url_resolved, source: "online", songs: 1, tags: ["radio"],
                  lyrics: ["🔴 Live broadcast", s.name, s.tags ? s.tags.split(",").slice(0, 3).join(" • ") : "streaming now"],
                });
                navigate("player");
                return { ok: true, note: `Tuning into online radio "${s.name}"` };
              }
            }

            if (forceOnline) {
              try {
                const { searchArchive } = await import("./api");
                const items = await searchArchive(q);
                if (items.length) {
                  onPlayExternal?.(await resolveArchiveItemToTrack(items[0]));
                  navigate("player");
                  return { ok: true, note: `Streaming "${items[0].title}" from Internet Archive` };
                }
              } catch { /* ignore */ }
              return { ok: false, note: `No online audio or radio found matching "${q}"` };
            }

            // Local first for general queries
            const local = findLocalTrack(q, tracks);
            if (local) { playTrack(local.id); navigate("player"); return { ok: true, note: `Playing "${local.title}" by ${local.artist}` }; }

            // Fall back to Internet Archive search
            try {
              const { searchArchive } = await import("./api");
              const items = await searchArchive(q);
              if (items.length) {
                onPlayExternal?.(await resolveArchiveItemToTrack(items[0]));
                navigate("player");
                return { ok: true, note: `Streaming "${items[0].title}" from Internet Archive` };
              }
            } catch { /* ignore */ }
            return { ok: false, note: `No track found for "${q}"` };
          }
          case "play_artist": {
            const matches = tracks.filter((t) => t.artist.toLowerCase().includes(action.artist.toLowerCase()));
            if (matches.length) { playTrack(matches[0].id); navigate("player"); return { ok: true, note: `Playing ${matches[0].artist} — ${matches[0].title}` }; }
            // No local: stream first archive hit
            try {
              const { searchArchive } = await import("./api");
              const items = await searchArchive(action.artist);
              if (items.length) { onPlayExternal?.(await resolveArchiveItemToTrack(items[0])); navigate("player"); return { ok: true, note: `Streaming ${action.artist} from the Internet Archive` }; }
            } catch { /* ignore */ }
            return { ok: false, note: `No matches for artist "${action.artist}"` };
          }
          case "play_radio_station": {
            const tag = findRadioGenre(radioTab) ?? TAGS[0];
            const stations = await fetchStations(tag.id);
            const s = findRadioStation(action.name, stations);
            if (!s) return { ok: false, note: `No radio station matching "${action.name}"` };
            onPlayExternal?.({
              id: s.stationuuid, title: s.name, artist: s.country || "Live radio",
              cover: s.favicon?.startsWith("http") ? s.favicon : "",
              src: s.url_resolved, source: "online", songs: 1, tags: ["radio"],
              lyrics: ["🔴 Live broadcast", s.name, s.tags ? s.tags.split(",").slice(0, 3).join(" • ") : "streaming now"],
            });
            navigate("player");
            return { ok: true, note: `Tuning into ${s.name} (${s.country})` };
          }
          case "play_genre": {
            const tag = findRadioGenre(action.genre) ?? TAGS.find((t) => t.label.toLowerCase().includes(action.genre.toLowerCase()));
            if (!tag) return { ok: false, note: `Unknown radio genre "${action.genre}"` };
            setRadioTab(tag.id);
            const stations = await fetchStations(tag.id);
            if (stations[0]) {
              onPlayExternal?.({
                id: stations[0].stationuuid, title: stations[0].name, artist: stations[0].country || tag.label,
                cover: "", src: stations[0].url_resolved, source: "online", songs: 1, tags: ["radio"],
                lyrics: ["🔴 Live broadcast", stations[0].name],
              });
            }
            navigate("explore");
            return { ok: true, note: `Tuned to ${tag.label} radio` };
          }
          case "play_playlist": {
            const pl = findPlaylistByName(action.name, playlists);
            if (!pl) return { ok: false, note: `No playlist called "${action.name}"` };
            if (!pl.trackIds.length) return { ok: false, note: `"${pl.name}" is empty` };
            playTrack(pl.trackIds[0]);
            navigate("player");
            return { ok: true, note: `Playing playlist "${pl.name}"` };
          }
          case "play_external_track": {
            const q = action.title;
            if (action.source === "radio") {
              const tag = TAGS[0];
              const stations = await fetchStations(tag.id);
              const s = findRadioStation(q, stations);
              if (s) {
                onPlayExternal?.({ id: s.stationuuid, title: s.name, artist: s.country || "Live radio", cover: "", src: s.url_resolved, source: "online", songs: 1, tags: ["radio"] });
                navigate("player");
                return { ok: true, note: `Streaming radio ${s.name}` };
              }
            }
            // Default to internet archive
            const { searchArchive } = await import("./api");
            const items = await searchArchive(action.artist ? `${action.artist} ${q}` : q);
            if (!items.length) return { ok: false, note: `No online match for "${q}"` };
            onPlayExternal?.(await resolveArchiveItemToTrack(items[0]));
            navigate("player");
            return { ok: true, note: `Streaming "${items[0].title}"` };
          }
          case "toggle_play":
            toggle();
            return { ok: true, note: "Toggled playback" };
          case "next": next(); return { ok: true, note: "Next track" };
          case "prev": prev(); return { ok: true, note: "Previous track" };
          case "seek_to_seconds":
            if (!current) return { ok: false, note: "Nothing is playing" };
            seek(Math.max(0, action.seconds));
            return { ok: true, note: `Skipped to ${action.seconds}s` };
          case "seek_by_seconds":
            if (!current) return { ok: false, note: "Nothing is playing" };
            seekBy(action.delta);
            return { ok: true, note: `${action.delta > 0 ? "Forward" : "Back"} ${Math.abs(action.delta)}s` };
          case "set_volume":
            setVolume(Math.max(0, Math.min(100, action.value)) / 100);
            return { ok: true, note: `Volume → ${Math.round(action.value)}%` };
          case "set_shuffle": setShuffle(action.value); return { ok: true, note: `Shuffle ${action.value ? "on" : "off"}` };
          case "set_repeat": setRepeat(action.value); return { ok: true, note: `Repeat ${action.value ? "on" : "off"}` };
          case "like_current":
            if (current && !liked.includes(current.id)) toggleLike(current.id);
            return { ok: true, note: "Liked current song" };
          case "unlike_current":
            if (current && liked.includes(current.id)) toggleLike(current.id);
            return { ok: true, note: "Unliked current song" };
          case "set_theme": {
            const t = findTheme(action.name);
            if (!t) return { ok: false, note: `Unknown theme "${action.name}". Try ${THEME_LOOKUP.join(", ")}.` };
            setTheme(t);
            return { ok: true, note: `Theme → ${t.name}` };
          }
          case "set_speed": setSpeed(Math.max(0.5, Math.min(2, action.value))); return { ok: true, note: `Speed → ${action.value}×` };
          case "set_eq_preset": {
            const p = EQ_PRESETS.find((x) => x.name.toLowerCase() === action.name.trim().toLowerCase());
            if (!p) return { ok: false, note: `Unknown EQ preset "${action.name}"` };
            setEqualizer(p.eq);
            return { ok: true, note: `EQ → ${p.name}` };
          }
          case "set_reverb": setReverb(Math.max(0, Math.min(100, action.value))); return { ok: true, note: `Reverb → ${action.value}%` };
          case "set_bass_boost": setBassBoost(Math.max(0, Math.min(100, action.value))); return { ok: true, note: `Bass → ${action.value}%` };
          case "create_playlist":
            createPlaylist(action.name.trim());
            return { ok: true, note: `Created playlist "${action.name}"` };
          case "add_current_to_playlist": {
            if (!current) return { ok: false, note: "Nothing is playing" };
            const pl = findPlaylistByName(action.name, playlists);
            if (!pl) return { ok: false, note: `No playlist called "${action.name}"` };
            addToPlaylist(pl.id, current.id);
            return { ok: true, note: `Added to "${pl.name}"` };
          }
          case "set_sleep_timer":
            setSleepTimer(action.minutes);
            return { ok: true, note: action.minutes ? `Sleep timer → ${action.minutes}m` : "Sleep timer cancelled" };
          case "stop_at": {
            const iso = parseStopAt(action.isoTime);
            if (!iso) return { ok: false, note: "Couldn't understand that time" };
            setStopAt(new Date(iso).getTime());
            const when = new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            return { ok: true, note: `Will stop playing at ${when}` };
          }
          case "clear_stop_at":
            setStopAt(null);
            return { ok: true, note: "Time-based stop cleared" };
          case "open_screen": {
            const valid: AINavTarget[] = ["home", "library", "courses", "explore", "radio", "reels", "settings", "profile", "analytics", "player", "simple_mode"];
            const target = valid.includes(action.screen as AINavTarget) ? (action.screen as AINavTarget) : null;
            if (!target) return { ok: false, note: `Unknown screen "${action.screen}"` };
            if (target === "simple_mode") {
              setDriveMode(true);
              return { ok: true, note: "Launched Simple Mode" };
            }
            if (target === "radio") {
              navigate("explore");
              return { ok: true, note: "Opened Radio mode" };
            }
            navigate(target);
            return { ok: true, note: `Opened ${target}` };
          }
          case "toggle_gestures": setGesturesOn(action.value); return { ok: true, note: `Gestures ${action.value ? "on" : "off"}` };
          case "toggle_haptics": setHapticsOn(action.value); return { ok: true, note: `Haptics ${action.value ? "on" : "off"}` };
          case "show_recently_played":
            navigate("library");
            return { ok: true, note: "Opened Recently Played in your library" };
          case "search_artist":
            addAiMessage({ id: `s-${Date.now()}`, role: "assistant", content: `Searching for ${action.artist}…`, ts: Date.now() });
            try {
              const { searchArchive } = await import("./api");
              const items = await searchArchive(action.artist);
              if (items.length) {
                onPlayExternal?.(await resolveArchiveItemToTrack(items[0]));
                navigate("player");
                return { ok: true, note: `Playing first match for ${action.artist}` };
              }
            } catch { /* ignore */ }
            return { ok: false, note: `No matches for ${action.artist}` };
          case "generate_music": {
            const { generateMusic, sfxReady } = await import("./elevenLabs");
            if (!sfxReady()) return { ok: false, note: "Music generation keys aren't configured yet — add VITE_ELEVENLABS_SFX_KEYS to your .env." };
            addAiMessage({ id: `s-${Date.now()}`, role: "assistant", content: "Generating your track…", ts: Date.now() });
            const res = await generateMusic(action.prompt, action.durationSec ?? 20);
            if (res.ok && res.url) {
              onPlayExternal?.({ id: `gen-${Date.now()}`, title: `Audenic Beat — ${action.prompt.slice(0, 24)}`, artist: "ElevenLabs", cover: "", src: res.url, songs: 1, source: "online", tags: ["generated"] });
              navigate("player");
              return { ok: true, note: "Generated beat is playing." };
            }
            return { ok: false, note: res.message };
          }
          case "text_to_speech": {
            const { generateSpeech, ttsReady } = await import("./elevenLabs");
            if (!ttsReady()) return { ok: false, note: "Speech keys aren't configured yet — add VITE_ELEVENLABS_TTS_KEYS to your .env." };
            const res = await generateSpeech(action.text);
            if (res.ok && res.url) {
              onPlayExternal?.({ id: `tts-${Date.now()}`, title: "Spoken by Audenic", artist: "ElevenLabs Voice", cover: "", src: res.url, songs: 1, source: "online", tags: ["speech"] });
              return { ok: true, note: "Speaking." };
            }
            return { ok: false, note: res.message };
          }
          case "play_video": {
            const vidsRaw = localStorage.getItem("audenic_desktop_videos");
            let foundTitle: string | null = null;
            if (vidsRaw) {
              try {
                const vids = JSON.parse(vidsRaw);
                if (Array.isArray(vids) && vids.length > 0) {
                  const targetQuery = (action.title || "").toLowerCase().trim();
                  const match = targetQuery ? vids.find((v: any) => v.title.toLowerCase().includes(targetQuery)) : vids[0];
                  if (match) {
                    foundTitle = match.title;
                    localStorage.setItem("audenic_active_video_id", match.id);
                  }
                }
              } catch {}
            }
            navigate("courses");
            return { ok: true, note: foundTitle ? `Playing video "${foundTitle}" in Course Studio` : "Opened Course & Video Studio" };
          }
          case "play_recent_video": {
            navigate("courses");
            return { ok: true, note: "Opening Course & Video Studio" };
          }
          case "fill_queue": {
            const artists = (action.artists || []).map((a) => a.trim().toLowerCase()).filter(Boolean);
            const queries = (action.queries || []).map((q) => q.trim().toLowerCase()).filter(Boolean);
            const explicitIds = action.trackIds || [];

            const matchedTracks: typeof tracks = [];
            if (explicitIds.length) {
              for (const id of explicitIds) {
                const tr = tracks.find((t) => t.id === id);
                if (tr && !matchedTracks.some((m) => m.id === tr.id)) matchedTracks.push(tr);
              }
            }
            if (artists.length) {
              for (const a of artists) {
                const found = tracks.filter(
                  (t) => t.artist.toLowerCase().includes(a) || t.title.toLowerCase().includes(a)
                );
                for (const tr of found) {
                  if (!matchedTracks.some((m) => m.id === tr.id)) matchedTracks.push(tr);
                }
              }
            }
            if (queries.length) {
              for (const q of queries) {
                const found = tracks.filter(
                  (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
                );
                for (const tr of found) {
                  if (!matchedTracks.some((m) => m.id === tr.id)) matchedTracks.push(tr);
                }
              }
            }

            if (matchedTracks.length > 0) {
              const matchedIds = matchedTracks.map((t) => t.id);
              setQueue(matchedIds);
              return { ok: true, note: `Queue loaded with ${matchedIds.length} tracks` };
            }
            return { ok: false, note: "Couldn't find matching songs in library to fill queue" };
          }
          case "add_to_queue": {
            if (action.trackIds?.length) {
              addToQueue(action.trackIds);
              return { ok: true, note: `Added ${action.trackIds.length} tracks to queue` };
            }
            if (action.artist) {
              const matches = tracks.filter((t) => t.artist.toLowerCase().includes(action.artist!.toLowerCase()));
              if (matches.length) {
                addToQueue(matches.map((m) => m.id));
                return { ok: true, note: `Added ${matches.length} songs by ${action.artist} to queue` };
              }
            }
            if (action.query) {
              const tr = findLocalTrack(action.query, tracks);
              if (tr) {
                addToQueue(tr.id);
                return { ok: true, note: `Added "${tr.title}" to queue` };
              }
            }
            return { ok: false, note: "No matching tracks found to add to queue" };
          }
          case "clear_queue": {
            setQueue([]);
            return { ok: true, note: "Cleared queue" };
          }
          default:
            return { ok: false, note: "Unrecognised action" };
        }
      } catch (e) {
        return { ok: false, note: "Couldn't complete that action" };
      }
    },
    [
      tracks, playTrack, toggle, next, prev, seek, seekBy, setVolume, setShuffle, setRepeat, toggleLike, liked, current,
      setTheme, setSpeed, setEqualizer, setReverb, setBassBoost, createPlaylist, addToPlaylist, playlists, setSleepTimer,
      setGesturesOn, setHapticsOn, setStopAt, navigate, onPlayExternal, radioTab, setRadioTab, addAiMessage, analytics,
      setQueue, addToQueue, resetQueue,
    ]
  );

  return { run };
}

export async function resolveArchiveItemToTrack(it: ArchiveItem) {
  const src = await resolveArchiveStream(it.identifier);
  return {
    id: it.identifier, title: it.title, artist: it.creator,
    cover: it.cover, src: src || "", songs: 1, source: "online" as const, tags: ["archive"],
    lyrics: ["🌐 Internet Archive", it.title, `by ${it.creator}`],
  };
}

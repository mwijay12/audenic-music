import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { ONLINE_TRACKS, type Track, type Playlist } from "../data/tracks";
import { engine } from "./audioEngine";
import { scanNativeMedia, nativeDelete, isNative, loadQueueNative, nativePlayback, setNativeEqualizer, setNativeReverb, nativeUpdatePosition } from "./nativeBridge";
import { isDesktop, pickFolder, scanDirectory, toAssetUrl } from "./tauriBridge";
import { readTags, attachLrc, findLrcFor, type EmbeddedTags } from "./tagReader";
import { useMediaSession } from "./useMediaSession";
import { getSafeAudioSrc } from "./useMediaScanner";
import { auth, onAuthStateChanged, syncUserToFirestore, saveSongToFirestore, fetchPublishedSongs, checkIsAdmin, OWNER_ADMIN_EMAIL } from "./firebase";

/* ───── Types ───── */
export type VideoItem = { id: string; title: string; src: string; cover: string; size: number; kind?: "reel" | "video" };
export type ReelCategory = { id: string; name: string; createdAt: number };
export type ReelPlaylist = { id: string; name: string; createdAt: number; videoIds: string[] };
export type Theme = { name: string; accent: string; accentSoft: string; gradientA: string; gradientB: string; gradientC: string };
export type Profile = { name: string; email: string; bio: string; avatar: string };
export type Analytics = { totalListens: number; totalMinutes: number; topTracks: { id: string; count: number }[]; byDay: { label: string; minutes: number }[]; streak: number };
export type Recording = { id: string; url: string; name: string; date: number; seconds: number };

type Ctx = {
  tracks: Track[]; localTracks: Track[]; current: Track | null;
  isPlaying: boolean; progress: number; duration: number;
  shuffle: boolean; repeat: boolean; liked: string[];
  loadingSrc: boolean; error: string | null;
  volume: number; crossfade: boolean; fadeMs: number;
  speed: number; setSpeed: (v: number) => void;
  holdSpeed: number | null; setHoldSpeed: (v: number | null) => void;
  scanning: boolean;
  recentlyPlayed: string[]; playCounts: Record<string, number>; addedAt: Record<string, number>;
  playTrack: (id: string, startTime?: number) => void; playExternal: (t: Track) => void;
  toggle: () => void; next: () => void; prev: () => void;
  seek: (t: number) => void; seekBy: (d: number) => void;
  setShuffle: (v: boolean) => void; setRepeat: (v: boolean) => void;
  toggleLike: (id: string) => void;
  addLocalFiles: (files: FileList | null) => void; clearLocal: () => void;
  scanNativeLibrary: () => Promise<number>;
  scanNativeVideos: () => Promise<number>;
  scanDesktopLibrary: () => Promise<number>;
  updateLocalTrack: (id: string, patch: Partial<Pick<Track, "title" | "artist" | "cover">>) => void;
  addLocalTrack: (track: Track) => void;
  deleteLocalTrack: (id: string) => void;
  setAsRingtone: (id: string) => Promise<{ ok: boolean; message: string }>;
  blacklistedIds: string[]; toggleBlacklist: (id: string) => void;
  localVideos: VideoItem[]; addLocalVideos: (files: FileList | null) => void; addDesktopVideos: (videos: VideoItem[]) => void; clearVideos: () => void;
  // reels: categories / playlists / tags / study flags
  reelCategories: ReelCategory[];
  createReelCategory: (name: string) => void;
  renameReelCategory: (id: string, name: string) => void;
  deleteReelCategory: (id: string) => void;
  setReelCategoryAssignment: (videoId: string, catId: string | null) => void;
  getReelCategoryId: (videoId: string) => string | null;
  reelPlaylists: ReelPlaylist[];
  createReelPlaylist: (name: string) => void;
  renameReelPlaylist: (id: string, name: string) => void;
  deleteReelPlaylist: (id: string) => void;
  addToReelPlaylist: (plId: string, videoId: string) => void;
  removeFromReelPlaylist: (plId: string, videoId: string) => void;
  toggleReelTag: (videoId: string, tag: string) => void;
  getReelTags: (videoId: string) => string[];
  toggleStudyReel: (videoId: string) => void;
  isStudyReel: (videoId: string) => boolean;
  setVolume: (v: number) => void; setCrossfade: (v: boolean) => void; setFadeMs: (v: number) => void;
  replayGain: boolean; setReplayGain: (v: boolean) => void;
  smartQueue: boolean; setSmartQueue: (v: boolean) => void;
  theme: Theme; setTheme: (t: Partial<Theme>) => void;
  equalizer: number[]; setEqualizer: (eq: number[]) => void;
  analytics: Analytics; resetAnalytics: () => void;
  radioTab: string; setRadioTab: (t: string) => void;
  profile: Profile; setProfile: (p: Partial<Profile>) => void;
  loggedIn: boolean; login: (p: Partial<Profile>) => void; logout: () => void;
  geminiKey: string; setGeminiKey: (k: string) => void;
  translateLang: string; setTranslateLang: (l: string) => void;
  playlists: Playlist[]; createPlaylist: (name: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (plId: string, trackId: string) => void;
  removeFromPlaylist: (plId: string, trackId: string) => void;
  driveMode: boolean; setDriveMode: (v: boolean) => void;
  sleepTimer: number | null; setSleepTimer: (mins: number | null) => void;
  sleepRemaining: number;
  showLyrics: boolean; setShowLyrics: (v: boolean) => void;
  reverb: number; setReverb: (v: number) => void;
  bassBoost: number; setBassBoost: (v: number) => void;
  isRecording: boolean; recordSeconds: number; recordings: Recording[];
  startRecording: () => void; stopRecording: () => void; deleteRecording: (id: string) => void;
  // Reels / gestures
  reelLoops: number; setReelLoops: (n: number) => void;
  reelAutoScroll: boolean; setReelAutoScroll: (v: boolean) => void;
  gesturesOn: boolean; setGesturesOn: (v: boolean) => void;
  hapticsOn: boolean; setHapticsOn: (v: boolean) => void;
  notifyOn: boolean; setNotifyOn: (v: boolean) => void;
  spectrum: () => number[];
  buzz: (ms?: number) => void;
  // AI assistant
  aiGroqKey: string; setAiGroqKey: (v: string) => void;
  aiGroqModel: string; setAiGroqModel: (v: string) => void;
  aiOrKey: string; setAiOrKey: (v: string) => void;
  aiOrModel: string; setAiOrModel: (v: string) => void;
  aiOllamaKey: string; setAiOllamaKey: (v: string) => void;
  aiOllamaModel: string; setAiOllamaModel: (v: string) => void;
  aiHfKey: string; setAiHfKey: (v: string) => void;
  aiHfModel: string; setAiHfModel: (v: string) => void;
  // admin
  adminTracks: Track[];
  addAdminTrack: (t: { title: string; artist: string; cover: string; src: string; tags?: string[] }) => void;
  removeAdminTrack: (id: string) => void;
  adminVideos: VideoItem[];
  addAdminReel: (r: { title: string; src: string }) => void;
  removeAdminReel: (id: string) => void;
  isAdmin: boolean;
  aiOfflineOnly: boolean; setAiOfflineOnly: (v: boolean) => void;
  aiMessages: AIMessage[]; addAiMessage: (m: AIMessage) => void; clearAiMessages: () => void;
  // time-based stop (AI/sleep variants)
  stopAt: number | null; setStopAt: (t: number | null) => void;
  stopAtRemaining: number;
  // chrome / UI
  floatingAi: boolean; setFloatingAi: (v: boolean) => void;
  // visualizer customization
  vizStyle: VizStyle; setVizStyle: (v: VizStyle) => void;
  artShape: ArtShape; setArtShape: (v: ArtShape) => void;
  // saved radio stations + moods
  savedStations: SavedStation[];
  toggleSavedStation: (s: SavedStation) => void;
  likedOnline: LikedOnline[];
  toggleLikedOnline: (t: LikedOnline) => void;
  isOnlineLiked: (id: string) => boolean;
  isStationSaved: (id: string) => boolean;
  setStationMood: (id: string, mood: string) => void;
  // queue management + custom lyrics
  queueIds: string[];
  setQueue: (ids: string[]) => void;
  addToQueue: (ids: string | string[]) => void;
  playNext: (ids: string | string[]) => void;
  deleteTracks: (ids: string[]) => void;
  moveInQueue: (from: number, to: number) => void;
  removeFromQueue: (id: string) => void;
  resetQueue: () => void;
  customLyrics: Record<string, string[]>;
  setTrackLyrics: (id: string, lines: string[] | null) => void;
  getAudioElement: () => HTMLAudioElement | null;

  // achievements
  achievements: Achievement[];
  unlockedIds: string[];
  achievementToast: Achievement | null;
  dismissAchievementToast: () => void;
  progressFor: (id: string) => number;
};

export type Achievement = {
  id: string; name: string; emoji: string; desc: string;
  goal: number; unit: string; category: "listen" | "library" | "social" | "explore" | "custom";
};

// Admin account — signing in with this email or owner email unlocks the Admin studio
export const ADMIN_EMAIL = OWNER_ADMIN_EMAIL;
export const isAdminEmail = (email: string) => checkIsAdmin(email);

export const REEL_TAGS = [
  "study", "motivation", "funny", "prayer", "tech", "ai", "coding", "tutorial",
  "holy", "gospel", "worship", "sermon", "workout", "cooking", "travel", "asmr",
] as const;

export type VizStyle = "bars" | "ring" | "wave" | "orbit" | "pulse" | "off";
export type ArtShape = "circle" | "squircle" | "square";
export type LikedOnline = { id: string; title: string; artist: string; cover: string; src: string };

export type SavedStation = {
  id: string; name: string; url: string; cover: string;
  country?: string; tags?: string; mood?: string;
};

export const MOODS = [
  { id: "happy", label: "Happy", emoji: "😄", color: "#FFD24C" },
  { id: "chill", label: "Chill", emoji: "🌙", color: "#5EE7CF" },
  { id: "hype", label: "Hype", emoji: "🔥", color: "#FF7A5C" },
  { id: "focus", label: "Focus", emoji: "🎯", color: "#7FB8FF" },
  { id: "sad", label: "Moody", emoji: "🌧", color: "#B17BFF" },
  { id: "news", label: "News", emoji: "📰", color: "#C8F249" },
];

export type AIMessage = { id: string; role: "user" | "assistant"; content: string; provider?: string; ts: number };

export const THEMES: Theme[] = [
  { name: "Aurora Lime", accent: "#C8F249", accentSoft: "#7A8A1F", gradientA: "#8B3BFF", gradientB: "#FF61C7", gradientC: "#3B6BFF" },
  { name: "Sunset Coral", accent: "#FF7A5C", accentSoft: "#7A2E1F", gradientA: "#FF5DA2", gradientB: "#FFB88C", gradientC: "#DE6262" },
  { name: "Ocean Mint", accent: "#5EE7CF", accentSoft: "#1F7A6E", gradientA: "#3B6BFF", gradientB: "#5EE7CF", gradientC: "#7FB8FF" },
  { name: "Royal Violet", accent: "#B17BFF", accentSoft: "#3B1F7A", gradientA: "#6C3CE9", gradientB: "#E4A2FF", gradientC: "#7B3BFF" },
  { name: "Solar Gold", accent: "#FFD24C", accentSoft: "#7A5A1F", gradientA: "#FF8C42", gradientB: "#FFD24C", gradientC: "#FF5DA2" },
  { name: "Neon Pink", accent: "#FF5DCF", accentSoft: "#7A1F58", gradientA: "#FF5DCF", gradientB: "#7B3BFF", gradientC: "#3B6BFF" },
];

const GRADIENTS = [
  "linear-gradient(135deg,#C8F249,#4CA37B)", "linear-gradient(135deg,#E4A2FF,#6C3CE9)",
  "linear-gradient(135deg,#FFB88C,#DE6262)", "linear-gradient(135deg,#7FB8FF,#3B4CCA)",
  "linear-gradient(135deg,#FFD24C,#FF8C42)", "linear-gradient(135deg,#5EE7CF,#3B6BFF)",
];

/** Deterministic gradient avatar with the user's initials — never a broken image. */
export function svgAvatar(name: string, accent = "#C8F249") {
  const clean = (name || "").trim();
  const initials = clean
    ? clean.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
    : "🎧";
  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  const g = GRADIENTS[hash % GRADIENTS.length];
  const cs = g.match(/#[0-9A-Fa-f]{6}/g) || [accent, "#4CA37B"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cs[0]}"/><stop offset="1" stop-color="${cs[1]}"/></linearGradient></defs><rect width="240" height="240" fill="url(#a)"/><text x="120" y="152" font-family="Inter,Arial,sans-serif" font-size="${initials.length > 1 ? 88 : 104}" font-weight="700" fill="rgba(0,0,0,.55)" text-anchor="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function svgCover(title: string, i: number, accent = "#C8F249") {
  const clean = (title || "Song").trim();
  let hash = 0;
  for (let k = 0; k < clean.length; k++) hash = (hash * 31 + clean.charCodeAt(k)) >>> 0;
  const g = GRADIENTS[(hash + i) % GRADIENTS.length];
  const cs = g.match(/#[0-9A-Fa-f]{6}/g) || [accent, "#4CA37B"];
  const letter = (clean[0] || "♪").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${cs[0]}"/><stop offset="100%" stop-color="${cs[1]}"/></linearGradient></defs><rect width="300" height="300" rx="36" fill="url(#bg)"/><circle cx="150" cy="150" r="110" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/><circle cx="150" cy="150" r="80" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/><circle cx="150" cy="150" r="50" fill="rgba(0,0,0,0.35)"/><text x="150" y="180" font-family="Inter, system-ui, sans-serif" font-size="92" font-weight="800" fill="#FFFFFF" text-anchor="middle" opacity="0.95">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function extractCoverAccent(coverUrl?: string, fallback = "#C8F249"): string {
  if (!coverUrl) return fallback;
  let hash = 0;
  for (let i = 0; i < coverUrl.length; i++) {
    hash = (hash * 31 + coverUrl.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 85%, 60%)`;
}

function parseName(name: string) {
  const c = name.replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
  const p = c.split(/\s+-\s+/);
  if (p.length >= 2) return { artist: p[0].trim(), title: p.slice(1).join(" - ").trim() };
  return { artist: "Unknown Artist", title: c.trim() };
}

const SK = {
  liked: "au.liked", theme: "au.theme", eq: "au.eq", cf: "au.cf", fade: "au.fade",
  radio: "au.radio", anl: "au.anl", prof: "au.prof", auth: "au.auth",
  gk: "au.gk", tl: "au.tl", pl: "au.pl", dm: "au.dm", sl: "au.sl",
  sp: "au.sp", rv: "au.rv", bb: "au.bb", rp: "au.rp", pc: "au.pc", aa: "au.aa",
  adm: "au.adminTracks",
  rlp: "au.rlp", ras: "au.ras", gst: "au.gst", hap: "au.hap", ntf: "au.ntf", vol: "au.vol",
  aigk: "au.ai.groqKey", aigm: "au.ai.groqModel", aiok: "au.ai.orKey", aiom: "au.ai.orModel",
  aiuk: "au.ai.ollamaKey", aium: "au.ai.ollamaModel", aioff: "au.ai.offlineOnly", aimsg: "au.ai.messages",
  floatAi: "au.floatingAi", viz: "au.vizStyle", art: "au.artShape", stations: "au.savedStations",
  likedOnline: "au.likedOnline",
  ach: "au.achievements",
  rCats: "au.reels.categories", rcAssign: "au.reels.catAssign", rPlaylists: "au.reels.playlists", rTags: "au.reels.tags", rStudy: "au.reels.study",
  replayGain: "au.replayGain", smartQueue: "au.smartQueue",
  queue: "au.queueIds", lyrics: "au.customLyrics", local: "au.localTracks",
};

export const DEFAULT_REEL_CATEGORIES: Omit<ReelCategory, "createdAt">[] = [
  { id: "study", name: "Study Mode" },
  { id: "faith", name: "Faith & Worship" },
  { id: "tech", name: "Tech & Coding" },
  { id: "ai", name: "AI & Tools" },
  { id: "fitness", name: "Fitness & Health" },
  { id: "music", name: "Music & Covers" },
  { id: "travel", name: "Travel & Places" },
  { id: "science", name: "Science & Space" },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_play", name: "First Beat", emoji: "🎵", desc: "Play your first song", goal: 1, unit: "song", category: "listen" },
  { id: "ten_plays", name: "Warming Up", emoji: "🔥", desc: "Play 10 tracks", goal: 10, unit: "plays", category: "listen" },
  { id: "hundred_plays", name: "Music Lover", emoji: "💯", desc: "Play 100 tracks", goal: 100, unit: "plays", category: "listen" },
  { id: "one_hour", name: "One Hour Deep", emoji: "⏱", desc: "Listen for 60 minutes", goal: 60, unit: "min", category: "listen" },
  { id: "ten_hours", name: "Marathon Ears", emoji: "🎧", desc: "Listen for 10 hours", goal: 600, unit: "min", category: "listen" },
  { id: "first_like", name: "Heart Struck", emoji: "❤️", desc: "Like your first song", goal: 1, unit: "song", category: "library" },
  { id: "ten_likes", name: "Curator", emoji: "💖", desc: "Like 10 songs", goal: 10, unit: "songs", category: "library" },
  { id: "fifty_likes", name: "Super Collector", emoji: "🌟", desc: "Like 50 songs", goal: 50, unit: "songs", category: "library" },
  { id: "first_playlist", name: "Playlist Maker", emoji: "📁", desc: "Create your first playlist", goal: 1, unit: "playlist", category: "library" },
  { id: "five_playlists", name: "DJ Vibes", emoji: "🎚", desc: "Create 5 playlists", goal: 5, unit: "playlists", category: "library" },
  { id: "ten_playlists", name: "Master Archivist", emoji: "📚", desc: "Create 10 playlists", goal: 10, unit: "playlists", category: "library" },
  { id: "first_scan", name: "Local Hero", emoji: "📂", desc: "Scan a song from your device", goal: 1, unit: "song", category: "library" },
  { id: "first_radio", name: "Tuned In", emoji: "📡", desc: "Play a live radio station", goal: 1, unit: "station", category: "explore" },
  { id: "five_radios", name: "Global Listener", emoji: "🌍", desc: "Play 5 radio stations", goal: 5, unit: "stations", category: "explore" },
  { id: "first_saved_station", name: "Frequency Collector", emoji: "🛰", desc: "Save a radio station", goal: 1, unit: "station", category: "explore" },
  { id: "first_archive", name: "Time Traveler", emoji: "🌐", desc: "Stream from the Internet Archive", goal: 1, unit: "track", category: "explore" },
  { id: "first_ai_chat", name: "Say Hi to Audenic", emoji: "🤖", desc: "Send your first message to Audenic AI", goal: 1, unit: "chat", category: "custom" },
  { id: "theme_switcher", name: "Chameleon", emoji: "🎨", desc: "Try 3 different themes", goal: 3, unit: "themes", category: "custom" },
  { id: "night_owl", name: "Night Owl", emoji: "🌙", desc: "Play music between midnight and 4 am", goal: 1, unit: "session", category: "custom" },
  { id: "simple_mode_user", name: "Distraction Free", emoji: "🚘", desc: "Use Simple Mode", goal: 1, unit: "session", category: "custom" },
  { id: "game_master", name: "Song Trivia Master", emoji: "🎯", desc: "Score points in Guess the Song", goal: 5, unit: "points", category: "custom" },
  { id: "streak_3", name: "3-Day Streak", emoji: "🔥", desc: "Listen 3 days in a row", goal: 3, unit: "days", category: "listen" },
  { id: "streak_7", name: "Week Warrior", emoji: "🏆", desc: "Listen 7 days in a row", goal: 7, unit: "days", category: "listen" },
  { id: "streak_14", name: "Fortnight Legend", emoji: "⚡", desc: "Listen 14 days in a row", goal: 14, unit: "days", category: "listen" },
  { id: "reels_master", name: "Reel Explorer", emoji: "🎬", desc: "Watch 5 reels videos", goal: 5, unit: "reels", category: "custom" },
  { id: "transcribe_singer", name: "Sing Along Hero", emoji: "🎤", desc: "Use Live Transcription while playing", goal: 1, unit: "session", category: "custom" },
  { id: "lyric_fan", name: "Lyricist", emoji: "✨", desc: "Open Synced Lyrics view", goal: 1, unit: "lyrics", category: "custom" },
  { id: "eq_tinker", name: "Sound Engineer", emoji: "🎛", desc: "Adjust the 5-band Equalizer", goal: 1, unit: "tweak", category: "custom" },
  { id: "bongo_vibes", name: "East Africa Sounds", emoji: "🌍", desc: "Listen to Swahili / East African tracks", goal: 3, unit: "tracks", category: "listen" },
  { id: "sleep_master", name: "Peaceful Sleep", emoji: "💤", desc: "Use the Sleep Timer", goal: 1, unit: "timer", category: "custom" },
  { id: "light_mode_hero", name: "Daylight Listener", emoji: "☀️", desc: "Switch to a Light Mode theme", goal: 1, unit: "theme", category: "custom" },
  { id: "share_card", name: "Music Promoter", emoji: "📲", desc: "Share a song card with friends", goal: 1, unit: "share", category: "custom" },
];

function ld<T>(k: string, fb: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fb; } catch { return fb; } }
function sv(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } }

const emptyWeek = () => Array.from({ length: 7 }, (_, i) => ({ label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i], minutes: 0 }));

const PlayerCtx = createContext<Ctx | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const sleepRef = useRef<number | null>(null);
  const stepRef = useRef<((d: 1 | -1) => void) | null>(null);

  const [localTracks, setLocalTracks] = useState<Track[]>(ld(SK.local, []));
  const [adminTracks, setAdminTracks] = useState<Track[]>(ld(SK.adm, []));
  const [localVideos, setLocalVideos] = useState<VideoItem[]>(ld("au.localVideos", []));
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [externalTrack, setExternalTrack] = useState<Track | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [liked, setLiked] = useState<string[]>(ld(SK.liked, []));
  const [loadingSrc, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolumeState] = useState<number>(ld(SK.vol, 1));
  const [replayGain, setReplayGainState] = useState<boolean>(ld(SK.replayGain, true));
  const [smartQueue, setSmartQueueState] = useState<boolean>(ld(SK.smartQueue, true));
  const [queueIds, setQueueIds] = useState<string[]>(ld(SK.queue, []));
  const [customLyrics, setCustomLyrics] = useState<Record<string, string[]>>(ld(SK.lyrics, {}));
  const [crossfade, setCrossfade] = useState<boolean>(ld(SK.cf, true));
  const [fadeMs, setFadeMs] = useState<number>(ld(SK.fade, 900));
  const [speed, setSpeedState] = useState<number>(ld(SK.sp, 1));
  const [holdSpeed, setHoldSpeed] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [theme, setThemeState] = useState<Theme>(ld(SK.theme, THEMES[0]));
  const [equalizer, setEqualizerState] = useState<number[]>(ld(SK.eq, [0, 0, 0, 0, 0]));
  const [profile, setProfileState] = useState<Profile>(ld(SK.prof, { name: "", email: "", bio: "", avatar: "" }));
  const [loggedIn, setLoggedIn] = useState<boolean>(ld(SK.auth, false));

  // Firebase Auth sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const rec = await syncUserToFirestore(user);
        const updatedProf = {
          name: rec.name || user.displayName || user.email?.split("@")[0] || "Listener",
          email: rec.email || user.email || "",
          bio: "",
          avatar: rec.avatar || user.photoURL || "",
        };
        setProfileState(updatedProf);
        sv(SK.prof, updatedProf);
        setLoggedIn(true);
        sv(SK.auth, true);
      }
    });
    return () => unsub();
  }, []);
  const [radioTab, setRadioTabState] = useState<string>(ld(SK.radio, "pop"));
  const [geminiKey, setGeminiKeyState] = useState<string>(ld(SK.gk, ""));
  const [translateLang, setTranslateLangState] = useState<string>(ld(SK.tl, "Spanish"));
  const [playlists, setPlaylists] = useState<Playlist[]>(ld(SK.pl, []));
  const [driveMode, setDriveModeState] = useState<boolean>(ld(SK.dm, false));
  const [sleepTimer, setSleepTimerState] = useState<number | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState(0);
  const [showLyrics, setShowLyricsState] = useState<boolean>(ld(SK.sl, true));
  const [reverb, setReverbState] = useState<number>(ld(SK.rv, 0));
  const [bassBoost, setBassBoostState] = useState<number>(ld(SK.bb, 0));
  const [recentlyPlayed, setRecentlyPlayed] = useState<string[]>(ld(SK.rp, []));
  const [playCounts, setPlayCounts] = useState<Record<string, number>>(ld(SK.pc, {}));
  const [addedAt, setAddedAt] = useState<Record<string, number>>(ld(SK.aa, {}));
  const [analytics, setAnalytics] = useState<Analytics>(ld(SK.anl, { totalListens: 0, totalMinutes: 0, topTracks: [], byDay: emptyWeek(), streak: 0 }));
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);
  // reels + gestures
  const [reelLoops, setReelLoopsState] = useState<number>(ld(SK.rlp, 2));
  const [reelAutoScroll, setReelAutoScrollState] = useState<boolean>(ld(SK.ras, true));
  const [gesturesOn, setGesturesOnState] = useState<boolean>(ld(SK.gst, true));
  const [hapticsOn, setHapticsOnState] = useState<boolean>(ld(SK.hap, true));
  const [notifyOn, setNotifyOnState] = useState<boolean>(ld(SK.ntf, true));
  // AI assistant
  const [aiGroqKey, setAiGroqKeyState] = useState<string>(ld(SK.aigk, ""));
  const [aiGroqModel, setAiGroqModelState] = useState<string>(ld(SK.aigm, ""));
  const [aiOrKey, setAiOrKeyState] = useState<string>(ld(SK.aiok, ""));
  const [aiOrModel, setAiOrModelState] = useState<string>(ld(SK.aiom, ""));
  const [aiOllamaKey, setAiOllamaKeyState] = useState<string>(ld(SK.aiuk, ""));
  const [aiOllamaModel, setAiOllamaModelState] = useState<string>(ld(SK.aium, ""));
  const [aiHfKey, setAiHfKeyState] = useState<string>("");
  const [aiHfModel, setAiHfModelState] = useState<string>("");
  const [aiOfflineOnly, setAiOfflineOnlyState] = useState<boolean>(ld(SK.aioff, false));
  const [aiMessages, setAiMessages] = useState<AIMessage[]>(ld(SK.aimsg, []));
  const [stopAt, setStopAt] = useState<number | null>(null);
  const [stopAtRemaining, setStopAtRemaining] = useState(0);
  const [floatingAi, setFloatingAiState] = useState<boolean>(ld(SK.floatAi, false));
  const [vizStyle, setVizStyleState] = useState<VizStyle>(ld(SK.viz, "bars"));
  const [artShape, setArtShapeState] = useState<ArtShape>(ld(SK.art, "squircle"));
  const [savedStations, setSavedStations] = useState<SavedStation[]>(ld(SK.stations, []));
  const [likedOnline, setLikedOnline] = useState<LikedOnline[]>(ld(SK.likedOnline, []));
  const [unlockedIds, setUnlockedIds] = useState<string[]>(ld(SK.ach, []));
  /* reel organisation */
  const [reelCategories, setReelCategories] = useState<ReelCategory[]>(
    ld(SK.rCats, DEFAULT_REEL_CATEGORIES.map((x, i) => ({ ...x, createdAt: i })))
  );
  const [reelPlaylists, setReelPlaylists] = useState<ReelPlaylist[]>(ld(SK.rPlaylists, []));
  const [reelAssignments, setReelAssignments] = useState<Record<string, string>>(ld(SK.rcAssign, {}));
  const [reelTags, setReelTags] = useState<Record<string, string[]>>(ld(SK.rTags, {}));
  const [studyReels, setStudyReels] = useState<string[]>(ld(SK.rStudy, []));
  const [achievementToast, setAchievementToast] = useState<Achievement | null>(null);
  const [triedThemes, setTriedThemes] = useState<string[]>([]);
  const [aiChatCount, setAiChatCount] = useState(0);

  const [blacklistedIds, setBlacklistedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("au.blacklisted");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const toggleBlacklist = useCallback((id: string) => {
    setBlacklistedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem("au.blacklisted", JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  }, []);

  // Local tracks prioritized first, followed by admin tracks and online tracks.
  const rawTracks = useMemo(() => [...localTracks, ...adminTracks, ...ONLINE_TRACKS], [adminTracks, localTracks]);
  const tracks = useMemo(() => rawTracks.filter((t) => !blacklistedIds.includes(t.id)), [rawTracks, blacklistedIds]);
  const current = useMemo(
    () =>
      // Look up in `rawTracks` first: a track that is currently playing must
      // stay resolvable even if it was just blacklisted/deleted (which filters
      // it out of `tracks`). Otherwise the player — and Simple/Drive mode —
      // would show "No Track Selected" while audio is still playing.
      rawTracks.find((t) => t.id === currentId) ||
      tracks.find((t) => t.id === currentId) ||
      (externalTrack?.id === currentId ? externalTrack : null),
    [rawTracks, tracks, currentId, externalTrack]
  );

  if (!audioRef.current && typeof Audio !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.preload = "metadata";
  }

  const buzz = useCallback((ms = 12) => {
    if (!hapticsOn) return;
    try { navigator.vibrate?.(ms); } catch { /* */ }
  }, [hapticsOn]);

  /* ── persistence ── */
  useEffect(() => sv(SK.liked, liked), [liked]);
  useEffect(() => sv(SK.eq, equalizer), [equalizer]);
  useEffect(() => sv(SK.cf, crossfade), [crossfade]);
  useEffect(() => sv(SK.fade, fadeMs), [fadeMs]);
  useEffect(() => sv(SK.radio, radioTab), [radioTab]);
  useEffect(() => sv(SK.anl, analytics), [analytics]);
  useEffect(() => sv(SK.prof, profile), [profile]);
  useEffect(() => sv(SK.auth, loggedIn), [loggedIn]);
  useEffect(() => sv(SK.gk, geminiKey), [geminiKey]);
  useEffect(() => sv(SK.tl, translateLang), [translateLang]);
  useEffect(() => sv(SK.pl, playlists), [playlists]);
  useEffect(() => sv(SK.dm, driveMode), [driveMode]);
  useEffect(() => sv(SK.sl, showLyrics), [showLyrics]);
  useEffect(() => sv(SK.rv, reverb), [reverb]);
  useEffect(() => sv(SK.bb, bassBoost), [bassBoost]);
  useEffect(() => sv(SK.sp, speed), [speed]);
  useEffect(() => sv(SK.rp, recentlyPlayed), [recentlyPlayed]);
  useEffect(() => sv(SK.adm, adminTracks), [adminTracks]);
  useEffect(() => sv(SK.pc, playCounts), [playCounts]);
  useEffect(() => sv(SK.aa, addedAt), [addedAt]);
  useEffect(() => sv(SK.rlp, reelLoops), [reelLoops]);
  useEffect(() => sv(SK.ras, reelAutoScroll), [reelAutoScroll]);
  useEffect(() => sv(SK.gst, gesturesOn), [gesturesOn]);
  useEffect(() => sv(SK.hap, hapticsOn), [hapticsOn]);
  useEffect(() => sv(SK.ntf, notifyOn), [notifyOn]);
  useEffect(() => sv(SK.vol, volume), [volume]);
  useEffect(() => sv(SK.replayGain, replayGain), [replayGain]);
  useEffect(() => sv(SK.smartQueue, smartQueue), [smartQueue]);
  useEffect(() => sv(SK.aigk, aiGroqKey), [aiGroqKey]);
  useEffect(() => sv(SK.aigm, aiGroqModel), [aiGroqModel]);
  useEffect(() => sv(SK.aiok, aiOrKey), [aiOrKey]);
  useEffect(() => sv(SK.aiom, aiOrModel), [aiOrModel]);
  useEffect(() => sv(SK.aiuk, aiOllamaKey), [aiOllamaKey]);
  useEffect(() => sv(SK.aium, aiOllamaModel), [aiOllamaModel]);
  useEffect(() => sv(SK.aioff, aiOfflineOnly), [aiOfflineOnly]);
  useEffect(() => sv(SK.aimsg, aiMessages), [aiMessages]);
  useEffect(() => sv(SK.floatAi, floatingAi), [floatingAi]);
  useEffect(() => sv(SK.viz, vizStyle), [vizStyle]);
  useEffect(() => sv(SK.art, artShape), [artShape]);
  useEffect(() => sv(SK.stations, savedStations), [savedStations]);
  useEffect(() => sv(SK.likedOnline, likedOnline), [likedOnline]);
  useEffect(() => sv(SK.ach, unlockedIds), [unlockedIds]);
  useEffect(() => sv(SK.rcAssign, reelAssignments), [reelAssignments]);
  useEffect(() => sv(SK.rPlaylists, reelPlaylists), [reelPlaylists]);
  useEffect(() => sv(SK.rTags, reelTags), [reelTags]);
  useEffect(() => sv(SK.rStudy, studyReels), [studyReels]);
  useEffect(() => sv(SK.rCats, reelCategories), [reelCategories]);

  const unlock = useCallback((id: string) => {
    setUnlockedIds((prev) => {
      if (prev.includes(id)) return prev;
      const ach = ACHIEVEMENTS.find((a) => a.id === id);
      if (ach) {
        setAchievementToast(ach);
        try { navigator.vibrate?.([12, 40, 24]); } catch { /* */ }
      }
      return [...prev, id];
    });
  }, []);
  const dismissAchievementToast = useCallback(() => setAchievementToast(null), []);

  const toggleSavedStation = useCallback((s: SavedStation) => {
    setSavedStations((prev) => {
      if (prev.some((x) => x.id === s.id)) return prev.filter((x) => x.id !== s.id);
      unlock("first_saved_station");
      return [{ ...s }, ...prev];
    });
  }, [unlock]);
  const isStationSaved = useCallback((id: string) => savedStations.some((x) => x.id === id), [savedStations]);
  const toggleLikedOnline = useCallback((t: LikedOnline) => setLikedOnline((p) => (p.some((x) => x.id === t.id) ? p.filter((x) => x.id !== t.id) : [t, ...p])), []);
  const isOnlineLiked = useCallback((id: string) => likedOnline.some((x) => x.id === id), [likedOnline]);
  const setStationMood = useCallback((id: string, mood: string) => {
    setSavedStations((prev) => prev.map((x) => (x.id === id ? { ...x, mood } : x)));
  }, []);

  const addAiMessage = useCallback((m: AIMessage) => {
    setAiMessages((prev) => [...prev, m].slice(-60));
    if (m.role === "user") {
      setAiChatCount((c) => c + 1);
      unlock("first_ai_chat");
    }
  }, [unlock]);
  const clearAiMessages = useCallback(() => setAiMessages([]), []);

  // time-based stop: e.g. "stop playing at 11:30 pm"
  useEffect(() => {
    if (stopAt == null) { setStopAtRemaining(0); return; }
    const tick = () => {
      const left = Math.max(0, Math.round((stopAt - Date.now()) / 1000));
      setStopAtRemaining(left);
      if (left <= 0) {
        audioRef.current?.pause();
        setPlaying(false);
        setStopAt(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [stopAt]);

  /* ── theme vars ── */

  useEffect(() => {
    const r = document.documentElement;
    const isLight = theme.mode === "light";
    r.style.setProperty("--accent", theme.accent);
    r.style.setProperty("--accent-soft", theme.accentSoft);
    r.style.setProperty("--ga", theme.gradientA);
    r.style.setProperty("--gb", theme.gradientB);
    r.style.setProperty("--gc", theme.gradientC);

    if (isLight) {
      r.style.setProperty("--app-bg", "#F8FAFC");
      r.style.setProperty("--card-bg", "rgba(255, 255, 255, 0.85)");
      r.style.setProperty("--text-main", "#0F172A");
      r.style.setProperty("--text-muted", "#475569");
      document.body.style.backgroundColor = "#F8FAFC";
      document.body.style.color = "#0F172A";
    } else {
      r.style.setProperty("--app-bg", "#0A0A0D");
      r.style.setProperty("--card-bg", "rgba(255, 255, 255, 0.05)");
      r.style.setProperty("--text-main", "#FFFFFF");
      r.style.setProperty("--text-muted", "rgba(255, 255, 255, 0.6)");
      document.body.style.backgroundColor = "#0A0A0D";
      document.body.style.color = "#FFFFFF";
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isLight ? "#F8FAFC" : "#0A0A0D");
    sv(SK.theme, theme);
  }, [theme]);

  useEffect(() => {
    if (current?.cover) {
      const coverColor = extractCoverAccent(current.cover, theme.accent);
      document.documentElement.style.setProperty("--cover-accent", coverColor);
    }
  }, [current?.cover, theme.accent]);

  /* ── live audio-effect wiring (this is what makes effects REAL) ── */
  useEffect(() => { engine.setEQ(equalizer); if (isNative()) setNativeEqualizer(equalizer, bassBoost); }, [equalizer]);
  useEffect(() => { engine.setBassBoost(bassBoost); if (isNative()) setNativeEqualizer(equalizer, bassBoost); }, [bassBoost]);
  useEffect(() => { engine.setReverb(reverb); }, [reverb]);

  // Re-apply native effects whenever the playing track/session changes. Android
  // audio effects live on the player's audio session: when ExoPlayer opens a new
  // session the previously-created Equalizer/BassBoost/Reverb objects no longer
  // affect the output, so the sliders would silently stop having any effect.
  useEffect(() => {
    if (!isNative()) return;
    const push = () => { setNativeEqualizer(equalizer, bassBoost); setNativeReverb(reverb).catch(() => {}); };
    push();
    const t1 = window.setTimeout(push, 600);
    const t2 = window.setTimeout(push, 1800);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [currentId, isPlaying, equalizer, bassBoost, reverb]);
  useEffect(() => { engine.setLoudnessNormalization(replayGain); }, [replayGain]);
  useEffect(() => {
    engine.setVolume(volume);
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = holdSpeed ?? speed;
      // When speed !== 1, disable pitch preservation for real pitch bending
      // (like a vinyl turntable / DJ deck). At speed 1, re-enable for normal playback.
      const rate = holdSpeed ?? speed;
      (audioRef.current as any).preservesPitch = rate === 1;
      (audioRef.current as any).mozPreservesPitch = rate === 1;
      (audioRef.current as any).webkitPreservesPitch = rate === 1;
    }
  }, [speed, holdSpeed, currentId]);

  /* ── sleep timer ── */
  useEffect(() => {
    if (sleepRef.current) { window.clearInterval(sleepRef.current); sleepRef.current = null; }
    if (sleepTimer === null) { setSleepRemaining(0); return; }
    const end = Date.now() + sleepTimer * 60000;
    setSleepRemaining(sleepTimer * 60);
    sleepRef.current = window.setInterval(() => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setSleepRemaining(left);
      if (left <= 0) {
        audioRef.current?.pause(); setPlaying(false); setSleepTimerState(null);
        if (sleepRef.current) window.clearInterval(sleepRef.current);
      }
    }, 1000);
    return () => { if (sleepRef.current) window.clearInterval(sleepRef.current); };
  }, [sleepTimer]);

  /* ── audio element events ── */
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    a.muted = false;

    let lastUpdate = 0;
    const onTime = () => {
      const now = performance.now();
      if (now - lastUpdate >= 250) {
        lastUpdate = now;
        setProgress(a.currentTime);
      }
    };
    const onMeta = () => {
      setDuration(a.duration || 0);
      a.playbackRate = speed;
      const rate = speed;
      (a as any).preservesPitch = rate === 1;
      (a as any).mozPreservesPitch = rate === 1;
      (a as any).webkitPreservesPitch = rate === 1;
    };
    const onEnd = () => handleEnd();
    const onErr = () => {
      if (isNative()) return;
      setLoading(false); setPlaying(false); setError("Couldn't play this track.");
    };
    const onPlay = () => { setLoading(false); setError(null); setPlaying(true); };
    const onPause = () => setPlaying(false);
    const onWait = () => setLoading(true);
    a.addEventListener("timeupdate", onTime); a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd); a.addEventListener("error", onErr);
    a.addEventListener("playing", onPlay); a.addEventListener("pause", onPause);
    a.addEventListener("waiting", onWait);
    return () => {
      a.removeEventListener("timeupdate", onTime); a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd); a.removeEventListener("error", onErr);
      a.removeEventListener("playing", onPlay); a.removeEventListener("pause", onPause);
      a.removeEventListener("waiting", onWait);
    };
  });

  /* ── listening-time accumulator (only while actually playing) ── */
  useEffect(() => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    if (!isPlaying) return;
    tickRef.current = window.setInterval(() => {
      setAnalytics((a) => {
        const dayIx = (new Date().getDay() + 6) % 7; // Mon=0
        const byDay = a.byDay.map((d, i) => (i === dayIx ? { ...d, minutes: Math.round((d.minutes + 1 / 60) * 100) / 100 } : d));
        const totalMinutes = Math.round((a.totalMinutes + 1 / 60) * 100) / 100;
        if (totalMinutes >= 60) unlock("one_hour");
        if (totalMinutes >= 600) unlock("ten_hours");
        if (a.streak >= 3) unlock("streak_3");
        if (a.streak >= 7) unlock("streak_7");
        return { ...a, totalMinutes, byDay };
      });
    }, 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [isPlaying]);

  /* ── queue + lyrics + local tracks + videos persistence ── */
  useEffect(() => sv(SK.queue, queueIds), [queueIds]);
  useEffect(() => sv(SK.lyrics, customLyrics), [customLyrics]);
  useEffect(() => sv(SK.local, localTracks.filter((t) => !t.src.startsWith("blob:"))), [localTracks]);
  useEffect(() => sv("au.localVideos", localVideos.filter((v) => !v.src.startsWith("blob:"))), [localVideos]);

  // Keep the queue in sync with the library — remove stale ids, seed when empty.
  useEffect(() => {
    setQueueIds((q) => {
      if (!tracks.length) return q;
      const trackSet = new Set(tracks.map((t) => t.id));
      const valid = q.filter((id) => trackSet.has(id));
      if (valid.length) return valid;
      return tracks.map((t) => t.id);
    });
  }, [tracks]);

  const resetQueue = useCallback(() => {
    setQueueIds(tracks.map((t) => t.id));
    buzz(12);
  }, [tracks, buzz]);

  const moveInQueue = useCallback((from: number, to: number) => {
    if (from === to || to < 0) return;
    setQueueIds((q) => {
      const n = [...q];
      const [item] = n.splice(from, 1);
      if (to >= n.length) n.push(item);
      else n.splice(to, 0, item);
      return n;
    });
    buzz(8);
  }, [buzz]);

  const removeFromQueue = useCallback((id: string) => {
    setQueueIds((q) => q.filter((x) => x !== id));
    buzz(10);
    if (currentId === id) {
      // current being removed — move to whatever is next in the queue
      const pool = queueIds.filter((x) => x !== id);
      const nxt = tracks.find((t) => t.id === pool[0]);
      if (nxt) { setCurrentId(nxt.id); loadAndPlayRef.current?.(nxt, true); }
      else { audioRef.current?.pause(); setPlaying(false); setCurrentId(null); }
    }
  }, [currentId, queueIds, tracks, buzz]);

  const setTrackLyrics = useCallback((id: string, lines: string[] | null) => {
    setCustomLyrics((p) => {
      const n = { ...p };
      if (lines == null || !lines.length) delete n[id];
      else n[id] = lines;
      return n;
    });
  }, []);

  // keep a ref so callbacks that reference loadAndPlay before it is defined work
  const loadAndPlayRef = useRef<((t: Track, autoplay?: boolean) => void) | null>(null);

  /* ── fade helpers (operate on the engine's master gain) ── */
  const cancelFade = () => { if (fadeRef.current) { window.clearInterval(fadeRef.current); fadeRef.current = null; } };
  const fadeTo = useCallback((target: number, ms: number, done?: () => void) => {
    cancelFade();
    const a = audioRef.current;
    if (!a || !crossfade || ms <= 0) {
      if (engine.isReady) engine.setVolumeNow(target);
      if (a) a.volume = target;
      done?.(); return;
    }
    const start = engine.isReady ? engine.getVolume() : a.volume;
    const isFadeOut = target < start;
    const steps = Math.max(16, Math.round(ms / 20));
    const iv = ms / steps;
    let i = 0;
    fadeRef.current = window.setInterval(() => {
      i++;
      const t = Math.min(1, i / steps);
      // Equal-power musical curve
      let v: number;
      if (isFadeOut) {
        // Cosine curve: 1.0 -> 0.0 with gentle shoulder
        const factor = Math.cos(t * 0.5 * Math.PI);
        v = target + (start - target) * factor;
      } else {
        // Sine curve: 0.0 -> 1.0 with energetic crest
        const factor = Math.sin(t * 0.5 * Math.PI);
        v = start + (target - start) * factor;
      }
      const clamped = Math.min(1, Math.max(0, v));
      if (engine.isReady) engine.setVolumeNow(clamped);
      if (a) a.volume = clamped;
      if (i >= steps) { cancelFade(); done?.(); }
    }, iv);
  }, [crossfade]);

  const addRecent = useCallback((id: string) => {
    setRecentlyPlayed((p) => [id, ...p.filter((x) => x !== id)].slice(0, 30));
    setPlayCounts((c) => {
      const next = { ...c, [id]: (c[id] || 0) + 1 };
      const total = Object.values(next).reduce((s, n) => s + n, 0);
      unlock("first_play");
      if (total >= 10) unlock("ten_plays");
      if (total >= 100) unlock("hundred_plays");
      const hr = new Date().getHours();
      if (hr >= 0 && hr < 4) unlock("night_owl");
      return next;
    });
    setAnalytics((a) => {
      const top = [...a.topTracks];
      const ix = top.findIndex((t) => t.id === id);
      if (ix >= 0) top[ix] = { id, count: top[ix].count + 1 }; else top.push({ id, count: 1 });
      return { ...a, totalListens: a.totalListens + 1, topTracks: top.sort((x, y) => y.count - x.count).slice(0, 25) };
    });
  }, [unlock]);

  const loadAndPlay = useCallback((track: Track, autoplay = true, restart = false, startTime?: number) => {
    const a = audioRef.current; if (!a) return;
    try {
      engine.attach(a);
      engine.resume();
      // On native, ExoPlayer is the actual audio source — mute the WebAudio
      // output gate so we don't get double audio / echo. The HTMLAudioElement
      // still plays (silently) so its timeupdate events drive the UI.
      engine.muteOutput(isNative());
    } catch { /* engine unavailable */ }
    const safeSrc = getSafeAudioSrc(track as any) || track.src;
    if (!safeSrc) return;

    if (a.src !== safeSrc) {
      a.src = safeSrc;
      a.load();
      if (startTime && startTime > 0) {
        const applySeek = () => {
          try { a.currentTime = startTime; } catch {}
          setProgress(startTime);
        };
        a.addEventListener("loadedmetadata", applySeek, { once: true });
        try { a.currentTime = startTime; } catch {}
        setProgress(startTime);
      } else {
        setProgress(0);
      }
      setDuration(0);
    } else if (startTime && startTime > 0) {
      a.currentTime = startTime;
      setProgress(startTime);
    } else if (restart) {
      a.currentTime = 0;
    }
    a.playbackRate = speed;
    const rate = speed;
    (a as any).preservesPitch = rate === 1;
    (a as any).mozPreservesPitch = rate === 1;
    (a as any).webkitPreservesPitch = rate === 1;
    a.muted = false;

    // Sync metadata with native notification / lockscreen if on Android
    if (isNative()) {
      let pool = queueIds.length ? queueIds : tracks.map((x) => x.id);
      let idx = pool.indexOf(track.id);
      if (idx < 0) {
        pool = [track.id, ...pool.filter((x) => x !== track.id)];
        setQueueIds(pool);
        idx = 0;
      }
      const poolTracks = pool.map((id) => tracks.find((x) => x.id === id) || (externalTrack?.id === id ? externalTrack : undefined)).filter(Boolean) as Track[];
      const trackIdx = Math.max(0, poolTracks.findIndex((x) => x.id === track.id));
      loadQueueNative(
        poolTracks.map((x) => ({
          id: x.id,
          uri: (x as any).rawContentUri || (x as any).path || safeSrc,
          title: x.title,
          artist: x.artist,
          coverUrl: (x as any).rawAlbumArt || x.cover,
          duration: x.duration ? (x.duration > 10000 ? x.duration : Math.floor(x.duration * 1000)) : 0,
        })),
        trackIdx >= 0 ? trackIdx : 0,
        Math.floor((a.currentTime || 0) * 1000)
      ).catch((e) => console.warn("[PlayerContext] loadQueueNative failed:", e));
    }

    if (!autoplay) return;
    setLoading(true);
    engine.resume();
    if (crossfade && (!startTime || startTime <= 0)) {
      if (engine.isReady) engine.setVolumeNow(0);
      a.volume = 0;
    } else {
      if (engine.isReady) engine.setVolumeNow(volume);
      a.volume = volume;
    }
    Promise.resolve(a.play())
      .then(() => {
        setPlaying(true);
        if (startTime && startTime > 0) {
          try { a.currentTime = startTime; } catch {}
          setProgress(startTime);
        }
        if (crossfade && (!startTime || startTime <= 0)) fadeTo(volume, fadeMs);
        else {
          if (engine.isReady) engine.setVolumeNow(volume);
          a.volume = volume;
        }
      })
      .catch((err) => {
        console.warn("[PlayerContext] audio play error:", err);
        setPlaying(false);
        setLoading(false);
      });
  }, [crossfade, fadeMs, fadeTo, volume, speed, queueIds, tracks, externalTrack]);

  useEffect(() => { loadAndPlayRef.current = loadAndPlay; }, [loadAndPlay]);

  const setQueue = useCallback((newQueueIds: string[]) => {
    setQueueIds(newQueueIds);
    sv(SK.queue, newQueueIds);
  }, []);

  const playExternal = useCallback((track: Track) => {
    setError(null); setExternalTrack(track); setCurrentId(track.id); addRecent(track.id); loadAndPlay(track, true, true);
    if (track.tags?.includes("radio")) unlock("first_radio");
    if (track.tags?.includes("archive")) unlock("first_archive");
  }, [loadAndPlay, addRecent, unlock]);

  const playTrack = useCallback((id: string, startTime?: number) => {
    const t = tracks.find((x) => x.id === id) || (externalTrack?.id === id ? externalTrack : undefined);
    if (!t) return;
    setError(null); buzz(10);
    if (t.id === currentId) {
      const a = audioRef.current!;
      if (a.paused) {
        engine.resume();
        if (isNative()) nativePlayback("play");
        // On native, ExoPlayer is already loaded — just resume it, don't re-load the queue
        if (isNative()) { a.play().catch((e) => console.warn("[PlayerContext] resume play() failed:", e)); setPlaying(true); }
        else loadAndPlay(t, true, false, startTime);
      }
      else fadeTo(0, Math.min(fadeMs, 400), () => { a.pause(); if (isNative()) nativePlayback("pause"); setPlaying(false); });
      return;
    }
    addRecent(id);
    if (isPlaying && crossfade && !startTime) fadeTo(0, fadeMs / 2, () => { setCurrentId(id); loadAndPlay(t, true, true); });
    else { setCurrentId(id); loadAndPlay(t, true, true, startTime); }
  }, [tracks, currentId, loadAndPlay, isPlaying, crossfade, fadeMs, fadeTo, externalTrack, addRecent, buzz]);

  const toggle = useCallback(() => {
    const a = audioRef.current; if (!a) return;
    if (!current) { if (tracks[0]) playTrack(tracks[0].id); return; }
    buzz(10);
    if (a.paused) {
      engine.resume();
      if (isNative()) nativePlayback("play");
      // On native, ExoPlayer is already loaded — just resume it, don't re-load the queue
      if (isNative()) { a.play().catch((e) => console.warn("[PlayerContext] toggle play() failed:", e)); setPlaying(true); }
      else loadAndPlay(current, true, false);
    }
    else fadeTo(0, Math.min(fadeMs, 400), () => { a.pause(); if (isNative()) nativePlayback("pause"); setPlaying(false); });
  }, [current, loadAndPlay, fadeTo, fadeMs, tracks, playTrack, buzz]);

  const step = useCallback((dir: 1 | -1) => {
    const pool = queueIds.length ? queueIds : tracks.map((t) => t.id);
    if (!pool.length) return;
    buzz(14);
    let i = pool.indexOf(currentId ?? "");
    if (i < 0) i = 0;
    let n: number;
    // Fast-path eligibility: only when the order is strictly sequential (no
    // shuffle / smart-queue reordering) — in that case the native queue
    // (already loaded via loadQueueNative) is in the exact same order, so we
    // can ask it to advance directly instead of reloading the whole queue.
    const sequentialOrder = !shuffle && !(smartQueue && dir === 1 && tracks.length > 2);
    if (shuffle) {
      do { n = Math.floor(Math.random() * pool.length); } while (pool.length > 1 && n === i);
    } else if (smartQueue && dir === 1 && tracks.length > 2) {
      const recent = new Set(recentlyPlayed.slice(0, Math.min(8, tracks.length - 1)));
      const candidates = pool
        .map((id, ix) => ({ ix, recent: recent.has(id), plays: playCounts[id] || 0 }))
        .filter((x) => x.ix !== i)
        .sort((a, b) => Number(a.recent) - Number(b.recent) || a.plays - b.plays);
      n = candidates[0]?.ix ?? ((i + 1) % pool.length);
    } else n = (i + dir + pool.length) % pool.length;
    const id = pool[n];
    const t = tracks.find((x) => x.id === id) || (externalTrack?.id === id ? externalTrack : undefined);
    if (!t) return;
    addRecent(t.id);

    // Fast path: on native, if we're simply moving one step without wrapping
    // around the ends of the queue, just send the lightweight native
    // next/previous command — ExoPlayer already has the full queue loaded,
    // so this avoids a full reload (which caused laggy/unreliable button taps).
    // The UI (currentId/progress/playing) updates via the "trackChanged"
    // native event handler (onTrackChanged) once ExoPlayer confirms the switch.
    const seqIdx = i + dir;
    const isAdjacentNoWrap = seqIdx >= 0 && seqIdx < pool.length && seqIdx === n;
    if (isNative() && sequentialOrder && isAdjacentNoWrap) {
      nativePlayback(dir === 1 ? "next" : "previous").catch((e) =>
        console.warn("[PlayerContext] nativePlayback step command failed:", e)
      );
      return;
    }

    if (isPlaying && crossfade) {
      fadeTo(0, fadeMs / 2, () => {
        setCurrentId(t.id);
        loadAndPlay(t, true, true);
      });
    } else {
      setCurrentId(t.id);
      loadAndPlay(t, true, true);
    }
  }, [queueIds, tracks, currentId, externalTrack, shuffle, smartQueue, recentlyPlayed, playCounts, isPlaying, crossfade, fadeMs, fadeTo, loadAndPlay, addRecent, buzz]);

  useEffect(() => { stepRef.current = step; }, [step]);

  const handleEnd = useCallback(() => {
    const a = audioRef.current!;
    if (repeat) {
      a.currentTime = 0;
      Promise.resolve(a.play()).catch((e) => console.warn("[PlayerContext] repeat play() failed:", e));
      return;
    }
    // On native, ExoPlayer auto-advances to the next track and fires
    // onTrackChanged — calling step(1) here would skip TWO tracks.
    if (isNative()) return;
    step(1);
  }, [repeat, step]);

  const seek = useCallback((t: number) => {
    const a = audioRef.current; if (!a) return;
    a.currentTime = t; setProgress(t);
    // Keep the native ExoPlayer scrubber in sync when seeking from the UI
    if (isNative()) nativeUpdatePosition(Math.floor(t * 1000), Math.floor((a.duration || 0) * 1000));
  }, []);

  const seekBy = useCallback((d: number) => {
    const a = audioRef.current; if (!a) return;
    const target = Math.max(0, Math.min(a.duration || 0, a.currentTime + d));
    a.currentTime = target; setProgress(target); buzz(8);
    // Keep the native ExoPlayer scrubber in sync when seeking from the UI
    if (isNative()) nativeUpdatePosition(Math.floor(target * 1000), Math.floor((a.duration || 0) * 1000));
  }, [buzz]);

  const toggleLike = useCallback((id: string) => {
    buzz(18);
    setLiked((l) => {
      const next = l.includes(id) ? l.filter((x) => x !== id) : [...l, id];
      if (next.length >= 1) unlock("first_like");
      if (next.length >= 10) unlock("ten_likes");
      return next;
    });
  }, [buzz, unlock]);

  /* ── Media Session: lock-screen + notification controls (placed AFTER callbacks to prevent TDZ) ── */
  useMediaSession({
    title: current?.title,
    artist: current?.artist,
    album: current?.source === "local" ? "On device" : "Audenic",
    cover: current?.cover,
    rawAlbumArt: (current as any)?.rawAlbumArt || "",
    albumArtFilePath: (current as any)?.albumArtFilePath || "",
    isPlaying,
    isLiked: current ? liked.includes(current.id) : false,
    progress,
    duration,
    speed,
    onPlay: toggle,
    onPause: toggle,
    onNext: () => step(1),
    onPrev: () => step(-1),
    onSeek: seek,
    onSeekBy: seekBy,
    onStop: () => { audioRef.current?.pause(); setPlaying(false); },
    onLike: () => { if (current) toggleLike(current.id); },
    /* ── Native ExoPlayer event handlers (background-safe) ── */
    onTrackChanged: (trackId, _index) => {
      if (trackId === currentId) return;
      const t = tracks.find(x => x.id === trackId) || (externalTrack?.id === trackId ? externalTrack : undefined);
      if (t) {
        setCurrentId(t.id);
        addRecent(t.id);
        setProgress(0);
        setDuration(0);
        setPlaying(true);
        setLoading(false);
        setError(null);
        // Sync the silent HTMLAudioElement to the new native track so its
        // timeupdate events keep driving the UI scrubber in the background.
        const a = audioRef.current;
        if (a) {
          const safeSrc = getSafeAudioSrc(t as any) || t.src;
          if (safeSrc && a.src !== safeSrc) { a.src = safeSrc; a.load(); }
          a.play().catch((e) => console.warn("[PlayerContext] trackChanged sync play() failed:", e));
        }
      }
    },
    onNativePlay: () => {
      // Native ExoPlayer started playing — update JS state directly
      setPlaying(true);
      setLoading(false);
      setError(null);
      const a = audioRef.current;
      if (a && a.paused) {
        a.play().catch((e) => console.warn("[PlayerContext] onNativePlay sync play() failed:", e));
      }
    },
    onNativePause: () => {
      // Native ExoPlayer paused — update JS state directly
      setPlaying(false);
      const a = audioRef.current;
      if (a && !a.paused) {
        a.pause();
      }
    },
    onProgress: (positionSec, durationSec) => {
      // Native progress tick from ExoPlayer — update scrubber position
      setProgress(positionSec);
      if (durationSec > 0) setDuration(durationSec);
    },
  });

  /* ── local media ── */
  const addLocalFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setScanning(true);
    const all = Array.from(files);
    const audio = all.filter((f) => f.type.startsWith("audio") || /\.(mp3|m4a|wav|ogg|flac|aac|opus)$/i.test(f.name));
    if (audio.length) unlock("first_scan");

    // Read embedded ID3 tags (title/artist/album art/lyrics) in small batches so
    // a big folder doesn't choke the main thread, and merge each file's result in.
    const existing = localTracks;
    const done = new Set(existing.map((p) => p.title + p.artist));
    const items: { t: Track; lrc?: File }[] = [];

    for (const f of audio) {
      const parsed = parseName(f.name);
      if (done.has(parsed.title + parsed.artist)) continue;
      const id = `l-${Date.now()}-${items.length}`;
      items.push({
        t: {
          id, title: parsed.title, artist: parsed.artist,
          cover: svgCover(parsed.title, items.length),
          src: URL.createObjectURL(f), songs: 1, source: "local", tags: ["local"],
          lyrics: undefined,
        },
        lrc: findLrcFor(all, f.name),
      });
    }

    // Local File blobs are plain objects — fetch isn't needed, but blob: URLs
    // still resolve through fetch() in Chrome/WebView, so this covers both.
    const blobFor = async (src: string): Promise<Blob | null> => {
      try { const r = await fetch(src); return await r.blob(); } catch { return null; }
    };
    // Tag reads — 5 workers at a time for faster throughput on large libraries,
    // with requestIdleCallback between batches to avoid UI jank.
    const work = [...items];
    const BATCH_SIZE = 20;
    let processed = 0;
    const worker = async () => {
      while (work.length) {
        const it = work.pop()!;
        try {
          const [tags, lrcPack] = await Promise.all([
            Promise.race<EmbeddedTags>([blobFor(it.t.src).then((b) => (b ? readTags(b) : ({} as EmbeddedTags))).catch(() => ({} as EmbeddedTags)), new Promise<EmbeddedTags>((r) => setTimeout(() => r({} as EmbeddedTags), 1200))]),
            attachLrc(it.lrc, undefined),
          ]);
          if (tags.title) it.t.title = tags.title;
          if (tags.artist) it.t.artist = tags.artist;
          if (tags.cover) it.t.cover = tags.cover;
          const lines = lrcPack.lyrics ?? tags.lyrics;
          if (lines?.length) it.t.lyrics = lines as string[];
          else it.t.lyrics = ["♪ " + it.t.title, it.t.artist, "Local file on this device"];
          if (lrcPack.timedLyrics) (it.t as Track & { timedLyrics?: { t: number; text: string }[] }).timedLyrics = lrcPack.timedLyrics;
        } catch { /* keep fallbacks */ }
        processed++;
        // Yield to the main thread every BATCH_SIZE files to keep UI responsive
        if (processed % BATCH_SIZE === 0) {
          await new Promise<void>((resolve) => {
            if (typeof requestIdleCallback !== "undefined") requestIdleCallback(() => resolve());
            else setTimeout(resolve, 0);
          });
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker()]);

    setLocalTracks((prev) => {
      const exist2 = new Set(prev.map((p) => p.title + p.artist));
      const added = items.filter((it) => !exist2.has(it.t.title + it.t.artist)).map((it) => it.t);
      if (added.length) {
        const stamps: Record<string, number> = {};
        added.forEach((tr, i) => { stamps[tr.id] = Date.now() + i; });
        setAddedAt((a) => ({ ...a, ...stamps }));
        return [...prev, ...added];
      }
      return prev;
    });
    setScanning(false);
  }, [localTracks, unlock]);
  const clearLocal = useCallback(() => setLocalTracks([]), []);

  const scanNativeLibrary = useCallback(async () => {
    setScanning(true);
    try {
      const items = await scanNativeMedia("audio");
      if (!items.length) return 0;
      // Batch-add in groups of 50 with idle callbacks so the UI stays responsive
      // even when scanning 1000+ songs.
      const BATCH = 50;
      for (let start = 0; start < items.length; start += BATCH) {
        const batch = items.slice(start, start + BATCH);
        setLocalTracks((prev) => {
          const existing = new Set(prev.map((x) => x.id));
          const added: Track[] = batch.filter((x) => !existing.has(`media-${x.id}`)).map((x, i) => {
            // Convert native artwork URI for WebView rendering; preserve raw path for notifications
            const rawArt = x.artwork || "";
            const convertedCover = rawArt ? getSafeAudioSrc({ src: rawArt } as any) || rawArt : svgCover(x.title || "Song", prev.length + i);
            return {
              id: `media-${x.id}`,
              title: x.title || "Unknown title",
              artist: x.artist || "Unknown Artist",
              cover: convertedCover,
              src: x.webPath,
              songs: 1,
              source: "local" as const,
              tags: ["local", "mediastore", x.album || ""].filter(Boolean),
              lyrics: (x as any).lrc
                ? ((x as any).lrc as string).split('\n').filter((s: string) => s.trim().length > 0)
                : [x.title || "Unknown title", x.artist || "Unknown Artist", x.album || "On device"],
              // Preserve raw native paths for notification artwork
              rawAlbumArt: rawArt,
              albumArtFilePath: (x as any).albumArtFilePath || "",
            };
          });
          if (added.length && start === 0) unlock("first_scan");
          return added.length ? [...prev, ...added] : prev;
        });
        // Yield between batches
        if (start + BATCH < items.length) {
          await new Promise<void>((resolve) => {
            if (typeof requestIdleCallback !== "undefined") requestIdleCallback(() => resolve());
            else setTimeout(resolve, 0);
          });
        }
      }
      return items.length;
    } finally { setScanning(false); }
  }, [unlock]);

  const scanNativeVideos = useCallback(async () => {
    setScanning(true);
    try {
      const items = await scanNativeMedia("video");
      if (!items.length) return 0;
      setLocalVideos((prev) => {
        const existing = new Set(prev.map((x) => x.id));
        const added: VideoItem[] = items.filter((x) => !existing.has(`mediav-${x.id}`)).map((x, i) => ({
          id: `mediav-${x.id}`,
          title: x.title || "Unknown Video",
          src: x.webPath,
          cover: x.artwork || svgCover(x.title || "Video", prev.length + i),
          size: x.size || 0,
          kind: x.category === "reels" ? "reel" : "video",
        }));
        return [...prev, ...added];
      });
      return items.length;
    } finally { setScanning(false); }
  }, []);

  const updateLocalTrack = useCallback((id: string, patch: Partial<Pick<Track, "title" | "artist" | "cover">>) => {
    setLocalTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setExternalTrack((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const addLocalTrack = useCallback((track: Track) => {
    setLocalTracks((prev) => {
      if (prev.some((t) => t.id === track.id || t.src === track.src)) return prev;
      return [track, ...prev];
    });
  }, []);

  const scanDesktopLibrary = useCallback(async (): Promise<number> => {
    if (!isDesktop()) return 0;
    try {
      const folder = await pickFolder();
      if (!folder) return 0;
      setScanning(true);
      const res = await scanDirectory(folder);
      if (!res.tracks.length) {
        return 0;
      }
      setLocalTracks((prev) => {
        const existing = new Set(prev.map((x) => x.id));
        const added: Track[] = res.tracks
          .filter((x) => !existing.has(`dt-${x.id}`))
          .map((x, i) => {
            const initialCover = x.cover_art
              ? toAssetUrl(x.cover_art)
              : svgCover(x.title || "Song", prev.length + i);
            return {
              id: `dt-${x.id}`,
              title: x.title || "Unknown title",
              artist: x.artist || "Unknown Artist",
              album: x.album || "Local Library",
              cover: initialCover,
              src: toAssetUrl(x.path),
              songs: 1,
              source: "local" as const,
              tags: ["local", "desktop", x.album || ""].filter(Boolean),
              duration: x.duration || 0,
            };
          });
        if (added.length) unlock("first_scan");
        return added.length ? [...prev, ...added] : prev;
      });

      // Background metadata & artwork enhancement for tracks missing artwork
      const missingArt = res.tracks.filter((t) => !t.cover_art);
      if (missingArt.length > 0) {
        setTimeout(async () => {
          for (const item of missingArt.slice(0, 40)) {
            try {
              const query = `${item.artist && item.artist !== "Unknown Artist" ? item.artist + " " : ""}${item.title}`
                .replace(/[\(\[](?:official|music|video|audio|lyrics|hd|4k)[^\)\]]*[\)\]]/gi, "")
                .trim();
              const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`);
              if (res.ok) {
                const data = await res.json();
                if (data.results?.[0]?.artworkUrl100) {
                  const highResCover = data.results[0].artworkUrl100.replace("100x100bb", "800x800bb");
                  updateLocalTrack(`dt-${item.id}`, { cover: highResCover });
                }
              }
            } catch {}
          }
        }, 1500);
      }

      return res.tracks.length;
    } catch (err) {
      console.error("Desktop library scan error:", err);
      return 0;
    } finally {
      setScanning(false);
    }
  }, [unlock, updateLocalTrack]);

  const deleteLocalTrack = useCallback(async (id: string) => {
    // If it's a native MediaStore track, try to delete it from storage too
    if (isNative() && id.startsWith("media-")) {
      const nativeId = id.replace("media-", "");
      const ok = await nativeDelete(nativeId, "audio");
      if (!ok) {
        console.warn("Failed to delete native media item:", nativeId);
        // We still remove it from the UI for a better user experience
      }
    }
    setLocalTracks((prev) => prev.filter((t) => t.id !== id));
    setLiked((l) => l.filter((x) => x !== id));
    setRecentlyPlayed((r) => r.filter((x) => x !== id));
    setPlaylists((pls) => pls.map((p) => ({ ...p, trackIds: p.trackIds.filter((x) => x !== id) })));
    if (currentId === id) {
      audioRef.current?.pause();
      setPlaying(false);
      setCurrentId(null);
    }
  }, [currentId]);

  /**
   * True native "set as ringtone" requires a platform bridge (Android's
   * RingtoneManager) which isn't reachable from a plain web view. We do the
   * best available web equivalent: hand the file to the OS share sheet
   * (where "Set as ringtone" is often a share target) or fall back to a
   * direct download so the user can assign it manually.
   */
  const setAsRingtone = useCallback(async (id: string): Promise<{ ok: boolean; message: string }> => {
    const t = tracks.find((x) => x.id === id);
    if (!t) return { ok: false, message: "Track not found." };
    try {
      if (navigator.share && t.source === "local") {
        const res = await fetch(t.src);
        const blob = await res.blob();
        const file = new File([blob], `${t.title}.mp3`, { type: blob.type || "audio/mpeg" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: t.title, text: `Set "${t.title}" as your ringtone` });
          return { ok: true, message: "Choose “Set as ringtone” from the share sheet." };
        }
      }
      const a = document.createElement("a");
      a.href = t.src;
      a.download = `${t.title}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return { ok: true, message: "Downloaded — set it as your ringtone from Settings ▸ Sound." };
    } catch {
      return { ok: false, message: "Couldn't prepare this track for ringtone use." };
    }
  }, [tracks]);

  const addLocalVideos = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const vs = Array.from(files).filter((f) => f.type.startsWith("video"));
    setLocalVideos((prev) => {
      const base = vs.map((f, i) => ({
        id: `v-${Date.now()}-${i}`, title: parseName(f.name).title,
        src: URL.createObjectURL(f), cover: svgCover(parseName(f.name).title, prev.length + i), size: f.size,
      }));
      // Smart split: probe each file's aspect ratio — vertical 9:16 becomes a reel,
      // anything wider/unknown stays a normal video.
      vs.forEach((f, i) => {
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.muted = true;
        const url = URL.createObjectURL(f);
        probe.src = url;
        probe.onloadedmetadata = () => {
          const portrait = probe.videoHeight > 0 && probe.videoWidth > 0 && probe.videoHeight / probe.videoWidth >= 1.35;
          setLocalVideos((cur) => cur.map((v) => (v.id === base[i].id ? { ...v, kind: portrait ? "reel" : "video" } : v)));
          URL.revokeObjectURL(url);
        };
        probe.onerror = () => URL.revokeObjectURL(url);
      });
      return [...prev, ...base];
    });
  }, []);
  const addDesktopVideos = useCallback((videos: VideoItem[]) => {
    if (!videos.length) return;
    setLocalVideos((prev) => {
      const existing = new Set(prev.map((v) => v.src));
      const fresh = videos.filter((v) => !existing.has(v.src));
      if (!fresh.length) return prev;

      // Smart probe aspect ratio for desktop videos:
      // Landscape (16:9) -> kind: "video" (stays in Course Player)
      // Portrait (9:16)  -> kind: "reel"  (goes to Reels)
      fresh.forEach((vid) => {
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.muted = true;
        probe.src = vid.src;
        probe.onloadedmetadata = () => {
          const isPortrait = probe.videoHeight > 0 && probe.videoWidth > 0 && (probe.videoHeight / probe.videoWidth) >= 1.2;
          setLocalVideos((cur) =>
            cur.map((v) => (v.id === vid.id ? { ...v, kind: isPortrait ? "reel" : "video" } : v))
          );
        };
      });

      return [...prev, ...fresh];
    });
  }, []);
  const clearVideos = useCallback(() => setLocalVideos([]), []);

  /* ── playlists ── */
  const createPlaylist = useCallback((name: string) => setPlaylists((p) => {
    const next = [...p, { id: `pl-${Date.now()}`, name, cover: "", trackIds: [], createdAt: Date.now() }];
    unlock("first_playlist");
    if (next.length >= 5) unlock("five_playlists");
    return next;
  }), [unlock]);
  const renamePlaylist = useCallback((id: string, name: string) => setPlaylists((p) => p.map((x) => (x.id === id ? { ...x, name } : x))), []);
  const deletePlaylist = useCallback((id: string) => setPlaylists((p) => p.filter((x) => x.id !== id)), []);
  const addToPlaylist = useCallback((plId: string, trackId: string) => setPlaylists((p) => p.map((x) => (x.id === plId ? { ...x, trackIds: x.trackIds.includes(trackId) ? x.trackIds : [...x.trackIds, trackId] } : x))), []);
  const removeFromPlaylist = useCallback((plId: string, trackId: string) => setPlaylists((p) => p.map((x) => (x.id === plId ? { ...x, trackIds: x.trackIds.filter((t) => t !== trackId) } : x))), []);

  /* ── recording ── */
  const startRecording = useCallback(() => {
    const a = audioRef.current as (HTMLAudioElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }) | null;
    if (!a || isRecording) return;
    try {
      const stream = a.captureStream?.() || a.mozCaptureStream?.() || null;
      if (!stream) { setError("Recording isn't supported here."); return; }
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordings((r) => [{ id: `rec-${Date.now()}`, url: URL.createObjectURL(blob), name: current?.title ? `Clip · ${current.title}` : "Recording", date: Date.now(), seconds: recordSeconds }, ...r]);
        setRecordSeconds(0);
      };
      mr.start(); recorderRef.current = mr; setIsRecording(true); setRecordSeconds(0);
      recTimerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch { setError("Couldn't start recording."); }
  }, [isRecording, current, recordSeconds]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    if (recTimerRef.current) { window.clearInterval(recTimerRef.current); recTimerRef.current = null; }
    setIsRecording(false);
  }, []);
  const deleteRecording = useCallback((id: string) => setRecordings((r) => r.filter((x) => x.id !== id)), []);

  /* ── reels organization ── */
  const createReelCategory = useCallback((name: string) => {
    setReelCategories((p) => [...p, { id: `rc-${Date.now()}`, name, createdAt: Date.now() }]);
  }, []);
  const renameReelCategory = useCallback((id: string, name: string) => {
    setReelCategories((p) => p.map((x) => (x.id === id ? { ...x, name } : x)));
  }, []);
  const deleteReelCategory = useCallback((id: string) => {
    setReelCategories((p) => p.filter((x) => x.id !== id));
    setReelAssignments((p) => {
      const n = { ...p };
      Object.keys(n).forEach((k) => { if (n[k] === id) delete n[k]; });
      return n;
    });
  }, []);

  const setReelCategoryAssignment = useCallback((videoId: string, catId: string | null) => {
    setReelAssignments((p) => {
      const n = { ...p };
      if (catId == null) delete n[videoId];
      else n[videoId] = catId;
      return n;
    });
  }, []);
  const getReelCategoryId = useCallback((videoId: string) => reelAssignments[videoId] ?? null, [reelAssignments]);

  const createReelPlaylist = useCallback((name: string) => {
    setReelPlaylists((p) => [...p, { id: `rp-${Date.now()}`, name, createdAt: Date.now(), videoIds: [] }]);
  }, []);
  const renameReelPlaylist = useCallback((id: string, name: string) => {
    setReelPlaylists((p) => p.map((x) => (x.id === id ? { ...x, name } : x)));
  }, []);
  const deleteReelPlaylist = useCallback((id: string) => {
    setReelPlaylists((p) => p.filter((x) => x.id !== id));
  }, []);
  const addToReelPlaylist = useCallback((plId: string, videoId: string) => {
    setReelPlaylists((p) => p.map((x) => (x.id === plId ? { ...x, videoIds: x.videoIds.includes(videoId) ? x.videoIds : [...x.videoIds, videoId] } : x)));
  }, []);
  const removeFromReelPlaylist = useCallback((plId: string, videoId: string) => {
    setReelPlaylists((p) => p.map((x) => (x.id === plId ? { ...x, videoIds: x.videoIds.filter((v) => v !== videoId) } : x)));
  }, []);

  const toggleReelTag = useCallback((videoId: string, tag: string) => {
    setReelTags((p) => {
      const cur = p[videoId] ?? [];
      return { ...p, [videoId]: cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag] };
    });
  }, []);
  const getReelTags = useCallback((videoId: string) => reelTags[videoId] ?? [], [reelTags]);

  const toggleStudyReel = useCallback((videoId: string) => {
    setStudyReels((p) => (p.includes(videoId) ? p.filter((x) => x !== videoId) : [...p, videoId]));
  }, []);
  const isStudyReel = useCallback((videoId: string) => studyReels.includes(videoId), [studyReels]);

  /* ── Admin content ── */
  useEffect(() => {
    fetchPublishedSongs().then((fetched) => {
      if (fetched.length) {
        setAdminTracks((prev) => {
          const ids = new Set(prev.map((x) => x.id));
          const newItems = (fetched as Track[]).filter((x) => !ids.has(x.id));
          return [...newItems, ...prev];
        });
      }
    });
  }, []);

  const addAdminTrack = useCallback((t: { title: string; artist: string; cover: string; src: string; tags?: string[] }) => {
    const newTrack: Track = {
      id: `adm-${Date.now()}`,
      title: t.title,
      artist: t.artist,
      cover: t.cover || svgCover(t.title, 0),
      src: t.src,
      songs: 1,
      source: "online",
      tags: [...(t.tags ?? []), "admin", "new"],
    };
    setAdminTracks((prev) => [newTrack, ...prev]);
    saveSongToFirestore(newTrack);
  }, []);
  const removeAdminTrack = useCallback((id: string) => setAdminTracks((p) => p.filter((x) => x.id !== id)), []);
  const isAdmin = isAdminEmail(profile.email);
  // Admin reels live in the same video feed as device reels (kind "reel").
  const adminVideos = useMemo(() => localVideos.filter((v) => v.id.startsWith("admr-")), [localVideos]);
  const addAdminReel = useCallback((r: { title: string; src: string }) => {
    setLocalVideos((prev) => [
      { id: `admr-${Date.now()}`, title: r.title, src: r.src, cover: svgCover(r.title, prev.length), size: 0, kind: "reel" },
      ...prev,
    ]);
  }, []);
  const removeAdminReel = useCallback((id: string) => setLocalVideos((p) => p.filter((v) => v.id !== id)), []);

  const addToQueue = useCallback((ids: string | string[]) => {
    const list = Array.isArray(ids) ? ids : [ids];
    setQueueIds((q) => [...q, ...list.filter((id) => !q.includes(id))]);
  }, []);

  const playNext = useCallback((ids: string | string[]) => {
    const list = Array.isArray(ids) ? ids : [ids];
    setQueueIds((q) => {
      const filtered = q.filter((id) => !list.includes(id));
      const curIdx = currentId ? filtered.indexOf(currentId) : -1;
      if (curIdx >= 0) {
        filtered.splice(curIdx + 1, 0, ...list);
        return filtered;
      }
      return [...list, ...filtered];
    });
  }, [currentId]);

  const deleteTracks = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setLocalTracks((prev) => prev.filter((t) => !set.has(t.id)));
    setQueueIds((prev) => prev.filter((id) => !set.has(id)));
  }, []);

  const value: Ctx = {
    tracks, localTracks, current, isPlaying, progress, duration, shuffle, repeat, liked,
    loadingSrc, error, volume, crossfade, fadeMs, speed, scanning,
    recentlyPlayed, playCounts, addedAt,
    playTrack, playExternal, toggle, next: () => step(1), prev: () => step(-1), seek, seekBy,
    queueIds, setQueue: setQueueIds, addToQueue, playNext, deleteTracks, resetQueue, moveInQueue, removeFromQueue,
    setShuffle, setRepeat, toggleLike, addLocalFiles, clearLocal, scanNativeLibrary, scanNativeVideos, scanDesktopLibrary, updateLocalTrack, addLocalTrack, deleteLocalTrack, setAsRingtone,
    blacklistedIds, toggleBlacklist,
    localVideos, addLocalVideos, addDesktopVideos, clearVideos, adminVideos, addAdminReel, removeAdminReel,
    reelCategories, createReelCategory, renameReelCategory, deleteReelCategory,
    setReelCategoryAssignment, getReelCategoryId,
    reelPlaylists, createReelPlaylist, renameReelPlaylist, deleteReelPlaylist,
    addToReelPlaylist, removeFromReelPlaylist,
    toggleReelTag, getReelTags,
    toggleStudyReel, isStudyReel,
    setVolume: setVolumeState, setCrossfade, setFadeMs, setSpeed: setSpeedState, holdSpeed, setHoldSpeed,
    replayGain, setReplayGain: setReplayGainState,
    smartQueue, setSmartQueue: setSmartQueueState,
    theme, setTheme: (t) => {
      setThemeState((c) => {
        const next = { ...c, ...t };
        if (t.name && !triedThemes.includes(t.name)) {
          const updated = [...triedThemes, t.name];
          setTriedThemes(updated);
          if (updated.length >= 3) unlock("theme_switcher");
        }
        return next;
      });
    },
    equalizer, setEqualizer: setEqualizerState,
    analytics, resetAnalytics: () => { setAnalytics({ totalListens: 0, totalMinutes: 0, topTracks: [], byDay: emptyWeek(), streak: 0 }); setRecentlyPlayed([]); setPlayCounts({}); },
    radioTab, setRadioTab: setRadioTabState,
    profile, setProfile: (p) => setProfileState((c) => ({ ...c, ...p })),
    loggedIn, login: (p) => { setProfileState((c) => ({ ...c, ...p })); setLoggedIn(true); }, logout: () => setLoggedIn(false),
    geminiKey, setGeminiKey: setGeminiKeyState, translateLang, setTranslateLang: setTranslateLangState,
    playlists, createPlaylist, renamePlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist,
    driveMode, setDriveMode: setDriveModeState,
    sleepTimer, setSleepTimer: setSleepTimerState, sleepRemaining,
    showLyrics, setShowLyrics: setShowLyricsState,
    reverb, setReverb: setReverbState, bassBoost, setBassBoost: setBassBoostState,
    isRecording, recordSeconds, recordings, startRecording, stopRecording, deleteRecording,
    reelLoops, setReelLoops: setReelLoopsState,
    reelAutoScroll, setReelAutoScroll: setReelAutoScrollState,
    gesturesOn, setGesturesOn: setGesturesOnState,
    hapticsOn, setHapticsOn: setHapticsOnState,
    notifyOn, setNotifyOn: setNotifyOnState,
    spectrum: () => engine.getSpectrum(28),
    buzz,
    aiGroqKey, setAiGroqKey: setAiGroqKeyState,
    aiGroqModel, setAiGroqModel: setAiGroqModelState,
    aiOrKey, setAiOrKey: setAiOrKeyState,
    aiOrModel, setAiOrModel: setAiOrModelState,
    aiOllamaKey, setAiOllamaKey: setAiOllamaKeyState,
    aiOllamaModel, setAiOllamaModel: setAiOllamaModelState,
    aiHfKey, setAiHfKey: setAiHfKeyState,
    aiHfModel, setAiHfModel: setAiHfModelState,
    adminTracks, addAdminTrack, removeAdminTrack, isAdmin,
    aiOfflineOnly, setAiOfflineOnly: setAiOfflineOnlyState,
    aiMessages, addAiMessage, clearAiMessages,
    stopAt, setStopAt, stopAtRemaining,
    floatingAi, setFloatingAi: setFloatingAiState,
    vizStyle, setVizStyle: setVizStyleState,
    artShape, setArtShape: setArtShapeState,
    savedStations, toggleSavedStation, isStationSaved, setStationMood,
    likedOnline, toggleLikedOnline, isOnlineLiked,
    achievements: ACHIEVEMENTS,
    unlockedIds,
    achievementToast,
    customLyrics, setTrackLyrics,
    getAudioElement: () => audioRef.current,
    dismissAchievementToast,
    progressFor: (id: string) => {
      switch (id) {
        case "first_play":
        case "ten_plays":
        case "hundred_plays": return Object.values(playCounts).reduce((s, n) => s + n, 0);
        case "one_hour":
        case "ten_hours": return analytics.totalMinutes;
        case "first_like":
        case "ten_likes": return liked.length;
        case "first_playlist":
        case "five_playlists": return playlists.length;
        case "first_scan": return localTracks.length;
        case "first_saved_station": return savedStations.length;
        case "streak_3":
        case "streak_7": return analytics.streak;
        case "theme_switcher": return triedThemes.length;
        case "first_ai_chat": return aiChatCount;
        case "first_radio":
        case "first_archive":
        case "night_owl": return unlockedIds.includes(id) ? 1 : 0;
        default: return 0;
      }
    },
  };

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

export function usePlayer() { const c = useContext(PlayerCtx); if (!c) throw new Error("no player ctx"); return c; }
export function fmt(s: number) { if (!isFinite(s) || s < 0) s = 0; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, "0")}`; }

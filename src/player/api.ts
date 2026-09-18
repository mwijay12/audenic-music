// ─── Radio-Browser community API (45k+ free stations) ───
// Docs: https://www.radio-browser.info/
// ─── Internet Archive (millions of free audio items) ───
// Docs: https://archive.org/advancedsearch.php  +  https://archive.org/metadata/{id}

export type Station = {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage?: string;
  favicon?: string;
  country: string;
  language: string;
  tags: string;
  votes: number;
  codec: string;
  bitrate: number;
};

const MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://de2.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
];

const TAGS = [
  { id: "pop", label: "Pop hits", q: "pop" },
  { id: "rock", label: "Rock", q: "rock" },
  { id: "jazz", label: "Jazz", q: "jazz" },
  { id: "lofi", label: "Lo-fi / chill", q: "lofi" },
  { id: "electronic", label: "Electronic", q: "electronic" },
  { id: "classical", label: "Classical", q: "classical" },
  { id: "hiphop", label: "Hip-hop", q: "hiphop" },
  { id: "news", label: "News & talk", q: "news" },
  { id: "ambient", label: "Ambient", q: "ambient" },
  { id: "country", label: "Country", q: "country" },
  { id: "metal", label: "Metal", q: "metal" },
  { id: "dance", label: "Dance", q: "dance" },
  { id: "reggae", label: "Reggae", q: "reggae" },
  { id: "soul", label: "Soul", q: "soul" },
  { id: "blues", label: "Blues", q: "blues" },
  { id: "funk", label: "Funk", q: "funk" },
];
export { TAGS };

const FALLBACK: Station[] = Array.from({ length: 40 }, (_, i) => ({
  stationuuid: `f-${i}`,
  name: `${["Aurora Lo-fi", "Neon Tokyo", "Lush FM", "Velvet Soul", "Static Bloom", "Echo Chamber", "Polar Lights", "Cassette Heart"][i % 8]} ${i + 1}`,
  url: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(i % 16) + 1}.mp3`,
  url_resolved: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(i % 16) + 1}.mp3`,
  country: "Online",
  language: "english",
  tags: ["pop", "rock", "jazz", "electronic", "lofi", "ambient"][i % 6],
  votes: 1500 - i * 10,
  codec: "MP3",
  bitrate: 128,
}));

const cache: Record<string, Station[]> = {};

async function tryMirrors(path: string): Promise<Station[] | null> {
  for (const m of MIRRORS) {
    try {
      const r = await fetch(m + path, { headers: { "User-Agent": "AuroraMusic/1.3" } });
      if (!r.ok) continue;
      const d = (await r.json()) as Station[];
      if (Array.isArray(d) && d.length) return d;
    } catch {
      /* next mirror */
    }
  }
  return null;
}

export async function fetchStations(tagId: string): Promise<Station[]> {
  if (cache[tagId]) return cache[tagId];
  const tag = TAGS.find((t) => t.id === tagId) || TAGS[0];
  // pull up to 1500 stations per genre so the catalog is genuinely huge
  const d = await tryMirrors(
    `/json/stations/search?tag=${encodeURIComponent(tag.q)}&hidebroken=true&order=votes&reverse=true&limit=1500`
  );
  const live = (d || []).filter((s) => s.url_resolved);
  if (!live.length) return FALLBACK;
  cache[tagId] = live;
  return live;
}

export async function fetchSearch(q: string): Promise<Station[]> {
  if (!q.trim()) return [];
  const d = await tryMirrors(
    `/json/stations/search?name=${encodeURIComponent(q)}&hidebroken=true&order=votes&reverse=true&limit=200`
  );
  const live = (d || []).filter((s) => s.url_resolved);
  return live.length ? live : FALLBACK.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
}

/* ───────────── Internet Archive online music ───────────── */

export type ArchiveItem = {
  identifier: string;
  title: string;
  creator: string;
  cover: string;
};

const IA_GENRES = [
  { id: "78rpm", label: "Vintage 78s", q: 'collection:(georgeblood) AND mediatype:audio' },
  { id: "netlabels", label: "Netlabels", q: 'collection:(netlabels) AND mediatype:audio' },
  { id: "live", label: "Live sets", q: 'collection:(etree) AND mediatype:audio' },
  { id: "chip", label: "Chiptune", q: 'subject:(chiptune) AND mediatype:audio' },
  { id: "jazz", label: "Jazz", q: 'subject:(jazz) AND mediatype:audio' },
  { id: "classical", label: "Classical", q: 'subject:(classical) AND mediatype:audio' },
  { id: "electronic", label: "Electronic", q: 'subject:(electronic) AND mediatype:audio' },
  { id: "rock", label: "Rock", q: 'subject:(rock) AND mediatype:audio' },
];
export { IA_GENRES };

const iaCache: Record<string, ArchiveItem[]> = {};

function cleanCreator(c: unknown): string {
  if (Array.isArray(c)) return String(c[0] || "Unknown Artist");
  return c ? String(c) : "Various Artists";
}

export async function fetchArchive(genreId: string): Promise<ArchiveItem[]> {
  if (iaCache[genreId]) return iaCache[genreId];
  const g = IA_GENRES.find((x) => x.id === genreId) || IA_GENRES[0];
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(g.q)}&fl[]=identifier&fl[]=title&fl[]=creator&sort[]=downloads+desc&rows=80&output=json`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("net");
    const data = await r.json();
    const docs = data?.response?.docs || [];
    const items: ArchiveItem[] = docs
      .filter((d: { identifier?: string; title?: string }) => d.identifier && d.title)
      .map((d: { identifier: string; title: string; creator?: unknown }) => ({
        identifier: d.identifier,
        title: String(d.title).slice(0, 80),
        creator: cleanCreator(d.creator),
        cover: `https://archive.org/services/img/${d.identifier}`,
      }));
    if (items.length) iaCache[genreId] = items;
    return items;
  } catch {
    return [];
  }
}

export async function searchArchive(q: string): Promise<ArchiveItem[]> {
  if (!q.trim()) return [];
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(`(${q}) AND mediatype:audio`)}&fl[]=identifier&fl[]=title&fl[]=creator&sort[]=downloads+desc&rows=60&output=json`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("net");
    const data = await r.json();
    const docs = data?.response?.docs || [];
    return docs
      .filter((d: { identifier?: string; title?: string }) => d.identifier && d.title)
      .map((d: { identifier: string; title: string; creator?: unknown }) => ({
        identifier: d.identifier,
        title: String(d.title).slice(0, 80),
        creator: cleanCreator(d.creator),
        cover: `https://archive.org/services/img/${d.identifier}`,
      }));
  } catch {
    return [];
  }
}

const ART_PALETTES = [
  ["#8B5CF6", "#EC4899", "#3B82F6"], // Neon Violet / Pink
  ["#10B981", "#06B6D4", "#3B82F6"], // Emerald Cyan
  ["#F59E0B", "#EF4444", "#8B5CF6"], // Sunset Ember
  ["#6366F1", "#A855F7", "#EC4899"], // Twilight Purple
  ["#14B8A6", "#3B82F6", "#6366F1"], // Oceanic Teal
  ["#F43F5E", "#FB923C", "#FBBF24"], // Sunrise Glow
  ["#0ea5e9", "#22c55e", "#a855f7"], // Cyber Wave
];

export function generateArchiveArtwork(
  title: string,
  creator: string,
  index: number,
  accent = "#C8F249"
): string {
  const cleanTitle = (title || "Track").trim();
  const cleanCreator = (creator || "Audenic").trim();
  let hash = 0;
  for (let k = 0; k < cleanTitle.length; k++) {
    hash = (hash * 31 + cleanTitle.charCodeAt(k)) >>> 0;
  }
  const palette = ART_PALETTES[(hash + index) % ART_PALETTES.length];
  const c1 = palette[0];
  const c2 = palette[1];
  const c3 = palette[2];
  const initial = (cleanTitle[0] || "♪").toUpperCase();
  const artistShort = cleanCreator.length > 20 ? cleanCreator.slice(0, 18) + "…" : cleanCreator;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="50%" stop-color="${c2}"/>
        <stop offset="100%" stop-color="${c3}"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.6"/>
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>
    <rect width="360" height="360" rx="44" fill="url(#grad)"/>
    <rect width="360" height="360" rx="44" fill="url(#glow)" style="mix-blend-mode: overlay;"/>
    <circle cx="180" cy="180" r="142" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
    <circle cx="180" cy="180" r="112" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <circle cx="180" cy="180" r="82" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
    <circle cx="180" cy="180" r="52" fill="rgba(12,12,18,0.85)" filter="url(#shadow)"/>
    <circle cx="180" cy="180" r="16" fill="${accent}"/>
    <text x="180" y="145" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="-2" opacity="0.95">${initial}</text>
    <rect x="36" y="276" width="288" height="48" rx="14" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.1)"/>
    <text x="180" y="306" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="0.4">${artistShort.toUpperCase()}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Archive thumbnails are frequently missing, tiny, or a generic placeholder.
 * Probe the item's real artwork (jpg/png in the file list) and fall back to
 * the generated custom artwork.
 */
const coverCache = new Map<string, string | null>();
export async function resolveArchiveCover(identifier: string): Promise<string | null> {
  if (coverCache.has(identifier)) return coverCache.get(identifier)!;
  try {
    const r = await fetch(`https://archive.org/metadata/${identifier}`);
    if (!r.ok) throw new Error("net");
    const data = await r.json();
    const files: { name: string; format?: string; size?: string }[] = data?.files || [];
    // Reject generic waveforms, thumbs, and spectrograms
    const art = files
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name) && !/thumb|__ia|_spine|itemimage|wave|waveform|spectrogram/i.test(f.name))
      .sort((a, b) => Number(b.size || 0) - Number(a.size || 0))[0];
    const url = art ? `https://archive.org/download/${identifier}/${encodeURIComponent(art.name)}` : null;
    coverCache.set(identifier, url);
    return url;
  } catch {
    coverCache.set(identifier, null);
    return null;
  }
}

/** Direct download URL for an archive item's first audio file. */
export async function resolveArchiveDownload(identifier: string): Promise<{ url: string; filename: string } | null> {
  try {
    const r = await fetch(`https://archive.org/metadata/${identifier}`);
    if (!r.ok) throw new Error("net");
    const data = await r.json();
    const files: { name: string; format?: string }[] = data?.files || [];
    const audio =
      files.find((f) => /\.mp3$/i.test(f.name) && (f.format?.includes("MP3") ?? true)) ||
      files.find((f) => /\.(mp3|ogg|m4a|flac)$/i.test(f.name));
    if (!audio) return null;
    return {
      url: `https://archive.org/download/${identifier}/${encodeURIComponent(audio.name)}`,
      filename: audio.name,
    };
  } catch {
    return null;
  }
}

// Resolve the first playable MP3 stream URL for an archive item
export async function resolveArchiveStream(identifier: string): Promise<string | null> {
  try {
    const r = await fetch(`https://archive.org/metadata/${identifier}`);
    if (!r.ok) throw new Error("net");
    const data = await r.json();
    const files: { name: string; format?: string }[] = data?.files || [];
    const mp3 = files.find((f) => /\.mp3$/i.test(f.name) && (f.format?.includes("MP3") ?? true))
      || files.find((f) => /\.(mp3|ogg|m4a)$/i.test(f.name));
    if (!mp3) return null;
    return `https://archive.org/download/${identifier}/${encodeURIComponent(mp3.name)}`;
  } catch {
    return null;
  }
}

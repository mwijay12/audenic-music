import { useEffect, useMemo, useRef, useState } from "react";
import { fetchSearch, fetchStations, type Station, TAGS, fetchArchive, searchArchive, resolveArchiveStream, resolveArchiveCover, resolveArchiveDownload, generateArchiveArtwork, type ArchiveItem, IA_GENRES } from "../player/api";
import { usePlayer, svgCover, fmt, MOODS, type SavedStation } from "../player/PlayerContext";
import { Chip, IconButton, StatusBar } from "../components/Shell";
import { Pause, Play, Search, Record, Stop, Music, Compass, Download, Heart, Dots, Shuffle } from "../components/Icons";
import { isNative, nativeDownload } from "../player/nativeBridge";

/**
 * Premium custom artwork for Internet Archive items:
 * Renders custom vinyl/studio artwork immediately, then upgrades to high-resolution
 * original album art if uploaded to the Archive item metadata.
 */
function SmartCover({ item, index, accent, className = "h-12 w-12 rounded-xl" }: { item: ArchiveItem; index: number; accent: string; className?: string }) {
  const customArtwork = useMemo(() => generateArchiveArtwork(item.title, item.creator, index, accent), [item.title, item.creator, index, accent]);
  const [src, setSrc] = useState(customArtwork);

  useEffect(() => {
    let active = true;
    resolveArchiveCover(item.identifier).then((real) => {
      if (active && real) setSrc(real);
    });
    return () => { active = false; };
  }, [item.identifier]);

  return (
    <img
      src={src}
      onError={() => setSrc(customArtwork)}
      loading="lazy"
      className={`shrink-0 bg-black/40 object-cover ${className} transition-opacity duration-200`}
      alt={item.title}
    />
  );
}

type Mode = "music" | "radio";

/** Curated hero rails for the radio tab, styled like the Home "Curated" cards. */
const RADIO_RAILS = [
  { id: "news", label: "News & Talk", sub: "Stay in the loop, worldwide", from: "#C8F249", to: "#7FB8FF", emoji: "📰" },
  { id: "lofi", label: "Lo-fi & Chill", sub: "Beats to relax and study to", from: "#5EE7CF", to: "#3B6BFF", emoji: "🌙" },
  { id: "dance", label: "Dance Floor", sub: "Amapiano, house and afrobeats", from: "#FF7A5C", to: "#FF5DA2", emoji: "🔥" },
  { id: "jazz", label: "Late Night Jazz", sub: "Smooth, warm and timeless", from: "#B17BFF", to: "#6C3CE9", emoji: "🎷" },
];

const MUSIC_RAILS = [
  { id: IA_GENRES[0]?.id ?? "78rpm", label: "Vintage Vault", sub: "Restored 78rpm classics", from: "#FFD24C", to: "#FF8C42", emoji: "📻" },
  { id: IA_GENRES[1]?.id ?? "netlabels", label: "Netlabel Gems", sub: "Free, legal, independent", from: "#C8F249", to: "#4CA37B", emoji: "💿" },
  { id: IA_GENRES[2]?.id ?? "live", label: "Live Sets", sub: "Concerts straight from the crowd", from: "#FF5DCF", to: "#7B3BFF", emoji: "🎤" },
];

export default function ExploreScreen({ onOpenSong, onOpenArtist }: { onOpenSong: (id: string) => void; onOpenArtist: (n: string) => void }) {
  const {
    playExternal, current, isPlaying, theme, radioTab, setRadioTab,
    isRecording, recordSeconds, startRecording, stopRecording, recordings,
    savedStations, toggleSavedStation, isStationSaved, setStationMood, buzz,
    likedOnline, toggleLikedOnline, isOnlineLiked,
  } = usePlayer();
  const [mode, setMode] = useState<Mode>("music");
  const [seed, setSeed] = useState(1);
  const [stations, setStations] = useState<Station[]>([]);
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [iaGenre, setIaGenre] = useState(IA_GENRES[0].id);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [moodPickerFor, setMoodPickerFor] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "radio" || q.trim() || radioTab === "favorites") return;
    let abort = false; setLoading(true);
    fetchStations(radioTab).then(d => { if (!abort) { setStations(d); setLoading(false); } });
    return () => { abort = true; };
  }, [radioTab, mode]);

  useEffect(() => {
    setSeed((s) => s + 1); // fresh shuffle every genre visit
    if (mode !== "music" || q.trim()) return;
    let abort = false; setLoading(true);
    fetchArchive(iaGenre).then(d => { if (!abort) { setItems(d); setLoading(false); } });
    return () => { abort = true; };
  }, [iaGenre, mode]);

  useEffect(() => {
    if (!q.trim()) return;
    let abort = false; setLoading(true);
    const t = window.setTimeout(() => {
      if (mode === "radio") fetchSearch(q).then(d => { if (!abort) { setStations(d); setLoading(false); } });
      else searchArchive(q).then(d => { if (!abort) { setItems(d); setLoading(false); } });
    }, 400);
    return () => { abort = true; window.clearTimeout(t); };
  }, [q, mode]);

  const stationToSaved = (s: Station): SavedStation => ({
    id: s.stationuuid, name: s.name, url: s.url_resolved,
    cover: s.favicon?.startsWith("http") ? s.favicon : svgCover(s.name, 0, theme.accent),
    country: s.country, tags: s.tags,
  });

  const playStation = (s: Station) => {
    const cover = s.favicon?.startsWith("http") ? s.favicon : svgCover(s.name, 0, theme.accent);
    playExternal({ id: s.stationuuid, title: s.name, artist: s.country || "Live radio", cover, src: s.url_resolved, songs: 1, source: "online", tags: s.tags ? s.tags.split(",") : ["radio"], lyrics: ["🔴 Live broadcast", s.name, s.tags ? s.tags.split(",").slice(0, 3).join(" • ") : "streaming now"] });
  };

  const playSaved = (s: SavedStation) => {
    playExternal({ id: s.id, title: s.name, artist: s.country || "Live radio", cover: s.cover, src: s.url, songs: 1, source: "online", tags: ["radio"], lyrics: ["🔴 Live broadcast", s.name] });
  };

  const playArchive = async (it: ArchiveItem) => {
    setResolving(it.identifier);
    const [url, realCover] = await Promise.all([
      resolveArchiveStream(it.identifier),
      resolveArchiveCover(it.identifier),
    ]);
    setResolving(null);
    if (!url) return;
    const cover = realCover || it.cover || svgCover(it.title, 0, theme.accent);
    playExternal({ id: it.identifier, title: it.title, artist: it.creator, cover, src: url, songs: 1, source: "online", tags: ["archive"], lyrics: ["🌐 Internet Archive", it.title, `by ${it.creator}`] });
  };

  const downloadArchive = async (it: ArchiveItem) => {
    setDownloading(it.identifier);
    try {
      const res = await resolveArchiveDownload(it.identifier);
      if (!res) { setToast("No downloadable file for this track."); return; }
      if (isNative()) {
        const native = await nativeDownload(res.url, res.filename, "audio/mpeg");
        if (native.ok) { setToast(`Downloading "${it.title}" in Android…`); return; }
      }
      const a = document.createElement("a");
      a.href = res.url; a.download = res.filename; a.target = "_blank"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setToast(`Downloading "${it.title}"…`);
    } catch { setToast("Download failed."); }
    finally { setDownloading(null); window.setTimeout(() => setToast(null), 2400); }
  };

  const favourites = useMemo(
    () => (moodFilter ? savedStations.filter((s) => s.mood === moodFilter) : savedStations),
    [savedStations, moodFilter]
  );

  // Fresh order every visit /   const favMusicRef = useRef<HTMLDivElement>(null);
  const favRadioRef = useRef<HTMLDivElement>(null);

  const rails = useMemo(() => {
    if (mode === "radio") {
      return [
        {
          id: "fav-radios-card",
          special: "fav-radios",
          label: "Favorite Radios",
          sub: savedStations.length > 0 ? `${savedStations.length} saved station${savedStations.length === 1 ? "" : "s"}` : "Saved live stations",
          from: "#FF5EA8",
          to: "#FF835C",
          emoji: "❤️",
        },
        ...RADIO_RAILS,
      ];
    }
    return [
      {
        id: "fav-music-card",
        special: "fav-music",
        label: "Liked Online Music",
        sub: likedOnline.length > 0 ? `${likedOnline.length} liked track${likedOnline.length === 1 ? "" : "s"}` : "Saved online tracks",
        from: "#FF4B8B",
        to: "#9E4BFF",
        emoji: "💖",
      },
      ...MUSIC_RAILS,
    ];
  }, [mode, savedStations.length, likedOnline.length]);

  const displayItems = useMemo(() => {
    const arr = [...items];
    let s = seed;
    for (let i = arr.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) % 2147483648;
      const j = s % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [items, seed]);

  const likeOnline = (it: ArchiveItem, cover: string, src: string) => {
    toggleLikedOnline({ id: it.identifier, title: it.title, artist: it.creator, cover, src });
    buzz(14);
  };

  const displayRadioStations = useMemo(() => {
    if (mode === "radio" && radioTab === "favorites") {
      return savedStations.map((s) => ({
        stationuuid: s.id,
        name: s.name,
        url: s.url,
        url_resolved: s.url,
        homepage: "",
        favicon: s.cover,
        country: s.country || "Saved radio",
        language: "",
        tags: s.tags || "favorite",
        votes: 999,
        codec: "LIVE",
        bitrate: 128,
      }));
    }
    return stations;
  }, [mode, radioTab, savedStations, stations]);

  const showRails = !q.trim();

  return (
    <div className="fade-in flex h-full flex-col">
      <StatusBar />
      <div className="flex items-center justify-between px-6 pt-2">
        <div className="flex items-center gap-2"><Compass size={22} className="text-[var(--accent)]" /><p className="text-[24px] font-bold text-white">Explore</p></div>
        <div className="flex items-center gap-2">
          {isRecording ? (
            <button onClick={stopRecording} className="flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-2 text-[11px] font-bold text-white active:scale-95"><Stop size={12} /> {fmt(recordSeconds)}</button>
          ) : (
            <button onClick={startRecording} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-rose-400 transition hover:bg-white/20 active:scale-90" title="Record"><Record size={16} /></button>
          )}
          <IconButton onClick={() => setSearching(s => !s)} active={searching} label="Search"><Search size={18} /></IconButton>
        </div>
      </div>

      {/* mode switch */}
      <div className="mx-6 mt-3 flex rounded-full bg-white/[0.06] p-1">
        {(["music", "radio"] as Mode[]).map(m => (
          <button key={m} onClick={() => { setMode(m); setQ(""); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12.5px] font-semibold transition ${mode === m ? "bg-[var(--accent)] text-black" : "text-white/55"}`}>
            {m === "music" ? <Music size={13} /> : "📡"} {m === "music" ? "Online Music" : "Radio"}
          </button>
        ))}
      </div>

      {searching && (
        <div className="px-6 pt-3">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={mode === "radio" ? "Search stations worldwide" : "Search millions of free tracks"} className="w-full rounded-full border border-white/15 bg-black/40 px-4 py-2.5 text-[13px] text-white outline-none placeholder:text-white/40 focus:border-[var(--accent)]" />
        </div>
      )}

      {toast && <div className="pop-in mx-6 mt-2 rounded-xl bg-white/10 px-3 py-2 text-center text-[11.5px] text-white/85 backdrop-blur">{toast}</div>}

      <div className="no-scrollbar smooth-scroll flex-1 overflow-y-auto" style={{ paddingBottom: "calc(160px + env(safe-area-inset-bottom, 0px))" }}>
        {/* ── Hero rails ── */}
        {showRails && (
          <>
            <h2 className="px-6 pb-2 pt-4 text-[15px] font-bold text-white">{mode === "radio" ? "Radio collections" : "Curated collections"}</h2>
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-6 pb-1">
              {rails.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    buzz(12);
                    if (r.special === "fav-radios") {
                      setMode("radio");
                      setRadioTab("favorites");
                      setQ("");
                      if (savedStations.length === 0) {
                        setToast("No saved radio stations yet. Tap ❤️ on any station to save it!");
                        window.setTimeout(() => setToast(null), 3500);
                      }
                      return;
                    }
                    if (r.special === "fav-music") {
                      if (likedOnline.length === 0) {
                        setToast("No liked online tracks yet. Tap ❤️ on any track to save it!");
                        window.setTimeout(() => setToast(null), 3000);
                      } else {
                        favMusicRef.current?.scrollIntoView({ behavior: "smooth" });
                      }
                      return;
                    }
                    if (mode === "radio") setRadioTab(r.id);
                    else setIaGenre(r.id);
                  }}
                  className="press relative w-[190px] shrink-0 overflow-hidden rounded-[24px] p-4 text-left"
                  style={{ background: `linear-gradient(140deg, ${r.from}, ${r.to})` }}
                >
                  <span className="absolute -right-2 -top-2 text-[58px] opacity-25">{r.emoji}</span>
                  <p className="relative text-[15px] font-bold text-black">{r.label}</p>
                  <p className="relative mt-1 max-w-[120px] text-[10.5px] font-medium leading-snug text-black/60">{r.sub}</p>
                  <span className="relative mt-4 inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-bold text-white">
                    <Play size={10} /> Open
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Favorite Online Music collection rail ── */}
        {mode === "music" && showRails && likedOnline.length > 0 && (
          <div ref={favMusicRef}>
            <div className="flex items-end justify-between px-6 pb-2 pt-5">
              <h2 className="text-[15px] font-bold text-white">Favorite Online Music</h2>
              <span className="text-[11px] text-[var(--accent)] font-bold">{likedOnline.length} liked</span>
            </div>
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-6 pb-1">
              {likedOnline.map((t) => {
                const cur = current?.id === t.id;
                return (
                  <div key={t.id} className="relative w-[140px] shrink-0">
                    <button onClick={() => playExternal({ id: t.id, title: t.title, artist: t.artist, cover: t.cover, src: t.src, songs: 1, source: "online", tags: ["online", "liked"] })} className="press w-full">
                      <div className="relative h-[140px] w-full overflow-hidden rounded-2xl bg-white/5">
                        <img src={t.cover} alt="" className="h-full w-full object-cover" />
                        {cur && isPlaying && <div className="absolute inset-0 grid place-items-center bg-black/45 text-[var(--accent)]"><Pause size={22} /></div>}
                        <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-rose-500/80 text-white shadow"><Heart size={12} filled /></span>
                      </div>
                      <p className="clamp-1 pt-1.5 text-left text-[12px] font-semibold text-white">{t.title}</p>
                      <p className="clamp-1 text-left text-[10px] text-white/40">{t.artist}</p>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Saved radio stations with moods ── */}
        {mode === "radio" && showRails && savedStations.length > 0 && (
          <div ref={favRadioRef}>
            <div className="flex items-end justify-between px-6 pb-2 pt-5">
              <h2 className="text-[15px] font-bold text-white">My stations</h2>
              <span className="text-[11px] text-white/35">{favourites.length} saved</span>
            </div>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-6 pb-2">
              <button onClick={() => setMoodFilter(null)} className={`press shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${!moodFilter ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/55"}`}>All</button>
              {MOODS.map((mo) => (
                <button key={mo.id} onClick={() => setMoodFilter(moodFilter === mo.id ? null : mo.id)} className={`press shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${moodFilter === mo.id ? "text-black" : "bg-white/[0.07] text-white/55"}`} style={moodFilter === mo.id ? { background: mo.color } : undefined}>
                  {mo.emoji} {mo.label}
                </button>
              ))}
            </div>
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-6 pb-1">
              {favourites.map((s) => {
                const mo = MOODS.find((x) => x.id === s.mood);
                const cur = current?.id === s.id;
                return (
                  <div key={s.id} className="relative w-[140px] shrink-0">
                    <button onClick={() => playSaved(s)} className="press w-full">
                      <div className="relative h-[140px] w-full overflow-hidden rounded-2xl bg-white/5">
                        <img src={s.cover} alt="" className="h-full w-full object-cover" />
                        {cur && isPlaying && <div className="absolute inset-0 grid place-items-center bg-black/45 text-[var(--accent)]"><Pause size={22} /></div>}
                        {mo && <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9.5px] font-bold text-black" style={{ background: mo.color }}>{mo.emoji} {mo.label}</span>}
                      </div>
                      <p className="clamp-2 mt-1.5 text-left text-[12px] font-semibold leading-snug text-white">{s.name}</p>
                      <p className="clamp-1 text-left text-[10px] text-white/40">{s.country || "Live radio"}</p>
                    </button>
                    <button onClick={() => setMoodPickerFor(moodPickerFor === s.id ? null : s.id)} className="press absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                      <Dots size={14} />
                    </button>
                    {moodPickerFor === s.id && (
                      <div className="pop-in absolute right-0 top-10 z-30 w-[130px] rounded-2xl border border-white/10 bg-[#17171c] p-1.5 shadow-2xl">
                        <p className="px-2 pb-1 text-[9.5px] font-bold uppercase tracking-wide text-white/35">Set mood</p>
                        {MOODS.map((x) => (
                          <button key={x.id} onClick={() => { setStationMood(s.id, x.id); setMoodPickerFor(null); buzz(12); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-white hover:bg-white/8">
                            <span>{x.emoji}</span> {x.label}
                          </button>
                        ))}
                        <button onClick={() => { toggleSavedStation({ id: s.id, name: s.name, url: s.url, cover: s.cover }); setMoodPickerFor(null); }} className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-rose-300 hover:bg-white/5">Remove</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Genre chips ── */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-6 pb-2 pt-5">
          {mode === "radio" ? (
            <>
              <Chip
                key="favorites"
                label={`❤️ Favorites (${savedStations.length})`}
                active={radioTab === "favorites"}
                onClick={() => { setRadioTab("favorites"); setQ(""); }}
              />
              {TAGS.map(t => <Chip key={t.id} label={t.label} active={radioTab === t.id} onClick={() => { setRadioTab(t.id); setQ(""); }} />)}
            </>
          ) : (
            IA_GENRES.map(g => <Chip key={g.id} label={g.label} active={iaGenre === g.id} onClick={() => { setIaGenre(g.id); setQ(""); }} />)
          )}
        </div>

        {/* recordings strip */}
        {recordings.length > 0 && (
          <div className="no-scrollbar mx-6 mb-2 flex gap-2 overflow-x-auto">
            {recordings.slice(0, 5).map(r => (
              <a key={r.id} href={r.url} download={`${r.name}.webm`} className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10.5px] text-white/70">⬇ {r.name.slice(0, 16)} · {fmt(r.seconds)}</a>
            ))}
          </div>
        )}

        <p className="px-6 pb-2 text-[11px] text-white/35">
          {mode === "radio"
            ? radioTab === "favorites"
              ? `${displayRadioStations.length} saved station${displayRadioStations.length === 1 ? "" : "s"}`
              : `${displayRadioStations.length.toLocaleString()} live stations · radio-browser`
            : `Free music · Internet Archive`}
        </p>

        {/* ── Liked online music ── */}
        {showRails && mode === "music" && likedOnline.length > 0 && (
          <>
            <h2 className="px-6 pb-2 pt-4 text-[15px] font-bold text-white">Liked online</h2>
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-6 pb-1">
              {likedOnline.map((l) => (
                <button key={l.id} onClick={async () => {
                  let src = l.src;
                  if (!src) { const r = await resolveArchiveStream(l.id); src = r || ""; }
                  if (src) playExternal({ id: l.id, title: l.title, artist: l.artist, cover: l.cover, src, songs: 1, source: "online", tags: ["archive"] });
                }} className="press w-[120px] shrink-0 text-left">
                  <div className="relative h-[120px] w-[120px] overflow-hidden rounded-2xl">
                    <img src={l.cover} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = svgCover(l.title, 2, theme.accent); }} />
                    <span className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"><Play size={11} /></span>
                  </div>
                  <p className="clamp-1 pt-1.5 text-[11.5px] font-semibold text-white">{l.title}</p>
                  <p className="clamp-1 text-[10px] text-white/40">{l.artist}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Lists ── */}
        <div className="px-6">
          {mode === "music" && (
            <div className="flex items-center justify-between pb-2">
              <p className="text-[11px] text-white/35">Free music · Internet Archive</p>
              <button onClick={() => { setSeed((s) => s + 7); buzz(10); setToast("Shuffled"); window.setTimeout(() => setToast(null), 1400); }} className="press flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-[10.5px] font-bold text-white/70">
                <Shuffle size={12} /> Shuffle
              </button>
            </div>
          )}
          {loading ? (
            <div className="space-y-2.5">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="skeleton h-[64px] rounded-2xl" />)}</div>
          ) : mode === "radio" ? (
            <div className="stagger space-y-2.5">
              {displayRadioStations.slice(0, 200).map((s, i) => {
                const cur = current?.src === s.url_resolved;
                const cover = s.favicon?.startsWith("http") ? s.favicon : svgCover(s.name, i, theme.accent);
                const saved = isStationSaved(s.stationuuid);
                return (
                  <div key={s.stationuuid} className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-2.5 hover:bg-white/[0.07]">
                    <img src={cover} className="mt-0.5 h-12 w-12 shrink-0 rounded-xl bg-black/40 object-cover" alt="" onError={e => ((e.target as HTMLImageElement).src = cover)} />
                    <div className="min-w-0 flex-1 py-0.5">
                      <p className={`clamp-2 text-[13px] font-semibold leading-snug ${cur ? "text-[var(--accent)]" : "text-white"}`}>{s.name}</p>
                      <p className="clamp-1 pt-0.5 text-[11px] text-white/45">{s.country || "Online"} • {s.codec}{s.tags ? ` • ${s.tags.split(",").slice(0, 2).join(", ")}` : ""}</p>
                    </div>
                    <button onClick={() => { toggleSavedStation(stationToSaved(s)); buzz(16); }} className={`press grid h-9 w-9 shrink-0 place-items-center rounded-full ${saved ? "text-rose-300" : "bg-white/[0.06] text-white/40"}`} title="Save station">
                      <Heart size={15} filled={saved} />
                    </button>
                    <button onClick={() => playStation(s)} className={`press grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${cur && isPlaying ? "bg-[var(--accent)] text-black" : "bg-white/10 text-white hover:bg-white/20"}`}>{cur && isPlaying ? <Pause size={14} /> : <Play size={14} />}</button>
                  </div>
                );
              })}
              {!displayRadioStations.length && (
                <p className="py-10 text-center text-[13px] text-white/35">
                  {radioTab === "favorites" ? "No saved radio stations yet. Tap ❤️ on any station to save it!" : "No stations found."}
                </p>
              )}
            </div>
          ) : (
            <div className="stagger space-y-2.5">
              {displayItems.map((it, i) => {
                const cur = current?.id === it.identifier;
                const cover = it.cover || svgCover(it.title, i, theme.accent);
                const likedIt = isOnlineLiked(it.identifier);
                return (
                  <div key={it.identifier} className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-2.5 hover:bg-white/[0.07]">
                    <button onClick={() => { playArchive(it); onOpenSong(it.identifier); }} className="press relative mt-0.5 shrink-0">
                      <SmartCover item={it} index={i} accent={theme.accent} />
                    </button>
                    <div className="min-w-0 flex-1 py-0.5">
                      <button onClick={() => { playArchive(it); onOpenSong(it.identifier); }} className="block w-full text-left">
                        <p className={`clamp-2 text-[13px] font-semibold leading-snug ${cur ? "text-[var(--accent)]" : "text-white"}`}>{it.title}</p>
                      </button>
                      <button onClick={() => onOpenArtist(it.creator)} className="clamp-1 pt-0.5 text-left text-[11px] text-white/45 hover:text-[var(--accent)]">{it.creator}</button>
                    </div>
                    <button onClick={() => likeOnline(it, cover, "")} className={`press grid h-9 w-9 shrink-0 place-items-center rounded-full ${likedIt ? "text-rose-400" : "bg-white/[0.06] text-white/40"}`} title="Like">
                      <Heart size={15} filled={likedIt} />
                    </button>
                    <button onClick={() => downloadArchive(it)} disabled={downloading === it.identifier} className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white/70 hover:bg-white/20" title="Download">
                      {downloading === it.identifier ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Download size={15} />}
                    </button>
                    <button onClick={() => playArchive(it)} disabled={resolving === it.identifier} className={`press grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${cur && isPlaying ? "bg-[var(--accent)] text-black" : "bg-white/10 text-white hover:bg-white/20"}`}>
                      {resolving === it.identifier ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : cur && isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                  </div>
                );
              })}
              {!items.length && <p className="py-10 text-center text-[13px] text-white/35">No tracks found.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

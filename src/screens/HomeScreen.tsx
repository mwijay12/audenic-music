import { useMemo, useState } from "react";
import { CHIPS, CURATED, ONLINE_TRACKS } from "../data/tracks";
import { recommendForYou } from "../player/recommend";
import { usePlayer, svgAvatar } from "../player/PlayerContext";
import { Chip, IconButton, StatusBar, TrackRow, SafeImage } from "../components/Shell";
import { Download, Heart, Pause, Play, Dots, Search, Bot, Sparkle, Award } from "../components/Icons";

export default function HomeScreen({
  onOpenPlayer,
  onOpenLibrary,
  onOpenProfile,
  onOpenArtist,
  onOpenSong,
  onOpenAI,
  onOpenExperiences,
  onOpenAchievements,
}: {
  onOpenPlayer: () => void;
  onOpenLibrary: () => void;
  onOpenProfile: () => void;
  onOpenArtist: (name: string) => void;
  onOpenSong: (id: string) => void;
  onOpenAI: () => void;
  onOpenExperiences: () => void;
  onOpenAchievements: () => void;
}) {
  const [chip, setChip] = useState("All");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const { playTrack, current, isPlaying, liked, toggleLike, localTracks, theme, profile, recentlyPlayed, tracks, addedAt, playCounts, unlockedIds } = usePlayer();

  const list = useMemo(() => {
    const all = tracks;
    let l = all;
    if (chip === "New Release") {
      const cut = Date.now() - 30 * 864e5;
      l = all.filter(t => t.tags?.includes("admin") || (addedAt[t.id] ?? 0) > cut || t.tags?.includes("new"));
    } else if (chip === "Trending") {
      l = [...all].sort((a, b) => (playCounts[b.id] ?? 0) - (playCounts[a.id] ?? 0));
    } else if (chip === "Top Charts") {
      l = [...all].sort((a, b) => (addedAt[b.id] ?? 0) - (addedAt[a.id] ?? 0));
    }
    if (q.trim()) {
      const query = q.toLowerCase().trim();
      l = l.filter(t => (t.title + " " + t.artist + " " + (t.tags || []).join(" ")).toLowerCase().includes(query));
    }
    return q.trim() ? l : l.slice(0, 10);
  }, [chip, q, tracks, addedAt, playCounts]);

  const recentTracks = useMemo(() => recentlyPlayed.slice(0, 6).map(id => tracks.find(t => t.id === id)).filter(Boolean) as typeof tracks, [recentlyPlayed, tracks]);
  const forYou = useMemo(() => recommendForYou(tracks, playCounts, recentlyPlayed, liked, 8), [tracks, playCounts, recentlyPlayed, liked]);

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Still up," : hour < 12 ? "Good morning," : hour < 18 ? "Hi," : "Good evening,";

  return (
    <div className="fade-in flex h-full flex-col">
      <div className="relative shrink-0 overflow-hidden pb-1">
        <div className="absolute inset-0 -top-24 opacity-95 blur-[2px]" style={{ background: `radial-gradient(circle at 18% 28%, ${theme.gradientA} 0%, transparent 48%), radial-gradient(circle at 78% 18%, ${theme.gradientB} 0%, transparent 46%), radial-gradient(circle at 55% 65%, ${theme.gradientC} 0%, transparent 52%)` }} />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#0A0A0D]" />
        <div className="relative">
          <StatusBar />
          <div className="flex items-center justify-between px-6 pt-3">
            <button onClick={onOpenProfile} className="h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-white/40 transition active:scale-90">
              <img
                src={profile.avatar || svgAvatar(profile.name, theme.accent)}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = svgAvatar(profile.name, theme.accent); }}
                className="h-full w-full object-cover"
                alt="avatar"
              />
            </button>
            <div className="flex gap-2 items-center">
              <IconButton onClick={() => setSearching(s => !s)} active={searching} label="Search"><Search size={18} /></IconButton>
              <IconButton onClick={onOpenLibrary} label="Liked"><Heart size={18} /></IconButton>
              <div className="relative">
                <IconButton onClick={onOpenAchievements} label="Achievements & Notifications"><Award size={18} /></IconButton>
                {unlockedIds.length > 0 && (
                  <span className="absolute -top-1 -right-1 grid h-4 min-w-[16px] px-1 place-items-center rounded-full bg-[var(--accent)] text-[9px] font-extrabold text-black shadow-md">
                    {unlockedIds.length}
                  </span>
                )}
              </div>
            </div>
          </div>
          <h1 className="px-6 pb-2 pt-3 text-[21px] font-extrabold leading-tight tracking-tight text-white">{greeting} {profile.name.split(" ")[0]}</h1>
          {searching && (
            <div className="px-6 pb-2">
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search songs or artists" className="w-full rounded-full border border-white/15 bg-black/40 px-4 py-2.5 text-[13px] text-white outline-none placeholder:text-white/40 focus:border-[var(--accent)]" />
            </div>
          )}
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-6 pb-4">{CHIPS.map(c => <Chip key={c} label={c} active={chip === c} onClick={() => setChip(c)} />)}</div>
        </div>
      </div>

      <div className="no-scrollbar smooth-scroll flex-1 overflow-y-auto px-6 pb-44">
        {/* 1. Recently played */}
        {recentTracks.length > 0 && !q && chip === "All" && (
          <>
            <h2 className="pb-2 pt-2 text-[17px] font-semibold text-white">Recently played</h2>

            <div className="no-scrollbar stagger -mx-6 flex gap-3 overflow-x-auto px-6 pb-4">
              {recentTracks.map(t => (
                <button key={t.id} onClick={() => playTrack(t.id)} className="press group flex w-[120px] shrink-0 flex-col items-center">
                  <div className="relative h-[100px] w-[100px] overflow-hidden rounded-2xl bg-white/5">
                    <SafeImage src={t.cover} fallbackText={t.title} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                    {current?.id === t.id && isPlaying && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><span className="text-[var(--accent)]"><Pause size={20} /></span></div>}
                  </div>
                  <p className="mt-1.5 w-full truncate text-center text-[11.5px] font-semibold text-white/80">{t.title}</p>
                  <button onClick={e => { e.stopPropagation(); onOpenArtist(t.artist); }} className="truncate text-[10px] text-white/40 hover:text-[var(--accent)]">{t.artist}</button>
                </button>
              ))}
            </div>
          </>
        )}

        {/* 2. Audenic AI hero card */}
        <button
          onClick={onOpenAI}
          className="press relative mt-1 mb-4 flex w-full items-center gap-3 overflow-hidden rounded-3xl p-4 text-left"
          style={{ background: `linear-gradient(135deg, ${theme.accent}33, ${theme.gradientA}33)` }}
        >
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent)] text-black shadow-[0_8px_24px_-6px_color-mix(in_srgb,var(--accent)_60%,transparent)]">
            <Bot size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-white">Audenic AI &amp; Moments</p>
            <p className="truncate text-[11.5px] text-white/65">Smart Assistant · Live Lyrics · Mindful Moments</p>
          </div>
          <span className="press rounded-full bg-black/45 px-3 py-1.5 text-[10.5px] font-semibold text-white">Open →</span>
        </button>

        {/* 3. Curated & trending */}
        <h2 className="pb-3 pt-1 text-[17px] font-semibold text-white">Curated &amp; trending</h2>
        <div className="no-scrollbar -mx-6 flex gap-3 overflow-x-auto px-6 pb-1">
          {CURATED.map(c => {
            const active = current?.id === c.trackId;
            return (
              <div key={c.id} className="relative w-[248px] shrink-0 overflow-hidden rounded-[26px] p-4" style={{ background: `linear-gradient(140deg, ${c.from}, ${c.to})` }}>
                <img src={c.cover} alt="" className="absolute -right-3 bottom-0 h-[130px] w-[110px] rounded-2xl object-cover mix-blend-luminosity opacity-80" />
                <div className="relative">
                  <p className="text-[17px] font-bold text-black">{c.title}</p>
                  <p className="mt-1 max-w-[130px] text-[11px] font-medium leading-snug text-black/60">{c.subtitle}</p>
                  <div className="mt-6 flex items-center gap-3 text-black/70">
                    <button onClick={() => playTrack(c.trackId)} className="grid h-11 w-11 place-items-center rounded-full bg-[#3A0B5B] text-white shadow-lg transition active:scale-90">{active && isPlaying ? <Pause size={16} /> : <Play size={16} />}</button>
                    <button onClick={() => toggleLike(c.trackId)}><Heart size={19} filled={liked.includes(c.trackId)} /></button>
                    <button><Download size={19} /></button>
                    <button><Dots size={19} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. Top daily playlists */}
        <div className="flex items-end justify-between pb-1 pt-6">
          <h2 className="text-[17px] font-semibold text-white">Top daily playlists</h2>
          <button onClick={onOpenLibrary} className="text-[12px] font-medium text-white/50 hover:text-[var(--accent)]">See all</button>
        </div>
        <div className="stagger flex flex-col">
          {list.map(t => <TrackRow key={t.id} track={t} onOpen={onOpenPlayer} onOpenDetails={onOpenSong} onOpenArtist={onOpenArtist} />)}
          {!list.length && <p className="py-10 text-center text-[13px] text-white/35">Nothing here yet.</p>}
        </div>
      </div>
    </div>
  );
}

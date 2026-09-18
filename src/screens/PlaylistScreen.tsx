import { useMemo, useState } from "react";
import { usePlayer, fmt } from "../player/PlayerContext";
import { IconButton, StatusBar, TrackRow, SafeImage } from "../components/Shell";
import { Back, Play, Shuffle, Trash, Plus, Disc, Sparkle } from "../components/Icons";
import { MarqueeText } from "../components/Marquee";

export default function PlaylistScreen({ playlistId, onBack, onOpenPlayer }: { playlistId: string; onBack: () => void; onOpenPlayer: () => void }) {
  const { playlists, tracks, playTrack, renamePlaylist, deletePlaylist, removeFromPlaylist, addToPlaylist, shuffle, setShuffle, playCounts, recentlyPlayed, addedAt, current, isPlaying } = usePlayer();
  const [editing, setEditing] = useState(false);
  const [plName, setPlName] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const isSmart = playlistId === "mostly-played" || playlistId === "recently-played" || playlistId === "recently-added";

  const pl = useMemo(() => {
    if (playlistId === "mostly-played") {
      const ids = Object.entries(playCounts).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).map(([id]) => id);
      return { id: playlistId, name: "Mostly Played", trackIds: ids };
    }
    if (playlistId === "recently-played") {
      return { id: playlistId, name: "Recently Played", trackIds: recentlyPlayed };
    }
    if (playlistId === "recently-added") {
      const ids = Object.entries(addedAt).sort((a, b) => b[1] - a[1]).map(([id]) => id);
      return { id: playlistId, name: "Recently Added", trackIds: ids };
    }
    return playlists.find(p => p.id === playlistId);
  }, [playlistId, playlists, playCounts, recentlyPlayed, addedAt]);

  const songs = useMemo(() => {
    if (!pl) return [];
    return (pl.trackIds || []).map(id => tracks.find(t => t.id === id)).filter(Boolean) as typeof tracks;
  }, [pl, tracks]);

  const totalDuration = useMemo(() => {
    return songs.reduce((sum, t) => sum + (t.duration || 180), 0);
  }, [songs]);

  const available = useMemo(() => {
    if (isSmart || !pl) return [];
    return tracks.filter(t => !pl.trackIds.includes(t.id));
  }, [tracks, pl, isSmart]);

  if (!pl) return <div className="flex h-full items-center justify-center text-white/40">Playlist not found</div>;

  return (
    <div className="fade-in flex h-full flex-col">
      <StatusBar />
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 pt-2 pb-1">
        <IconButton onClick={onBack} label="Back"><Back size={20} /></IconButton>
        <div className="min-w-0 flex-1 px-3 text-center">
          {editing && !isSmart ? (
            <input autoFocus value={plName || pl.name} onChange={e => setPlName(e.target.value)} onBlur={() => { renamePlaylist(pl.id, (plName || pl.name).trim()); setEditing(false); }} className="w-full bg-transparent text-center text-[15px] font-bold text-white outline-none" />
          ) : (
            <button onClick={() => { if (!isSmart) setEditing(true); }} className="w-full text-[15px] font-bold text-white" disabled={isSmart}>
              <MarqueeText text={pl.name} />
            </button>
          )}
        </div>
        {!isSmart ? (
          <IconButton onClick={() => { deletePlaylist(pl.id); onBack(); }} label="Delete"><Trash size={16} /></IconButton>
        ) : (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-[var(--accent)]">Auto</span>
        )}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-6 pb-40">
        {/* Playlist Hero Banner */}
        <div className="relative mt-2 mb-5 overflow-hidden rounded-3xl border border-white/10 p-5 shadow-2xl" style={{ background: "linear-gradient(135deg, rgba(58,11,91,0.6) 0%, rgba(200,242,73,0.15) 100%)" }}>
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/15 shadow-xl bg-black/40">
              {songs[0]?.cover ? (
                <SafeImage src={songs[0].cover} fallbackText={pl.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-white/50"><Disc size={32} /></div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">PLAYLIST</span>
              <h1 className="clamp-1 text-[19px] font-extrabold text-white">{pl.name}</h1>
              <p className="mt-1 text-[11px] text-white/60">
                {songs.length} Track{songs.length !== 1 ? "s" : ""} • {fmt(totalDuration)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => { if (songs[0]) playTrack(songs[0].id); }} className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-[13px] font-bold text-black shadow-lg transition active:scale-95">
                <Play size={15} /> Play All
              </button>
              <button onClick={() => setShuffle(!shuffle)} className={`flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-[12px] font-bold transition active:scale-95 ${shuffle ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10" : "border-white/20 text-white/70 hover:bg-white/10"}`}>
                <Shuffle size={14} /> Shuffle
              </button>
            </div>
            {!isSmart && (
              <button onClick={() => setShowAdd(true)} className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-white hover:bg-white/10 active:scale-90" title="Add tracks">
                <Plus size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Add Tracks drawer */}
        {showAdd && !isSmart && (
          <div className="mb-4 rounded-3xl border border-white/12 bg-[#141418] p-4 shadow-xl">
            <div className="flex items-center justify-between pb-2">
              <p className="text-[12px] font-bold text-white">Add Songs to Playlist</p>
              <button onClick={() => setShowAdd(false)} className="text-[11px] font-semibold text-[var(--accent)]">Done</button>
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto no-scrollbar pt-1">
              {available.map(t => (
                <button key={t.id} onClick={() => addToPlaylist(pl.id, t.id)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-white/5 transition">
                  <SafeImage src={t.cover} fallbackText={t.title} className="h-10 w-10 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-white">{t.title}</p>
                    <p className="truncate text-[10.5px] text-white/50">{t.artist}</p>
                  </div>
                  <Plus size={16} className="text-[var(--accent)]" />
                </button>
              ))}
              {!available.length && <p className="py-4 text-center text-[12px] text-white/40">All songs already added</p>}
            </div>
          </div>
        )}

        {/* Track Rows */}
        <div className="space-y-1.5 pt-1">
          {songs.map((t, idx) => (
            <div key={t.id} className="group flex items-center gap-2 rounded-2xl bg-white/[0.03] p-1.5 transition hover:bg-white/[0.07]">
              <span className="w-6 text-center text-[11px] font-bold text-white/35 group-hover:text-[var(--accent)]">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <TrackRow track={t} onOpen={onOpenPlayer} />
              </div>
              {!isSmart && (
                <button onClick={() => removeFromPlaylist(pl.id, t.id)} className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/30 hover:text-rose-400 hover:bg-white/10 transition" title="Remove from playlist">
                  <Trash size={14} />
                </button>
              )}
            </div>
          ))}
          {!songs.length && !showAdd && (
            <div className="py-14 text-center">
              <Disc size={40} className="mx-auto mb-2 text-white/20" />
              <p className="text-[13px] font-semibold text-white/40">This playlist is currently empty.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

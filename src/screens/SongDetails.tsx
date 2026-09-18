import { useEffect, useRef, useState } from "react";
import { usePlayer } from "../player/PlayerContext";
import { IconButton, StatusBar } from "../components/Shell";
import { Back, Heart, Play, Pause, Plus, Check, Dots, Bell, Pencil, Trash, Share } from "../components/Icons";
import { nativeShare } from "../player/nativeBridge";

export default function SongDetails({ trackId, onBack, onOpenPlayer, onOpenArtist }: { trackId: string; onBack: () => void; onOpenPlayer: () => void; onOpenArtist: (n: string) => void }) {
  const { tracks, playlists, playTrack, current, isPlaying, liked, toggleLike, addToPlaylist, setAsRingtone, updateLocalTrack, deleteLocalTrack } = usePlayer();
  const track = tracks.find(t => t.id === trackId) || (current?.id === trackId ? current : null);
  const [showAdd, setShowAdd] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(track?.title || "");
  const [artist, setArtist] = useState(track?.artist || "");
  const [cover, setCover] = useState(track?.cover || "");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(!track);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (track) {
      setLoading(false);
      setTitle(track.title);
      setArtist(track.artist);
      setCover(track.cover);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [track]);

  if (!track) {
    if (loading) {
      return (
        <div className="fade-in relative flex h-full flex-col">
          <StatusBar />
          <div className="flex items-center justify-between px-6 pt-2">
            <IconButton onClick={onBack} label="Back"><Back size={20} /></IconButton>
            <p className="text-[14px] font-semibold text-white">Song Details</p>
            <div className="w-10" />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center space-y-3 px-6 text-white/60">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            <p className="text-[13px] font-medium text-white/70">Loading song details...</p>
          </div>
        </div>
      );
    }
    return (
      <div className="fade-in relative flex h-full flex-col">
        <StatusBar />
        <div className="flex items-center justify-between px-6 pt-2">
          <IconButton onClick={onBack} label="Back"><Back size={20} /></IconButton>
          <p className="text-[14px] font-semibold text-white">Song Details</p>
          <div className="w-10" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-white/40">
          Song not found
        </div>
      </div>
    );
  }
  const isCur = current?.id === track.id;
  const isLocal = track.source === "local";

  const showToast = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2200); };

  const doRingtone = async () => {
    setMenu(false);
    const res = await setAsRingtone(track.id);
    showToast(res.message);
  };

  const doShare = async () => {
    setMenu(false);
    const ok = await nativeShare({
      title: track.title,
      text: `Now listening to "${track.title}" by ${track.artist}`,
      url: track.source === "online" ? track.src : undefined
    });
    if (!ok) showToast("Couldn't share this song.");
  };

  const saveEdit = () => {
    updateLocalTrack(track.id, { title: title.trim() || track.title, artist: artist.trim() || track.artist, cover });
    setEditing(false);
    showToast("Song details updated");
  };

  const doDelete = () => {
    deleteLocalTrack(track.id);
    onBack();
  };

  return (
    <div className="fade-in relative flex h-full flex-col">
      <img src={track.cover} alt="" className="absolute inset-x-0 top-0 h-[55%] w-full scale-125 object-cover opacity-40 blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#0A0A0D]/85 to-[#0A0A0D]" />
      <div className="relative flex h-full flex-col">
        <StatusBar />
        <div className="flex items-center justify-between px-6 pt-2">
          <IconButton onClick={onBack} label="Back"><Back size={20} /></IconButton>
          <p className="text-[14px] font-semibold text-white">Song Details</p>
          <div className="relative flex items-center gap-1.5">
            <IconButton onClick={() => toggleLike(track.id)} label="Like"><Heart size={18} filled={liked.includes(track.id)} /></IconButton>
            <IconButton onClick={() => setMenu(m => !m)} active={menu} label="More"><Dots size={18} /></IconButton>
            {menu && (
              <div className="pop-in absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#17171c] py-1 shadow-2xl">
                <button onClick={doShare} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-white hover:bg-white/5"><Share size={15} className="text-[var(--accent)]" /> Share song</button>
                <button onClick={doRingtone} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-white hover:bg-white/5"><Bell size={15} className="text-[var(--accent)]" /> Set as ringtone</button>
                <button
                  onClick={() => { if (!isLocal) { showToast("Only songs on your device can be edited."); setMenu(false); return; } setEditing(true); setMenu(false); }}
                  className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] hover:bg-white/5 ${isLocal ? "text-white" : "text-white/35"}`}
                >
                  <Pencil size={15} className="text-[var(--accent)]" /> Edit details
                </button>
                <button
                  onClick={() => { if (!isLocal) { showToast("Only songs on your device can be deleted."); setMenu(false); return; } setConfirmDelete(true); setMenu(false); }}
                  className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] hover:bg-white/5 ${isLocal ? "text-rose-300" : "text-white/35"}`}
                >
                  <Trash size={15} /> Delete song
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center px-8 pt-6">
          <div className="h-52 w-52 overflow-hidden rounded-[32px] shadow-[0_25px_60px_-15px_rgba(0,0,0,.9)]">
            <img src={track.cover} alt="" className="h-full w-full object-cover" />
          </div>
          <h1 className="mt-5 text-center text-[22px] font-bold leading-[1.3] text-white" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>{track.title}</h1>
          <button onClick={() => onOpenArtist(track.artist)} className="mt-1 text-[13px] text-[var(--accent)]">{track.artist} →</button>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] text-white/60">{track.source === "local" ? "On device" : "Online"}</span>
            {track.tags.slice(0, 3).map(t => <span key={t} className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] text-white/60">{t}</span>)}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 px-6">
          <button onClick={() => { playTrack(track.id); onOpenPlayer(); }} className="press flex w-full max-w-[260px] items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-[14px] font-bold text-black shadow-[0_8px_30px_-6px_color-mix(in_srgb,var(--accent)_60%,transparent)]">
            {isCur && isPlaying ? <Pause size={16} /> : <Play size={16} />} {isCur && isPlaying ? "Pause" : "Play now"}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={doShare} className="press flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[11.5px] font-semibold text-white/80 backdrop-blur"><Share size={14} className="text-[var(--accent)]" /> Share</button>
            <button onClick={doRingtone} className="press flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[11.5px] font-semibold text-white/80 backdrop-blur"><Bell size={14} className="text-[var(--accent)]" /> Ringtone</button>
            <button onClick={() => setShowAdd(v => !v)} className="press flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[11.5px] font-semibold text-white/80 backdrop-blur"><Plus size={14} className="text-[var(--accent)]" /> Playlist</button>
          </div>
        </div>

        {toast && <div className="pop-in mx-auto mt-3 max-w-[280px] rounded-full bg-white/10 px-4 py-2 text-center text-[11.5px] text-white/85 backdrop-blur">{toast}</div>}

        {showAdd && (
          <div className="slide-up mx-6 mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="pb-2 text-[11px] font-semibold text-white/50">Add to playlist</p>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {playlists.map(pl => (
                <button key={pl.id} onClick={() => { addToPlaylist(pl.id, track.id); setAdded(pl.id); setTimeout(() => setAdded(null), 1200); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] text-white hover:bg-white/5">
                  {pl.name}
                  {added === pl.id ? <Check size={14} className="text-[var(--accent)]" /> : <Plus size={14} className="text-white/40" />}
                </button>
              ))}
              {!playlists.length && <p className="py-2 text-center text-[11px] text-white/30">No playlists — create one in My Music.</p>}
            </div>
          </div>
        )}

        {track.lyrics && track.lyrics.length > 0 && (
          <div className="no-scrollbar smooth-scroll mt-5 flex-1 overflow-y-auto px-8 pb-10">
            <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Lyrics</p>
            {track.lyrics.map((l, i) => <p key={i} className="py-0.5 text-[13.5px] leading-relaxed text-white/70">{l}</p>)}
          </div>
        )}
      </div>

      {/* Edit details modal */}
      {editing && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end" onClick={() => setEditing(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div onClick={e => e.stopPropagation()} className="slide-up relative rounded-t-3xl border-t border-white/10 bg-[#141418] p-5 pb-8">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <p className="pb-3 text-[15px] font-bold text-white">Edit song details</p>

            <div className="flex items-center gap-3 pb-4">
              <button onClick={() => coverInput.current?.click()} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
                <img src={cover} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-semibold text-white">Change</span>
              </button>
              <input ref={coverInput} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setCover(URL.createObjectURL(f)); }} />
              <p className="text-[11.5px] text-white/40">Tap the artwork to replace it from your device.</p>
            </div>

            <label className="block pb-3">
              <span className="mb-1.5 block text-[11px] font-medium text-white/45">Title</span>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[13.5px] text-white outline-none focus:border-[var(--accent)]" />
            </label>
            <label className="block pb-4">
              <span className="mb-1.5 block text-[11px] font-medium text-white/45">Artist</span>
              <input value={artist} onChange={e => setArtist(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[13.5px] text-white outline-none focus:border-[var(--accent)]" />
            </label>

            <div className="flex gap-2.5">
              <button onClick={() => setEditing(false)} className="press flex-1 rounded-full border border-white/15 py-3 text-[13px] font-semibold text-white/70">Cancel</button>
              <button onClick={saveEdit} className="press flex-1 rounded-full bg-[var(--accent)] py-3 text-[13px] font-bold text-black">Save changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-8" onClick={() => setConfirmDelete(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div onClick={e => e.stopPropagation()} className="pop-in relative w-full max-w-[300px] rounded-3xl border border-white/10 bg-[#141418] p-5 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/15 text-rose-300"><Trash size={22} /></div>
            <p className="pt-3 text-[15px] font-bold text-white">Delete this song?</p>
            <p className="pt-1 text-[12px] text-white/45">"{track.title}" will be removed from your library, playlists and liked songs.</p>
            <div className="mt-4 flex gap-2.5">
              <button onClick={() => setConfirmDelete(false)} className="press flex-1 rounded-full border border-white/15 py-2.5 text-[13px] font-semibold text-white/70">Cancel</button>
              <button onClick={doDelete} className="press flex-1 rounded-full bg-rose-500 py-2.5 text-[13px] font-bold text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

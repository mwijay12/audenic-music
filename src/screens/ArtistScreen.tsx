import { useMemo } from "react";
import { usePlayer } from "../player/PlayerContext";
import { IconButton, StatusBar, TrackRow } from "../components/Shell";
import { Back, Heart, Play, Shuffle } from "../components/Icons";

export default function ArtistScreen({ artistName, onBack, onOpenPlayer }: { artistName: string; onBack: () => void; onOpenPlayer: () => void }) {
  const { tracks, playTrack, liked, toggleLike, shuffle, setShuffle } = usePlayer();
  const songs = useMemo(() => tracks.filter(t => t.artist === artistName), [tracks, artistName]);
  const cover = songs[0]?.cover || "";
  const totalSongs = songs.length;
  const isLikedAll = songs.every(s => liked.includes(s.id));

  return (
    <div className="fade-in flex h-full flex-col">
      <div className="relative shrink-0 overflow-hidden">
        <img src={cover} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-2xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-[#0A0A0D]/70 to-[#0A0A0D]" />
        <div className="relative">
          <StatusBar />
          <div className="flex items-center justify-between px-6 pt-2">
            <IconButton onClick={onBack} label="Back"><Back size={20} /></IconButton>
            <span className="w-10" />
          </div>
          <div className="flex flex-col items-center px-6 pb-5 pt-3">
            <div className="h-24 w-24 overflow-hidden rounded-full ring-4 ring-white/15">
              <img src={cover} alt="" className="h-full w-full object-cover" />
            </div>
            <h1 className="mt-3 text-[22px] font-bold text-white">{artistName}</h1>
            <p className="text-[12px] text-white/45">{totalSongs} song{totalSongs !== 1 ? "s" : ""} in your library</p>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => { if (songs[0]) playTrack(songs[0].id); }} className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-[13px] font-bold text-black transition active:scale-95">
                <Play size={14} /> Play all
              </button>
              <button onClick={() => setShuffle(!shuffle)} className={`flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-[13px] font-semibold transition active:scale-95 ${shuffle ? "border-[var(--accent)] text-[var(--accent)]" : "border-white/20 text-white/70"}`}>
                <Shuffle size={14} /> Shuffle
              </button>
              <button onClick={() => songs.forEach(s => { if (!liked.includes(s.id)) toggleLike(s.id); })} className={`grid h-10 w-10 place-items-center rounded-full border transition active:scale-90 ${isLikedAll ? "border-rose-400 text-rose-300" : "border-white/20 text-white/50"}`}>
                <Heart size={16} filled={isLikedAll} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-6 pb-40">
        {songs.map(t => <TrackRow key={t.id} track={t} onOpen={onOpenPlayer} />)}
        {!songs.length && <p className="py-10 text-center text-[13px] text-white/35">No songs by this artist.</p>}
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { usePlayer } from "../player/PlayerContext";
import { StatusBar, IconButton } from "../components/Shell";
import { Back, Trash, Play, Pause, Film } from "../components/Icons";
import { uploadToCloudflareR2 } from "../player/r2Upload";

export default function AdminScreen({ onBack, onOpenDiagnostics }: { onBack: () => void; onOpenDiagnostics?: () => void }) {
  const { adminTracks, addAdminTrack, removeAdminTrack, adminVideos, addAdminReel, removeAdminReel, playTrack, current, isPlaying, isAdmin } = usePlayer();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [cover, setCover] = useState("");
  const [src, setSrc] = useState("");
  const [reelTitle, setReelTitle] = useState("");
  const [reelSrc, setReelSrc] = useState("");
  const [tab, setTab] = useState<"songs" | "reels">("songs");
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const coverFile = useRef<HTMLInputElement>(null);
  const audioFile = useRef<HTMLInputElement>(null);
  const videoFile = useRef<HTMLInputElement>(null);

  if (!isAdmin) {
    return (
      <div className="fade-in flex h-full flex-col bg-[#0A0A0D]">
        <StatusBar />
        <div className="flex items-center justify-between px-5 pt-1">
          <IconButton onClick={onBack} label="Back"><Back size={20} /></IconButton>
          <p className="text-[14px] font-semibold text-white">Admin Studio</p>
          <div className="w-8" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-amber-500/10 text-amber-400">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h2 className="mb-2 text-lg font-bold text-white">Administrator Access Required</h2>
          <p className="max-w-xs text-xs text-white/60">
            Only designated administrator accounts (<span className="text-[var(--accent)]">audenic.audio@gmail.com</span> / <span className="text-[var(--accent)]">mwijaydavie@gmail.com</span>) can upload and manage Cloudflare R2 tracks.
          </p>
        </div>
      </div>
    );
  }

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatusMsg("Uploading song to Cloudflare R2...");
    const res = await uploadToCloudflareR2(file);
    setUploading(false);
    if (res.ok) {
      setSrc(res.url);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
      setStatusMsg(res.message);
    } else {
      setStatusMsg("Upload failed.");
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatusMsg("Uploading reel video to Cloudflare R2...");
    const res = await uploadToCloudflareR2(file);
    setUploading(false);
    if (res.ok) {
      setReelSrc(res.url);
      if (!reelTitle) setReelTitle(file.name.replace(/\.[^/.]+$/, ""));
      setStatusMsg(res.message);
    } else {
      setStatusMsg("Upload failed.");
    }
  };

  const pushSong = () => {
    if (!title.trim() || !src.trim()) return;
    addAdminTrack({ title: title.trim(), artist: artist.trim() || "Audenic", cover: cover.trim(), src: src.trim() });
    setTitle(""); setArtist(""); setCover(""); setSrc("");
  };

  const pushReel = () => {
    if (!reelSrc.trim()) return;
    addAdminReel({ title: reelTitle.trim() || "Audenic Reel", src: reelSrc.trim() });
    setReelTitle(""); setReelSrc("");
  };

  return (
    <div className="fade-in flex h-full flex-col">
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-1">
        <IconButton onClick={onBack} label="Back"><Back size={20} /></IconButton>
        <p className="text-[14px] font-semibold text-white">Admin Studio</p>
        {onOpenDiagnostics ? (
          <button
            onClick={onOpenDiagnostics}
            className="rounded-full bg-white/[0.08] px-3 py-1 text-[11px] font-semibold text-white hover:bg-white/[0.16]"
            title="Run native bridge diagnostics"
          >
            Diagnostics
          </button>
        ) : (
          <span className="w-10" />
        )}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-32 pt-3">
        <div className="overflow-hidden rounded-3xl p-4" style={{ background: "linear-gradient(135deg, var(--accent)22, var(--ga)18)" }}>
          <p className="text-[16px] font-extrabold text-white">Owner controls</p>
          <p className="pt-1 text-[11.5px] leading-snug text-white/50">
            Push songs and reels from your cloud (Cloudflare R2 / any direct MP4/MP3 URL). They appear instantly for everyone in "New Release" and the Reels feed.
          </p>
        </div>

        <div className="mt-4 flex rounded-full bg-white/[0.06] p-1">
          {(["songs", "reels"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-full py-2 text-[12px] font-bold capitalize transition ${tab === t ? "bg-[var(--accent)] text-black" : "text-white/50"}`}>
              {t === "songs" ? "Songs" : "Reels"}
            </button>
          ))}
        </div>

        {statusMsg && (
          <p className="mt-2 text-center text-[11px] font-semibold text-[var(--accent)]">{statusMsg}</p>
        )}

        {tab === "songs" ? (
          <div className="mt-4 space-y-2.5">
            <Field label="Title" value={title} onChange={setTitle} placeholder="Golden Hour" />
            <Field label="Artist" value={artist} onChange={setArtist} placeholder="Audenic" />
            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Stream URL (Cloudflare R2 / Direct MP3)</span>
              <div className="flex gap-2">
                <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="https://pub-c26084d7ca874fcda47de161be8ded27.r2.dev/track.mp3" className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-[12.5px] text-white outline-none focus:border-[var(--accent)]" />
                <button onClick={() => audioFile.current?.click()} disabled={uploading} className="shrink-0 rounded-xl bg-[var(--accent)]/20 hover:bg-[var(--accent)]/30 border border-[var(--accent)]/40 px-3 text-[11px] font-bold text-[var(--accent)] transition">
                  {uploading ? "..." : "Upload R2"}
                </button>
                <input ref={audioFile} type="file" accept="audio/*" hidden onChange={handleAudioUpload} />
              </div>
            </div>
            <div className="flex gap-2">
              <Field label="Cover URL (optional)" value={cover} onChange={setCover} placeholder="https://…/cover.jpg" />
              <button onClick={() => coverFile.current?.click()} className="mt-5 shrink-0 rounded-xl bg-white/[0.08] px-3 text-[11px] font-bold text-white">Pick</button>
              <input ref={coverFile} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCover(URL.createObjectURL(f)); }} />
            </div>
            <button onClick={pushSong} disabled={uploading} className="w-full rounded-full bg-[var(--accent)] py-3 text-[13px] font-extrabold text-black">Publish song</button>

            <p className="pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Published ({adminTracks.length})</p>
            {adminTracks.map((t) => {
              const active = current?.id === t.id;
              return (
                <div key={t.id} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] p-2.5">
                  <img src={t.cover} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="clamp-1 text-[12.5px] font-bold text-white">{t.title}</p>
                    <p className="clamp-1 text-[10px] text-white/40">{t.artist}</p>
                  </div>
                  <button onClick={() => playTrack(t.id)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white">
                    {active && isPlaying ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                  <button onClick={() => removeAdminTrack(t.id)} className="grid h-8 w-8 place-items-center rounded-full text-white/30 hover:text-rose-300"><Trash size={14} /></button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            <Field label="Reel title" value={reelTitle} onChange={setReelTitle} placeholder="Studio session" />
            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Video URL (Cloudflare R2 / Direct MP4)</span>
              <div className="flex gap-2">
                <input value={reelSrc} onChange={(e) => setReelSrc(e.target.value)} placeholder="https://pub-c26084d7ca874fcda47de161be8ded27.r2.dev/video.mp4" className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-[12.5px] text-white outline-none focus:border-[var(--accent)]" />
                <button onClick={() => videoFile.current?.click()} disabled={uploading} className="shrink-0 rounded-xl bg-[var(--accent)]/20 hover:bg-[var(--accent)]/30 border border-[var(--accent)]/40 px-3 text-[11px] font-bold text-[var(--accent)] transition">
                  {uploading ? "..." : "Upload R2"}
                </button>
                <input ref={videoFile} type="file" accept="video/*" hidden onChange={handleVideoUpload} />
              </div>
            </div>
            <button onClick={pushReel} disabled={uploading} className="w-full rounded-full bg-[var(--accent)] py-3 text-[13px] font-extrabold text-black">Publish reel</button>

            <p className="pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Published reels ({adminVideos.length})</p>
            {adminVideos.map((v) => (
              <div key={v.id} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] p-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white/60"><Film size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="clamp-1 text-[12.5px] font-bold text-white">{v.title}</p>
                  <p className="clamp-1 text-[10px] text-white/40">vertical reel · published</p>
                </div>
                <button onClick={() => removeAdminReel(v.id)} className="grid h-8 w-8 place-items-center rounded-full text-white/30 hover:text-rose-300"><Trash size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-[12.5px] text-white outline-none focus:border-[var(--accent)]" />
    </label>
  );
}

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { LIBRARY_CHIPS } from "../data/tracks";
import { usePlayer, svgCover } from "../player/PlayerContext";
import { Chip, IconButton, StatusBar, TrackRow } from "../components/Shell";
import { Back, Dots, Scan, Shuffle, Video, Play, Plus, Search, CheckSquare, Filter, Check } from "../components/Icons";
import { isNative } from "../player/nativeBridge";
import { isDesktop } from "../player/tauriBridge";
import { VirtualList } from "../components/VirtualList";
import { uploadToCloudflareR2 } from "../player/r2Upload";
import { useContextMenu } from "../components/ContextMenu";
import { BulkActionBar } from "../components/BulkActionBar";

export default function MyMusic({ onBack, onOpenPlayer, onOpenVideo, onOpenSettings, onOpenArtist: _onOpenArtist, onOpenPlaylist, onOpenSong }: { onBack: () => void; onOpenPlayer: () => void; onOpenVideo: () => void; onOpenSettings: () => void; onOpenArtist: (n: string) => void; onOpenPlaylist: (id: string) => void; onOpenSong: (id: string) => void }) {
  const [chip, setChip] = useState("All");
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "dateAdded" | "az" | "za" | "mostPlayed">("default");
  const [newPl, setNewPl] = useState(false);
  const [plName, setPlName] = useState("");
  const [r2Uploading, setR2Uploading] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  const {
    tracks,
    localTracks,
    localVideos,
    liked,
    addLocalFiles,
    clearLocal,
    addLocalVideos,
    scanning,
    scanNativeLibrary,
    scanNativeVideos,
    scanDesktopLibrary,
    shuffle,
    setShuffle,
    playTrack,
    setQueue,
    addToQueue,
    deleteTracks,
    playlists,
    createPlaylist,
    addToPlaylist,
    playCounts,
    recentlyPlayed,
    addedAt,
    addAdminTrack,
    theme,
    isAdmin,
  } = usePlayer();

  const { openTrackMenu } = useContextMenu();

  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const r2Ref = useRef<HTMLInputElement>(null);

  const handleScan = async () => {
    if (isDesktop()) {
      await scanDesktopLibrary();
    } else if (isNative()) {
      await Promise.all([
        scanNativeLibrary(),
        scanNativeVideos ? scanNativeVideos() : Promise.resolve(0),
      ]);
    } else {
      dirRef.current?.click();
    }
  };

  const handleR2Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      alert("Access Denied: Only users with administrator roles can upload music to Cloudflare R2.");
      return;
    }
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setR2Uploading(true);
    for (const f of files) {
      const res = await uploadToCloudflareR2(f);
      if (res.ok) {
        addAdminTrack({
          title: f.name.replace(/\.[^/.]+$/, ""),
          artist: "R2 Cloud Stream",
          cover: svgCover(f.name, 0, theme.accent),
          src: res.url,
        });
      } else {
        alert(res.message || "Cloudflare R2 Upload failed.");
      }
    }
    setR2Uploading(false);
  };

  const list = useMemo(() => {
    let base = tracks;
    if (chip === "Liked Songs") base = tracks.filter(t => liked.includes(t.id));
    else if (chip === "Local Files") base = localTracks;
    else if (chip === "Playlists") return [];

    if (q.trim()) {
      const query = q.toLowerCase().trim();
      base = base.filter(t => (t.title + " " + t.artist + " " + (t.tags || []).join(" ")).toLowerCase().includes(query));
    }

    if (sortBy === "dateAdded") {
      base = [...base].sort((a, b) => (addedAt[b.id] || 0) - (addedAt[a.id] || 0));
    } else if (sortBy === "az") {
      base = [...base].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "za") {
      base = [...base].sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortBy === "mostPlayed") {
      base = [...base].sort((a, b) => (playCounts[b.id] || 0) - (playCounts[a.id] || 0));
    }

    return base;
  }, [chip, tracks, localTracks, liked, q, sortBy, addedAt, playCounts]);

  const showPlaylists = chip === "Playlists";

  const smartPlaylists = useMemo(() => [
    { id: "mostly-played", name: "Mostly Played", count: Object.values(playCounts).filter(c => c > 0).length, icon: "🔥", sub: "Your top rotation" },
    { id: "recently-played", name: "Recently Played", count: recentlyPlayed.length, icon: "⏱", sub: "Jump back in" },
    { id: "recently-added", name: "Recently Added", count: Object.keys(addedAt).length, icon: "✨", sub: "Fresh on device" },
  ], [playCounts, recentlyPlayed, addedAt]);

  const [scrollTop, setScrollTop] = useState(0);
  const shrink = Math.min(1, scrollTop / 60);

  // Toggle or range-select with Shift/Ctrl
  const handleToggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (e?.shiftKey && lastSelectedId) {
        const fromIdx = list.findIndex(t => t.id === lastSelectedId);
        const toIdx = list.findIndex(t => t.id === id);
        if (fromIdx >= 0 && toIdx >= 0) {
          const start = Math.min(fromIdx, toIdx);
          const end = Math.max(fromIdx, toIdx);
          for (let i = start; i <= end; i++) {
            next.add(list[i].id);
          }
          return next;
        }
      }

      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLastSelectedId(id);
    if (!multiSelect) setMultiSelect(true);
  }, [list, lastSelectedId, multiSelect]);

  // Bulk Actions
  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(list.map(t => t.id)));
  }, [list]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setMultiSelect(false);
    setLastSelectedId(null);
  }, []);

  const handlePlaySelected = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setQueue(ids);
    playTrack(ids[0]);
    onOpenPlayer();
  }, [selectedIds, setQueue, playTrack, onOpenPlayer]);

  const handleAddQueueSelected = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    addToQueue(ids);
  }, [selectedIds, addToQueue]);

  const handleAddToPlaylistSelected = useCallback((playlistId: string) => {
    selectedIds.forEach(id => addToPlaylist(playlistId, id));
    handleDeselectAll();
  }, [selectedIds, addToPlaylist, handleDeselectAll]);

  const handleCreatePlaylistFromSelected = useCallback((name: string) => {
    createPlaylist(name);
    // Add tracks to newly created playlist
    setTimeout(() => {
      const created = playlists.find(p => p.name === name);
      if (created) {
        selectedIds.forEach(id => addToPlaylist(created.id, id));
      }
    }, 100);
    handleDeselectAll();
  }, [selectedIds, createPlaylist, playlists, addToPlaylist, handleDeselectAll]);

  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (confirm(`Remove ${ids.length} song${ids.length > 1 ? "s" : ""} from your library?`)) {
      deleteTracks(ids);
      handleDeselectAll();
    }
  }, [selectedIds, deleteTracks, handleDeselectAll]);

  // Keyboard Shortcuts for Desktop Multi-Select
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        if (!showPlaylists && list.length > 0) {
          e.preventDefault();
          setMultiSelect(true);
          handleSelectAll();
        }
      } else if (e.key === "Escape" && selectedIds.size > 0) {
        handleDeselectAll();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPlaylists, list, handleSelectAll, handleDeselectAll, selectedIds.size]);

  return (
    <div className="fade-in relative flex h-full flex-col bg-[#0A0A0D]">
      <StatusBar />
      <div className="relative flex items-center justify-between px-6 transition-all duration-200" style={{ paddingTop: `${8 - shrink * 4}px`, paddingBottom: `${4 - shrink * 2}px` }}>
        <IconButton onClick={onBack} label="Back"><Back size={20} /></IconButton>
        <p className="font-semibold text-white transition-all duration-200" style={{ fontSize: `${15 - shrink * 2}px` }}>My Music</p>
        <IconButton onClick={() => setMenu(m => !m)} active={menu} label="Menu"><Dots size={18} /></IconButton>
        {menu && (
          <div className="absolute right-6 top-14 z-40 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#17171c] py-1 shadow-2xl">
            <button onClick={() => { setMultiSelect(m => !m); setMenu(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-white hover:bg-white/5">
              <CheckSquare size={14} className="text-[var(--accent)]" />
              <span>{multiSelect ? "Exit multi-select" : "Select multiple"}</span>
            </button>
            <div className="my-1 border-t border-white/[0.08]" />
            <button onClick={() => { handleScan(); setMenu(false); }} className="block w-full px-4 py-2.5 text-left text-[13px] text-white hover:bg-white/5">Scan device library</button>
            <button onClick={() => { fileRef.current?.click(); setMenu(false); }} className="block w-full px-4 py-2.5 text-left text-[13px] text-white hover:bg-white/5">Add audio files</button>
            <button onClick={() => { vidRef.current?.click(); setMenu(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-white hover:bg-white/5"><Video size={14} /> Scan video files</button>
            <button onClick={() => { onOpenSettings(); setMenu(false); }} className="block w-full px-4 py-2.5 text-left text-[13px] text-white hover:bg-white/5">Settings</button>
            <button onClick={() => { clearLocal(); setMenu(false); }} className="block w-full px-4 py-2.5 text-left text-[13px] text-rose-300 hover:bg-white/5">Clear local library</button>
          </div>
        )}
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-6 py-2">
        {LIBRARY_CHIPS.map(c => <Chip key={c} label={c} active={chip === c} onClick={() => setChip(c)} />)}
      </div>

      {/* Search Input Bar + Sort/Filter */}
      <div className="px-6 py-1.5">
        <div className="flex items-center gap-2">
          <div className="relative flex flex-1 items-center">
            <span className="absolute left-3.5 text-white/40"><Search size={16} /></span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search songs, artists, or local files..."
              className="w-full rounded-2xl border border-white/12 bg-white/[0.06] pl-10 pr-9 py-2.5 text-[13px] text-white outline-none placeholder:text-white/40 focus:border-[var(--accent)]"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-3.5 text-[12px] font-bold text-white/50 hover:text-white">✕</button>
            )}
          </div>
          <div className="relative shrink-0">
            <button
              onClick={() => setSortOpen(v => !v)}
              className={`grid h-[42px] w-[42px] place-items-center rounded-2xl border transition ${sortBy !== "default" ? "border-[var(--accent)]/50 bg-[var(--accent)]/15 text-[var(--accent)]" : "border-white/12 bg-white/[0.06] text-white/60 hover:text-white"}`}
              title="Sort & filter"
            >
              <Filter size={16} />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-[48px] z-50 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#17171c] py-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                  {([
                    { id: "default", label: "Default order" },
                    { id: "dateAdded", label: "Date added (newest)" },
                    { id: "az", label: "Title A → Z" },
                    { id: "za", label: "Title Z → A" },
                    { id: "mostPlayed", label: "Most played" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => { setSortBy(opt.id); setSortOpen(false); }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] text-white hover:bg-white/5"
                    >
                      <span>{opt.label}</span>
                      {sortBy === opt.id && <Check size={14} className="text-[var(--accent)]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* scan & R2 upload card - Collapses smoothly on scroll down to expand song list */}
      <div className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${
        isScrolled ? "max-h-0 opacity-0 scale-95 pointer-events-none mb-0 py-0" : "max-h-28 opacity-100 scale-100 py-1"
      }`}>
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/[0.06] px-4 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-black"><Scan size={16} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-white">{scanning ? "Scanning…" : "Scan device"}</p>
            <p className="truncate text-[10.5px] text-white/40">{localTracks.length} audio • {localVideos.length} video</p>
          </div>
          <button onClick={handleScan} disabled={scanning} className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[11px] font-bold text-black active:scale-95 disabled:opacity-50">{scanning ? "…" : "Scan"}</button>
          <button onClick={() => r2Ref.current?.click()} disabled={r2Uploading} className="shrink-0 rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/15 px-3 py-1.5 text-[11px] font-bold text-[var(--accent)] active:scale-95 disabled:opacity-50">
            {r2Uploading ? "Uploading…" : "☁️ R2 Upload"}
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={e => addLocalFiles(e.target.files)} />
      <input ref={r2Ref} type="file" accept="audio/*,video/*" multiple hidden onChange={handleR2Upload} />
      {/* @ts-expect-error directory attributes */}
      <input ref={dirRef} type="file" multiple hidden webkitdirectory="" directory="" onChange={e => addLocalFiles(e.target.files)} />
      <input ref={vidRef} type="file" accept="video/*" multiple hidden onChange={e => addLocalVideos(e.target.files)} />

      {/* video quick - Collapses smoothly on scroll down */}
      {localVideos.length > 0 && chip !== "Playlists" && (
        <div className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${
          isScrolled ? "max-h-0 opacity-0 scale-95 pointer-events-none mt-0" : "max-h-20 opacity-100 scale-100 mt-2"
        }`}>
          <button onClick={onOpenVideo} className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] p-2.5 text-left hover:bg-white/[0.08]">
            <img src={localVideos[0].cover} className="h-10 w-10 rounded-xl object-cover" alt="" />
            <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold text-white">{localVideos.length} video{localVideos.length > 1 ? "s" : ""}</p><p className="text-[10px] text-white/40">Tap to open video player</p></div>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-black"><Play size={12} /></span>
          </button>
        </div>
      )}

      {showPlaylists ? (
        <div className="no-scrollbar flex-1 overflow-y-auto px-6 pb-40 pt-3">
          {/* Smart Auto-created Playlists Section */}
          <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">Auto-Created Playlists</p>
          <div className="mb-4 space-y-2">
            {smartPlaylists.map(sp => (
              <button key={sp.id} onClick={() => onOpenPlaylist(sp.id)} className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.03] p-2 text-left hover:bg-white/[0.06]">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--ga)]/15 text-[20px]">{sp.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-white">{sp.name}</p>
                  <p className="text-[10px] text-white/40">{sp.count ? `${sp.count} song${sp.count !== 1 ? "s" : ""}` : sp.sub}</p>
                </div>
                <Play size={12} className="text-[var(--accent)] mr-2" />
              </button>
            ))}
          </div>

          <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">Your Playlists</p>
          <button onClick={() => setNewPl(true)} className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/15 p-3 text-left hover:bg-white/[0.04]">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.06] text-white/50"><Plus size={20} /></span>
            <div><p className="text-[13px] font-semibold text-white">New Playlist</p><p className="text-[10.5px] text-white/40">Create a custom playlist</p></div>
          </button>
          {newPl && (
            <div className="mb-3 flex gap-2">
              <input autoFocus value={plName} onChange={e => setPlName(e.target.value)} placeholder="Playlist name" className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px] text-white outline-none focus:border-[var(--accent)]" />
              <button onClick={() => { if (plName.trim()) { createPlaylist(plName.trim()); setPlName(""); setNewPl(false); } }} className="rounded-xl bg-[var(--accent)] px-4 text-[12px] font-bold text-black active:scale-95">Add</button>
            </div>
          )}
          {playlists.map(pl => (
            <button key={pl.id} onClick={() => onOpenPlaylist(pl.id)} className="flex w-full items-center gap-3 rounded-2xl py-2 text-left hover:bg-white/[0.04]">
              <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[var(--accent)]/30 to-[var(--ga)]/20 text-[20px]">🎵</div>
              <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-white">{pl.name}</p><p className="text-[11px] text-white/40">{pl.trackIds.length} song{pl.trackIds.length !== 1 ? "s" : ""}</p></div>
              <Play size={14} className="text-white/40" />
            </button>
          ))}
          {!playlists.length && !newPl && <p className="py-2 text-center text-[12px] text-white/30">Create a custom playlist above.</p>}
        </div>
      ) : (
        <div className="flex-1 min-h-0 relative">
          <VirtualList
            items={list}
            itemHeight={64}
            overscan={10}
            bottomPad={160}
            className="px-6 h-full"
            onScrollChange={(top) => { setIsScrolled(top > 25); setScrollTop(top); }}
            renderItem={(t) => (
              <TrackRow
                key={t.id}
                track={t}
                onOpen={onOpenPlayer}
                onOpenDetails={onOpenSong}
                selectable={multiSelect || selectedIds.size > 0}
                selected={selectedIds.has(t.id)}
                onToggleSelect={(e) => handleToggleSelect(t.id, e)}
                onContextMenu={(e) =>
                  openTrackMenu(e, t, {
                    onSelect: () => handleToggleSelect(t.id, e),
                    isMultiSelectMode: multiSelect,
                    onDelete: () => {
                      if (confirm(`Remove "${t.title}" from library?`)) {
                        deleteTracks([t.id]);
                      }
                    },
                  })
                }
              />
            )}
            empty={<p className="py-12 text-center text-[13px] text-white/35">{chip === "Local Files" ? "No local songs yet — tap Scan." : "Nothing here."}</p>}
          />
        </div>
      )}

      {/* Bulk Action Bar (Docked when items are selected) */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={list.length}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onPlaySelected={handlePlaySelected}
        onAddQueueSelected={handleAddQueueSelected}
        onAddToPlaylistSelected={handleAddToPlaylistSelected}
        onCreatePlaylistFromSelected={handleCreatePlaylistFromSelected}
        onDeleteSelected={handleDeleteSelected}
        onClose={handleDeselectAll}
        playlists={playlists}
      />

      {/* Standard Play-all / shuffle-all bar (only shown when multi-select bar is NOT active) */}
      {!showPlaylists && list.length > 0 && selectedIds.size === 0 && (
        <div className={`pointer-events-none absolute inset-x-0 ${isDesktop() ? "bottom-4" : "bottom-24"} flex justify-center px-6 z-20`}>
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-[#1a1a20]/95 p-1.5 pl-4 shadow-2xl backdrop-blur">
            <span className="text-[11px] font-semibold text-white/45">{list.length} {list.length === 1 ? "song" : "songs"}</span>
            <button
              onClick={() => {
                const ids = list.map((t) => t.id);
                setQueue(ids);
                playTrack(list[0].id);
                onOpenPlayer();
              }}
              className="press flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-2 text-[11.5px] font-bold text-black"
              title="Play all from the top"
            >
              <Play size={13} /> Play all
            </button>
            <button
              onClick={() => {
                setShuffle(true);
                const ids = list.map((t) => t.id);
                setQueue(ids);
                const pick = list[Math.floor(Math.random() * list.length)];
                playTrack(pick.id);
                onOpenPlayer();
              }}
              className={`press flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11.5px] font-bold transition ${shuffle ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "bg-white/[0.08] text-white"}`}
              title="Shuffle this list"
            >
              <Shuffle size={13} /> Shuffle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


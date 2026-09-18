import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { usePlayer, svgCover, REEL_TAGS, type VideoItem, type ReelCategory, type ReelPlaylist } from "../player/PlayerContext";
import { useGestures } from "../hooks/useGestures";
import { nativeShare, isNative } from "../player/nativeBridge";
import { Heart, Comment, Share, Play, Plus, Dots, Check, Eye, EyeOff, Headphones, Send, Folder, Film, Volume2, VolumeX, GraduationCap } from "../components/Icons";
import { pickFolder, pickVideoFiles, scanDirectory, toAssetUrl, isDesktop } from "../player/tauriBridge";

type Mode = "for-you" | "study" | "category" | "playlist";
type CommentT = { id: string; user: string; text: string; ts: number };

const LS = { likes: "au.reels.likes", likeC: "au.reels.likeC", comments: "au.reels.comments", shares: "au.reels.shares" };
function ldj<T>(k: string, fb: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fb; } catch { return fb; } }
function svj(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } }

export default function ReelsScreen({
  chromeHidden, onChromeHiddenChange, activePlaylistId, activeCategoryId,
}: {
  chromeHidden: boolean;
  onChromeHiddenChange: (v: boolean) => void;
  activePlaylistId?: string; activeCategoryId?: string;
}) {
  const {
    localVideos, addLocalVideos, addDesktopVideos, scanNativeVideos, reelLoops, reelAutoScroll, gesturesOn, buzz, profile,
    reelCategories, reelPlaylists, setReelCategoryAssignment, getReelCategoryId,
    addToReelPlaylist, removeFromReelPlaylist, toggleReelTag, getReelTags,
    createReelCategory, createReelPlaylist,
    toggleStudyReel, isStudyReel,
  } = usePlayer();
  const [mode, setMode] = useState<Mode>("for-you");
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [targetVideo, setTargetVideo] = useState<VideoItem | null>(null);

  /* social state — persisted so likes/comments/shares survive reloads */
  const [likes, setLikes] = useState<Record<string, boolean>>(ldj(LS.likes, {}));
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>(ldj(LS.likeC, {}));
  const [comments, setComments] = useState<Record<string, CommentT[]>>(ldj(LS.comments, {}));
  const [shareCounts, setShareCounts] = useState<Record<string, number>>(ldj(LS.shares, {}));
  const [commentSheet, setCommentSheet] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [burstAt, setBurstAt] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [newPlaylist, setNewPlaylist] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const loopCount = useRef<Record<string, number>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => svj(LS.likes, likes), [likes]);
  useEffect(() => svj(LS.likeC, likeCounts), [likeCounts]);
  useEffect(() => svj(LS.comments, comments), [comments]);
  useEffect(() => svj(LS.shares, shareCounts), [shareCounts]);

const DEFAULT_REELS: VideoItem[] = [
  {
    id: "reel-demo-1",
    title: "Afrobeats Live Studio Session",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600",
    size: 4200000,
    kind: "reel",
  },
  {
    id: "reel-demo-2",
    title: "Audenic AI Music Experience",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600",
    size: 5100000,
    kind: "reel",
  },
  {
    id: "reel-demo-3",
    title: "Swahili Acoustic Beats",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600",
    size: 3900000,
    kind: "reel",
  },
];

  const [detectedAspect, setDetectedAspect] = useState<Record<string, "portrait" | "landscape">>(() => {
    try {
      const v = localStorage.getItem("au.videoAspect");
      return v ? JSON.parse(v) : {};
    } catch { return {}; }
  });

  const markAspect = useCallback((id: string, aspect: "portrait" | "landscape") => {
    setDetectedAspect((prev) => {
      if (prev[id] === aspect) return prev;
      const next = { ...prev, [id]: aspect };
      try { localStorage.setItem("au.videoAspect", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const rawList = localVideos.length ? localVideos : DEFAULT_REELS;
    // Strict 9:16 portrait filter: filter out any 16:9 landscape videos
    const reelsOnly = rawList.filter((v) => {
      if (v.kind === "video") return false;
      if (detectedAspect[v.id] === "landscape") return false;
      return true;
    });
    const forReels = reelsOnly.length ? reelsOnly : DEFAULT_REELS;
    if (!forReels.length) return [];
    if (mode === "study") return forReels.filter((v) => isStudyReel(v.id));
    if (mode === "category") {
      const cid = activeCategoryId || reelCategories[0]?.id;
      if (cid) return forReels.filter((v) => getReelCategoryId(v.id) === cid);
      return forReels.filter((v) => getReelCategoryId(v.id) !== null);
    }
    if (mode === "playlist") {
      const pid = activePlaylistId || reelPlaylists[0]?.id;
      if (pid) {
        const pl = reelPlaylists.find((x) => x.id === pid) || reelPlaylists[0];
        if (pl) return pl.videoIds.map((id) => forReels.find((v) => v.id === id)).filter(Boolean) as VideoItem[];
      }
      return [];
    }
    return forReels;
  }, [mode, localVideos, detectedAspect, isStudyReel, activeCategoryId, activePlaylistId, reelCategories, reelPlaylists, getReelCategoryId]);

  const activeVideo = filtered[activeIdx] ?? null;

  useEffect(() => {
    filtered.forEach((r, i) => {
      const v = videoRefs.current[r.id];
      if (!v) return;
      if (i === activeIdx) {
        loopCount.current[r.id] = 0;
        v.currentTime = 0;
        Promise.resolve(v.play()).catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [activeIdx, filtered]);

  const feed = useCallback((idx: number) => {
    const c = containerRef.current;
    if (!c) return;
    const idx2 = Math.max(0, Math.min(filtered.length - 1, idx));
    c.scrollTo({ top: idx2 * c.clientHeight, behavior: "smooth" });
    setActiveIdx(idx2);
  }, [filtered]);

  const onScroll = () => {
    const c = containerRef.current;
    if (!c) return;
    const idx = Math.round(c.scrollTop / c.clientHeight);
    if (idx >= 0 && idx < filtered.length && idx !== activeIdx) setActiveIdx(idx);
  };

  const onEnded = (id: string) => {
    const v = videoRefs.current[id];
    if (!v) return;
    loopCount.current[id] = (loopCount.current[id] || 0) + 1;
    const done = loopCount.current[id] >= reelLoops;
    const i = filtered.findIndex((x) => x.id === id);
    if (reelAutoScroll && done && i < filtered.length - 1) feed(i + 1);
    else { v.currentTime = 0; Promise.resolve(v.play()).catch(() => {}); }
  };

  const flash = (m: string) => { setHint(m); window.setTimeout(() => setHint(null), 1200); };

  const seekBy = (d: number) => {
    const v = videoRefs.current[activeVideo?.id || ""];
    if (!v || !activeVideo) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d));
  };

  const like = useCallback((id: string, burst = false) => {
    setLikes((l) => {
      const on = !l[id];
      setLikeCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + (on ? 1 : -1)) }));
      return { ...l, [id]: on };
    });
    buzz(18);
    if (burst) { setBurstAt(id); window.setTimeout(() => setBurstAt(null), 800); }
  }, [buzz]);

  const share = useCallback(async (r: VideoItem) => {
    setShareCounts((s) => ({ ...s, [r.id]: (s[r.id] || 0) + 1 }));
    buzz(14);
    const ok = await nativeShare({
      title: r.title,
      text: `Check out "${r.title}" on Audenic`,
      url: typeof location !== "undefined" ? location.href : undefined,
    });
    flash(ok ? "Shared ✔" : "Couldn’t share right now");
  }, [buzz]);

  const postComment = useCallback((id: string) => {
    const text = draft.trim();
    if (!text) return;
    setComments((c) => ({
      ...c,
      [id]: [{ id: `c-${Date.now()}`, user: profile.name || "Mwijay Davie", text, ts: Date.now() }, ...(c[id] || [])],
    }));
    setDraft("");
    buzz(12);
  }, [draft, profile.name, buzz]);

  const deleteComment = useCallback((videoId: string, cid: string) => {
    setComments((c) => ({ ...c, [videoId]: (c[videoId] || []).filter((x) => x.id !== cid) }));
  }, []);

  const gestures = useGestures({
    enabled: gesturesOn,
    onSwipeUp: () => feed(activeIdx + 1),
    onSwipeDown: () => feed(activeIdx - 1),
    onSingleTap: () => { const v = videoRefs.current[activeVideo?.id || ""]; if (!v) return; if (v.paused) v.play(); else v.pause(); },
    onDoubleTap: (x, w) => {
      if (!activeVideo) return;
      if (x < w * 0.33) { seekBy(-15); flash("−15s"); }
      else if (x > w * 0.67) { seekBy(15); flash("+15s"); }
      else like(activeVideo.id, true);
    },
    onLongPress: () => { if (activeVideo) { setTargetVideo(activeVideo); buzz(22); } },
  });

  const [isScanning, setIsScanning] = useState(false);
  const [showScanMenu, setShowScanMenu] = useState(false);

  const probeIsVertical = (src: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.muted = true;
      probe.src = src;
      const t = setTimeout(() => {
        probe.src = "";
        resolve(false);
      }, 4000);
      probe.onloadedmetadata = () => {
        clearTimeout(t);
        const w = probe.videoWidth || 0;
        const h = probe.videoHeight || 0;
        const vertical = w > 0 && h > 0 && h / w >= 1.2;
        probe.src = "";
        resolve(vertical);
      };
      probe.onerror = () => {
        clearTimeout(t);
        probe.src = "";
        resolve(false);
      };
    });
  };

  const handleFolderScan = async () => {
    setShowScanMenu(false);
    if (!isDesktop()) {
      fileRef.current?.click();
      return;
    }
    try {
      const folder = await pickFolder();
      if (!folder) return;

      setIsScanning(true);
      flash("Scanning folder for videos...");

      const library = await scanDirectory(folder);
      const vids = library.videos;
      if (!vids.length) {
        flash("No videos found in selected folder");
        setIsScanning(false);
        return;
      }

      flash(`Probing ${vids.length} videos for vertical portrait format...`);

      const verticalItems: VideoItem[] = [];
      const standardItems: VideoItem[] = [];

      for (let i = 0; i < vids.length; i++) {
        const v = vids[i];
        const srcUrl = toAssetUrl(v.path);
        const isVert = await probeIsVertical(srcUrl);

        const item: VideoItem = {
          id: v.id,
          title: v.title,
          src: srcUrl,
          size: v.size,
          kind: isVert ? "reel" : "video",
          cover: svgCover(v.title, localVideos.length + i),
        };

        if (isVert) {
          verticalItems.push(item);
        } else {
          standardItems.push(item);
        }
      }

      addDesktopVideos([...verticalItems, ...standardItems]);
      if (verticalItems.length > 0) {
        flash(`✨ Discovered ${verticalItems.length} vertical reels!`);
      } else {
        flash(`Added ${standardItems.length} videos (no vertical reels)`);
      }
    } catch (e) {
      console.error("Folder scan error:", e);
      flash("Failed to scan folder");
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileScan = async () => {
    setShowScanMenu(false);
    if (isDesktop()) {
      const files = await pickVideoFiles();
      if (!files.length) return;
      setIsScanning(true);
      flash(`Probing ${files.length} selected videos...`);

      const items: VideoItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const srcUrl = toAssetUrl(f);
        const isVert = await probeIsVertical(srcUrl);
        const filename = f.split(/[\\/]/).pop() || "video.mp4";
        const title = filename.replace(/\.[^/.]+$/, "");

        items.push({
          id: `desktop-vid-${Date.now()}-${i}`,
          title,
          src: srcUrl,
          kind: isVert ? "reel" : "video",
          cover: svgCover(title, localVideos.length + i),
        });
      }
      addDesktopVideos(items);
      const vertCount = items.filter((x) => x.kind === "reel").length;
      flash(vertCount > 0 ? `✨ Added ${vertCount} vertical reels!` : `Added ${items.length} videos`);
      setIsScanning(false);
    } else {
      fileRef.current?.click();
    }
  };

  const addToStudy = (v: VideoItem) => {
    toggleStudyReel(v.id);
    flash(isStudyReel(v.id) ? "Removed from Study Mode" : "Added to Study Mode 🎓");
  };

  return (
    <div className="relative flex flex-col h-full bg-black select-none overflow-hidden">
      {/* Desktop Top Toolbar — neatly clear of the phone frame */}
      <div className="hidden md:flex items-center justify-between border-b border-white/[0.06] bg-[#0A0A0E]/90 px-5 py-2.5 backdrop-blur-md z-30 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">Reels Studio</span>
          <span className="text-[11px] text-white/45">
            {filtered.length} clips • loops {reelLoops}×
          </span>
        </div>

        {/* Mode chips centered */}
        {!chromeHidden && filtered.length > 0 && (
          <div className="flex gap-1 rounded-full border border-white/10 bg-black/60 p-1 backdrop-blur-md shadow-lg">
            {([
              ["for-you", "Feed"],
              ["study", "Study"],
              ["category", "Categories"],
              ["playlist", "Playlists"],
            ] as [Mode, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setMode(m); setActiveIdx(0); containerRef.current?.scrollTo({ top: 0 }); buzz(10); }}
                className={`press shrink-0 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-tight transition ${
                  mode === m
                    ? (m === "study" ? "bg-yellow-300 text-black shadow" : "bg-[var(--accent)] text-black shadow")
                    : "text-white/70 hover:text-white"
                }`}
              >
                {m === "study" && <GraduationCap size={12} className="inline mr-1 -mt-0.5" />}
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAudioOnly((a) => !a); buzz(14); flash(audioOnly ? "Video is back" : "Audio-only mode"); }}
            className={`press flex h-8 w-8 place-items-center rounded-xl backdrop-blur transition ${audioOnly ? "bg-[var(--accent)] text-black" : "bg-white/10 text-white hover:bg-white/15"}`}
            title="Audio only mode"
          >
            <Headphones size={15} />
          </button>
          <button onClick={() => setMuted((m) => !m)} className="press flex h-8 w-8 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/15 transition">{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
          
          <div className="relative">
            <button
              onClick={() => {
                buzz(14);
                if (isDesktop()) {
                  setShowScanMenu((prev) => !prev);
                } else {
                  fileRef.current?.click();
                }
              }}
              disabled={isScanning}
              className="press flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-black transition hover:opacity-90 active:scale-95"
            >
              <Folder size={13} />
              {isScanning ? "Scanning..." : "Scan"}
            </button>

            {showScanMenu && (
              <div className="absolute right-0 top-11 z-50 flex w-60 flex-col gap-1 rounded-2xl border border-white/10 bg-[#0F0F14]/95 p-2 shadow-2xl backdrop-blur-xl animate-fade-in">
                <button
                  onClick={handleFolderScan}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-white hover:bg-white/10 active:scale-95 transition"
                >
                  <Folder size={16} className="text-[var(--accent)]" />
                  <div>
                    <p className="font-bold text-white">Scan Video Folder</p>
                    <p className="text-[10px] text-white/50">Auto-detect portrait (9:16) reels</p>
                  </div>
                </button>
                <button
                  onClick={handleFileScan}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-white hover:bg-white/10 active:scale-95 transition border-t border-white/5"
                >
                  <Play size={16} className="text-white/70" />
                  <div>
                    <p className="font-bold text-white">Select Video Files</p>
                    <p className="text-[10px] text-white/50">Pick single or multiple videos</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Top Floating Controls */}
      <div className={`md:hidden absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-11 transition-opacity duration-300 ${chromeHidden ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        <div className="pointer-events-none">
          <p className="text-[17px] font-bold text-white drop-shadow">Reels</p>
          <p className="text-[9.5px] text-white/50">{`For you · loops ${reelLoops}× · ${localVideos.length} on device`}</p>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button
            onClick={() => { setAudioOnly((a) => !a); buzz(14); flash(audioOnly ? "Video is back" : "Audio-only — only sound plays"); }}
            className={`press flex h-9 w-9 place-items-center rounded-full backdrop-blur ${audioOnly ? "bg-[var(--accent)] text-black" : "bg-white/15 text-white"}`}
            title="Audio only"
          >
            <Headphones size={16} />
          </button>
          <button onClick={() => setMuted((m) => !m)} className="press flex h-9 w-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur">{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
          
          <div className="relative">
            <button
              onClick={() => {
                buzz(14);
                if (isDesktop()) {
                  setShowScanMenu((prev) => !prev);
                } else if (isNative()) {
                  flash("Scanning videos from storage...");
                  scanNativeVideos().then((n) => flash(n > 0 ? `Found ${n} videos!` : "No new videos found"));
                } else {
                  fileRef.current?.click();
                }
              }}
              disabled={isScanning}
              className="press flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/25 active:scale-95 transition"
            >
              <Folder size={13} />
              {isScanning ? "Scanning..." : "Scan"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile mode chips */}
      {!chromeHidden && filtered.length > 0 && (
        <div className="md:hidden absolute left-1/2 top-14 z-30 flex -translate-x-1/2 gap-1 rounded-full border border-white/10 bg-black/60 p-1 backdrop-blur-md shadow-lg">
          {([
            ["for-you", "Feed"],
            ["study", "Study"],
            ["category", "Categories"],
            ["playlist", "Playlists"],
          ] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setActiveIdx(0); containerRef.current?.scrollTo({ top: 0 }); buzz(10); }}
              className={`press shrink-0 rounded-full px-3 py-1 text-[9.5px] font-bold uppercase tracking-tight transition ${mode === m ? (m === "study" ? "bg-yellow-300 text-black shadow" : "bg-[var(--accent)] text-black shadow") : "text-white/70 hover:text-white"}`}
            >
              {m === "study" && <GraduationCap size={11} className="inline mr-1 -mt-0.5" />}
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Eye toggle */}
      <button
        onClick={() => { onChromeHiddenChange(!chromeHidden); buzz(14); flash(chromeHidden ? "Controls shown" : "Clean view — footer hidden"); }}
        className="press absolute right-3 z-30 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur md:hidden"
        style={{ top: chromeHidden ? 14 : 106 }}
        title={chromeHidden ? "Show footer" : "Hide footer"}
      >
        {chromeHidden ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>

      <input ref={fileRef} type="file" accept="video/*" multiple hidden onChange={(e) => addLocalVideos(e.target.files)} />

      {/* Empty state */}
      {!filtered.length && (
        <div className="flex h-full flex-col items-center justify-center px-8 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/10 text-[var(--accent)]">
            <Film size={36} />
          </div>
          <p className="pt-4 text-[18px] font-bold text-white">No reels yet</p>
          <p className="max-w-[280px] pt-2 text-[12.5px] text-white/50">Tap Scan at the top to add videos from your device and start scrolling like TikTok.</p>
          <button
            onClick={() => {
              if (isDesktop()) {
                handleFolderScan();
              } else {
                fileRef.current?.click();
              }
            }}
            className="press mt-6 rounded-full bg-[var(--accent)] px-5 py-2.5 text-[13px] font-bold text-black shadow-lg hover:opacity-90 active:scale-95 transition"
          >
            {isDesktop() ? "Scan folder for vertical reels" : "Add reels from device"}
          </button>
        </div>
      )}

      {/* Feed */}
      {filtered.length > 0 && (
        <div ref={containerRef} onScroll={onScroll} className="no-scrollbar smooth-scroll h-full snap-y snap-mandatory overflow-y-scroll" style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch", willChange: "scroll-position" }}>
          {filtered.map((r, i) => (
            <ReelItem
              key={r.id}
              reel={r}
              index={i}
              isActive={i === activeIdx}
              isNearby={Math.abs(i - activeIdx) <= 1}
              muted={muted}
              audioOnly={audioOnly}
              chromeHidden={chromeHidden}
              isStudy={isStudyReel(r.id)}
              liked={!!likes[r.id]}
              likeCount={likeCounts[r.id] || 0}
              commentCount={(comments[r.id] || []).length}
              shareCount={shareCounts[r.id] || 0}
              burst={burstAt === r.id}
              categoryName={reelCategories.find((c: ReelCategory) => c.id === getReelCategoryId(r.id))?.name || null}
              playlistsString={reelPlaylists.filter((pl: ReelPlaylist) => pl.videoIds.includes(r.id)).map((pl) => pl.name).join(" · ")}
              videoRef={(el) => { videoRefs.current[r.id] = el; }}
              onEnded={() => onEnded(r.id)}
              onLike={() => like(r.id)}
              onComment={() => setCommentSheet(r.id)}
              onShare={() => share(r)}
              onStudy={() => addToStudy(r)}
              onOpenMeta={() => setTargetVideo(r)}
              onDetectedAspect={markAspect}
              gestures={gestures}
            />
          ))}
        </div>
      )}

      {hint && <div className="pointer-events-none absolute left-1/2 top-[10%] z-40 -translate-x-1/2 pop-in rounded-full bg-black/70 px-3.5 py-1.5 text-[11.5px] font-semibold text-white backdrop-blur">{hint}</div>}

      {/* Comments sheet */}
      {commentSheet && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end" onClick={() => setCommentSheet(null)}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="slide-up relative max-h-[75%] rounded-t-[32px] border-t border-white/10 bg-[#141418] p-5 shadow-[0_-20px_50px_rgba(0,0,0,0.9)]"
            style={{ paddingBottom: "calc(90px + env(safe-area-inset-bottom, 16px))" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <p className="pb-2 text-[14px] font-semibold text-white">{(comments[commentSheet] || []).length} comments</p>
            <div className="no-scrollbar smooth-scroll max-h-56 space-y-3 overflow-y-auto">
              {(comments[commentSheet] || []).map((c) => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent)]/20 text-[12px] font-bold text-[var(--accent)]">{(c.user[0] || "?").toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-semibold text-white">{c.user}</p>
                      <button onClick={() => deleteComment(commentSheet, c.id)} className="text-[10px] text-white/30 hover:text-rose-300">Delete</button>
                    </div>
                    <p className="clamp-3 pt-0.5 text-[13px] leading-snug text-white/75">{c.text}</p>
                    <p className="pt-0.5 text-[9.5px] text-white/25">{new Date(c.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
              {!(comments[commentSheet] || []).length && <p className="py-6 text-center text-[12px] text-white/35">Be the first to comment!</p>}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && postComment(commentSheet)}
                placeholder="Add a comment…"
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[13px] text-white outline-none focus:border-[var(--accent)]"
              />
              <button onClick={() => postComment(commentSheet)} disabled={!draft.trim()} className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-black disabled:opacity-40"><Send size={15} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Organize / metadata sheet */}
      {targetVideo && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end" onClick={() => setTargetVideo(null)}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="slide-up relative max-h-[85%] overflow-y-auto rounded-t-[32px] border-t border-white/10 bg-[#141418] p-5 shadow-[0_-20px_50px_rgba(0,0,0,0.9)]"
            style={{ paddingBottom: "calc(100px + env(safe-area-inset-bottom, 20px))" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-start gap-3 pb-2">
              {targetVideo.cover && <img src={targetVideo.cover} alt="" className="h-16 w-16 rounded-2xl object-cover" />}
              <div className="min-w-0">
                <p className="clamp-1 text-[15px] font-bold text-white">{targetVideo.title}</p>
                <p className="text-[11px] text-white/40">{(targetVideo.size / 1048576).toFixed(1)} MB • Local device video</p>
              </div>
            </div>

            <button onClick={() => addToStudy(targetVideo)} className="press mt-2 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left">
              <span className="flex items-center gap-2 text-[13px] text-white"><span className={`h-2.5 w-2.5 rounded-full ${isStudyReel(targetVideo.id) ? "bg-yellow-300" : "bg-white/25"}`} /> Add to Study Mode</span>
              <span className="text-[11px] text-white/45">Study tab only</span>
            </button>

            <p className="pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Category</p>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-2">
              {reelCategories.map((c: ReelCategory) => {
                const active = getReelCategoryId(targetVideo.id) === c.id;
                return (
                  <button key={c.id} onClick={() => setReelCategoryAssignment(targetVideo.id, active ? null : c.id)} className={`press shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${active ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/70"}`}>
                    {active ? `✓ ${c.name}` : c.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[12px] text-white outline-none focus:border-[var(--accent)]" />
              <button onClick={() => { if (newCategory.trim()) { createReelCategory(newCategory.trim()); setNewCategory(""); } }} className="press rounded-xl bg-[var(--accent)] px-3 text-[11px] font-bold text-black">Create</button>
            </div>

            <p className="pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Playlists</p>
            <div className="space-y-1.5 overflow-y-auto pb-1">
              {reelPlaylists.map((pl: ReelPlaylist) => {
                const included = pl.videoIds.includes(targetVideo.id);
                return (
                  <button key={pl.id} onClick={() => included ? removeFromReelPlaylist(pl.id, targetVideo.id) : addToReelPlaylist(pl.id, targetVideo.id)} className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-2.5 text-left">
                    <span className={`text-[12.5px] ${included ? "text-[var(--accent)]" : "text-white/85"}`}>{pl.name}</span>
                    <span className={`grid h-7 w-7 place-items-center rounded-full transition ${included ? "bg-[var(--accent)] text-black" : "bg-white/10 text-white"}`}>{included ? <Check size={14} /> : <Plus size={14} />}</span>
                  </button>
                );
              })}
              {!reelPlaylists.length && <p className="pb-1 text-[11px] text-white/30">No playlists yet — create some in My Reels.</p>}
            </div>
            <div className="mt-2 flex gap-2">
              <input value={newPlaylist} onChange={(e) => setNewPlaylist(e.target.value)} placeholder="New playlist" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[12px] text-white outline-none focus:border-[var(--accent)]" />
              <button onClick={() => { if (newPlaylist.trim()) { createReelPlaylist(newPlaylist.trim()); setNewPlaylist(""); } }} className="press rounded-xl bg-[var(--accent)] px-3 text-[11px] font-bold text-black">Create</button>
            </div>

            <p className="pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Tags</p>
            <div className="no-scrollbar flex flex-wrap gap-1.5 pb-3">
              {REEL_TAGS.slice(0, 12).map((t) => {
                const active = getReelTags(targetVideo.id).includes(String(t));
                return (
                  <button key={t} onClick={() => toggleReelTag(targetVideo.id, String(t))} className={`press shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${active ? "bg-[var(--accent)] text-black" : "bg-white/[0.07] text-white/70"}`}>#{t}</button>
                );
              })}
            </div>

            <button onClick={() => setTargetVideo(null)} className="press w-full rounded-full bg-[var(--accent)] py-3 text-[13px] font-bold text-black">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ReelItemProps {
  reel: VideoItem;
  index: number;
  isActive: boolean;
  isNearby: boolean;
  muted: boolean;
  audioOnly: boolean;
  chromeHidden: boolean;
  isStudy: boolean;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  burst: boolean;
  categoryName: string | null;
  playlistsString: string;
  videoRef: (el: HTMLVideoElement | null) => void;
  onEnded: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onStudy: () => void;
  onOpenMeta: () => void;
  onDetectedAspect?: (id: string, aspect: "portrait" | "landscape") => void;
  gestures: Record<string, unknown>;
}

function ReelItem({
  reel, index, isActive, isNearby, muted, audioOnly, chromeHidden, isStudy, liked, likeCount, commentCount, shareCount, burst,
  categoryName, playlistsString, videoRef, onEnded, onLike, onComment, onShare, onStudy, onOpenMeta, onDetectedAspect, gestures,
}: ReelItemProps) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const v = localRef.current;
    if (!v) return;
    const p = () => setPaused(false);
    const u = () => setPaused(true);
    v.addEventListener("play", p);
    v.addEventListener("pause", u);
    return () => { v.removeEventListener("play", p); v.removeEventListener("pause", u); };
  }, [isNearby]);

  useEffect(() => {
    const v = localRef.current;
    if (!v) return;
    if (isActive) {
      v.currentTime = 0;
      const playPromise = v.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } else {
      v.pause();
    }
  }, [isActive, isNearby]);

  return (
    <div
      className="relative flex h-full w-full snap-start items-center justify-center overflow-hidden bg-[#0A0A0E]"
      style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
    >
      {/* Ambient blurred backdrop on desktop */}
      {reel.cover && (
        <img
          src={reel.cover}
          alt=""
          className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover opacity-25 blur-3xl md:block scale-110 select-none"
        />
      )}

      {/* True 9:16 Vertical Smartphone / Reel Frame on Desktop */}
      <div className="relative flex h-full w-full md:max-w-[420px] md:aspect-[9/16] md:max-h-[92vh] items-center justify-center overflow-hidden md:rounded-3xl md:border md:border-white/15 md:shadow-[0_10px_50px_rgba(0,0,0,0.8)] bg-black">
        {/* video keeps PLAYING in audio-only mode — only the picture is hidden */}
        {isNearby ? (
          <video
            ref={(el) => { localRef.current = el; videoRef(el); }}
            src={reel.src}
            poster={reel.cover}
            muted={muted}
            playsInline
            preload={isActive ? "auto" : "metadata"}
            onEnded={onEnded}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth > 0 && v.videoHeight > 0) {
                const isPortrait = (v.videoHeight / v.videoWidth) >= 1.15;
                onDetectedAspect?.(reel.id, isPortrait ? "portrait" : "landscape");
              }
            }}
            onClick={() => {
              const v = localRef.current;
              if (v) {
                if (v.paused) v.play().catch(() => {});
                else v.pause();
              }
            }}
            className={`h-full w-full object-cover transition-opacity duration-300 ${audioOnly ? "opacity-0" : "opacity-100"}`}
          />
        ) : (
          <div className="relative h-full w-full bg-[#0A0A0E] flex items-center justify-center">
            {reel.cover ? (
              <img src={reel.cover} alt={reel.title} className="h-full w-full object-cover opacity-60 select-none" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/5 text-white/40">
                <Film size={28} />
              </div>
            )}
          </div>
        )}

        {/* audio-only overlay */}
        {audioOnly && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black">
            {reel.cover && <img src={reel.cover} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-3xl" />}
            <div className="relative flex flex-col items-center">
              <span className={`grid h-20 w-20 place-items-center rounded-[26px] bg-[var(--accent)]/15 text-[var(--accent)] ${!paused ? "pulse-soft" : ""}`}>
                <Headphones size={34} />
              </span>
              <p className="clamp-2 mt-3 max-w-[230px] text-center text-[14px] font-bold text-white">{reel.title}</p>
              <p className="mt-1 text-[11px] text-white/40">Audio-only — sound keeps playing</p>
              <div className="mt-4 flex h-8 items-end gap-[3px]">
                {Array.from({ length: 16 }).map((_, i) => (
                  <span key={i} className="w-[3px] rounded-full bg-[var(--accent)]" style={{ height: "40%", opacity: paused ? 0.25 : 0.9, animation: paused ? undefined : `viz ${0.4 + (i % 5) * 0.08}s ${i * 0.04}s ease-in-out infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <ReelProgress video={localRef.current} />
        <div {...gestures} className="absolute inset-0 z-[5]" style={{ touchAction: "pan-y" }} />

        {burst && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <Heart size={76} filled className="heart-burst text-rose-500 drop-shadow-[0_0_25px_rgba(244,63,94,0.7)]" />
          </div>
        )}
        {paused && !audioOnly && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="pop-in grid h-16 w-16 place-items-center rounded-full bg-black/50 text-white backdrop-blur"><Play size={26} /></span>
          </div>
        )}

        {!chromeHidden && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 pt-16 md:pt-4">
            <div className="flex items-center gap-1.5">
              {isStudy && <span className="rounded-full bg-yellow-300/25 border border-yellow-300/30 px-2 py-0.5 text-[9px] font-bold text-yellow-300">STUDY</span>}
              {categoryName && <span className="rounded-full bg-white/10 border border-white/10 px-2 py-0.5 text-[9px] font-bold text-white/80">{categoryName}</span>}
              {playlistsString && <span className="rounded-full bg-indigo-400/20 border border-indigo-400/30 px-2 py-0.5 text-[9px] font-bold text-indigo-300">{playlistsString}</span>}
            </div>
          </div>
        )}

        {/* action rail — likes / comments / share / study, all live counts */}
        {!chromeHidden && (
          <div className="absolute bottom-24 md:bottom-8 right-3 z-10 flex flex-col items-center gap-5">
            <ActionBtn icon={<Heart size={26} filled={liked} />} label={`${likeCount}`} onClick={onLike} active={liked} />
            <ActionBtn icon={<Comment size={26} />} label={`${commentCount}`} onClick={onComment} />
            <ActionBtn icon={<Share size={24} />} label={`${shareCount}`} onClick={onShare} />
            <ActionBtn icon={<GraduationCap size={22} />} label="Study" onClick={onStudy} active={isStudy} />
            <ActionBtn icon={<Dots size={22} />} label="" onClick={onOpenMeta} />
          </div>
        )}

        <div className={`absolute bottom-24 md:bottom-8 left-4 right-16 z-10 transition-opacity duration-300 ${chromeHidden ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          <p className="clamp-2 text-[15px] font-extrabold leading-snug text-white drop-shadow">{reel.title}</p>
          <p className="pt-0.5 text-[11px] text-white/50 drop-shadow">Reel #{index + 1} • Local device{audioOnly ? " • audio-only" : ""}</p>
        </div>
      </div>
    </div>
  );
}

function ReelProgress({ video }: { video: HTMLVideoElement | null }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (!video) return;
    const onTime = () => { if (video.duration > 0) setPct((video.currentTime / video.duration) * 100); };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [video]);
  return (
    <div className="absolute inset-x-0 top-0 z-10 h-0.5 bg-white/10">
      <div className="h-full bg-[var(--accent)] transition-[width] duration-150" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ActionBtn({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className="press flex flex-col items-center gap-1 active:scale-90">
      <span className={active ? "text-rose-500 drop-shadow-[0_0_10px_color-mix(in_srgb,#f43f5f_50%,transparent)]" : "text-white drop-shadow"}>{icon}</span>
      {label !== "" && <span className="text-[10px] font-bold tabular-nums tracking-tight text-white/85 drop-shadow">{label}</span>}
    </button>
  );
}

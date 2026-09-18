import { useEffect, useRef } from "react";
import { isNative, nativeUpdateMetadata, listenNativePlayback } from "./nativeBridge";

export type MediaSessionProps = {
  title?: string;
  artist?: string;
  album?: string;
  cover?: string;
  /** Raw album art path (file:// URI) from scanner — before Capacitor URL conversion */
  rawAlbumArt?: string;
  /** Absolute filesystem path to cached cover art JPEG — loadable by native service directly */
  albumArtFilePath?: string;
  isPlaying: boolean;
  isLiked?: boolean;
  progress: number;
  duration: number;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (seconds: number) => void;
  onSeekBy: (delta: number) => void;
  onStop: () => void;
  /** Called when native ExoPlayer auto-advances to a new track in background */
  /** Called when user taps Like / Heart button on the native Android notification card */
  onLike?: () => void;
  onTrackChanged?: (trackId: string, index: number) => void;
  /** Called when native ExoPlayer play state changes (without re-sending command) */
  onNativePlay?: () => void;
  onNativePause?: () => void;
  /** Called when native ExoPlayer sends progress updates (background-safe) */
  onProgress?: (positionSec: number, durationSec: number) => void;
};

/**
 * Custom Media Session API Hook for Lock Screen & Notification Controls.
 * Works across desktop browsers and Android/Capacitor webviews.
 * Also syncs metadata to the native Android foreground notification.
 */
export function useMediaSession(props: MediaSessionProps) {
  const {
    title, artist, album, cover, rawAlbumArt, albumArtFilePath,
    isPlaying, isLiked, progress, duration, speed,
    onPlay, onPause, onNext, onPrev, onSeek, onSeekBy, onStop, onLike,
    onTrackChanged, onNativePlay, onNativePause, onProgress,
  } = props;

  // Track whether an event originated from native to prevent feedback loops
  const nativeOriginRef = useRef(false);

  // 1. Native lockscreen / notification / ExoPlayer event listener bridge
  useEffect(() => {
    const unsub = listenNativePlayback((event) => {
      const action = typeof event === "string" ? event : event.action;

      if (action === "pause") {
        onNativePause?.();
      } else if (action === "play") {
        onNativePlay?.();
      } else if (action === "next") {
        if (!isNative()) onNext();
      } else if (action === "previous") {
        if (!isNative()) onPrev();
      } else if (action === "stop") {
        onStop();
      } else if (action === "like") {
        onLike?.();
      } else if (action === "seek" && typeof event === "object" && event.position != null) {
        onSeek(event.position / 1000);
      } else if (action === "trackChanged" && typeof event === "object" && event.trackId) {
        onTrackChanged?.(event.trackId, event.index ?? 0);
      } else if (action === "progress" && typeof event === "object" && event.position != null) {
        onProgress?.(event.position / 1000, (event.duration ?? 0) / 1000);
      }
    });
    return () => unsub();
  }, [onPlay, onPause, onNext, onPrev, onStop, onSeek, onLike, onTrackChanged, onNativePlay, onNativePause, onProgress]);

  // 2. Metadata setup — Web Media Session + Native notification
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!title) return;

    try {
      const defaultArtwork = `${location.origin}/favicon.svg`;
      const artSrc = cover && !cover.includes("unsplash") ? cover : defaultArtwork;
      
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: artist || "Audenic",
        album: album || "Audenic Music",
        artwork: [96, 128, 192, 256, 384, 512].map((size) => ({
          src: artSrc,
          sizes: `${size}x${size}`,
          type: "image/png",
        })),
      });

      // Update Desktop Window Title & Taskbar Tooltip
      if (typeof document !== "undefined") {
        const titleText = `${isPlaying ? "▶ " : "⏸ "}${title} • ${artist || "Audenic"} — Audenic`;
        document.title = titleText;
        if (typeof window !== "undefined") {
          const w = window as any;
          if (w.__TAURI__ || w.__TAURI_INTERNALS__) {
            import("@tauri-apps/api/window")
              .then(({ getCurrentWindow }) => getCurrentWindow().setTitle(titleText))
              .catch(() => {});
          }
        }
      }

      // For native notification: prefer the raw file path over the Capacitor-converted URL
      const nativeCoverSrc = albumArtFilePath
        ? `file://${albumArtFilePath}`
        : (rawAlbumArt && rawAlbumArt.length > 5 && !rawAlbumArt.includes("unsplash")
          ? rawAlbumArt
          : artSrc);

      nativeUpdateMetadata(title, artist || "Audenic", nativeCoverSrc, Math.floor(progress * 1000), Math.floor((duration || 0) * 1000), isPlaying, isLiked ?? false);
    } catch (e) {
      console.warn("[MediaSession] Metadata update error caught:", e);
    }
  }, [title, artist, album, cover, rawAlbumArt, albumArtFilePath, duration, isPlaying, isLiked]);

  // 3. Playback state & Action handlers
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;

    try {
      ms.playbackState = isPlaying ? "playing" : "paused";
      // Only send native playback command if NOT on native (browser uses this for sync)
      // On native, ExoPlayer is the source of truth — don't echo state back
      if (!isNative()) {
        // Browser: no native service, so this is a no-op anyway
      }
    } catch { /* */ }

    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { ms.setActionHandler(action, handler); } catch { /* unsupported handler */ }
    };

    // Web Media Session action handlers (browser lockscreen/PiP controls)
    // On native, these are redundant because native MediaSession handles them,
    // but they're harmless and provide fallback for Chrome desktop.
    setHandler("play", () => { onPlay(); });
    setHandler("pause", () => { onPause(); });
    setHandler("previoustrack", () => { onPrev(); });
    setHandler("nexttrack", () => { onNext(); });
    setHandler("seekto", (details) => {
      if (details.seekTime != null) onSeek(details.seekTime);
    });
    setHandler("seekbackward", (details) => {
      onSeekBy(-(details.seekOffset || 10));
    });
    setHandler("seekforward", (details) => {
      onSeekBy(details.seekOffset || 10);
    });
    setHandler("stop", () => { onStop(); });
  }, [isPlaying, title, artist, cover, onPlay, onPause, onNext, onPrev, onSeek, onSeekBy, onStop]);

  // 4. Position state (lockscreen scrub bar)
  useEffect(() => {
    if (!title || !duration || isNaN(duration) || duration <= 0) return;

    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        const safeDuration = Math.max(1, duration || 0);
        const safePosition = Math.min(Math.max(0, progress || 0), Math.max(0, safeDuration - 0.05));
        navigator.mediaSession.setPositionState?.({
          duration: safeDuration,
          playbackRate: speed || 1,
          position: safePosition,
        });
      } catch {
        /* position state not supported */
      }
    }

    // NOTE: We do NOT push progress to native here. On Android, ExoPlayer is
    // the source of truth and sends progress back via onProgress. Pushing
    // position on every tick would seek ExoPlayer → fire progress back → stutter.
    // Explicit user seeks are handled in PlayerContext.seek/seekBy via nativeUpdatePosition.
  }, [title, progress, duration, speed]);
}

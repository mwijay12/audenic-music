import { registerPlugin, Capacitor } from "@capacitor/core";
import { useState, useEffect, useRef, useCallback } from "react";

export interface NativeTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  src: string;
  cover: string;
  duration: number;
}

interface NativeTrackEvent extends NativeTrack {
  index: number;
}

interface NativeState {
  isPlaying: boolean;
  position: number;
  duration: number;
  currentIndex: number;
  currentTrack: NativeTrack | null;
}

interface AudenicPlaybackPlugin {
  setQueueAndPlay(opts: { tracks: NativeTrack[]; startIndex: number }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seekTo(opts: { position: number }): Promise<void>;
  getState(): Promise<NativeState>;
  addListener(
    event: "trackChanged",
    handler: (data: NativeTrackEvent) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    event: "playbackStateChanged",
    handler: (data: { isPlaying: boolean }) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    event: "progressUpdate",
    handler: (data: { position: number; duration: number }) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    event: "queueEnded",
    handler: (data: { ended: boolean }) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    event: "playbackError",
    handler: (data: { message: string }) => void
  ): Promise<{ remove: () => void }>;
  removeAllListeners(): Promise<void>;
}

const AudenicPlayback = registerPlugin<AudenicPlaybackPlugin>("AudenicPlayback", {
  web: {
    async setQueueAndPlay() {
      console.warn("[NativePlayback] Web fallback — setQueueAndPlay");
    },
    async play() {},
    async pause() {},
    async next() {},
    async previous() {},
    async seekTo() {},
    async getState() {
      return {
        isPlaying: false,
        position: 0,
        duration: 0,
        currentIndex: 0,
        currentTrack: null,
      };
    },
    async addListener() {
      return { remove: () => {} };
    },
    async removeAllListeners() {},
  },
});

export interface UseNativePlaybackReturn {
  isNative: boolean;
  isPlaying: boolean;
  currentTrack: NativeTrack | null;
  currentIndex: number;
  position: number;
  duration: number;
  playQueue: (tracks: NativeTrack[], startIndex?: number) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  onTrackChanged: (cb: (track: NativeTrack, index: number) => void) => void;
  onQueueEnded: (cb: () => void) => void;
}

export function useNativePlayback(): UseNativePlaybackReturn {
  const isNative = Capacitor.isNativePlatform();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<NativeTrack | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const trackChangedCb = useRef<((track: NativeTrack, index: number) => void) | null>(null);
  const queueEndedCb = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isNative) return;

    let removers: Array<() => void> = [];

    const setupListeners = async () => {
      try {
        const l1 = await AudenicPlayback.addListener("trackChanged", (data) => {
          setCurrentIndex(data.index);
          const trackObj: NativeTrack = {
            id: data.id,
            title: data.title,
            artist: data.artist,
            album: data.album,
            src: data.src,
            cover: data.cover,
            duration: data.duration,
          };
          setCurrentTrack(trackObj);
          if (trackChangedCb.current) {
            trackChangedCb.current(trackObj, data.index);
          }
        });
        if (l1?.remove) removers.push(() => l1.remove());

        const l2 = await AudenicPlayback.addListener("playbackStateChanged", (data) => {
          setIsPlaying(data.isPlaying);
        });
        if (l2?.remove) removers.push(() => l2.remove());

        const l3 = await AudenicPlayback.addListener("progressUpdate", (data) => {
          setPosition(data.position);
          setDuration(data.duration);
        });
        if (l3?.remove) removers.push(() => l3.remove());

        const l4 = await AudenicPlayback.addListener("queueEnded", () => {
          setIsPlaying(false);
          if (queueEndedCb.current) {
            queueEndedCb.current();
          }
        });
        if (l4?.remove) removers.push(() => l4.remove());

        const l5 = await AudenicPlayback.addListener("playbackError", (data) => {
          console.error("[NativePlayback] Playback error event:", data.message);
        });
        if (l5?.remove) removers.push(() => l5.remove());

        // Fetch initial state
        const state = await AudenicPlayback.getState();
        setIsPlaying(state.isPlaying);
        setPosition(state.position);
        setDuration(state.duration);
        setCurrentIndex(state.currentIndex);
        setCurrentTrack(state.currentTrack);
      } catch (err) {
        console.error("[NativePlayback] Failed to set up listeners:", err);
      }
    };

    setupListeners();

    return () => {
      removers.forEach((r) => r());
    };
  }, [isNative]);

  const playQueue = useCallback(
    async (tracks: NativeTrack[], startIndex: number = 0) => {
      if (!isNative) return;
      try {
        if (tracks.length > 0 && startIndex >= 0 && startIndex < tracks.length) {
          setCurrentTrack(tracks[startIndex]);
          setCurrentIndex(startIndex);
        }
        await AudenicPlayback.setQueueAndPlay({ tracks, startIndex });
      } catch (err) {
        console.error("[NativePlayback] playQueue error:", err);
      }
    },
    [isNative]
  );

  const play = useCallback(async () => {
    if (!isNative) return;
    try {
      await AudenicPlayback.play();
    } catch (err) {
      console.error("[NativePlayback] play error:", err);
    }
  }, [isNative]);

  const pause = useCallback(async () => {
    if (!isNative) return;
    try {
      await AudenicPlayback.pause();
    } catch (err) {
      console.error("[NativePlayback] pause error:", err);
    }
  }, [isNative]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  const next = useCallback(async () => {
    if (!isNative) return;
    try {
      await AudenicPlayback.next();
    } catch (err) {
      console.error("[NativePlayback] next error:", err);
    }
  }, [isNative]);

  const previous = useCallback(async () => {
    if (!isNative) return;
    try {
      await AudenicPlayback.previous();
    } catch (err) {
      console.error("[NativePlayback] previous error:", err);
    }
  }, [isNative]);

  const seekTo = useCallback(
    async (ms: number) => {
      if (!isNative) return;
      try {
        await AudenicPlayback.seekTo({ position: ms });
      } catch (err) {
        console.error("[NativePlayback] seekTo error:", err);
      }
    },
    [isNative]
  );

  const onTrackChanged = useCallback((cb: (track: NativeTrack, index: number) => void) => {
    trackChangedCb.current = cb;
  }, []);

  const onQueueEnded = useCallback((cb: () => void) => {
    queueEndedCb.current = cb;
  }, []);

  return {
    isNative,
    isPlaying,
    currentTrack,
    currentIndex,
    position,
    duration,
    playQueue,
    play,
    pause,
    togglePlay,
    next,
    previous,
    seekTo,
    onTrackChanged,
    onQueueEnded,
  };
}

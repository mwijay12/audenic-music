import { registerPlugin, Capacitor } from "@capacitor/core";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  parseLrc,
  getActiveLrcLine,
  ParsedLrc,
  LrcLine,
} from "./lrcParser";

interface LrcReaderPlugin {
  findAndReadLrc(opts: { audioPath: string }): Promise<{
    found: boolean;
    content: string | null;
    lrcPath: string | null;
    matchType: "exact" | "fuzzy" | "known_dir" | "none" | "error";
  }>;
  listLrcFiles(opts: { directory: string }): Promise<{
    files: string[];
    count: number;
  }>;
}

const LrcReader = registerPlugin<LrcReaderPlugin>("LrcReader", {
  web: {
    async findAndReadLrc() {
      return { found: false, content: null, lrcPath: null, matchType: "none" };
    },
    async listLrcFiles() {
      return { files: [], count: 0 };
    },
  },
});

export interface UseLrcLyricsProps {
  audioPath: string | null;
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  isLocalTrack: boolean;
}

export interface UseLrcLyricsReturn {
  parsedLrc: ParsedLrc | null;
  lines: LrcLine[];
  activeLineIndex: number;
  activeLine: LrcLine | null;
  lrcPath: string | null;
  matchType: string | null;
  isLoading: boolean;
  hasLyrics: boolean;
  isEnhanced: boolean;
  seekToLine: (lineIndex: number) => void;
}

const lrcCache = new Map<string, ParsedLrc | null>();

export function useLrcLyrics({
  audioPath,
  audioElement,
  isPlaying,
  isLocalTrack,
}: UseLrcLyricsProps): UseLrcLyricsReturn {
  const [parsedLrc, setParsedLrc] = useState<ParsedLrc | null>(null);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [lrcPath, setLrcPath] = useState<string | null>(null);
  const [matchType, setMatchType] = useState<string | null>(null);

  const rafRef = useRef<number | null>(null);
  const lastIndexRef = useRef(-1);

  useEffect(() => {
    setParsedLrc(null);
    setActiveLineIndex(-1);
    setLrcPath(null);
    setMatchType(null);
    lastIndexRef.current = -1;

    if (!audioPath || !isLocalTrack) return;
    if (!Capacitor.isNativePlatform()) return;

    if (lrcCache.has(audioPath)) {
      const cached = lrcCache.get(audioPath) ?? null;
      setParsedLrc(cached);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const loadLrc = async () => {
      try {
        const result = await LrcReader.findAndReadLrc({ audioPath });
        if (cancelled) return;

        if (result.found && result.content) {
          const parsed = parseLrc(result.content);
          lrcCache.set(audioPath, parsed);
          setParsedLrc(parsed);
          setLrcPath(result.lrcPath);
          setMatchType(result.matchType);
        } else {
          lrcCache.set(audioPath, null);
          setParsedLrc(null);
        }
      } catch {
        if (!cancelled) setParsedLrc(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadLrc();
    return () => { cancelled = true; };
  }, [audioPath, isLocalTrack]);

  useEffect(() => {
    const audio = audioElement;
    if (!audio || !parsedLrc || parsedLrc.lines.length === 0) {
      setActiveLineIndex(-1);
      return;
    }

    function tick() {
      if (!audio) return;
      const currentMs = audio.currentTime * 1000;
      const idx = getActiveLrcLine(parsedLrc!.lines, currentMs);

      if (idx !== lastIndexRef.current) {
        lastIndexRef.current = idx;
        setActiveLineIndex(idx);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      const currentMs = audio.currentTime * 1000;
      const idx = getActiveLrcLine(parsedLrc.lines, currentMs);
      setActiveLineIndex(idx);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [audioElement, parsedLrc, isPlaying]);

  const seekToLine = useCallback(
    (lineIndex: number) => {
      if (!audioElement || !parsedLrc) return;
      const line = parsedLrc.lines[lineIndex];
      if (!line) return;
      audioElement.currentTime = line.time / 1000;
    },
    [audioElement, parsedLrc]
  );

  const lines = parsedLrc?.lines ?? [];
  const hasLyrics = parsedLrc !== null && lines.length > 0;
  const isEnhanced = parsedLrc?.isEnhanced ?? false;
  const activeLine = activeLineIndex >= 0 ? lines[activeLineIndex] : null;

  return {
    parsedLrc,
    lines,
    activeLineIndex,
    activeLine,
    lrcPath,
    matchType,
    isLoading,
    hasLyrics,
    isEnhanced,
    seekToLine,
  };
}

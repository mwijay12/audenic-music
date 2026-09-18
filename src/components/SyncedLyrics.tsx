import React, { useEffect, useRef, useCallback } from "react";
import { LrcLine } from "../player/lrcParser";

interface SyncedLyricsProps {
  lines: LrcLine[];
  activeLineIndex: number;
  isEnhanced: boolean;
  matchType: string | null;
  currentTimeMs: number;
  onSeekToLine: (index: number) => void;
  accentColor?: string;
}

export default function SyncedLyrics({
  lines,
  activeLineIndex,
  isEnhanced,
  matchType,
  currentTimeMs,
  onSeekToLine,
  accentColor = "#7C3AED",
}: SyncedLyricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const userScrollRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (userScrollRef.current) return;
    if (!activeLineRef.current || !containerRef.current) return;
    if (activeLineIndex < 0) return;

    const container = containerRef.current;
    const activeLine = activeLineRef.current;

    const containerRect = container.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();

    // Accurate line offset relative to container's current scroll position
    const relativeLineTop = lineRect.top - containerRect.top + container.scrollTop;
    const targetScroll = relativeLineTop - containerRect.height / 2 + lineRect.height / 2;

    isProgrammaticScrollRef.current = true;
    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: "smooth",
    });

    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 450);
  }, [activeLineIndex]);

  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    userScrollRef.current = true;
    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      userScrollRef.current = false;
    }, 2500);
  }, []);

  if (lines.length === 0) return null;

  return (
    <div className="relative flex h-full flex-col">
      {matchType && matchType !== "none" && (
        <div className="flex items-center justify-center py-2">
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-white/40">
            {matchType === "exact" && "🎵 Synced Lyrics"}
            {matchType === "fuzzy" && "🎵 Synced Lyrics (matched)"}
            {matchType === "known_dir" && "🎵 Synced Lyrics (found)"}
            {isEnhanced && " • Word sync"}
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="no-scrollbar flex-1 overflow-y-auto px-6 py-8"
        style={{ scrollBehavior: "smooth" }}
      >
        <div className="h-32" />
        {lines.map((line, index) => {
          const isActive = index === activeLineIndex;
          const isPast = index < activeLineIndex;

          return (
            <div
              key={`${line.time}-${index}`}
              ref={isActive ? activeLineRef : null}
              onClick={() => onSeekToLine(index)}
              className={`press cursor-pointer select-none py-2 text-center transition-all duration-300 ${
                isActive ? "scale-105" : "scale-100 active:scale-95"
              }`}
            >
              {isActive && isEnhanced && line.words && line.words.length > 0 ? (
                <p className="text-2xl font-bold leading-relaxed">
                  {line.words.map((word, wi) => {
                    const wordActive = word.time <= currentTimeMs;
                    return (
                      <span
                        key={wi}
                        className="transition-colors duration-100"
                        style={{ color: wordActive ? accentColor : "rgba(255,255,255,0.5)" }}
                      >
                        {word.text}{" "}
                      </span>
                    );
                  })}
                </p>
              ) : (
                <p
                  className={`leading-relaxed transition-all duration-300 ${
                    isActive
                      ? "text-2xl font-bold text-white drop-shadow-md"
                      : isPast
                      ? "text-base font-normal text-white/30"
                      : "text-base font-normal text-white/20"
                  }`}
                >
                  {line.text || "♪"}
                </p>
              )}
            </div>
          );
        })}
        <div className="h-32" />
      </div>

      {userScrollRef.current && (
        <button
          onClick={() => {
            userScrollRef.current = false;
            if (activeLineRef.current && containerRef.current) {
              const container = containerRef.current;
              const line = activeLineRef.current;
              container.scrollTo({
                top: line.offsetTop - container.clientHeight / 2,
                behavior: "smooth",
              });
            }
          }}
          className="press absolute bottom-4 right-4 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white/70 backdrop-blur"
        >
          ↓ Back to lyrics
        </button>
      )}
    </div>
  );
}

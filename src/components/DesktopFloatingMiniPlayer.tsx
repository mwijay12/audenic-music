import React, { useState, useRef, useEffect, useCallback } from "react";
import { usePlayer, fmt } from "../player/PlayerContext";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize as Maximize2,
  Minimize as Minimize2,
  X,
  Sliders,
  ChevronUp,
  ChevronDown,
} from "./Icons";

interface DesktopFloatingMiniPlayerProps {
  isOpen?: boolean;
  onClose: () => void;
  onRestoreApp?: () => void;
}

export function DesktopFloatingMiniPlayer({
  isOpen = true,
  onClose,
  onRestoreApp,
}: DesktopFloatingMiniPlayerProps) {
  const {
    current,
    isPlaying,
    toggle,
    next,
    prev,
    progress,
    duration,
    seek,
    volume,
    setVolume,
  } = usePlayer();

  const [isCollapsed, setIsCollapsed] = useState(false);
  // Use refs for position during drag for zero-rerender GPU-accelerated movement
  const posRef = useRef({ x: 24, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Clamp position within viewport
  const clampPosition = useCallback((x: number, y: number) => {
    const el = containerRef.current;
    const w = el ? el.offsetWidth : 300;
    const h = el ? el.offsetHeight : 200;
    return {
      x: Math.max(8, Math.min(window.innerWidth - w - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - h - 8, y)),
    };
  }, []);

  // Handle Dragging — write directly to DOM transform for zero-jank GPU movement
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;

    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: posRef.current.x,
      posY: posRef.current.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const clamped = clampPosition(
        dragStartRef.current.posX + dx,
        dragStartRef.current.posY + dy,
      );
      posRef.current = clamped;
      // Direct DOM write — no React re-render, pure GPU compositing
      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0)`;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, clampPosition]);

  // Set initial position
  useEffect(() => {
    if (containerRef.current) {
      const p = posRef.current;
      containerRef.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        transform: `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`,
        willChange: "transform",
        transition: isDragging ? "none" : "box-shadow 0.3s ease",
      }}
      className={`z-[99999] select-none ${
        isDragging
          ? "cursor-grabbing"
          : ""
      }`}
    >
      {isCollapsed ? (
        /* ── Compact Mini Pill Mode ── */
        <div
          onMouseDown={handleMouseDown}
          className={`group flex items-center gap-2.5 rounded-full border bg-[#0F0F14]/92 px-3.5 py-2 backdrop-blur-2xl transition-all duration-300 ${
            isDragging
              ? "border-[var(--accent)]/60 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_30px_color-mix(in_srgb,var(--accent)_15%,transparent)]"
              : "border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.3)] hover:border-[var(--accent)]/40 hover:shadow-[0_12px_40px_rgba(0,0,0,0.7),0_0_20px_color-mix(in_srgb,var(--accent)_10%,transparent)]"
          } ${isDragging ? "" : "cursor-grab"}`}
        >
          {/* Animated Indicator / Cover */}
          <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-white/20 shadow-inner">
            {current?.cover ? (
              <img
                src={current.cover}
                alt=""
                className={`h-full w-full object-cover ${isPlaying ? "animate-spin-slow" : ""}`}
              />
            ) : (
              <div className="h-full w-full bg-[var(--accent)]/30" />
            )}
            {isPlaying && (
              <span className="absolute inset-0 grid place-items-center bg-black/40">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-ping" />
              </span>
            )}
          </div>

          {/* Track Name */}
          <div className="max-w-[130px] truncate text-xs font-semibold text-white/90">
            {current?.title || "No track"}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent)] text-black transition-transform duration-150 hover:scale-110 active:scale-90"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={10} /> : <Play size={10} />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(false);
              }}
              className="grid h-6 w-6 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white transition"
              title="Expand mini player"
            >
              <Maximize2 size={11} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="grid h-6 w-6 place-items-center rounded-full text-white/40 hover:bg-rose-500/20 hover:text-rose-300 transition"
              title="Close overlay (music keeps playing)"
            >
              <X size={11} />
            </button>
          </div>
        </div>
      ) : (
        /* ── Full Mini Card Mode ── */
        <div
          onMouseDown={handleMouseDown}
          className={`w-[280px] overflow-hidden rounded-[28px] border bg-[#0A0A0E]/95 p-4 backdrop-blur-2xl transition-all duration-300 ${
            isDragging
              ? "border-[var(--accent)]/50 shadow-[0_24px_64px_rgba(0,0,0,0.85),0_0_40px_color-mix(in_srgb,var(--accent)_12%,transparent)]"
              : "border-white/12 shadow-[0_12px_40px_rgba(0,0,0,0.6),0_4px_16px_rgba(0,0,0,0.3)] hover:border-white/20 hover:shadow-[0_16px_50px_rgba(0,0,0,0.7)]"
          } ${isDragging ? "" : "cursor-grab"}`}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Audenic Floating Mini
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsCollapsed(true)}
                className="grid h-6 w-6 place-items-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white transition"
                title="Collapse to mini pill"
              >
                <Minimize2 size={12} />
              </button>

              {onRestoreApp && (
                <button
                  onClick={onRestoreApp}
                  className="grid h-6 w-6 place-items-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white transition"
                  title="Open full app window"
                >
                  <Maximize2 size={12} />
                </button>
              )}

              <button
                onClick={onClose}
                className="grid h-6 w-6 place-items-center rounded-xl text-white/40 hover:bg-rose-500/20 hover:text-rose-300 transition"
                title="Close overlay (music keeps playing)"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Album Art & Track Info */}
          <div className="flex items-center gap-3 py-1">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-lg">
              {current?.cover ? (
                <img
                  src={current.cover}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center bg-[var(--accent)]/20 text-xs font-bold text-[var(--accent)]">
                  ♪
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="truncate text-xs font-bold text-white">
                {current?.title || "Nothing Playing"}
              </h4>
              <p className="truncate text-[11px] text-white/45">
                {current?.artist || "Select music from library"}
              </p>

              {/* Mini Equalizer animation */}
              {isPlaying && (
                <div className="flex items-end gap-0.5 pt-1.5 h-3">
                  <span className="w-1 bg-[var(--accent)] rounded-full animate-bounce [animation-duration:600ms]" style={{ height: "70%" }} />
                  <span className="w-1 bg-[var(--accent)] rounded-full animate-bounce [animation-duration:400ms]" style={{ height: "100%" }} />
                  <span className="w-1 bg-[var(--accent)] rounded-full animate-bounce [animation-duration:800ms]" style={{ height: "40%" }} />
                  <span className="w-1 bg-[var(--accent)] rounded-full animate-bounce [animation-duration:500ms]" style={{ height: "90%" }} />
                  <span className="w-1 bg-[var(--accent)] rounded-full animate-bounce [animation-duration:700ms]" style={{ height: "60%" }} />
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar & Timers */}
          <div className="pt-3">
            <div className="flex items-center justify-between text-[10px] font-mono text-white/40 pb-1">
              <span>{fmt(progress)}</span>
              <span>{fmt(duration)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={progress}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--accent)]"
            />
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-between pt-3">
            {/* Volume */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                className="text-white/40 hover:text-white transition"
                title="Mute toggle"
              >
                {volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="h-1 w-12 cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--accent)]"
              />
            </div>

            {/* Transport Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white active:scale-95 transition"
                title="Previous Track (P)"
              >
                <SkipBack size={14} />
              </button>

              <button
                onClick={toggle}
                className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-black shadow-md hover:scale-105 active:scale-95 transition"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>

              <button
                onClick={next}
                className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white active:scale-95 transition"
                title="Next Track (N)"
              >
                <SkipForward size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  Prev,
  Next,
  Volume2,
  VolumeX,
  Pin,
  PinOff,
  AppWindow,
  X,
  GripHorizontal,
  Minimize2,
  Maximize2,
} from "./Icons";
import {
  setWidgetAlwaysOnTop,
  setWidgetSize,
  showMainWindow,
  closeDesktopWidget,
} from "../player/tauriBridge";

export interface WidgetPlayerState {
  title: string;
  artist: string;
  cover: string;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
}

export function DesktopWidget() {
  const [state, setState] = useState<WidgetPlayerState>(() => {
    try {
      const saved = localStorage.getItem("au.widgetState");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      title: "Audenic Music",
      artist: "Ready to play",
      cover: "",
      isPlaying: false,
      progress: 0,
      duration: 0,
      volume: 0.8,
    };
  });

  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);
  const [isCompact, setIsCompact] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Setup broadcast channel communication with main window
  useEffect(() => {
    document.body.classList.add("widget-mode");

    const bc = new BroadcastChannel("audenic-player");
    channelRef.current = bc;

    bc.onmessage = (ev) => {
      if (ev.data && ev.data.type === "state_update") {
        setState((prev) => ({ ...prev, ...ev.data.payload }));
      }
    };

    // Request fresh state from main window
    bc.postMessage({ type: "request_state" });

    return () => {
      document.body.classList.remove("widget-mode");
      bc.close();
    };
  }, []);

  // Post command to main player
  const sendCommand = (action: string, payload?: any) => {
    channelRef.current?.postMessage({ type: "command", action, payload });
  };

  // Format MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Toggle Always on top
  const handleTogglePin = async () => {
    const next = !isAlwaysOnTop;
    setIsAlwaysOnTop(next);
    await setWidgetAlwaysOnTop(next);
  };

  // Toggle Compact / Expanded
  const handleToggleCompact = async () => {
    const next = !isCompact;
    setIsCompact(next);
    if (next) {
      await setWidgetSize(320, 85);
    } else {
      await setWidgetSize(380, 165);
    }
  };

  // Native window drag handler
  const handleDragMouseDown = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input")) return;
    if (e.buttons === 1) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        getCurrentWindow().startDragging();
      } catch (err) {
        console.warn("startDragging error:", err);
      }
    }
  };

  const pct = state.duration > 0 ? (state.progress / state.duration) * 100 : 0;

  return (
    <div
      onMouseDown={handleDragMouseDown}
      className="select-none flex flex-col justify-between w-full h-full p-3.5 rounded-2xl bg-[#080B12]/95 border border-cyan-500/35 backdrop-blur-2xl shadow-[0_0_30px_rgba(6,182,212,0.2)] text-white overflow-hidden cursor-default transition-all duration-200"
    >
      {/* ── Top Header Row ── */}
      <div className="flex items-center justify-between shrink-0 mb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75 ${state.isPlaying ? "block" : "hidden"}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${state.isPlaying ? "bg-cyan-400 shadow-[0_0_8px_#22d3ee]" : "bg-white/30"}`} />
          </span>
          <span className="text-[10px] font-extrabold tracking-widest text-cyan-300 uppercase font-mono">
            {state.isPlaying ? "NOW PLAYING" : "AUDENIC HUD"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Pin Button */}
          <button
            onClick={handleTogglePin}
            className={`p-1.5 rounded-lg border transition ${
              isAlwaysOnTop
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                : "bg-white/5 text-white/50 border-white/10 hover:text-white"
            }`}
            title={isAlwaysOnTop ? "Pinned (Always on top)" : "Unpinned"}
          >
            {isAlwaysOnTop ? <Pin size={12} /> : <PinOff size={12} />}
          </button>

          {/* Compact Toggle */}
          <button
            onClick={handleToggleCompact}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
            title={isCompact ? "Expand Widget" : "Compact Mode"}
          >
            {isCompact ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>

          {/* Open Main Window */}
          <button
            onClick={() => showMainWindow()}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition"
            title="Restore Main Studio"
          >
            <AppWindow size={12} />
          </button>

          {/* Close Widget */}
          <button
            onClick={() => closeDesktopWidget()}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-rose-400 hover:bg-rose-500/10 transition"
            title="Hide Widget"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* ── Middle Row: Track Info & Drag Handle ── */}
      <div className="flex items-center justify-between gap-3 min-w-0 my-auto">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Thumbnail */}
          <div className="relative h-10 w-10 shrink-0 rounded-xl overflow-hidden border border-white/15 bg-white/5 shadow-md">
            {state.cover ? (
              <img
                src={state.cover}
                alt=""
                className={`h-full w-full object-cover ${state.isPlaying ? "animate-[spin_6s_linear_infinite]" : ""}`}
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-cyan-600 to-blue-800" />
            )}
          </div>

          {/* Title & Artist */}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-white truncate drop-shadow">
              {state.title || "No track"}
            </h4>
            <p className="text-[10px] text-cyan-200/60 truncate pt-0.5">
              {state.artist || "Audenic"}
            </p>
          </div>
        </div>

        {/* Monospace Digital Clock Style Track Time */}
        <div className="flex items-baseline gap-1 font-mono shrink-0 pl-1">
          <span className="text-sm font-black text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
            {formatTime(state.progress)}
          </span>
          <span className="text-[10px] text-cyan-400 font-bold">
            /{formatTime(state.duration)}
          </span>
        </div>

        {/* 6-Dot Draggable Grip Handle */}
        <div
          title="Drag to reposition widget"
          className="flex items-center text-cyan-400/60 hover:text-cyan-300 transition cursor-move shrink-0 pl-1"
        >
          <GripHorizontal size={16} />
        </div>
      </div>

      {/* ── Bottom Row: Progress & Controls (in non-compact mode) ── */}
      {!isCompact && (
        <div className="pt-2">
          {/* Progress Bar with seek */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              sendCommand("seek", ratio * state.duration);
            }}
            className="group relative h-1.5 w-full bg-white/10 rounded-full overflow-hidden cursor-pointer mb-2.5"
          >
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-[var(--accent)] rounded-full transition-all duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => sendCommand("prev")}
                className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition active:scale-95"
                title="Previous Track"
              >
                <Prev size={13} />
              </button>

              <button
                onClick={() => sendCommand("toggle")}
                className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-r from-cyan-400 to-[var(--accent)] text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)] transition hover:brightness-110 active:scale-90"
                title={state.isPlaying ? "Pause" : "Play"}
              >
                {state.isPlaying ? <Pause size={13} /> : <Play size={13} />}
              </button>

              <button
                onClick={() => sendCommand("next")}
                className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition active:scale-95"
                title="Next Track"
              >
                <Next size={13} />
              </button>
            </div>

            {/* Volume Quick Toggle */}
            <button
              onClick={() => sendCommand("toggle_mute")}
              className="p-1.5 rounded-lg bg-white/5 text-white/60 hover:text-cyan-300 transition"
              title="Mute / Unmute"
            >
              {state.volume > 0 ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

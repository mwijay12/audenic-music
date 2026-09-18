import React, { useState } from "react";
import { Play, Plus, Trash, Folder, CheckSquare, X, Music } from "./Icons";

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onPlaySelected: () => void;
  onAddQueueSelected: () => void;
  onAddToPlaylistSelected: (playlistId: string) => void;
  onCreatePlaylistFromSelected: (name: string) => void;
  onDeleteSelected: () => void;
  onClose: () => void;
  playlists: { id: string; name: string }[];
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onPlaySelected,
  onAddQueueSelected,
  onAddToPlaylistSelected,
  onCreatePlaylistFromSelected,
  onDeleteSelected,
  onClose,
  playlists,
}: BulkActionBarProps) {
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const isAllSelected = selectedCount > 0 && selectedCount === totalCount;

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-[#141419]/95 px-4 py-2.5 shadow-[0_16px_48px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
        {/* Selection Count Badge */}
        <div className="flex items-center gap-2 pr-2 border-r border-white/10">
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-bold text-black">
            {selectedCount}
          </span>
          <span className="text-xs font-semibold text-white/90">
            {selectedCount === 1 ? "song selected" : "songs selected"}
          </span>
        </div>

        {/* Select All / Deselect Toggle */}
        <button
          onClick={isAllSelected ? onDeselectAll : onSelectAll}
          className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-white/80 hover:bg-white/12 hover:text-white transition"
          title={isAllSelected ? "Deselect All (Esc)" : "Select All (Ctrl+A)"}
        >
          <CheckSquare size={14} className={isAllSelected ? "text-[var(--accent)]" : "text-white/60"} />
          <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
        </button>

        {/* Play Selected */}
        <button
          onClick={onPlaySelected}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-black transition active:scale-95 hover:brightness-110 shadow-[0_2px_12px_-2px_color-mix(in_srgb,var(--accent)_50%,transparent)]"
          title="Play selected songs"
        >
          <Play size={13} fill="currentColor" />
          <span>Play</span>
        </button>

        {/* Add to Queue */}
        <button
          onClick={onAddQueueSelected}
          className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-white/80 hover:bg-white/12 hover:text-white transition"
          title="Add selected to queue"
        >
          <Plus size={14} />
          <span>Queue</span>
        </button>

        {/* Add / Create Playlist Popup Trigger */}
        <div className="relative">
          <button
            onClick={() => setShowPlaylistMenu((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-white/80 hover:bg-white/12 hover:text-white transition"
            title="Add to playlist"
          >
            <Folder size={14} />
            <span>Playlist</span>
          </button>

          {/* Playlist Dropdown */}
          {showPlaylistMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-52 overflow-hidden rounded-2xl border border-white/15 bg-[#141419]/98 p-1.5 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  const name = prompt("Enter new playlist name for selected songs:");
                  if (name && name.trim()) {
                    onCreatePlaylistFromSelected(name.trim());
                    setShowPlaylistMenu(false);
                  }
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/15 transition"
              >
                <Plus size={14} />
                <span>New Playlist...</span>
              </button>

              {playlists.length > 0 && <div className="my-1 border-t border-white/[0.08]" />}

              <div className="max-h-40 overflow-y-auto no-scrollbar py-0.5">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => {
                      onAddToPlaylistSelected(pl.id);
                      setShowPlaylistMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10 hover:text-white transition"
                  >
                    <Music size={13} className="text-white/40" />
                    <span className="truncate">{pl.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Delete Selected */}
        <button
          onClick={onDeleteSelected}
          className="flex items-center gap-1.5 rounded-xl bg-rose-500/15 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/25 hover:text-rose-200 transition"
          title="Delete selected songs"
        >
          <Trash size={14} />
          <span>Delete</span>
        </button>

        {/* Close / Done */}
        <button
          onClick={onClose}
          className="ml-1 grid h-7 w-7 place-items-center rounded-xl bg-white/[0.06] text-white/50 hover:bg-white/15 hover:text-white transition"
          title="Close multi-select mode (Esc)"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

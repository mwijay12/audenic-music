import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Play, Plus, ListPlus, Heart, Trash, Folder, Info, CheckSquare, Sliders, Maximize, Settings, Disc, Music } from "./Icons";
import type { Track } from "../data/tracks";
import { openInExplorer } from "../player/tauriBridge";

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  onClick?: () => void;
  submenu?: MenuItem[];
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  items: MenuItem[];
  title?: string;
}

interface ContextMenuContextType {
  openMenu: (x: number, y: number, items: MenuItem[], title?: string) => void;
  closeMenu: () => void;
  openTrackMenu: (e: React.MouseEvent, track: Track, options?: {
    onSelect?: () => void;
    onDelete?: () => void;
    isMultiSelectMode?: boolean;
  }) => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | null>(null);

export function useContextMenu() {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) {
    throw new Error("useContextMenu must be used within a ContextMenuProvider");
  }
  return ctx;
}

export function ContextMenuProvider({
  children,
  onOpenPlayer,
  onOpenEqualizer,
  onOpenDJ,
  onOpenSettings,
  onScanLibrary,
  playlists = [],
  onAddToPlaylist,
  onCreatePlaylist,
  playTrack,
  addToQueue,
  playNext,
  liked = [],
  toggleLike,
  onOpenSongDetails,
}: {
  children: React.ReactNode;
  onOpenPlayer?: () => void;
  onOpenEqualizer?: () => void;
  onOpenDJ?: () => void;
  onOpenSettings?: () => void;
  onScanLibrary?: () => void;
  playlists?: { id: string; name: string }[];
  onAddToPlaylist?: (playlistId: string, trackId: string) => void;
  onCreatePlaylist?: (name: string, trackId?: string) => void;
  playTrack?: (id: string) => void;
  addToQueue?: (id: string) => void;
  playNext?: (id: string) => void;
  liked?: string[];
  toggleLike?: (id: string) => void;
  onOpenSongDetails?: (id: string) => void;
}) {
  const [menu, setMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    items: [],
  });

  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setMenu((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
    setActiveSubmenu(null);
  }, []);

  const openMenu = useCallback((x: number, y: number, items: MenuItem[], title?: string) => {
    // Clamping within viewport
    const menuWidth = 230;
    const menuHeight = items.length * 38 + (title ? 40 : 0);
    const clampedX = Math.min(x, window.innerWidth - menuWidth - 16);
    const clampedY = Math.min(y, window.innerHeight - menuHeight - 16);

    setMenu({
      isOpen: true,
      x: Math.max(12, clampedX),
      y: Math.max(12, clampedY),
      items,
      title,
    });
    setActiveSubmenu(null);
  }, []);

  // Helper to open a standardized Track Context Menu
  const openTrackMenu = useCallback(
    (
      e: React.MouseEvent,
      track: Track,
      options?: {
        onSelect?: () => void;
        onDelete?: () => void;
        isMultiSelectMode?: boolean;
      }
    ) => {
      e.preventDefault();
      e.stopPropagation();

      const isLiked = liked.includes(track.id);
      const isLocal = track.source === "local" || (track as any).path;

      // Playlist Submenu
      const playlistSubmenu: MenuItem[] = [
        {
          id: "create-pl",
          label: "New Playlist...",
          icon: <Plus size={14} />,
          onClick: () => {
            const name = prompt("Enter new playlist name:");
            if (name && name.trim() && onCreatePlaylist) {
              onCreatePlaylist(name.trim(), track.id);
            }
          },
        },
      ];

      if (playlists.length > 0) {
        playlistSubmenu.push({ id: "div-pl", label: "", divider: true });
        playlists.forEach((pl) => {
          playlistSubmenu.push({
            id: `pl-${pl.id}`,
            label: pl.name,
            icon: <Music size={13} />,
            onClick: () => {
              if (onAddToPlaylist) onAddToPlaylist(pl.id, track.id);
            },
          });
        });
      }

      const items: MenuItem[] = [
        {
          id: "play",
          label: "Play Now",
          icon: <Play size={14} />,
          onClick: () => {
            playTrack?.(track.id);
            onOpenPlayer?.();
          },
        },
        {
          id: "play-next",
          label: "Play Next",
          icon: <ListPlus size={14} />,
          onClick: () => playNext?.(track.id),
        },
        {
          id: "add-queue",
          label: "Add to Queue",
          icon: <Plus size={14} />,
          onClick: () => addToQueue?.(track.id),
        },
        { id: "div1", label: "", divider: true },
        {
          id: "playlist",
          label: "Add to Playlist",
          icon: <Folder size={14} />,
          submenu: playlistSubmenu,
        },
        {
          id: "like",
          label: isLiked ? "Remove from Liked" : "Like Song",
          icon: <Heart size={14} className={isLiked ? "text-rose-400 fill-rose-400" : ""} />,
          onClick: () => toggleLike?.(track.id),
        },
      ];

      if (isLocal && (track as any).path) {
        items.push({
          id: "reveal-file",
          label: "Show in File Explorer",
          icon: <Folder size={14} />,
          onClick: () => openInExplorer((track as any).path),
        });
      }

      items.push({
        id: "details",
        label: "Track Info & Tags",
        icon: <Info size={14} />,
        onClick: () => onOpenSongDetails?.(track.id),
      });

      if (options?.onSelect) {
        items.push({
          id: "select",
          label: options.isMultiSelectMode ? "Toggle Selection" : "Select Song",
          icon: <CheckSquare size={14} />,
          shortcut: "Ctrl+Click",
          onClick: options.onSelect,
        });
      }

      if (options?.onDelete) {
        items.push({ id: "div2", label: "", divider: true });
        items.push({
          id: "delete",
          label: "Delete from Library",
          icon: <Trash size={14} />,
          danger: true,
          onClick: options.onDelete,
        });
      }

      openMenu(e.clientX, e.clientY, items, track.title);
    },
    [liked, playlists, playTrack, playNext, addToQueue, toggleLike, onOpenPlayer, onOpenSongDetails, onAddToPlaylist, onCreatePlaylist, openMenu]
  );

  // Global Context Menu Interception (Disables browser default menus across the app!)
  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      // Allow default context menu only inside text inputs / textareas so copy/paste works
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();

      // If user right-clicks on blank background or generic container, show general desktop menu
      const isSongRow = target.closest("[data-track-id]");
      if (!isSongRow) {
        openMenu(e.clientX, e.clientY, [
          {
            id: "scan",
            label: "Scan Local Library",
            icon: <Folder size={14} />,
            onClick: onScanLibrary,
          },
          {
            id: "eq",
            label: "Equalizer & Effects",
            icon: <Sliders size={14} />,
            onClick: onOpenEqualizer,
          },
          {
            id: "dj",
            label: "DJ Studio & Mixer",
            icon: <Disc size={14} />,
            onClick: onOpenDJ,
          },
          { id: "div-gen", label: "", divider: true },
          {
            id: "fullscreen",
            label: document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen",
            icon: <Maximize size={14} />,
            shortcut: "F",
            onClick: () => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.().catch(() => {});
              } else {
                document.exitFullscreen?.().catch(() => {});
              }
            },
          },
          {
            id: "settings",
            label: "Settings",
            icon: <Settings size={14} />,
            onClick: onOpenSettings,
          },
        ]);
      }
    };

    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    window.addEventListener("contextmenu", handleGlobalContextMenu);
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("contextmenu", handleGlobalContextMenu);
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, openMenu, onScanLibrary, onOpenEqualizer, onOpenDJ, onOpenSettings]);

  return (
    <ContextMenuContext.Provider value={{ openMenu, closeMenu, openTrackMenu }}>
      {children}

      {/* Render Active Desktop Context Menu */}
      {menu.isOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[210px] overflow-hidden rounded-2xl border border-white/15 bg-[#141419]/95 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100"
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.title && (
            <div className="border-b border-white/[0.08] px-3 py-2">
              <p className="truncate text-[11px] font-bold uppercase tracking-wider text-white/40">
                {menu.title}
              </p>
            </div>
          )}

          <div className="py-1">
            {menu.items.map((item) => {
              if (item.divider) {
                return <div key={item.id} className="my-1 border-t border-white/[0.08]" />;
              }

              const hasSubmenu = item.submenu && item.submenu.length > 0;
              const isSubmenuOpen = activeSubmenu === item.id;

              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => {
                    if (hasSubmenu) setActiveSubmenu(item.id);
                    else setActiveSubmenu(null);
                  }}
                >
                  <button
                    onClick={() => {
                      if (!hasSubmenu) {
                        item.onClick?.();
                        closeMenu();
                      }
                    }}
                    disabled={item.disabled}
                    className={`group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[12.5px] font-medium transition ${
                      item.danger
                        ? "text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
                        : "text-white/85 hover:bg-white/10 hover:text-white"
                    } ${item.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.icon && (
                        <span className={`shrink-0 ${item.danger ? "text-rose-400" : "text-white/60 group-hover:text-[var(--accent)]"}`}>
                          {item.icon}
                        </span>
                      )}
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.shortcut ? (
                      <span className="text-[10px] font-semibold text-white/35">
                        {item.shortcut}
                      </span>
                    ) : hasSubmenu ? (
                      <span className="text-[10px] text-white/40">▶</span>
                    ) : null}
                  </button>

                  {/* Nested Submenu */}
                  {hasSubmenu && isSubmenuOpen && (
                    <div
                      className="absolute left-full top-0 ml-1 min-w-[190px] overflow-hidden rounded-2xl border border-white/15 bg-[#141419]/95 p-1.5 shadow-2xl backdrop-blur-2xl"
                    >
                      {item.submenu!.map((sub) => {
                        if (sub.divider) {
                          return <div key={sub.id} className="my-1 border-t border-white/[0.08]" />;
                        }
                        return (
                          <button
                            key={sub.id}
                            onClick={() => {
                              sub.onClick?.();
                              closeMenu();
                            }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[12px] font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
                          >
                            {sub.icon && <span className="shrink-0 text-white/60">{sub.icon}</span>}
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ContextMenuContext.Provider>
  );
}

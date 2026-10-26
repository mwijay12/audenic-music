import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Zero-dependency virtualized list for rendering 100,000+ items without DOM bloat.
 * Only renders items within the visible viewport + an overscan buffer.
 *
 * Usage:
 *   <VirtualList items={tracks} itemHeight={64} overscan={8}
 *     renderItem={(track, i) => <TrackRow key={track.id} track={track} />}
 *   />
 */
type VirtualListProps<T> = {
  items: T[];
  itemHeight: number;
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  /** Extra padding at the bottom (e.g. for MiniPlayer clearance) */
  bottomPad?: number;
  /** Called when scrolled near the end */
  onEndReached?: () => void;
  /** Called on scroll with current scrollTop */
  onScrollChange?: (scrollTop: number) => void;
  /** Render above the list (sticky header, filters, etc.) */
  header?: ReactNode;
  /** Empty state when items.length === 0 */
  empty?: ReactNode;
};

export function VirtualList<T>({
  items,
  itemHeight,
  overscan = 8,
  renderItem,
  className = "",
  bottomPad = 0,
  onEndReached,
  onScrollChange,
  header,
  empty,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const rafRef = useRef<number | null>(null);
  const endReachedRef = useRef(false);

  // Measure container on mount and resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    setContainerHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  // Scroll handler using rAF for smooth 60fps
  const onScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = containerRef.current;
      if (!el) return;
      setScrollTop(el.scrollTop);
      onScrollChange?.(el.scrollTop);

      // End-reached detection
      if (onEndReached && !endReachedRef.current) {
        const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (remaining < itemHeight * 5) {
          endReachedRef.current = true;
          onEndReached();
        }
      }
    });
  }, [onEndReached, itemHeight]);

  // Reset end-reached when items change
  useEffect(() => {
    endReachedRef.current = false;
  }, [items.length]);

  const totalHeight = items.length * itemHeight + bottomPad;
  const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIdx = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = [];
  for (let i = startIdx; i < endIdx; i++) {
    // The item list can shrink between a scroll event and this render (filter,
    // folder switch, delete) — never dereference a missing entry.
    if (i >= items.length || items[i] === undefined) continue;
    visibleItems.push(
      <div
        key={i}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: itemHeight,
          transform: `translateY(${i * itemHeight}px)`,
          contain: "layout style paint",
          willChange: "transform",
        }}
      >
        {renderItem(items[i], i)}
      </div>
    );
  }

  if (!items.length && empty) {
    return (
      <div className={className} style={{ flex: 1 }}>
        {header}
        {empty}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`no-scrollbar ${className}`}
      onScroll={onScroll}
      style={{
        flex: 1,
        overflow: "auto",
        position: "relative",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "contain",
      }}
    >
      {header}
      <div style={{ position: "relative", height: totalHeight, width: "100%" }}>
        {visibleItems}
      </div>
    </div>
  );
}

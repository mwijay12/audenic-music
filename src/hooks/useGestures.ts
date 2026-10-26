import { useRef } from "react";

type Opts = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onDoubleTap?: (x: number, width: number) => void;
  onSingleTap?: () => void;
  onLongPress?: () => void;
  enabled?: boolean;
  threshold?: number;
};

/**
 * Lark-style gesture layer: swipe (4-way), double-tap zones, long-press.
 * Returns props to spread on the target element.
 */
export function useGestures({
  onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown,
  onDoubleTap, onSingleTap, onLongPress,
  enabled = true, threshold = 55,
}: Opts) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<number | null>(null);
  const longTimer = useRef<number | null>(null);
  const moved = useRef(false);
  // Touch devices (Capacitor/Android WebView, mobile Chrome) fire a synthetic
  // mousedown/mousemove/mouseup sequence right after the real touchstart/
  // touchmove/touchend sequence, for legacy compatibility. Since this hook
  // binds BOTH touch and mouse handlers on the same element, a single
  // physical tap used to run end() twice — the 2nd (synthetic mouse) call
  // landed inside the 1st (real touch) call's 280ms double-tap window, so it
  // was misread as a double-tap (-> onDoubleTap/"like") while swallowing the
  // real single-tap's onSingleTap ("play/pause"). We track the last touch
  // timestamp and ignore any mouse events that follow within 700ms.
  const lastTouchAt = useRef(0);

  if (!enabled) return {};

  const begin = (x: number, y: number, fromTouch: boolean) => {
    if (!fromTouch && Date.now() - lastTouchAt.current < 700) return;
    if (fromTouch) lastTouchAt.current = Date.now();
    start.current = { x, y, t: Date.now() };
    moved.current = false;
    if (onLongPress) {
      longTimer.current = window.setTimeout(() => {
        if (!moved.current) onLongPress();
      }, 550);
    }
  };

  const move = (x: number, y: number, fromTouch: boolean) => {
    if (!fromTouch && Date.now() - lastTouchAt.current < 700) return;
    if (!start.current) return;
    if (Math.abs(x - start.current.x) > 10 || Math.abs(y - start.current.y) > 10) moved.current = true;
  };

  const end = (x: number, y: number, width: number, fromTouch: boolean) => {
    if (!fromTouch && Date.now() - lastTouchAt.current < 700) return;
    if (fromTouch) lastTouchAt.current = Date.now();
    if (longTimer.current) { window.clearTimeout(longTimer.current); longTimer.current = null; }
    const s = start.current;
    start.current = null;
    if (!s) return;

    const dx = x - s.x, dy = y - s.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const fast = Date.now() - s.t < 600;

    if (fast && Math.max(adx, ady) > threshold) {
      if (adx > ady) { if (dx < 0) onSwipeLeft?.(); else onSwipeRight?.(); }
      else { if (dy < 0) onSwipeUp?.(); else onSwipeDown?.(); }
      return;
    }

    if (moved.current) return;

    // tap / double-tap discrimination
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      if (tapTimer.current) { window.clearTimeout(tapTimer.current); tapTimer.current = null; }
      onDoubleTap?.(x, width);
    } else {
      lastTap.current = now;
      if (onSingleTap) {
        tapTimer.current = window.setTimeout(() => { onSingleTap(); tapTimer.current = null; }, 290);
      }
    }
  };

  return {
    onTouchStart: (e: React.TouchEvent) => begin(e.touches[0].clientX, e.touches[0].clientY, true),
    onTouchMove: (e: React.TouchEvent) => move(e.touches[0].clientX, e.touches[0].clientY, true),
    onTouchEnd: (e: React.TouchEvent) => {
      const t = e.changedTouches[0];
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      end(t.clientX, t.clientY, r.width, true);
    },
    onMouseDown: (e: React.MouseEvent) => begin(e.clientX, e.clientY, false),
    onMouseMove: (e: React.MouseEvent) => move(e.clientX, e.clientY, false),
    onMouseUp: (e: React.MouseEvent) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      end(e.clientX, e.clientY, r.width, false);
    },
  };
}

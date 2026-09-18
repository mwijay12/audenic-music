import { useRef, useState } from "react";

type Side = "left" | "right";

/**
 * Invisible left/right press-and-hold zones layered over a player surface.
 * Short taps pass straight through (bubble) to whatever gesture layer sits
 * underneath (e.g. useGestures' tap / double-tap). A sustained press (>
 * holdDelay) is treated as a hold: it fires onHoldStart once, onHoldTick on
 * an interval while held, and onHoldEnd on release — then swallows the
 * touchend so the parent's tap logic doesn't also fire.
 */
export function HoldZones({
  enabled = true,
  holdDelay = 280,
  tickMs = 120,
  leftWidthPct = 32,
  rightWidthPct = 32,
  onHoldStart,
  onHoldTick,
  onHoldEnd,
  indicatorLeft,
  indicatorRight,
}: {
  enabled?: boolean;
  holdDelay?: number;
  tickMs?: number;
  leftWidthPct?: number;
  rightWidthPct?: number;
  onHoldStart?: (side: Side) => void;
  onHoldTick?: (side: Side) => void;
  onHoldEnd?: (side: Side) => void;
  indicatorLeft?: React.ReactNode;
  indicatorRight?: React.ReactNode;
}) {
  const [active, setActive] = useState<Side | null>(null);
  const timer = useRef<number | null>(null);
  const interval = useRef<number | null>(null);
  const holding = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const sideRef = useRef<Side | null>(null);

  if (!enabled) return null;

  const clearTimers = () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    if (interval.current) { window.clearInterval(interval.current); interval.current = null; }
  };

  const begin = (side: Side, x: number, y: number) => {
    holding.current = false;
    sideRef.current = side;
    startPos.current = { x, y };
    clearTimers();
    timer.current = window.setTimeout(() => {
      holding.current = true;
      setActive(side);
      onHoldStart?.(side);
      interval.current = window.setInterval(() => onHoldTick?.(side), tickMs);
    }, holdDelay);
  };

  const move = (x: number, y: number) => {
    if (!startPos.current) return;
    if (Math.abs(x - startPos.current.x) > 14 || Math.abs(y - startPos.current.y) > 14) {
      clearTimers();
      if (holding.current && sideRef.current) onHoldEnd?.(sideRef.current);
      holding.current = false;
      setActive(null);
    }
  };

  const end = (e: React.SyntheticEvent) => {
    clearTimers();
    if (holding.current && sideRef.current) {
      e.stopPropagation();
      onHoldEnd?.(sideRef.current);
    }
    holding.current = false;
    setActive(null);
    startPos.current = null;
  };

  return (
    <>
      <div
        className="absolute inset-y-0 left-0 z-[6]"
        style={{ width: `${leftWidthPct}%` }}
        onTouchStart={(e) => begin("left", e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={end}
        onTouchCancel={end}
        onMouseDown={(e) => begin("left", e.clientX, e.clientY)}
        onMouseMove={(e) => move(e.clientX, e.clientY)}
        onMouseUp={end}
        onMouseLeave={end}
      />
      <div
        className="absolute inset-y-0 right-0 z-[6]"
        style={{ width: `${rightWidthPct}%` }}
        onTouchStart={(e) => begin("right", e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={end}
        onTouchCancel={end}
        onMouseDown={(e) => begin("right", e.clientX, e.clientY)}
        onMouseMove={(e) => move(e.clientX, e.clientY)}
        onMouseUp={end}
        onMouseLeave={end}
      />
      {active && (
        <div className={`pointer-events-none absolute inset-y-0 z-10 flex w-[34%] items-center justify-center ${active === "right" ? "right-0" : "left-0"}`}>
          <span className="pop-in flex flex-col items-center gap-1.5 rounded-2xl bg-black/55 px-4 py-3 text-white backdrop-blur">
            {active === "left" ? indicatorLeft : indicatorRight}
          </span>
        </div>
      )}
    </>
  );
}

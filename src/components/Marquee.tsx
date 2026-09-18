import { useEffect, useRef, useState } from "react";

/**
 * One-line text that smoothly loops only when it actually overflows.
 * Detection runs on mount + whenever the text or its box resizes.
 */
export function MarqueeText({ text, className = "" }: { text: string; className?: string }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [over, setOver] = useState(false);
  const [px, setPx] = useState(0);

  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      const inner = innerRef.current;
      if (!wrap || !inner) return;
      const w = wrap.clientWidth;
      const i = inner.scrollWidth;
      const overflow = i > w + 2 || text.length > 20;
      setOver(overflow);
      if (overflow) setPx(Math.max(60, Math.max(i, text.length * 9) + 28));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [text]);

  if (!over) {
    return (
      <span ref={wrapRef} className={`clamp-1 ${className}`} style={{ display: "block" }}>
        <span ref={innerRef} className="whitespace-nowrap">{text}</span>
      </span>
    );
  }

  return (
    <span ref={wrapRef} className={`block overflow-hidden ${className}`} aria-label={text}>
      <span
        ref={innerRef}
        className="inline-block whitespace-nowrap marquee-run"
        style={{ "--marquee-px": `${px}px` } as React.CSSProperties}
      >
        {text}
        <span className="mx-3 opacity-40">•</span>
        {text}
        <span className="mx-3 opacity-40">•</span>
      </span>
    </span>
  );
}

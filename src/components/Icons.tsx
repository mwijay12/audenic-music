type P = { className?: string; size?: number };

const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const Search = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
);

export const Heart = ({
  className,
  size,
  filled,
}: P & { filled?: boolean }) => (
  <svg {...base(size)} className={className} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20s-7-4.35-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.65 12 20 12 20Z" />
  </svg>
);

export const Play = ({ className, size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" />
  </svg>
);

export const Pause = ({ className, size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <rect x="6.5" y="5" width="3.8" height="14" rx="1.4" />
    <rect x="13.7" y="5" width="3.8" height="14" rx="1.4" />
  </svg>
);

export const Next = ({ className, size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M6 5.7v12.6a1 1 0 0 0 1.54.84l9.2-6.3a1 1 0 0 0 0-1.68l-9.2-6.3A1 1 0 0 0 6 5.7Z" />
    <rect x="17.2" y="5" width="2.6" height="14" rx="1.3" />
  </svg>
);

export const Prev = ({ className, size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18 5.7v12.6a1 1 0 0 1-1.54.84l-9.2-6.3a1 1 0 0 1 0-1.68l9.2-6.3A1 1 0 0 1 18 5.7Z" />
    <rect x="4.2" y="5" width="2.6" height="14" rx="1.3" />
  </svg>
);

export const SkipForward = Next;
export const SkipBack = Prev;

export const Shuffle = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M16 4h4v4" />
    <path d="M20 4 4 20" />
    <path d="M16 20h4v-4" />
    <path d="m4 4 5 5" />
    <path d="m15 15 5 5" />
  </svg>
);

export const Repeat = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M17 2.5 20.5 6 17 9.5" />
    <path d="M3.5 12V9a3 3 0 0 1 3-3h14" />
    <path d="M7 21.5 3.5 18 7 14.5" />
    <path d="M20.5 12v3a3 3 0 0 1-3 3h-14" />
  </svg>
);

export const Queue = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 6h12M3 12h9M3 18h7" />
    <circle cx="17.5" cy="17" r="2.5" />
    <path d="M20 17V9l2.5 1.5" />
  </svg>
);

export const Back = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M15 5 8 12l7 7" />
  </svg>
);

export const Dots = ({ className, size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="5.5" cy="12" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="18.5" cy="12" r="1.7" />
  </svg>
);

export const Download = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 4v10" />
    <path d="m8 11 4 3.5L16 11" />
    <path d="M5 18.5h14" />
  </svg>
);

export const Home = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1Z" />
  </svg>
);

export const Disc = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2.3" />
  </svg>
);

export const Chat = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20 12.5c0 3.6-3.6 6.5-8 6.5a9.7 9.7 0 0 1-2.6-.35L5 20.5l.9-3.1A6.3 6.3 0 0 1 4 12.5C4 8.9 7.6 6 12 6s8 2.9 8 6.5Z" />
  </svg>
);

export const Folder = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2.2h8a1.5 1.5 0 0 1 1.5 1.5v7.3A1.5 1.5 0 0 1 19 18.5H5a1.5 1.5 0 0 1-1.5-1.5Z" />
  </svg>
);

export const Gear = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.3 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.2 1Z" />
  </svg>
);

export const Settings = Gear;

export const Wifi = ({ className, size }: P) => (
  <svg width={size ?? 15} height={size ?? 15} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 18.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Zm0-6.6c1.4 0 2.7.5 3.7 1.4l1.5-1.6A8 8 0 0 0 12 9.4a8 8 0 0 0-5.2 2.3l1.5 1.6a5.4 5.4 0 0 1 3.7-1.4Zm0-4.6a10 10 0 0 1 6.9 2.7l1.5-1.6A12.2 12.2 0 0 0 12 5 12.2 12.2 0 0 0 3.6 8.4l1.5 1.6A10 10 0 0 1 12 7.3Z" />
  </svg>
);

export const Cell = ({ className }: P) => (
  <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor" className={className}>
    <rect x="0" y="8" width="3" height="4" rx="1" />
    <rect x="4.6" y="5.5" width="3" height="6.5" rx="1" />
    <rect x="9.2" y="3" width="3" height="9" rx="1" />
    <rect x="13.8" y="0" width="3" height="12" rx="1" />
  </svg>
);

export const Battery = ({ className }: P) => (
  <svg width="25" height="12" viewBox="0 0 25 12" fill="none" className={className}>
    <rect x="0.5" y="0.5" width="21" height="11" rx="3.2" stroke="currentColor" opacity="0.5" />
    <rect x="2" y="2" width="18" height="8" rx="2.2" fill="currentColor" />
    <path d="M23 4.2v3.6c.9-.3 1.4-.9 1.4-1.8S23.9 4.5 23 4.2Z" fill="currentColor" opacity="0.5" />
  </svg>
);

export const Plus = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const Scan = ({ className, size }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M20 8.5V6a2 2 0 0 0-2-2h-2.5M4 15.5V18a2 2 0 0 0 2 2h2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5" />
    <path d="M4 12h16" />
  </svg>
);

export const Equalizer = ({ className, size = 20 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 4v6M4 13v7" />
    <path d="M4 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
    <path d="M10 4v3M10 10v10" />
    <path d="M10 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
    <path d="M16 4v9M16 16v4" />
    <path d="M16 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
  </svg>
);

export const Sliders = Equalizer;

export const Mic = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 12a7 7 0 0 0 14 0" />
    <path d="M12 19v3" />
  </svg>
);

export const PlaySquare = ({ className, size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M9 8.5v7l6-3.5Z" />
  </svg>
);

export const Video = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="m22 8-6 4 6 4Z" />
  </svg>
);

export const Trash = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
  </svg>
);

export const Chart = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const BarChart2 = Chart;

export const Palette = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3a9 9 0 1 0 0 18 3 3 0 0 0 2.8-4.2 2 2 0 0 1 1.9-3h1.6a2.7 2.7 0 0 0 2.7-2.7C21 6.5 17 3 12 3Z" />
    <circle cx="7" cy="11" r="1" />
    <circle cx="9.5" cy="7" r="1" />
    <circle cx="14" cy="7" r="1" />
    <circle cx="17" cy="11" r="1" />
  </svg>
);

export const Volume = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 10v4h3l4 3V7L7 10H4Z" />
    <path d="M16 9a3.5 3.5 0 0 1 0 6" />
    <path d="M18 6a7 7 0 0 1 0 12" />
  </svg>
);

export const Volume2 = Volume;

export const VolumeX = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 10v4h3l4 3V7L7 10H4Z" />
    <path d="m16 9 5 5M21 9l-5 5" />
  </svg>
);

export const Check = ({ className, size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12.5 10 17 19 7.5" />
  </svg>
);

export const Eye = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOff = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.7A10.4 10.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.6 15.6 0 0 1-3.2 4M6.6 6.7C4 8.5 2.5 12 2.5 12S6 18.5 12 18.5a9.9 9.9 0 0 0 3.4-.6" />
    <path d="M9.9 10a3 3 0 0 0 4.1 4.1" />
  </svg>
);

export const Headphones = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 13.5V12a8 8 0 0 1 16 0v1.5" />
    <rect x="2.5" y="13.5" width="4.5" height="6.5" rx="1.8" />
    <rect x="17" y="13.5" width="4.5" height="6.5" rx="1.8" />
  </svg>
);

export const Target = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.3" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const Pencil = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 20l.9-4L16.5 4.4a1.8 1.8 0 0 1 2.6 0l.5.5a1.8 1.8 0 0 1 0 2.6L8 19l-4 1Z" />
    <path d="M14 6.5 17.5 10" />
  </svg>
);

export const Bell = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 9a6 6 0 0 1 12 0c0 4.2 1.5 5.5 2 6.5H4c.5-1 2-2.3 2-6.5Z" />
    <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" />
  </svg>
);

export const Maximize = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3" />
  </svg>
);

export const Minimize = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M9 4v3a1 1 0 0 1-1 1H5M15 4v3a1 1 0 0 0 1 1h3M9 20v-3a1 1 0 0 0-1-1H5M15 20v-3a1 1 0 0 1 1-1h3" />
  </svg>
);

export const Maximize2 = Maximize;
export const Minimize2 = Minimize;


export const Globe = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.3 3.7 5.3 3.7 8.5s-1.3 6.2-3.7 8.5c-2.4-2.3-3.7-5.3-3.7-8.5S9.6 5.8 12 3.5Z" />
  </svg>
);

export const Sparkle = ({ className, size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2.5c.5 3.6 1.6 5.9 3.5 7.8s4.2 3 7.8 3.5c-3.6.5-5.9 1.6-7.8 3.5s-3 4.2-3.5 7.8c-.5-3.6-1.6-5.9-3.5-7.8s-4.2-3-7.8-3.5c3.6-.5 5.9-1.6 7.8-3.5s3-4.2 3.5-7.8Z" />
  </svg>
);

export const Sparkles = Sparkle;

export const Compass = ({ className, size = 20 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </svg>
);

export const Radio = Compass;

export const Film = ({ className, size = 20 }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="6" y="2.5" width="12" height="19" rx="3.5" />
    <path d="M6 7.5h4M6 11h3M6 14.5h4" />
    <path d="m12 10 4 2.5-4 2.5Z" fill="currentColor" stroke="none" />
  </svg>
);

export const Timer = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="13" r="7.5" />
    <path d="M12 9v4.2l2.6 1.6" />
    <path d="M9 2.5h6" />
  </svg>
);

export const ChevronUp = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="m6 14.5 6-6 6 6" />
  </svg>
);

export const ChevronDown = ({ className, size = 16 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="m6 9.5 6 6 6-6" />
  </svg>
);

export const Comment = ({ className, size = 20 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20 12a7.5 7.5 0 0 1-10.6 6.8L4 20l1.2-4.1A7.5 7.5 0 1 1 20 12Z" />
  </svg>
);

export const Share = ({ className, size = 20 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="6" cy="12" r="2.4" />
    <circle cx="18" cy="6" r="2.4" />
    <circle cx="18" cy="18" r="2.4" />
    <path d="m8.1 10.9 7.8-3.8M8.1 13.1l7.8 3.8" />
  </svg>
);

export const Record = ({ className, size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="12" cy="12" r="7" />
  </svg>
);

export const Stop = ({ className, size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
  </svg>
);

export const Send = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 12 20 4l-4 16-4-6-8-2Z" />
  </svg>
);

export const Music = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M9 18V6l11-2v10" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="15" r="3" />
  </svg>
);

export const Bot = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="4" y="8.5" width="16" height="11" rx="4" />
    <path d="M12 8.5V5M9 4.5h6" />
    <circle cx="9" cy="14" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="14" r="1.3" fill="currentColor" stroke="none" />
    <path d="M2.5 12.5v3M21.5 12.5v3" />
  </svg>
);

export const CloudOff = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 3l18 18" />
    <path d="M9.5 6.5A5.5 5.5 0 0 1 18 10.8a4 4 0 0 1-.6 7.9H7.2a4.6 4.6 0 0 1-3.4-7.7" />
  </svg>
);

export const Award = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="8" r="6" />
    <path d="M15.5 13.5 18 21l-6-3-6 3 2.5-7.5" />
  </svg>
);

export const User = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="7" r="4" />
    <path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
  </svg>
);

export const Shield = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
  </svg>
);

export const Smartphone = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="5" y="2" width="14" height="20" rx="3" />
    <path d="M12 18h.01" />
  </svg>
);

export const Monitor = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

export const Gamepad = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <line x1="6" y1="12" x2="10" y2="12" />
    <line x1="8" y1="10" x2="8" y2="14" />
    <circle cx="15" cy="13" r="1" fill="currentColor" />
    <circle cx="18" cy="11" r="1" fill="currentColor" />
    <rect x="2" y="6" width="20" height="12" rx="6" />
  </svg>
);

export const BookOpen = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

export const BarChart = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

export const Close = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const X = Close;

export const Clock = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const CheckCircle = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const ExternalLink = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export const RotateCcw = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export const Zap = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export const CheckSquare = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

export const ListPlus = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M11 12H3M16 6H3M16 18H3M18 9v6M15 12h6" />
  </svg>
);

export const Info = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

export const Trash2 = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export const PanelLeftClose = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="m16 15-3-3 3-3" />
  </svg>
);

export const PanelLeftOpen = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="m13 9 3 3-3 3" />
  </svg>
);

export const PanelRightClose = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M15 3v18" />
    <path d="m8 9 3 3-3 3" />
  </svg>
);

export const PanelRightOpen = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M15 3v18" />
    <path d="m11 15-3-3 3-3" />
  </svg>
);

export const Pin = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
  </svg>
);

export const PinOff = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <line x1="2" y1="2" x2="22" y2="22" />
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h12" />
    <path d="M15 9.34V6h1a1 1 0 0 0 0-2H9" />
  </svg>
);

export const AppWindow = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M10 4v4" />
    <path d="M2 8h20" />
    <path d="M6 4v4" />
  </svg>
);

export const GripHorizontal = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="9" r="1" fill="currentColor" />
    <circle cx="19" cy="9" r="1" fill="currentColor" />
    <circle cx="5" cy="9" r="1" fill="currentColor" />
    <circle cx="12" cy="15" r="1" fill="currentColor" />
    <circle cx="19" cy="15" r="1" fill="currentColor" />
    <circle cx="5" cy="15" r="1" fill="currentColor" />
  </svg>
);

export const Waves = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
  </svg>
);

export const Filter = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

export const Trophy = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

export const Lock = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const Car = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" />
    <path d="M9 17h6" />
    <circle cx="17" cy="17" r="2" />
  </svg>
);

export const Flame = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

export const GraduationCap = ({ className, size = 18 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);





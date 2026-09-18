import React, { useState, useCallback } from "react";

interface TrackArtworkProps {
  cover?: string;
  title?: string;
  artist?: string;
  avatarLetter?: string;
  avatarColor?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  onClick?: () => void;
}

const SIZE_MAP = {
  sm: "w-10 h-10",
  md: "w-14 h-14",
  lg: "w-24 h-24",
  xl: "w-full h-full",
};

const FONT_MAP = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-5xl",
};

export default function TrackArtwork({
  cover,
  title,
  artist,
  avatarLetter,
  avatarColor,
  size = "md",
  className = "",
  onClick,
}: TrackArtworkProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleError = useCallback(() => {
    setImgError(true);
  }, []);

  const handleLoad = useCallback(() => {
    setImgLoaded(true);
  }, []);

  const letter = avatarLetter || (title ? title.charAt(0).toUpperCase() : "🎵");
  const color = avatarColor || "#7C3AED";
  const sizeClass = SIZE_MAP[size];
  const fontClass = FONT_MAP[size];
  const showAvatar = !cover || imgError;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl shrink-0 ${sizeClass} ${className}`}
      onClick={onClick}
    >
      {showAvatar && (
        <div
          className="absolute inset-0 flex items-center justify-center font-bold text-white shadow-inner"
          style={{ backgroundColor: color }}
        >
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5) 0%, transparent 70%)`,
            }}
          />
          <span className={`relative z-10 select-none drop-shadow-md ${fontClass}`}>
            {letter}
          </span>
        </div>
      )}

      {cover && !imgError && (
        <img
          src={cover}
          alt={`${title || "Track"} by ${artist || "Artist"}`}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
        />
      )}

      {cover && !imgError && !imgLoaded && (
        <div className="absolute inset-0 animate-pulse bg-white/10" />
      )}
    </div>
  );
}

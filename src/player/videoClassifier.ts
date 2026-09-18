export type VideoCategory =
  | "reel"
  | "music_video"
  | "concert"
  | "movie"
  | "tutorial"
  | "my_video"
  | "other";

export interface VideoClassification {
  category: VideoCategory;
  confidence: number;
  scores: Record<VideoCategory, number>;
  signals: string[];
}

export interface RawVideoData {
  id: string;
  title: string;
  displayName: string;
  duration: number; // ms
  size: number; // bytes
  aspectRatio: number; // width / height
  width: number;
  height: number;
  bucket: string;
  bitrate: number;
  mimeType: string;
}

const REEL_KEYWORDS = [
  "reel", "reels", "short", "shorts", "tiktok", "story",
  "stories", "status", "clip", "ig", "instagram", "snap",
  "snapchat", "viral", "60s", "30s", "fyp"
];

const MUSIC_VIDEO_KEYWORDS = [
  "mv", "music video", "official video", "official mv",
  "music_video", "musicvideo", "lyric video", "lyrics",
  "audio visual", "vevo", "official audio", "visualizer"
];

const CONCERT_KEYWORDS = [
  "concert", "live", "performance", "show", "tour",
  "festival", "stage", "gig", "acoustic", "unplugged",
  "session", "soundcheck", "backstage", "venue"
];

const MOVIE_KEYWORDS = [
  "movie", "film", "episode", "series", "season",
  "documentary", "cinema", "theatrical", "trailer",
  "feature", "full movie", "hd movie", "fullhd"
];

const TUTORIAL_KEYWORDS = [
  "tutorial", "how to", "howto", "learn", "lesson",
  "course", "class", "training", "guide", "tips",
  "tricks", "teach", "education", "explain", "review"
];

const CAMERA_BUCKETS = ["camera", "dcim", "camera roll", "snapchat", "photos"];
const REEL_BUCKETS = ["reels", "tiktok", "instagram", "shorts", "whatsapp status", "status"];
const DOWNLOAD_BUCKETS = ["download", "downloads", "telegram"];

function scoreDuration(durationMs: number): Record<VideoCategory, number> {
  const sec = durationMs / 1000;
  const scores: Record<VideoCategory, number> = {
    reel: 0, music_video: 0, concert: 0, movie: 0, tutorial: 0, my_video: 0, other: 0,
  };

  if (sec >= 5 && sec <= 90) {
    scores.reel = Math.max(0, 50 - (sec - 30) * 0.5);
    scores.music_video = sec > 60 ? 15 : 5;
    scores.my_video = 20;
  } else if (sec > 90 && sec <= 300) {
    scores.music_video = 40;
    scores.tutorial = 20;
    scores.reel = sec < 150 ? 10 : 0;
    scores.my_video = 10;
  } else if (sec > 300 && sec <= 1800) {
    scores.concert = 30;
    scores.tutorial = 35;
    scores.music_video = 10;
    scores.movie = 15;
  } else if (sec > 1800) {
    scores.movie = 45;
    scores.concert = 30;
    scores.tutorial = 15;
  }

  return scores;
}

function scoreAspectRatio(ratio: number): Record<VideoCategory, number> {
  const scores: Record<VideoCategory, number> = {
    reel: 0, music_video: 0, concert: 0, movie: 0, tutorial: 0, my_video: 0, other: 0,
  };

  if (ratio < 0.65) {
    scores.reel = 45;
    scores.my_video = 15;
  } else if (ratio >= 0.65 && ratio <= 1.1) {
    scores.reel = 25;
    scores.my_video = 20;
    scores.music_video = 10;
  } else if (ratio > 1.1 && ratio <= 1.5) {
    scores.tutorial = 20;
    scores.movie = 15;
    scores.my_video = 25;
  } else if (ratio > 1.5 && ratio <= 1.9) {
    scores.music_video = 30;
    scores.concert = 25;
    scores.tutorial = 20;
    scores.movie = 20;
  } else if (ratio > 1.9) {
    scores.movie = 35;
    scores.concert = 20;
  }

  return scores;
}

function scoreFilename(title: string, displayName: string): Record<VideoCategory, number> {
  const text = `${title} ${displayName}`.toLowerCase();
  const scores: Record<VideoCategory, number> = {
    reel: 0, music_video: 0, concert: 0, movie: 0, tutorial: 0, my_video: 0, other: 0,
  };

  for (const kw of REEL_KEYWORDS) {
    if (text.includes(kw)) { scores.reel += 15; break; }
  }
  for (const kw of MUSIC_VIDEO_KEYWORDS) {
    if (text.includes(kw)) { scores.music_video += 20; break; }
  }
  for (const kw of CONCERT_KEYWORDS) {
    if (text.includes(kw)) { scores.concert += 18; break; }
  }
  for (const kw of MOVIE_KEYWORDS) {
    if (text.includes(kw)) { scores.movie += 20; break; }
  }
  for (const kw of TUTORIAL_KEYWORDS) {
    if (text.includes(kw)) { scores.tutorial += 18; break; }
  }

  if (/^VID_\d{8}/i.test(displayName) || /^video_\d{8}/i.test(displayName)) {
    scores.my_video += 30;
  }
  if (/^VID-\d{8}-WA/i.test(displayName)) {
    scores.reel += 20;
  }

  return scores;
}

function scoreBucket(bucket: string): Record<VideoCategory, number> {
  const b = (bucket || "").toLowerCase();
  const scores: Record<VideoCategory, number> = {
    reel: 0, music_video: 0, concert: 0, movie: 0, tutorial: 0, my_video: 0, other: 0,
  };

  for (const cam of CAMERA_BUCKETS) {
    if (b.includes(cam)) { scores.my_video += 35; return scores; }
  }
  for (const reel of REEL_BUCKETS) {
    if (b.includes(reel)) { scores.reel += 35; return scores; }
  }
  for (const dl of DOWNLOAD_BUCKETS) {
    if (b.includes(dl)) { scores.music_video += 10; scores.movie += 10; return scores; }
  }

  return scores;
}

function scoreResolution(width: number, height: number): Record<VideoCategory, number> {
  const maxDim = Math.max(width, height);
  const scores: Record<VideoCategory, number> = {
    reel: 0, music_video: 0, concert: 0, movie: 0, tutorial: 0, my_video: 0, other: 0,
  };

  if (maxDim <= 480) {
    scores.reel += 10; scores.my_video += 5;
  } else if (maxDim <= 720) {
    scores.reel += 8; scores.music_video += 8; scores.my_video += 8;
  } else if (maxDim <= 1080) {
    scores.music_video += 12; scores.concert += 10; scores.tutorial += 10;
  } else if (maxDim <= 1440) {
    scores.concert += 12; scores.movie += 15; scores.music_video += 10;
  } else {
    scores.movie += 20; scores.concert += 15;
  }

  return scores;
}

export function classifyVideo(video: RawVideoData): VideoClassification {
  const categories: VideoCategory[] = ["reel", "music_video", "concert", "movie", "tutorial", "my_video", "other"];
  const totalScores: Record<VideoCategory, number> = {
    reel: 0, music_video: 0, concert: 0, movie: 0, tutorial: 0, my_video: 0, other: 0,
  };

  const signals: string[] = [];

  const durScores = scoreDuration(video.duration);
  for (const cat of categories) totalScores[cat] += durScores[cat];
  signals.push(`Duration: ${Math.round(video.duration / 1000)}s`);

  const ratioScores = scoreAspectRatio(video.aspectRatio);
  for (const cat of categories) totalScores[cat] += ratioScores[cat] * 1.2;
  signals.push(`Ratio: ${video.aspectRatio.toFixed(2)} (${video.width}x${video.height})`);

  const nameScores = scoreFilename(video.title, video.displayName);
  for (const cat of categories) totalScores[cat] += nameScores[cat];

  const bucketScores = scoreBucket(video.bucket);
  for (const cat of categories) totalScores[cat] += bucketScores[cat] * 1.1;
  if (video.bucket) signals.push(`Folder: ${video.bucket}`);

  const resScores = scoreResolution(video.width, video.height);
  for (const cat of categories) totalScores[cat] += resScores[cat] * 0.8;

  let winnerCat: VideoCategory = "other";
  let winnerScore = 0;

  for (const cat of categories) {
    if (totalScores[cat] > winnerScore) {
      winnerScore = totalScores[cat];
      winnerCat = cat;
    }
  }

  if (winnerScore < 15) winnerCat = "other";

  const confidence = Math.min(100, Math.round((winnerScore / 120) * 100));
  signals.push(`→ Classified: ${winnerCat} (score: ${Math.round(winnerScore)})`);

  return {
    category: winnerCat,
    confidence,
    scores: totalScores,
    signals,
  };
}

export const CATEGORY_META: Record<VideoCategory, { label: string; icon: string; color: string; description: string }> = {
  reel: { label: "Reels", icon: "🎬", color: "#EC4899", description: "Short vertical videos" },
  music_video: { label: "Music Videos", icon: "🎵", color: "#7C3AED", description: "Official music videos" },
  concert: { label: "Concerts", icon: "🎤", color: "#F59E0B", description: "Live performances" },
  movie: { label: "Movies", icon: "🎞️", color: "#EF4444", description: "Films and long videos" },
  tutorial: { label: "Tutorials", icon: "📚", color: "#10B981", description: "Educational content" },
  my_video: { label: "My Videos", icon: "📱", color: "#3B82F6", description: "Recorded by you" },
  other: { label: "Other", icon: "📹", color: "#6B7280", description: "Unclassified videos" },
};

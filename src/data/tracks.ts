export type Track = {
  id: string;
  title: string;
  artist: string;
  cover: string;
  src: string;
  songs: number;
  source: "online" | "local";
  tags: string[];
  lyrics?: string[];
};

export type Playlist = {
  id: string;
  name: string;
  cover: string;
  trackIds: string[];
  createdAt: number;
};

// Playable CDN sources (Codepen reference build) — SoundHelix samples turned out
// to be unreliable on mobile, so only tracks that actually stream are shipped.
// High-reliability audio CDN streams
const A = (n: number) => {
  const streams = [
    "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3",
    "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=chill-abstract-intention-12099.mp3",
    "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=ambient-piano-amp-string-10781.mp3",
    "https://cdn.pixabay.com/download/audio/2021/09/06/audio_843513364f.mp3?filename=soft-rain-ambient-11115.mp3",
  ];
  return streams[(n - 1) % streams.length];
};

const P = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=600&h=600&fit=crop`;

export const ONLINE_TRACKS: Track[] = [
  {
    id: "t2", title: "Midnight Confessions", artist: "Alexiao", cover: P(3394658), src: A(1), songs: 24, source: "online", tags: ["new", "trending", "top"],
    lyrics: ["Tell me secrets in the dark,", "Underneath the neon spark,", "Midnight holds the only truth we know.", "Hold the silence, let it grow,", "Speak it slow, don't let it go."],
  },
  {
    id: "t4", title: "Letters I Never Sent", artist: "Alexiao", cover: P(3394657), src: A(2), songs: 24, source: "online", tags: ["new", "top"],
    lyrics: ["Paper folded, ink still wet,", "All the words I can't forget,", "Pages that I never sent to you.", "Maybe someday they'll come true,", "Maybe someday, so will you."],
  },
  {
    id: "t5", title: "Neon Horizon", artist: "Audenic Studio", cover: P(3394658), src: A(3), songs: 18, source: "online", tags: ["trending"],
    lyrics: ["Driving through the digital night,", "City lights shining bright,", "Speeding to the neon horizon."],
  },
  {
    id: "t6", title: "Acoustic Sunset", artist: "Audenic Acoustic", cover: P(3394657), src: A(4), songs: 12, source: "online", tags: ["new"],
    lyrics: ["Guitar strings softly ring,", "As the golden shadows fall,", "Peaceful mind, peace of all."],
  },
];

export const CHIPS = ["All", "New Release", "Trending", "Top Charts"];
export const LIBRARY_CHIPS = ["All", "Playlists", "Liked Songs", "Local Files"];

export const CURATED = [
  { id: "c1", title: "Discover weekly", subtitle: "The original slow instrumental best playlists.", cover: P(3394658), from: "#E4A2FF", to: "#C77DFF", trackId: "t2" },
  { id: "c2", title: "Focus flow", subtitle: "Deep beats to keep the mind moving forward.", cover: P(3394657), from: "#D6F25B", to: "#A8D82C", trackId: "t4" },
  { id: "c3", title: "Night drive", subtitle: "Synths, neon and a very long empty road.", cover: P(3394658), from: "#7FB8FF", to: "#5C7CFA", trackId: "t2" },
];

export function getArtists(tracks: Track[]) {
  const map = new Map<string, Track[]>();
  tracks.forEach((t) => {
    const list = map.get(t.artist) || [];
    list.push(t);
    map.set(t.artist, list);
  });
  return [...map.entries()]
    .map(([name, songs]) => ({ name, songs, cover: songs[0].cover }))
    .sort((a, b) => b.songs.length - a.songs.length);
}

/**
 * Multi-Key News & Entertainment API Integration.
 * Rotates across GNews, NewsAPI, and The Guardian API keys
 * to fetch live music, entertainment & tech news inside Audenic Music.
 */

import { ENV, pickFromPool } from "./envKeys";

export type NewsArticle = {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  category: "music" | "entertainment" | "culture" | "tech";
};

const FALLBACK_NEWS: NewsArticle[] = [
  {
    id: "fb-1",
    title: "Global Music Industry Reaches New Milestone in Streaming Innovation",
    description: "Spatial audio, AI music tools, and high-fidelity lossless streaming are redefining how millions experience their favorite tracks daily.",
    source: "Audenic Music Beats",
    url: "https://music.youtube.com",
    imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80",
    publishedAt: "Just now",
    category: "music",
  },
  {
    id: "fb-2",
    title: "The Rise of Independent Artists & Direct Cloud Storage Distribution",
    description: "Cloudflare R2 and decentralized storage allow creators to publish studio master files directly to fans around the world.",
    source: "Tech & Sound Journal",
    url: "https://developers.cloudflare.com/r2",
    imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80",
    publishedAt: "1h ago",
    category: "tech",
  },
  {
    id: "fb-3",
    title: "How Binaural Frequencies & Focus Beats Enhance Daily Deep Work",
    description: "Neuroscience researchers confirm that 432Hz ambient soundscapes significantly lower cortisol and improve focus concentration.",
    source: "Audenic Science & Sound",
    url: "https://en.wikipedia.org/wiki/Binaural_beats",
    imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80",
    publishedAt: "3h ago",
    category: "culture",
  },
  {
    id: "fb-4",
    title: "Live Concert Festivals & Global Tours Breakthrough in 2026",
    description: "Live performances witness record-breaking stadium turnouts across Africa, America, and Europe with immersive AR sound stages.",
    source: "World Entertainment Weekly",
    url: "https://www.billboard.com",
    imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80",
    publishedAt: "5h ago",
    category: "entertainment",
  },
];

export async function fetchLatestNews(query = "music"): Promise<NewsArticle[]> {
  // 1. Try GNews API if keys exist
  const gnewsKey = pickFromPool(ENV.gnewsKeys);
  if (gnewsKey) {
    try {
      const res = await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=8&apikey=${gnewsKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data.articles?.length) {
          return data.articles.map((a: any, i: number) => ({
            id: `gnews-${i}-${Date.now()}`,
            title: a.title,
            description: a.description || a.content || "",
            source: a.source?.name || "GNews",
            url: a.url,
            imageUrl: a.image,
            publishedAt: new Date(a.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: "music",
          }));
        }
      }
    } catch { /* fallback below */ }
  }

  // 2. Try NewsAPI if keys exist
  const newsApiKey = pickFromPool(ENV.newsApiKeys);
  if (newsApiKey) {
    try {
      const res = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(query + " music")}&language=en&sortBy=publishedAt&pageSize=8&apiKey=${newsApiKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data.articles?.length) {
          return data.articles.map((a: any, i: number) => ({
            id: `newsapi-${i}-${Date.now()}`,
            title: a.title,
            description: a.description || "",
            source: a.source?.name || "NewsAPI",
            url: a.url,
            imageUrl: a.urlToImage,
            publishedAt: new Date(a.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: "music",
          }));
        }
      }
    } catch { /* fallback below */ }
  }

  // 3. Try Guardian API if key exists
  if (ENV.guardianKey) {
    try {
      const res = await fetch(`https://content.guardianapis.com/search?q=${encodeURIComponent(query)}&section=music&show-fields=thumbnail,trailText&api-key=${ENV.guardianKey}`);
      if (res.ok) {
        const data = await res.json();
        const results = data.response?.results;
        if (results?.length) {
          return results.map((r: any, i: number) => ({
            id: `guardian-${i}-${Date.now()}`,
            title: r.webTitle,
            description: r.fields?.trailText?.replace(/<[^>]*>?/gm, '') || "",
            source: "The Guardian",
            url: r.webUrl,
            imageUrl: r.fields?.thumbnail,
            publishedAt: new Date(r.webPublicationDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: "music",
          }));
        }
      }
    } catch { /* fallback below */ }
  }

  return FALLBACK_NEWS;
}

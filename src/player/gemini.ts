// Lightweight client for Gemini's generateContent REST API, used for live lyric translation.
// Docs: https://ai.google.dev/gemini-api/docs/generate-content/text-generation
// Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent

import { ENV, pickFromPool } from "./envKeys";

const MODEL = "gemini-2.5-flash";

export type TranslateResult = { lines: string[]; error?: string };

const cache = new Map<string, string[]>();

export async function translateLines(
  lines: string[],
  targetLang: string,
  apiKey: string
): Promise<TranslateResult> {
  const manual = apiKey.trim();
  const pool = Array.from(new Set(ENV.geminiKeys.map((k) => k.trim()).filter(Boolean)));
  const keys = manual ? [manual, ...pool.filter((k) => k !== manual)] : pool;
  if (!keys.length) {
    return { lines, error: "no-key" };
  }
  const cacheKey = `${targetLang}::${lines.join("|")}`;
  if (cache.has(cacheKey)) return { lines: cache.get(cacheKey)! };

  const prompt = `Translate each of the following song-lyric lines into ${targetLang}. Keep the poetic tone, keep the same number of lines, and reply with ONLY the translated lines separated by newlines, no numbering, no extra commentary.\n\nLines:\n${lines
    .map((l, i) => `${i + 1}. ${l}`)
    .join("\n")}`;

  for (const activeKey of keys) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(activeKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": activeKey,
            "Authorization": `Bearer ${activeKey}`,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4 },
          }),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text: string | undefined =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("\n");
      if (!text) continue;
      const out = text
        .split("\n")
        .map((l) => l.replace(/^\s*\d+\.\s*/, "").trim())
        .filter(Boolean);
      const final = out.length >= lines.length ? out.slice(0, lines.length) : lines;
      cache.set(cacheKey, final);
      return { lines: final };
    } catch {
      continue;
    }
  }
  return { lines, error: "all-keys-failed" };
}

export const LANGUAGES = [
  { code: "Spanish", label: "Español" },
  { code: "French", label: "Français" },
  { code: "German", label: "Deutsch" },
  { code: "Hindi", label: "हिन्दी" },
  { code: "Japanese", label: "日本語" },
  { code: "Korean", label: "한국어" },
  { code: "Portuguese", label: "Português" },
  { code: "Arabic", label: "العربية" },
  { code: "Indonesian", label: "Indonesia" },
  { code: "Swahili", label: "Kiswahili" },
];

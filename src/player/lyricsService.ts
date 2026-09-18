import { ENV, pickFromPool } from "./envKeys";

export type LyricLine = string;

export type Tier2Result = {
  found: boolean;
  lyrics: string | null;
  error?: string;
};

/**
 * TIER 2 — AI-powered lyrics fetch when no local .lrc exists.
 * Returns unsynced lyrics text or null if unknown/not confident.
 */
function getValidGeminiKeys(userKey?: string): string[] {
  const user = userKey?.trim();
  const pool = Array.from(new Set(ENV.geminiKeys.map((k) => k.trim()).filter(Boolean)));
  if (user) return [user, ...pool.filter((k) => k !== user)];
  return pool;
}

/**
 * Fast & free LRCLIB community database for synced & plain lyrics
 */
async function fetchLyricsViaLrclib(title: string, artist: string): Promise<Tier2Result> {
  try {
    const cleanTitle = title
      .replace(/[\(\[](?:official|music|video|audio|lyrics|hd|4k|visualizer|acoustic|remastered)[^\)\]]*[\)\]]/gi, "")
      .trim();
    const cleanArtist = artist.replace(/ft\..*|feat\..*/i, "").trim();

    const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics && typeof data.syncedLyrics === "string") {
        return { found: true, lyrics: data.syncedLyrics.trim() };
      }
      if (data.plainLyrics && typeof data.plainLyrics === "string") {
        return { found: true, lyrics: data.plainLyrics.trim() };
      }
    }

    // Secondary search endpoint
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`)}`;
    const sRes = await fetch(searchUrl);
    if (sRes.ok) {
      const list = await sRes.json();
      if (Array.isArray(list) && list.length > 0) {
        const item = list[0];
        if (item.syncedLyrics) return { found: true, lyrics: item.syncedLyrics.trim() };
        if (item.plainLyrics) return { found: true, lyrics: item.plainLyrics.trim() };
      }
    }
  } catch {}
  return { found: false, lyrics: null };
}

/**
 * Groq Whisper live audio chunk transcription
 */
async function transcribeViaGroq(audioBase64: string, mimeType = "audio/webm"): Promise<string> {
  const groqKeys = ENV.groqKeys;
  if (!groqKeys.length) return "";

  try {
    const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
    const binary = atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const file = new File([blob], "chunk.webm", { type: mimeType });

    for (const key of groqKeys.slice(0, 5)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("model", "whisper-large-v3");
        formData.append("response_format", "json");

        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
          },
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.text && data.text.trim()) {
            return data.text.trim();
          }
        }
      } catch {
        continue;
      }
    }
  } catch {}
  return "";
}

/**
 * Groq / OpenRouter fallback to fetch song lyrics
 */
async function fetchLyricsViaGroq(title: string, artist: string): Promise<Tier2Result> {
  const prompt = `Provide the complete song lyrics for "${title}" by "${artist}".
Return ONLY valid JSON in this exact structure:
{"found": true, "lyrics": "line 1\\nline 2\\nline 3"}
If unknown, return: {"found": false, "lyrics": null}`;

  for (const key of ENV.groqKeys.slice(0, 5)) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.found && parsed.lyrics) {
            return { found: true, lyrics: parsed.lyrics.trim() };
          }
        }
      }
    } catch {
      continue;
    }
  }

  // Also check OpenRouter if Groq didn't have it
  for (const key of ENV.openRouterKeys.slice(0, 5)) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.found && parsed.lyrics) {
              return { found: true, lyrics: parsed.lyrics.trim() };
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  return { found: false, lyrics: null };
}

/**
 * TIER 2 — AI-powered lyrics fetch with multi-provider fallback.
 */
export async function fetchLyricsViaGemini(
  title: string,
  artist: string,
  userApiKey?: string
): Promise<Tier2Result> {
  // 1. Try official community synced & plain lyrics via LRCLIB first (fast, free, exact)
  const lrclibResult = await fetchLyricsViaLrclib(title, artist);
  if (lrclibResult.found) {
    return lrclibResult;
  }

  const keys = getValidGeminiKeys(userApiKey);

  const prompt = `Provide the full lyrics for the song "${title}" by "${artist}" if you know it accurately.
Return ONLY valid JSON in this exact format, nothing else:
{"found": true, "lyrics": "full lyrics text with \\n between lines"}
If you don't know this song with certainty, return: {"found": false, "lyrics": null}
Do not guess or hallucinate lyrics you're not confident about.`;

  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest"];

  for (const apiKey of keys) {
    for (const model of models) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (!res.ok) continue;

        const data = await res.json();
        const text: string | undefined =
          data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;

        const parsed = JSON.parse(text);
        if (parsed.found && typeof parsed.lyrics === "string" && parsed.lyrics.trim()) {
          return { found: true, lyrics: parsed.lyrics.trim() };
        }

        if (parsed.found === false) {
          break;
        }
      } catch {
        continue;
      }
    }
  }

  // Fallback to Groq 70B / OpenRouter
  const groqResult = await fetchLyricsViaGroq(title, artist);
  if (groqResult.found) return groqResult;

  return { found: false, lyrics: null, error: "all-providers-failed" };
}

/**
 * TIER 3 — Sing-along real-time transcription with Gemini + Groq Whisper fallback.
 */
export async function transcribeViaGemini(
  audioBase64: string,
  mimeType = "audio/webm",
  userApiKey?: string
): Promise<string> {
  const keys = getValidGeminiKeys(userApiKey);
  const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest"];

  for (const apiKey of keys) {
    for (const model of models) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: "Transcribe the singing/speech in this audio chunk. The user may sing in Swahili, English, or mixed Swahili-English code-switching. Return ONLY the transcribed words, no explanations, no punctuation if unclear, no code blocks.",
                    },
                    {
                      inline_data: {
                        mime_type: mimeType,
                        data: cleanBase64,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.3,
              },
            }),
          }
        );

        if (!res.ok) continue;

        const data = await res.json();
        const text: string | undefined =
          data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) return text.trim();
      } catch {
        continue;
      }
    }
  }

  // Fall back to ultra-fast Groq Whisper
  return await transcribeViaGroq(audioBase64, mimeType);
}

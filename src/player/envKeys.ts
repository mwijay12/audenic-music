/**
 * Key pools loaded from build-time environment variables.
 *
 * The user keeps real keys OUT of source control. Drop them into a local
 * `.env` file (comma-separated) and run `npm run build` — Vite inlines
 * `VITE_*` vars into the bundle, and the native app ships with them.
 *
 * Manual overrides typed in Settings always win over the built-in pool.
 * Cerebras is intentionally NOT wired yet.
 */

const raw = (k: string): string => {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> }).env?.[k];
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
};

export const envPool = (k: string): string[] =>
  raw(k)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const ENV = {
  groqKeys: envPool("VITE_GROQ_KEYS"),
  openRouterKeys: envPool("VITE_OPENROUTER_KEYS"),
  ollamaKeys: envPool("VITE_OLLAMA_KEYS"),
  huggingFaceKeys: envPool("VITE_HUGGINGFACE_KEYS"),
  elevenLabsTtsKeys: envPool("VITE_ELEVENLABS_TTS_KEYS"),
  elevenLabsSfxKeys: envPool("VITE_ELEVENLABS_SFX_KEYS"),
  geminiKeys: Array.from(
    new Set([
      ...envPool("VITE_GEMINI_KEYS"),
      ...envPool("GEMINI_KEYS"),
    ])
  ),
  newsApiKeys: envPool("VITE_NEWSAPI_KEYS"),
  guardianKey: raw("VITE_GUARDIAN_KEY") || raw("GUARDIAN_KEY"),
  gnewsKeys: envPool("VITE_GNEWS_KEYS"),
  puterToken: raw("VITE_PUTER_TOKEN") || raw("PUTER_TOKEN"),
  cfAccountId: raw("VITE_CF_ACCOUNT_ID") || raw("CF_ACCOUNT_ID"),
  cloudflareApiTokens: envPool("VITE_CLOUDFLARE_API_TOKENS"),
  r2: {
    accessKeyId: raw("VITE_R2_ACCESS_KEY_ID") || raw("R2_ACCESS_KEY_ID"),
    secretAccessKey: raw("VITE_R2_SECRET_ACCESS_KEY") || raw("R2_SECRET_ACCESS_KEY"),
    endpoint: raw("VITE_R2_ENDPOINT") || raw("R2_ENDPOINT"),
    bucketName: raw("VITE_R2_BUCKET_NAME") || raw("R2_BUCKET_NAME"),
    publicUrl: raw("VITE_R2_PUBLIC_URL") || raw("R2_PUBLIC_URL") || "https://pub-c26084d7ca874fcda47de161be8ded27.r2.dev",
  },
  telegramBotToken: raw("VITE_TELEGRAM_BOT_TOKEN") || raw("TELEGRAM_BOT_TOKEN"),
};

export const POOL_STATUS = {
  groq: ENV.groqKeys.length,
  openrouter: ENV.openRouterKeys.length,
  ollama: ENV.ollamaKeys.length,
  huggingface: ENV.huggingFaceKeys.length,
  elevenLabsTts: ENV.elevenLabsTtsKeys.length,
  elevenLabsSfx: ENV.elevenLabsSfxKeys.length,
  gemini: ENV.geminiKeys.length,
  newsApi: ENV.newsApiKeys.length,
  gnews: ENV.gnewsKeys.length,
  guardian: ENV.guardianKey ? 1 : 0,
};

/** Round-robin helper — spreads requests across the pool. */
export function pickFromPool(keys: string[]): string | null {
  if (!keys.length) return null;
  const i = Math.floor(Math.random() * keys.length);
  return keys[i] ?? null;
}

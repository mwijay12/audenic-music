/**
 * ElevenLabs integration — TTS + music/ambient generation.
 * Keys come exclusively from VITE_* env pools (see envKeys.ts); nothing is
 * hardcoded. The Sound Effects API doubles as the music bed generator:
 * prompting it with "a 30s chill lo-fi beat, 90 BPM" returns a usable track.
 */

import { ENV, pickFromPool } from "./envKeys";

const TTS_URL = (voiceId: string) => `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
const SFX_URL = "https://api.elevenlabs.io/v1/sound-generation";

async function withRotation(
  keys: string[],
  attempt: (key: string) => Promise<Response>,
): Promise<Response | null> {
  const pool = [...keys].sort(() => Math.random() - 0.5);
  for (const key of pool) {
    try {
      const r = await attempt(key);
      if (r.status === 429) continue; // rate-limited — rotate
      return r;
    } catch {
      continue;
    }
  }
  return null;
}

/** Generate speech audio; returns a blob ready for an <audio> src. */
export async function generateSpeech(
  text: string,
  voiceId = "21m00Tcm4TlvDq8ikWAM"
): Promise<{ ok: boolean; url?: string; message: string }> {
  if (!ENV.elevenLabsTtsKeys.length)
    return { ok: false, message: "Add VITE_ELEVENLABS_TTS_KEYS to enable speech." };

  const sanitizedKeys = ENV.elevenLabsTtsKeys.map((k) => k.trim()).filter(Boolean);
  const models = ["eleven_turbo_v2_5", "eleven_turbo_v2", "eleven_multilingual_v2"];

  for (const modelId of models) {
    const res = await withRotation(sanitizedKeys, (key) =>
      fetch(TTS_URL(voiceId), {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, 1000), // ElevenLabs max length limit safety
          model_id: modelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      })
    );

    if (res && res.ok) {
      try {
        const blob = await res.blob();
        if (blob.size > 100) {
          return { ok: true, url: URL.createObjectURL(blob), message: "Speech ready." };
        }
      } catch {
        /* try next model */
      }
    }
  }

  return { ok: false, message: "Speech generation rate-limited or key invalid." };
}

/** Generate a music bed / ambient track via the Sound Effects API. */
export async function generateMusic(prompt: string, durationSec = 20): Promise<{ ok: boolean; url?: string; message: string }> {
  if (!ENV.elevenLabsSfxKeys.length) return { ok: false, message: "Add VITE_ELEVENLABS_SFX_KEYS to enable music generation." };
  const res = await withRotation(ENV.elevenLabsSfxKeys, (key) =>
    fetch(SFX_URL, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: prompt, duration_seconds: Math.max(5, Math.min(30, durationSec)) }),
    }),
  );
  if (!res || !res.ok) return { ok: false, message: "Music generation is rate-limited right now." };
  const blob = await res.blob();
  return { ok: true, url: URL.createObjectURL(blob), message: "Track generated." };
}

/** Speak text aloud using ElevenLabs multi-key TTS, falling back to Web Speech API. */
export async function speakWithElevenLabs(text: string, voiceId = "21m00Tcm4TlvDq8ikWAM"): Promise<boolean> {
  if (!text?.trim()) return false;
  try {
    const res = await generateSpeech(text, voiceId);
    if (res.ok && res.url) {
      const audio = new Audio(res.url);
      audio.volume = 0.95;
      await Promise.resolve(audio.play());
      return true;
    }
  } catch {
    /* fallback to browser speech synthesis */
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.0;
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
      return true;
    } catch {
      /* fallback */
    }
  }
  return false;
}

export function ttsReady() { return ENV.elevenLabsTtsKeys.length > 0; }
export function sfxReady() { return ENV.elevenLabsSfxKeys.length > 0; }
export { pickFromPool };

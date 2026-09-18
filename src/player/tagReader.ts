/**
 * Self-contained ID3v2 reader (TIT2 / TPE1 / APIC / USLT) with zero npm deps.
 * Reads just the leading chunks of an MP3 file, extracts embedded album art
 * and lyrics, and also parses `.lrc` sidecars into timed karaoke lines.
 */

export type EmbeddedTags = {
  title?: string;
  artist?: string;
  cover?: string;
  lyrics?: string[];
  timedLyrics?: { t: number; text: string }[];
};

function dec(bytes: Uint8Array, encoding: number, from: number, to: number): string {
  // encoding 0 = ISO-8859-1, 1 = UTF-16(+BOM), 2 = UTF-16BE, 3 = UTF-8
  let out = "";
  if (encoding <= 0 || encoding === 3) {
    for (let i = from; i < to; i++) out += String.fromCharCode(bytes[i]);
  } else {
    let i = from;
    if (to - from >= 2 && bytes[from] === 0xff && bytes[from + 1] === 0xfe) i = from + 2;
    else if (to - from >= 2 && bytes[from] === 0xfe && bytes[from + 1] === 0xff) return "";
    for (; i + 1 < to; i += 2) out += String.fromCharCode((bytes[i + 1] << 8) | bytes[i]);
  }
  return out.replace(/\u0000+$/, "");
}

function readU32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}
function readSyncSafe(b: Uint8Array, o: number): number {
  return ((b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3]) >>> 0;
}

function chunkToBase64(bytes: Uint8Array): string {
  let out = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as never[]) as string;
  }
  return btoa(out);
}

export async function readTags(blob: Blob): Promise<EmbeddedTags> {
  const out: EmbeddedTags = {};
  try {
    // Most APIC tags sit in the first few MB; cap at 4 MB to avoid OOM on
    // low-memory Android devices scanning 1000+ songs concurrently.
    const MAX_SLICE = 4 * 1024 * 1024;
    const buf = new Uint8Array(await blob.slice(0, Math.min(blob.size, MAX_SLICE)).arrayBuffer());
    if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return out; // not ID3v2

    const major = buf[3];
    const isV4 = major >= 4;
    const headerSize = 10 + readSyncSafe(buf, 6) + (buf[5] & 0x40 ? readSyncSafe(buf, 10) : 0);

    let o = headerSize;
    const end = Math.min(buf.length - 10, o + 6 * 1024 * 1024);
    const lyricLines: string[] = [];

    while (o + 10 <= end) {
      const id = String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const size = isV4 ? readSyncSafe(buf, o + 4) : readU32(buf, o + 4);
      if (size <= 0 || o + 10 + size > buf.length) break;
      const body = buf.subarray(o + 10, o + 10 + size);

      if (id === "TIT2" || id === "TPE1") {
        const text = dec(body, body[0], 1, body.length).split(/\r\n|\n|\u0000+/)[0]?.trim();
        if (text) {
          if (id === "TIT2") out.title = out.title || text;
          else out.artist = out.artist || text;
        }
      } else if (id === "APIC") {
        const enc = body[0];
        let i = 1;
        const mimeStart = i;
        while (i < body.length && body[i] !== 0) i++;
        const mime = dec(body, 0, mimeStart, i) || "image/jpeg";
        i++; // null
        i += 1; // picture type byte
        if (enc === 1 || enc === 2) { i += 2; } // UTF-16 BOM … approximation is fine for description skip
        // walk to the terminator
        while (i < body.length) {
          if (enc <= 0 && body[i] === 0) { i++; break; }
          if (enc >= 1 && i + 1 < body.length && body[i] === 0 && body[i + 1] === 0) { i += 2; break; }
          i++;
        }
        const img = body.subarray(i);
        if (img.length > 200) {
          out.cover = `data:${mime.startsWith("image") ? mime : "image/jpeg"};base64,${chunkToBase64(img)}`;
        }
      } else if (id === "USLT") {
        const enc = body[0];
        let i = 4; // encoding(1) + language(3)
        if (enc <= 0) { while (i < body.length && body[i] !== 0) i++; i++; }
        else { while (i + 1 < body.length && !(body[i] === 0 && body[i + 1] === 0)) i += 2; i += 2; }
        const text = dec(body, enc, i, body.length);
        text.split(/\r\n|\n|\r/).forEach((l) => { const t = l.trim(); if (t) lyricLines.push(t); });
      }
      o += 10 + size;
    }

    if (lyricLines.length) out.lyrics = lyricLines.slice(0, 200);
    return out;
  } catch {
    return out;
  }
}

/** `[mm:ss.xx]`-stamped LRC → [{t seconds, text}] sorted. */
export function parseLrc(text: string): { t: number; text: string }[] {
  const out: { t: number; text: string }[] = [];
  const re = /\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]\s*(.*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const t = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
    const line = m[3].trim();
    if (line) out.push({ t, text: line });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** Match a `.lrc` / `.txt` sidecar that shares the audio file's base name. */
export function findLrcFor(files: File[], audioName: string): File | undefined {
  const base = audioName.replace(/\.[a-z0-9]+$/i, "").toLowerCase();
  for (const f of files) {
    const name = f.name.toLowerCase();
    if (!name.endsWith(".lrc") && !name.endsWith(".txt")) continue;
    const fb = name.replace(/\.(lrc|txt)$/i, "");
    if (fb === base || fb.includes(base) || base.includes(fb)) return f;
  }
  return undefined;
}

export async function attachLrc(
  lrc: File | undefined,
  fallback: string[] | undefined,
): Promise<{ lyrics?: string[]; timedLyrics?: { t: number; text: string }[] }> {
  if (!lrc) return { lyrics: fallback };
  try {
    const text = await lrc.text();
    const timed = parseLrc(text);
    if (timed.length) return { lyrics: timed.map((x) => x.text), timedLyrics: timed };
    const lines = text.split(/\r\n|\n|\r/).map((l) => l.trim()).filter(Boolean);
    return { lyrics: lines.length ? lines : fallback };
  } catch {
    return { lyrics: fallback };
  }
}

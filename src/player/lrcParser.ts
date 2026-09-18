export interface LrcLine {
  time: number; // ms
  text: string;
  words?: LrcWord[];
}

export interface LrcWord {
  time: number; // ms
  text: string;
}

export interface LrcMetadata {
  title: string | null;
  artist: string | null;
  album: string | null;
  author: string | null;
  length: string | null;
  offset: number;
  version: string | null;
}

export interface ParsedLrc {
  lines: LrcLine[];
  metadata: LrcMetadata;
  raw: string;
  isEnhanced: boolean;
}

const METADATA_REGEX = /^\[(\w+):(.+)\]$/;
const WORD_TIME_REGEX = /<(\d{1,2}):(\d{2})\.(\d{2,3})>/g;

function timestampToMs(min: string, sec: string, centisec: string): number {
  const m = parseInt(min, 10);
  const s = parseInt(sec, 10);
  const cs = centisec.length === 3 ? parseInt(centisec, 10) : parseInt(centisec, 10) * 10;
  return m * 60 * 1000 + s * 1000 + cs;
}

function parseMetadataLine(line: string, meta: LrcMetadata): boolean {
  const match = line.trim().match(METADATA_REGEX);
  if (!match) return false;

  const tag = match[1].toLowerCase().trim();
  const value = match[2].trim();

  switch (tag) {
    case "ti": meta.title = value; break;
    case "ar": meta.artist = value; break;
    case "al": meta.album = value; break;
    case "au": case "by": meta.author = value; break;
    case "length": meta.length = value; break;
    case "ve": meta.version = value; break;
    case "offset": meta.offset = parseInt(value, 10) || 0; break;
  }
  return true;
}

function parseEnhancedWords(text: string): LrcWord[] {
  const words: LrcWord[] = [];
  const regex = /<(\d{1,2}):(\d{2})\.(\d{2,3})>([^<]*)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const time = timestampToMs(match[1], match[2], match[3]);
    const word = match[4].trim();
    if (word.length > 0) {
      words.push({ time, text: word });
    }
  }
  return words;
}

function cleanLyricText(text: string): string {
  let clean = text.replace(/\[\d{1,2}:\d{2}\.\d{2,3}\]/g, "");
  clean = clean.replace(/<\d{1,2}:\d{2}\.\d{2,3}>/g, "");
  return clean.trim();
}

export function parseLrc(rawContent: string): ParsedLrc {
  const metadata: LrcMetadata = {
    title: null, artist: null, album: null,
    author: null, length: null, offset: 0, version: null,
  };

  const lines: LrcLine[] = [];
  let isEnhanced = false;

  if (!rawContent || rawContent.trim().length === 0) {
    return { lines: [], metadata, raw: rawContent || "", isEnhanced: false };
  }

  const normalized = rawContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const fileLines = normalized.split("\n");

  for (const fileLine of fileLines) {
    const trimmed = fileLine.trim();
    if (trimmed.length === 0) continue;

    if (parseMetadataLine(trimmed, metadata)) continue;

    if (trimmed.includes("<") && WORD_TIME_REGEX.test(trimmed)) {
      isEnhanced = true;
    }

    const timestamps: number[] = [];
    const tsRegex = /\[(\d{1,2}):(\d{2})\.(\d{2,3})\]/g;
    let tsMatch: RegExpExecArray | null;

    while ((tsMatch = tsRegex.exec(trimmed)) !== null) {
      const ms = timestampToMs(tsMatch[1], tsMatch[2], tsMatch[3]);
      timestamps.push(ms);
    }

    if (timestamps.length === 0) continue;

    const lastTsEnd = trimmed.lastIndexOf("]") + 1;
    const textPart = cleanLyricText(trimmed.substring(lastTsEnd));

    if (textPart.length === 0 && !isEnhanced) continue;

    const words = isEnhanced ? parseEnhancedWords(trimmed) : undefined;

    for (const ts of timestamps) {
      const adjustedTime = ts + metadata.offset;
      lines.push({
        time: Math.max(0, adjustedTime),
        text: textPart,
        words: words && words.length > 0 ? words : undefined,
      });
    }
  }

  lines.sort((a, b) => a.time - b.time);

  const deduplicated: LrcLine[] = [];
  const seenTimes = new Set<number>();
  for (const line of lines) {
    if (!seenTimes.has(line.time)) {
      seenTimes.add(line.time);
      deduplicated.push(line);
    }
  }

  return {
    lines: deduplicated,
    metadata,
    raw: rawContent,
    isEnhanced,
  };
}

export function getActiveLrcLine(lines: LrcLine[], currentTimeMs: number): number {
  if (lines.length === 0) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (lines[mid].time <= currentTimeMs) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return result;
}

export function getActiveWord(words: LrcWord[], currentTimeMs: number): number {
  if (!words || words.length === 0) return -1;
  let result = -1;
  for (let i = 0; i < words.length; i++) {
    if (words[i].time <= currentTimeMs) result = i;
    else break;
  }
  return result;
}

export function lrcToPlainText(parsed: ParsedLrc): string {
  return parsed.lines.filter((l) => l.text.trim().length > 0).map((l) => l.text).join("\n");
}

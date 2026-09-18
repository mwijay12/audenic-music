import type { Track } from "../data/tracks";

/**
 * Interest-based recommendation — the same idea social feeds use.
 * Scores every candidate by what the listener has actually spent time on:
 * artist affinity + tag/genre affinity, then rewards freshness and
 * penalises songs already worn out.
 */

export function recommendForYou(
  tracks: Track[],
  playCounts: Record<string, number>,
  recentlyPlayed: string[],
  liked: string[],
  limit = 10,
): Track[] {
  const totalPlays = Object.values(playCounts).reduce((a, b) => a + b, 0);
  if (totalPlays < 2) return []; // not enough signal yet

  // Artist affinity from play history
  const artistScore = new Map<string, number>();
  const tagScore = new Map<string, number>();
  for (const t of tracks) {
    const plays = playCounts[t.id] || 0;
    if (!plays) continue;
    artistScore.set(t.artist, (artistScore.get(t.artist) || 0) + plays);
    for (const tag of t.tags ?? []) tagScore.set(tag, (tagScore.get(tag) || 0) + plays * 0.8);
    if (liked.includes(t.id)) {
      artistScore.set(t.artist, (artistScore.get(t.artist) || 0) + 6);
      for (const tag of t.tags ?? []) tagScore.set(tag, (tagScore.get(tag) || 0) + 4);
    }
  }

  const recent = new Set(recentlyPlayed.slice(0, 12));
  const scored = tracks.map((t) => {
    let s = 0;
    s += (artistScore.get(t.artist) || 0) * 3;
    for (const tag of t.tags ?? []) s += (tagScore.get(tag) || 0) * 2;
    if (recent.has(t.id)) s -= 60;                 // already fresh in memory
    s -= Math.min(30, (playCounts[t.id] || 0) * 4); // fatigue
    if ((t.tags ?? []).includes("new")) s += 8;     // a little discovery
    return { t, s };
  });

  return scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.t);
}

/* ─────────── Share-card studio ───────────
 * Renders a branded listening card to an offscreen canvas so listeners can
 * share exactly what they're hearing — cover + visualizer + lyric.
 * Three templates: "pulse" (art + spectrum), "lyric" (art + bars + line),
 * "poster" (typographic poster with gradient pulled from the cover).
 */
export type ShareTemplate = "pulse" | "lyric" | "poster";

const W = 720;
const H = 1280; // 9:16 — perfect for stories / status

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBars(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string, seed: number, live?: number[]) {
  const n = 28;
  const bw = (w - (n - 1) * 6) / n;
  for (let i = 0; i < n; i++) {
    const amp = live ? live[i % live.length] : Math.abs(Math.sin(seed + i * 0.55)) * 0.7 + 0.15;
    const bh = Math.max(8, amp * h);
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.35 + amp * 0.65;
    roundRect(ctx, x + i * (bw + 6), y + (h - bh), bw, bh, bw / 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderShareCard(
  track: { title: string; artist: string; cover: string },
  lyric: string | null,
  template: ShareTemplate,
  accent: string,
  live?: number[],
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = await loadImg(track.cover);

  // Background
  ctx.fillStyle = "#0A0A0D";
  ctx.fillRect(0, 0, W, H);
  if (img) {
    ctx.save();
    ctx.globalAlpha = template === "poster" ? 0.35 : 0.55;
    const scale = Math.max(W / img.width, H / img.height);
    const iw = img.width * scale, ih = img.height * scale;
    ctx.filter = "blur(36px) saturate(1.3)";
    ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2 - 60, iw, ih);
    ctx.restore();
  }
  const grad = ctx.createLinearGradient(0, H * 0.45, 0, H);
  grad.addColorStop(0, "rgba(10,10,13,0)");
  grad.addColorStop(1, "rgba(10,10,13,0.97)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  if (template === "pulse") {
    // Cover art, large, with a living spectrum ring of bars beneath
    if (img) {
      ctx.save();
      roundRect(ctx, 140, 250, 440, 440, 56);
      ctx.clip();
      ctx.drawImage(img, 140, 250, 440, 440);
      ctx.restore();
      ctx.lineWidth = 3;
      ctx.strokeStyle = `${accent}66`;
      roundRect(ctx, 140, 250, 440, 440, 56);
      ctx.stroke();
    }
    drawBars(ctx, 90, 830, W - 180, 150, accent, track.title.length, live);
  } else if (template === "lyric") {
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(360, 380, 190, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, 170, 190, 380, 380);
      ctx.restore();
    }
    drawBars(ctx, 180, 640, W - 360, 46, accent, track.title.length + 4, live);
    if (lyric) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 44px system-ui, sans-serif";
      const lines = wrapText(ctx, `“${lyric}”`, W - 160).slice(0, 4);
      lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 800 + i * 60));
    }
  } else {
    // Poster — big type, diagonal cover sliver, date stamp
    ctx.save();
    ctx.translate(120, 220);
    ctx.rotate(-0.06);
    if (img) {
      roundRect(ctx, 0, 0, 480, 320, 32);
      ctx.clip();
      ctx.drawImage(img, 0, 0, 480, 320);
    } else {
      ctx.fillStyle = `${accent}33`;
      roundRect(ctx, 0, 0, 480, 320, 32);
      ctx.fill();
    }
    ctx.restore();
    ctx.textAlign = "left";
    ctx.fillStyle = accent;
    ctx.font = "800 26px system-ui, sans-serif";
    ctx.fillText(track.artist.toUpperCase(), 84, 640);
    ctx.fillStyle = "#fff";
    ctx.font = "800 74px system-ui, sans-serif";
    wrapText(ctx, track.title, W - 168).slice(0, 3).forEach((ln, i) => ctx.fillText(ln, 80, 730 + i * 86));
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "600 24px system-ui, sans-serif";
    ctx.fillText(new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }), W / 2, 1040);
  }

  // Brand footer
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "800 30px system-ui, sans-serif";
  ctx.fillText("AUDENIC", W / 2, H - 96);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(W / 2 - 92, H - 106, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "500 22px system-ui, sans-serif";
  ctx.fillText(`${track.artist} · now playing`, W / 2, H - 58);

  try {
    return canvas.toDataURL("image/png");
  } catch {
    // Remote cover tainted the canvas — redraw without the photo.
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0A0A0D";
    ctx.fillRect(0, 0, W, H);
    drawBars(ctx, 90, 520, W - 180, 220, accent, track.title.length, live);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "800 64px system-ui, sans-serif";
    ctx.fillText(track.title, W / 2, 900);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "600 30px system-ui, sans-serif";
    ctx.fillText(track.artist, W / 2, 960);
    return canvas.toDataURL("image/png");
  }
}

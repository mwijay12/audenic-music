/**
 * Thin, safe wrapper around Capacitor plugins.
 * Everything degrades gracefully in the browser build (no Capacitor available),
 * so the same code powers dev-in-browser and installed Android.
 */

type CapWindow = Window & {
  Capacitor?: {
    isNativePlatform: () => boolean;
    getPlatform: () => "web" | "android" | "ios";
    convertFileSrc?: (uri: string) => string;
    Plugins?: Record<string, Record<string, (o?: Record<string, unknown>) => Promise<unknown>>>;
  };
};

export type NativeMediaItem = {
  id: string; uri: string; webPath: string; title: string; artist: string;
  album: string; duration: number; size: number; mimeType: string;
  dateAdded: number; artwork?: string;
  category?: "reels" | "videos";
};

export const isNative = (): boolean => {
  if (typeof window === "undefined") return false;
  return !!(window as CapWindow).Capacitor?.isNativePlatform?.();
};

if (typeof window !== "undefined") {
  (window as any).isNative = isNative;
  (globalThis as any).isNative = isNative;
  (window as any).nativeUpdatePosition = nativeUpdatePosition;
  (globalThis as any).nativeUpdatePosition = nativeUpdatePosition;
  (window as any).updatePosition = nativeUpdatePosition;
  (globalThis as any).updatePosition = nativeUpdatePosition;
}

export const platform = (): "web" | "android" | "ios" => {
  if (typeof window === "undefined") return "web";
  return (window as CapWindow).Capacitor?.getPlatform?.() ?? "web";
};

// Shared URI sanitizer — Android content:// / file:// paths can legitimately contain
// a bare "%", "#", or "?" (e.g. "Track #1 100%.mp3") which breaks Capacitor's internal
// decodeURIComponent() and throws "URI malformed". Escape those characters only when
// they are NOT already part of a valid %XX escape sequence, so already-encoded URIs
// are left untouched.
function sanitizeUri(uri: string): string {
  if (!uri) return uri;
  return uri
    .replace(/%(?![0-9A-Fa-f]{2})/g, "%25")
    .replace(/#/g, "%23")
    .replace(/\?/g, "%3F");
}

export async function scanNativeMedia(kind: "audio" | "video" = "audio"): Promise<NativeMediaItem[]> {
  if (!isNative()) return [];
  try {
    const cap = (window as CapWindow).Capacitor;

    // Try MediaScanner plugin first for audio (handles Android runtime permissions)
    const mediaScanner = cap?.Plugins?.MediaScanner;
    if (kind === "audio" && mediaScanner?.scanAudio) {
      try {
        const res = (await mediaScanner.scanAudio()) as { tracks?: any[] };
        if (res?.tracks && Array.isArray(res.tracks) && res.tracks.length > 0) {
          return res.tracks.map((t) => {
            const rawUri = t.contentUri || t.path || "";
            const webPath = rawUri ? (cap?.convertFileSrc?.(sanitizeUri(rawUri)) || rawUri) : "";
            const rawArt = t.albumArtFilePath ? `file://${t.albumArtFilePath}` : (t.albumArt || "");
            const convertedArt = rawArt ? (cap?.convertFileSrc?.(sanitizeUri(rawArt)) || rawArt) : "";
            return {
              id: String(t.id),
              uri: rawUri,
              webPath: webPath || rawUri,
              title: t.title || "Unknown Title",
              artist: t.artist || "Unknown Artist",
              album: t.album || "On Device",
              duration: Math.round((t.duration || 0) / 1000),
              size: t.size || 0,
              mimeType: t.mimeType || "audio/mpeg",
              dateAdded: t.dateAdded || Date.now(),
              artwork: convertedArt || rawArt,
              albumArtFilePath: t.albumArtFilePath || "",
            };
          });
        }
      } catch (e) {
        console.warn("[nativeBridge] MediaScanner.scanAudio error, falling back to AudenicMedia", e);
      }
    }

    // Fallback to AudenicMedia.scan
    const plugin = cap?.Plugins?.AudenicMedia;
    if (!plugin?.scan) return [];
    const result = (await plugin.scan({ kind })) as { items?: NativeMediaItem[] };
    return (result.items || []).map((x) => {
      let webPath = x.webPath;
      if (!webPath && x.uri) {
        try {
          webPath = cap?.convertFileSrc?.(sanitizeUri(x.uri)) || x.uri;
        } catch {
          webPath = x.uri;
        }
      }
      return {
        ...x,
        webPath: webPath || x.uri,
      };
    });
  } catch { return []; }
}

/** Download through Android DownloadManager; progress appears in notifications. */
export async function nativeDownload(url: string, filename: string, mimeType = "audio/mpeg") {
  if (!isNative()) return { ok: false, id: null as number | null };
  try {
    const plugin = (window as CapWindow).Capacitor?.Plugins?.AudenicMedia;
    if (!plugin?.download) return { ok: false, id: null };
    const r = await plugin.download({ url, filename, mimeType }) as { id?: number };
    return { ok: true, id: r.id ?? null };
  } catch { return { ok: false, id: null }; }
}

/** Native Media3 foreground service command. */
export async function nativePlayback(command: "play" | "pause" | "next" | "previous" | "stop", payload: Record<string, unknown> = {}) {
  if (!isNative()) return false;
  try {
    const plugin = (window as CapWindow).Capacitor?.Plugins?.AudenicMedia;
    if (!plugin?.playback) return false;
    await plugin.playback({ command, ...payload });
    return true;
  } catch { return false; }
}

/** Push track metadata to the native notification (title, artist, artwork, position, duration). */
export async function nativeUpdateMetadata(title: string, artist: string, coverUrl?: string, positionMs = 0, durationMs = 0, isPlaying = true, isLiked = false) {
  if (!isNative()) return false;
  try {
    const plugin = (window as CapWindow).Capacitor?.Plugins?.AudenicMedia;
    if (!plugin?.updateNotification) return false;
    await plugin.updateNotification({ title, artist, coverUrl: coverUrl || "", positionMs, durationMs, isPlaying, isLiked });
    return true;
  } catch { return false; }
}

/** Push current progress position (in ms) to native lockscreen scrubber. */
export async function nativeUpdatePosition(positionMs: number, durationMs: number) {
  if (!isNative()) return false;
  try {
    const plugin = (window as CapWindow).Capacitor?.Plugins?.AudenicMedia;
    if (!plugin?.updatePosition) return false;
    await plugin.updatePosition({ positionMs, durationMs });
    return true;
  } catch { return false; }
}

/** Requests POST_NOTIFICATIONS natively so the mediaPlayback notification (and therefore the
 *  lock-screen controls) is not suppressed on Android 13+. Must run on a user-initiated play
 *  while the app is visible — Android 17 additionally grants while-in-use capability only then. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const plugin = (window as CapWindow).Capacitor?.Plugins?.AudenicMedia;
    if (!plugin?.requestNotifications) return false;
    const r = await plugin.requestNotifications({}) as { granted?: boolean };
    return !!r.granted;
  } catch { return false; }
}

/** Load and start playing an entire track queue in native ExoPlayer via the
 *  live AudenicMedia.loadQueue path. (The old "AudenicPlayback"/PlaybackPlugin
 *  plugin this used to try first was retired — it was registered but dead;
 *  see HANDOVER.md.) */
export async function loadQueueNative(
  items: { id: string; uri?: string; src?: string; title: string; artist: string; coverUrl?: string; cover?: string; duration?: number }[],
  startIndex = 0,
  startPosMs = 0
) {
  if (!isNative()) return false;

  await ensureNotificationPermission();

  try {
    const plugin = (window as CapWindow).Capacitor?.Plugins?.AudenicMedia;
    if (plugin?.loadQueue) {
      await plugin.loadQueue({ items, startIndex, startPosMs });
      return true;
    }
  } catch (e) {
    console.warn("[nativeBridge] AudenicMedia.loadQueue failed", e);
  }
  return false;
}

/** Set native ExoPlayer Equalizer bands & Bass Boost strength. */
export async function setNativeEqualizer(bands: number[], bassBoost = 0) {
  if (!isNative()) return false;
  try {
    const plugin = (window as CapWindow).Capacitor?.Plugins?.AudenicMedia;
    if (!plugin?.setEqualizer) return false;
    await plugin.setEqualizer({ bands, bassBoost });
    return true;
  } catch { return false; }
}

/** Set native ExoPlayer aux-effect PresetReverb (wet 0-100, type: hall|room|plate|cathedral). */
export async function setNativeReverb(wetPct: number, type = "hall") {
  if (!isNative()) return false;
  try {
    const plugin = (window as CapWindow).Capacitor?.Plugins?.AudenicMedia;
    if (!plugin?.setReverb) return false;
    await plugin.setReverb({ wet: wetPct, type });
    return true;
  } catch { return false; }
}

/** Listen to native lockscreen / notification / ExoPlayer play/pause/next/prev/seek/trackChanged events */
export type NativePlaybackEvent = { action: string; position?: number; duration?: number; trackId?: string; index?: number };
export function listenNativePlayback(callback: (event: NativePlaybackEvent) => void) {
  if (!isNative()) return () => {};
  try {
    const plugin = (window as CapWindow).Capacitor?.Plugins?.AudenicMedia as
      | {
          addListener?: (event: string, cb: (data: { action?: string; position?: number; duration?: number; trackId?: string; index?: number }) => void) => Promise<{ remove: () => void }>;
        }
      | undefined;
    const handlePromise = plugin?.addListener?.("onNativePlayback", (data) => {
      if (data?.action) callback(data as NativePlaybackEvent);
    });
    return () => {
      if (handlePromise) {
        Promise.resolve(handlePromise).then((h: any) => h?.remove?.()).catch(() => {});
      }
    };
  } catch { return () => {}; }
}

/** Check if SYSTEM_ALERT_WINDOW overlay permission is granted */
export async function hasOverlayPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const plugin = (window as CapWindow).Capacitor?.Plugins?.AudenicMedia;
    if (!plugin?.hasOverlayPermission) return false;
    const r = await plugin.hasOverlayPermission() as { granted?: boolean };
    return !!r.granted;
  } catch { return false; }
}

/** Open Android Settings page to grant overlay permission */
export async function requestOverlayPermission(): Promise<void> {
  if (!isNative()) return;
  try {
    const plugin = (window as CapWindow).Capacitor?.Plugins?.AudenicMedia;
    await plugin?.requestOverlayPermission?.();
  } catch { /* */ }
}

/** Enable or disable floating Dynamic Island overlay */
export async function toggleDynamicIsland(enable: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    const plugin = (window as CapWindow).Capacitor?.Plugins?.AudenicMedia;
    await plugin?.toggleIsland?.({ enable });
  } catch { /* */ }
}

/** Delete a file from MediaStore. */
export async function nativeDelete(id: string, kind: "audio" | "video" = "audio"): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const plugin = (window as CapWindow).Capacitor?.Plugins?.AudenicMedia;
    if (!plugin?.delete) return false;
    const r = await plugin.delete({ id, kind }) as { deleted?: boolean };
    return !!r.deleted;
  } catch { return false; }
}

/* ─── Real permission probes used by onboarding ─── */
export async function requestNotificationAccess(): Promise<boolean> {
  if (isNative()) {
    const n = await safeImport<{
      LocalNotifications: { requestPermissions: () => Promise<{ display: "granted" | "denied" | "prompt" | "determined" }> };
    }>("@capacitor/local-notifications");
    try {
      const r = await n?.LocalNotifications.requestPermissions();
      return r?.display === "granted" || r?.display === "determined";
    } catch { return false; }
  }
  if (typeof Notification === "undefined") return true;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try { return (await Notification.requestPermission()) === "granted"; } catch { return false; }
}

export async function requestStorageProbe(): Promise<boolean> {
  if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
    try {
      const { pickFolder } = await import("./tauriBridge");
      const folder = await pickFolder();
      return !!folder;
    } catch {
      return false;
    }
  }
  if (isNative()) {
    try { Array.isArray(await scanNativeMedia("audio")) && (await scanNativeMedia("video")); return true; }
    catch { return false; }
  }
  try {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    (input as unknown as { webkitdirectory?: string }).webkitdirectory = "";
    const done = new Promise<boolean>((resolve) => {
      input.onchange = () => resolve(true);
      window.addEventListener("focus", () => setTimeout(() => resolve(false), 400), { once: true });
    });
    input.click();
    return await done;
  } catch { return false; }
}

/** Lazy-loaded so the browser bundle doesn't pull the plugin runtimes it can't use. */
async function safeImport<T>(mod: string): Promise<T | null> {
  if (!isNative()) return null;
  try {
    return (await import(/* @vite-ignore */ mod)) as T;
  } catch {
    return null;
  }
}

/* ─── Splash + status bar + notch polish ─── */
export async function bootNative() {
  if (!isNative()) return;
  const status = await safeImport<{ StatusBar: { setStyle: (o: { style: string }) => Promise<void>; setBackgroundColor: (o: { color: string }) => Promise<void>; setOverlaysWebView: (o: { overlay: boolean }) => Promise<void> } }>("@capacitor/status-bar");
  try {
    await status?.StatusBar.setOverlaysWebView({ overlay: false });
    await status?.StatusBar.setStyle({ style: "DARK" });
    await status?.StatusBar.setBackgroundColor({ color: "#0A0A0D" });
  } catch { /* */ }
  const splash = await safeImport<{ SplashScreen: { hide: () => Promise<void> } }>("@capacitor/splash-screen");
  try { await splash?.SplashScreen.hide(); } catch { /* */ }
  const keyboard = await safeImport<{ Keyboard: { setResizeMode: (o: { mode: string }) => Promise<void> } }>("@capacitor/keyboard");
  try { await keyboard?.Keyboard.setResizeMode({ mode: "body" }); } catch { /* */ }

  // Inject safe-area CSS variables for notch/cutout phones
  try {
    const root = document.documentElement;
    const safeTop = getComputedStyle(root).getPropertyValue("env(safe-area-inset-top)");
    if (!safeTop || safeTop === "") {
      // Fallback: inject viewport-fit=cover meta if not present
      const existing = document.querySelector('meta[name="viewport"]');
      if (existing && !existing.getAttribute("content")?.includes("viewport-fit")) {
        existing.setAttribute("content", existing.getAttribute("content") + ", viewport-fit=cover");
      }
    }
  } catch { /* */ }
}

/* ─── Haptics ─── */
export async function nativeVibrate(ms = 12) {
  if (!isNative()) { try { navigator.vibrate?.(ms); } catch { /* */ } return; }
  const h = await safeImport<{ Haptics: { impact: (o: { style: string }) => Promise<void>; vibrate: (o: { duration: number }) => Promise<void> } }>("@capacitor/haptics");
  try {
    if (ms <= 15) await h?.Haptics.impact({ style: "Light" });
    else if (ms <= 30) await h?.Haptics.impact({ style: "Medium" });
    else await h?.Haptics.vibrate({ duration: ms });
  } catch { try { navigator.vibrate?.(ms); } catch { /* */ } }
}

/* ─── Share (song, playlist, station) ─── */
export async function nativeShare(payload: { title: string; text: string; url?: string }) {
  if (isNative()) {
    const s = await safeImport<{ Share: { share: (o: { title: string; text: string; url?: string; dialogTitle?: string }) => Promise<void> } }>("@capacitor/share");
    try { await s?.Share.share({ ...payload, dialogTitle: "Share via" }); return true; } catch { return false; }
  }
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try { await navigator.share(payload); return true; } catch { /* cancelled */ }
  }
  try {
    await navigator.clipboard?.writeText(payload.url ?? payload.text);
    return true;
  } catch { return false; }
}

/* ─── Local notifications (achievement unlocks, sleep timer warnings) ─── */
export async function nativeNotify(title: string, body: string) {
  if (!isNative()) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try { new Notification(title, { body, icon: "/favicon.ico" }); } catch { /* */ }
    }
    return;
  }
  const n = await safeImport<{
    LocalNotifications: {
      checkPermissions: () => Promise<{ display: "granted" | "denied" | "prompt" }>;
      requestPermissions: () => Promise<{ display: "granted" | "denied" | "prompt" }>;
      schedule: (o: { notifications: { title: string; body: string; id: number; smallIcon?: string; iconColor?: string }[] }) => Promise<void>;
    }
  }>("@capacitor/local-notifications");
  try {
    let perm = await n?.LocalNotifications.checkPermissions();
    if (perm?.display !== "granted") {
      perm = await n?.LocalNotifications.requestPermissions();
    }
    if (perm?.display !== "granted") return;
    await n?.LocalNotifications.schedule({
      notifications: [{
        title, body,
        id: Math.floor(Math.random() * 2_147_483_000),
        smallIcon: "ic_stat_music",
        iconColor: "#C8F249",
      }],
    });
  } catch { /* */ }
}

/* ─── Persist small key/value pairs in native storage instead of localStorage ─── */
export async function nativePrefsSet(key: string, value: string) {
  if (!isNative()) { try { localStorage.setItem(key, value); } catch { /* */ } return; }
  const p = await safeImport<{ Preferences: { set: (o: { key: string; value: string }) => Promise<void> } }>("@capacitor/preferences");
  try { await p?.Preferences.set({ key, value }); } catch { /* */ }
}

export async function nativePrefsGet(key: string): Promise<string | null> {
  if (!isNative()) { try { return localStorage.getItem(key); } catch { return null; } }
  const p = await safeImport<{ Preferences: { get: (o: { key: string }) => Promise<{ value: string | null }> } }>("@capacitor/preferences");
  try { const r = await p?.Preferences.get({ key }); return r?.value ?? null; } catch { return null; }
}

/** Share a rendered share-card image. Uses native Filesystem + Share on Android, or Web Share API */
export async function shareImage(dataUrl: string, filename: string, fallbackText: string): Promise<boolean> {
  if (isNative()) {
    const s = await safeImport<{ Share: { share: (o: { title: string; text: string; url?: string; dialogTitle?: string }) => Promise<void> } }>("@capacitor/share");
    const fs = await safeImport<{ Filesystem: { writeFile: (o: { path: string; data: string; directory: string }) => Promise<{ uri: string }> } }>("@capacitor/filesystem");
    try {
      if (fs && s) {
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
        const res = await fs.Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: "CACHE",
        });
        await s.Share.share({
          title: "Audenic",
          text: fallbackText,
          url: res.uri,
          dialogTitle: "Share Picture",
        });
        return true;
      }
    } catch { /* fall through */ }
  }
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: "image/png" });
    if (typeof navigator !== "undefined" && "share" in navigator && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Audenic", text: fallbackText });
      return true;
    }
  } catch { /* fall through to download */ }
  try {
    const a = document.createElement("a");
    a.href = dataUrl; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    return true;
  } catch { return false; }
}

/* ─── Hardware back button ─── */
export async function onBackPress(handler: () => boolean | void) {
  if (!isNative()) return () => {};
  const a = await safeImport<{ App: { addListener: (event: string, cb: (data: { canGoBack: boolean }) => void) => Promise<{ remove: () => Promise<void> }>; exitApp: () => Promise<void> } }>("@capacitor/app");
  const sub = await a?.App.addListener("backButton", (data) => {
    const handled = handler();
    if (!handled && !data.canGoBack) {
      a?.App.exitApp().catch(() => {});
    }
  });
  return () => {
    if (sub?.remove) {
      Promise.resolve(sub.remove()).catch(() => {});
    }
  };
}

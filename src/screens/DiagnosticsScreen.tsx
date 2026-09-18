/**
 * Audenic Music — Diagnostics Screen
 *
 * Run a series of automated checks against the native plugin + MediaStore bridge
 * and report each one as ✅ pass / ⚠️ warning / ❌ fail with a one-line fix hint.
 *
 * Tap "Run All Tests" once and watch the results appear in order.
 * Tap "Copy Logs" to dump every result to the clipboard for sharing / debugging.
 *
 * Lives at: src/screens/DiagnosticsScreen.tsx
 * Routed as: "diagnostics"   (see App.tsx)
 */

import React, { useState, useCallback } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

// ────────── Plugin registrations (typed, web-fallback returns safe defaults) ──────────

interface MediaScannerPlugin {
  scanAudio(): Promise<{ tracks: RawTrack[]; total: number }>;
  checkPermission(): Promise<{
    sdkVersion: number;
    needed: string;
    granted: boolean;
    READ_MEDIA_AUDIO?: boolean;
    READ_EXTERNAL_STORAGE?: boolean;
  }>;
  triggerMediaScan(opts: { path: string }): Promise<{ triggered: boolean }>;
  clearArtCache(): Promise<{ cleared: boolean }>;
}

interface NativePlaybackPlugin {
  setQueueAndPlay(opts: { tracks: unknown[]; startIndex: number }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seekTo(opts: { position: number }): Promise<void>;
  getState(): Promise<{
    isPlaying: boolean;
    position: number;
    duration: number;
    currentIndex: number;
    currentTrack: unknown;
  }>;
}

interface RawTrack {
  id: string;
  title: string;
  artist?: string;
  contentUri?: string;
  path?: string;
  albumArt?: string;
  duration?: number;
}

const MediaScanner = registerPlugin<MediaScannerPlugin>("MediaScanner", {
  web: {
    async scanAudio() { return { tracks: [], total: 0 }; },
    async checkPermission() { return { sdkVersion: 0, needed: "web", granted: false }; },
    async triggerMediaScan() { return { triggered: false }; },
    async clearArtCache() { return { cleared: false }; },
  } as any,
});

const AudenicPlayback = registerPlugin<NativePlaybackPlugin>("AudenicPlayback", {
  web: {
    async setQueueAndPlay() { /* noop */ },
    async play() {},
    async pause() {},
    async next() {},
    async previous() {},
    async seekTo() {},
    async getState() {
      return { isPlaying: false, position: 0, duration: 0, currentIndex: 0, currentTrack: null };
    },
  } as any,
});

// ────────── Result model ──────────

type Status = "pass" | "fail" | "warn" | "loading" | "pending";

interface TestResult {
  id: string;
  name: string;
  status: Status;
  detail: string;
  fix?: string;
}

const STATUS_ICON: Record<Status, string> = {
  pass: "✅",
  fail: "❌",
  warn: "⚠️",
  loading: "⏳",
  pending: "·",
};

const STATUS_COLOR: Record<Status, string> = {
  pass: "#22c55e",
  fail: "#ef4444",
  warn: "#f59e0b",
  loading: "#94a3b8",
  pending: "#64748b",
};

// ────────── Helpers ──────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function runSafely<T>(fn: () => Promise<T> | T): Promise<{ ok: true; v: T } | { ok: false; e: unknown }> {
  try {
    const v = await fn();
    return { ok: true, v };
  } catch (e) {
    return { ok: false, e };
  }
}

const platformName = (): "android" | "ios" | "web" => {
  try {
    const p = (window as any).Capacitor?.getPlatform?.();
    if (p === "android" || p === "ios" || p === "web") return p;
  } catch {}
  return "web";
};

// ────────── Component ──────────

export default function DiagnosticsScreen() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const patch = (id: string, status: Status, detail: string, fix?: string) => {
    setResults((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, status, detail, fix } : r));
      // If test was not in list yet, add it
      if (!next.find((r) => r.id === id)) {
        next.push({ id, name: id, status, detail, fix });
      }
      return next;
    });
  };

  const resetResults = () => {
    const labels = [
      "1. Platform Detection",
      "2. MediaScanner Plugin",
      "3. Permission Status",
      "4. MediaStore Has Files",
      "5. URI Conversion",
      "6. AudenicPlayback Plugin",
      "7. Service Binding",
    ];
    setResults(
      labels.map((name, i) => ({
        id: `t${i + 1}`,
        name,
        status: "pending",
        detail: "—",
      }))
    );
  };

  const runAll = useCallback(async () => {
    setRunning(true);
    resetResults();

    // ── TEST 1: Platform Detection ──────────────────────────────
    patch("t1", "loading", "Checking Capacitor.isNativePlatform()...");
    const t1 = await runSafely(() => Capacitor.isNativePlatform());
    if (t1.ok && t1.v === true) {
      patch("t1", "pass", `Running as native APK (platform=${platformName()}).`);
    } else {
      patch("t1", "fail",
        "Capacitor reports non-native platform.",
        "If you launched via `npm run dev`, you are in browser — install the APK on a device to test native features."
      );
    }

    // ── TEST 2: MediaScanner Plugin Exists ──────────────────────
    patch("t2", "loading", "Calling MediaScanner.checkPermission()...");
    const t2 = await runSafely(() => MediaScanner.checkPermission());
    if (t2.ok && typeof (t2.v as any).sdkVersion === "number") {
      patch("t2", "pass", `Plugin reachable. SDK=${(t2.v as any).sdkVersion}.`);
    } else {
      const msg = (t2.ok ? "" : String((t2.e as any)?.message ?? t2.e));
      patch("t2", "fail",
        `MediaScanner plugin did NOT respond. ${msg}`,
        "Add `registerPlugin(MediaScannerPlugin.class)` to MainActivity.java before super.onCreate(). Rebuild APK."
      );
      // Once MediaScanner itself is missing, downstream tests can't run.
      for (const i of ["t3", "t4", "t5"]) patch(i, "fail", "Skipped — MediaScanner not available.");
      patch("t6", "loading", "Calling AudenicPlayback.getState()...");
      const t6 = await runSafely(() => AudenicPlayback.getState());
      patch("t6", t6.ok ? "pass" : "fail", t6.ok ? "getState() responded." : `AudenicPlayback not reachable: ${String((t6 as any).e?.message ?? (t6 as any).e)}`,
            !t6.ok ? "Add `registerPlugin(PlaybackPlugin.class)` to MainActivity.java before super.onCreate()." : undefined);
      patch("t7", "warn", "Skipped — upstream plugin missing.");
      setRunning(false);
      return;
    }

    // ── TEST 3: Permission Status ───────────────────────────────
    patch("t3", "loading", "Reading permission state...");
    if (t2.ok) {
      const perm = t2.v as any;
      if (perm.granted === true) {
        patch("t3", "pass", `${perm.needed} granted.`);
      } else {
        patch("t3", "fail",
          `Permission NOT granted. Needed: ${perm.needed}.`,
          "On Android 13+: Settings → Apps → Audenic Music → Permissions → Files and media → Allow. On older: Storage → Allow."
        );
      }
    }

    // ── TEST 4: MediaStore Has Files ────────────────────────────
    patch("t4", "loading", "Triggering MediaStore rescan...");
    await runSafely(() => MediaScanner.triggerMediaScan({ path: "/storage/emulated/0" }));
    await sleep(500);
    patch("t4", "loading", "Querying ContentResolver...");
    const t4 = await runSafely(() => MediaScanner.scanAudio());
    if (t4.ok) {
      const total = (t4.v as any).total ?? 0;
      if (total > 0) {
        patch("t4", "pass", `Found ${total} tracks in MediaStore.`);
      } else {
        patch("t4", "fail",
          "MediaStore returned 0 tracks.",
          "1. Check Android Studio Logcat for `MediaStore EXTERNAL count` and `Scan complete` lines. 2. On emulator, drag MP3 into /sdcard/Music and wait. 3. Run `adb shell content query --uri content://media/external/audio/media` to verify the OS sees files."
        );
      }
    } else {
      patch("t4", "fail", `scanAudio errored: ${String((t4 as any).e?.message ?? (t4 as any).e)}`);
    }

    // ── TEST 5: URI Conversion ──────────────────────────────────
    patch("t5", "loading", "Verifying Capacitor.convertFileSrc()...");
    if (t4.ok && (t4.v as any).tracks?.length > 0) {
      const first = (t4.v as any).tracks[0] as RawTrack;
      const raw = first.contentUri ?? first.path ?? "";
      try {
        const converted = Capacitor.convertFileSrc(raw);
        if (converted.startsWith("http://localhost/") || converted.startsWith("https://localhost/")) {
          patch("t5", "pass", `OK. ${raw.slice(0, 40)}… → ${converted.slice(0, 50)}…`);
        } else {
          patch("t5", "warn",
            `Conversion output: ${converted.slice(0, 60)}`,
            "Expected http://localhost/_capacitor_content_/… — make sure Capacitor.convertFileSrc() is called on every contentUri before passing to <audio> or ExoPlayer."
          );
        }
      } catch (e: any) {
        patch("t5", "fail", `convertFileSrc threw: ${e?.message ?? e}`);
      }
    } else {
      patch("t5", "warn", "Skipped (no tracks to convert).");
    }

    // ── TEST 6: AudenicPlayback Plugin Exists ───────────────────
    patch("t6", "loading", "Calling AudenicPlayback.getState()...");
    const t6 = await runSafely(() => AudenicPlayback.getState());
    if (t6.ok) {
      patch("t6", "pass", "AudenicPlayback plugin reachable.");
    } else {
      patch("t6", "fail",
        `AudenicPlayback plugin did NOT respond: ${String((t6 as any).e?.message ?? (t6 as any).e)}`,
        "Add `registerPlugin(PlaybackPlugin.class)` to MainActivity.java before super.onCreate(). Also confirm you ran `npx cap sync android` after editing."
      );
    }

    // ── TEST 7: Service Binding ─────────────────────────────────
    patch("t7", "loading", "Waiting for service binding (1.5s)…");
    await sleep(1500);
    const t7 = await runSafely(() => AudenicPlayback.getState());
    if (t7.ok) {
      const s = t7.v as any;
      const allZero =
        s.isPlaying === false && s.position === 0 && s.duration === 0 && s.currentTrack === null;
      if (allZero) {
        patch("t7", "warn",
          "Service reachable but no media loaded yet — bind may still be warming up.",
          "Start a track, then re-run. If problems persist, check `adb logcat -s AudenicPlayback`."
        );
      } else {
        patch("t7", "pass",
          `isPlaying=${s.isPlaying} idx=${s.currentIndex} pos=${s.position}/${s.duration}.`
        );
      }
    } else {
      patch("t7", "fail", `getState errored: ${String((t7 as any).e?.message ?? (t7 as any).e)}`);
    }

    setRunning(false);
  }, []);

  const copyLogs = useCallback(async () => {
    try {
      const text = results
        .map((r) => `${STATUS_ICON[r.status]} ${r.name} — ${r.detail}${r.fix ? `\n   Fix: ${r.fix}` : ""}`)
        .join("\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [results]);

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-4 pb-32">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">System Diagnostics</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Audenic Music — native bridge test rig
            </p>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded-full font-mono ${
              platformName() === "android"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : platformName() === "web"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-zinc-700 text-zinc-300"
            }`}
          >
            {platformName().toUpperCase()}
          </span>
        </header>

        <div className="flex gap-2 mb-6">
          <button
            onClick={runAll}
            disabled={running}
            className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 font-semibold transition-all shadow-lg shadow-purple-900/30"
          >
            {running ? "Running tests…" : "Run All Tests"}
          </button>
          <button
            onClick={copyLogs}
            disabled={results.length === 0}
            className="px-4 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 font-semibold transition-colors"
          >
            {copied ? "✓ Copied" : "Copy Logs"}
          </button>
        </div>

        {results.length === 0 && !running && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-center text-zinc-400">
            Tap <span className="text-purple-300 font-semibold">Run All Tests</span> to verify every
            native bridge component. Tests will surface exact fixes when something fails.
          </div>
        )}

        <div className="space-y-2">
          {results.map((r) => (
            <div
              key={r.id}
              className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 transition-all"
              style={{ borderLeftWidth: "4px", borderLeftColor: STATUS_COLOR[r.status] }}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl leading-none mt-0.5 select-none">{STATUS_ICON[r.status]}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white">{r.name}</div>
                  <div className="text-sm text-zinc-300 mt-1 break-words">{r.detail}</div>
                  {r.fix && (
                    <div className="mt-2 text-xs bg-zinc-900/70 rounded px-3 py-2 text-zinc-300 font-mono border border-zinc-700/50">
                      <span className="text-amber-400 font-sans font-semibold">FIX: </span>
                      {r.fix}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {results.length > 0 && (
          <details className="mt-8 bg-zinc-800/30 border border-zinc-700 rounded-lg p-4">
            <summary className="cursor-pointer font-semibold text-zinc-300">
              Troubleshooting Guide
            </summary>
            <div className="mt-4 space-y-3 text-sm text-zinc-300">
              <Fix
                title="Plugin not registered"
                cmd="MainActivity.java → before super.onCreate():
registerPlugin(MediaScannerPlugin.class);
registerPlugin(PlaybackPlugin.class);"
              />
              <Fix
                title="Permission denied"
                cmd="Android Settings → Apps → Audenic Music → Permissions → Allow files/media."
              />
              <Fix
                title="MediaStore empty (0 tracks)"
                cmd="adb shell content query --uri content://media/external/audio/media
# If 0 there too: emulator has no audio. Drag MP3 into /sdcard/Music/."
              />
              <Fix
                title="Service not bound"
                cmd="adb logcat -s AudenicPlayback PlaybackPlugin -v time
# Should print 'Service created' then 'Service bound successfully'.
# If not: rebuild APK after `npx cap sync android`."
              />
              <Fix
                title="Lock screen still blank"
                cmd="1. Confirm startForeground() is called (check logcat).
2. Phone: Settings → Notifications → Audenic → Lock screen → Show all content.
3. Some OEMs (Xiaomi/Oppo) hide media notifications by default — disable battery optimization for Audenic."
              />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

const Fix: React.FC<{ title: string; cmd: string }> = ({ title, cmd }) => (
  <div>
    <div className="font-semibold text-purple-300 mb-1">{title}</div>
    <pre className="bg-black/40 rounded p-2 text-xs overflow-x-auto whitespace-pre-wrap">{cmd}</pre>
  </div>
);

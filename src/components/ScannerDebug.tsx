import React, { useState } from "react";
import { registerPlugin, Capacitor } from "@capacitor/core";

interface MediaScannerPlugin {
  scanAudio(): Promise<{ tracks: any[]; total: number }>;
  checkPermission(): Promise<{
    READ_MEDIA_AUDIO?: boolean;
    READ_EXTERNAL_STORAGE?: boolean;
    sdkVersion: number;
    needed: string;
  }>;
  triggerMediaScan(opts: { path: string }): Promise<{ triggered: boolean }>;
  clearArtCache(): Promise<{ cleared: boolean }>;
}

const MediaScanner = registerPlugin<MediaScannerPlugin>("MediaScanner");

export default function ScannerDebug() {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const addLog = (msg: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    console.log("[ScannerDebug]", msg);
  };

  async function runDiagnostics() {
    setRunning(true);
    setLog([]);

    addLog("=== AUDENIC SCANNER DIAGNOSTICS ===");
    addLog("Platform: " + (Capacitor.isNativePlatform() ? "NATIVE" : "WEB"));

    // Test 1: Permission check
    try {
      const perm = await MediaScanner.checkPermission();
      addLog("SDK Version: " + perm.sdkVersion);
      addLog("Permission needed: " + perm.needed);
      addLog("Permission granted: " + (perm.READ_MEDIA_AUDIO || perm.READ_EXTERNAL_STORAGE));
    } catch (e: any) {
      addLog("ERROR: checkPermission failed - " + (e?.message || e));
      addLog("LIKELY CAUSE: Plugin not registered in MainActivity.java");
    }

    // Test 2: Trigger MediaStore rescan
    try {
      await MediaScanner.triggerMediaScan({ path: "/storage/emulated/0" });
      addLog("MediaStore rescan triggered OK");
    } catch (e: any) {
      addLog("MediaStore rescan note: " + (e?.message || e));
    }

    // Test 3: Run actual scan
    try {
      const result = await MediaScanner.scanAudio();
      addLog("Scan result: " + result.total + " tracks");
      if (result.tracks && result.tracks.length > 0) {
        const first = result.tracks[0];
        addLog("First track: " + first.title);
        addLog("First path: " + (first.contentUri || first.path)?.substring(0, 50));
        addLog("First art: " + (first.albumArt ? "YES" : "NO"));
        const converted = Capacitor.convertFileSrc(first.contentUri || first.path);
        addLog("Converted src: " + converted.substring(0, 60));
      } else {
        addLog("ZERO tracks found!");
        addLog("Run: adb logcat -s MediaScannerPlugin");
      }
    } catch (e: any) {
      addLog("SCAN ERROR: " + (e?.message || e));
    }

    setRunning(false);
  }

  return (
    <div className="m-4 rounded-2xl bg-zinc-900/90 p-4 border border-white/10 text-white shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">🔧 Scanner Diagnostics</p>
        <button
          onClick={runDiagnostics}
          disabled={running}
          className="press rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {running ? "Running..." : "Run Tests"}
        </button>
      </div>
      <div className="no-scrollbar max-h-64 overflow-y-auto rounded-xl bg-black/80 p-3 font-mono text-[11px]">
        {log.length === 0 ? (
          <p className="text-white/30">Tap "Run Tests" to diagnose music scanner</p>
        ) : (
          log.map((line, i) => (
            <p key={i} className="mb-0.5 text-emerald-400">
              {line}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

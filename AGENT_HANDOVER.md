# AUDENIC — Agent Handover (read this first)

> Personal, private music player. **Not** published to any store. Repo: `mwijay12/audenic-music` (private).
> Owner speaks Swahili + English (mixed voice-to-text). Reply in English unless asked otherwise.

---

## 1. Hard constraints (do not violate)

| Rule | Detail |
|---|---|
| **Stack** | Capacitor v6 + React 19 + TypeScript + Vite. Native Android layer is **100% Java** (no Kotlin). |
| **NOT Flutter** | No `pubspec.yaml`, no Dart. Never scaffold or migrate to Flutter. |
| **Honesty** | Never claim a native/Java change is tested without actually compiling it. |
| **Private** | Never publish to a store, never make the repo public, never add marketing. |
| **Delivery** | "push to GitHub" = push to the existing private repo on `main`. |

---

## 2. Environment / how to run

```bash
# web dev
npm install
npm run dev          # vite

# web build (this is what Capacitor ships)
npm run build        # -> dist/

# android
npx cap sync android
cd android && bash gradlew assembleDebug     # NOTE: use `bash gradlew`, ./gradlew is not +x
# APK -> android/app/build/outputs/apk/debug/app-debug.apk
```

**Sandbox toolchain** (already installed in this agent's box, re-install if wiped):

```bash
# JDK (apt has no openjdk here — download Temurin)
curl -sL -o /tmp/jdk.tar.gz "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
mkdir -p /opt/jdk && tar xzf /tmp/jdk.tar.gz -C /opt/jdk --strip-components=1

# Android SDK
curl -sL -o /tmp/cmt.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q /tmp/cmt.zip -d /opt/android-sdk/cmdline-tools
mv /opt/android-sdk/cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/latest
yes | /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses
/opt/android-sdk/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"

# build env
export JAVA_HOME=/opt/jdk PATH=/opt/jdk/bin:$PATH ANDROID_HOME=/opt/android-sdk ANDROID_SDK_ROOT=/opt/android-sdk
echo "sdk.dir=/opt/android-sdk" > android/local.properties
```

**Delivering an APK to the user** (he asks for a download link often):

```bash
mkdir -p apk-share && cp android/app/build/outputs/apk/debug/app-debug.apk apk-share/audenic-X.Y.apk
cd apk-share && python3 -m http.server 8080 --bind 127.0.0.1        # background
cloudflared tunnel --url http://127.0.0.1:8080 --no-autoupdate      # background; read the URL from its log
curl -sI https://<url>/audenic-X.Y.apk | head -3                    # verify before sending
```

Tunnels are **ephemeral** — they die with the session. Also call `present_files` with the APK.

---

## 3. Architecture map

### Web layer (`src/`)

| Area | Files | Notes |
|---|---|---|
| **Entry** | `main.tsx` | Mounts `<ErrorBoundary><AuthProvider><App/>`. Has a **global URIError guard** (see §5). |
| **Routing/state shell** | `App.tsx` | Two shells: `Phone` (mobile: tabs + `overlay` state machine) and `DesktopStudio` (desktop). `overlay === "drive"` renders `DriveMode`. |
| **Player core** | `player/PlayerContext.tsx` (~1730 lines) | The heart. All state: tracks, queue, playback, EQ, lyrics, playlists, achievements, analytics. `current` resolves from `rawTracks` → `tracks` → `externalTrack`. |
| **Audio graph** | `player/audioEngine.ts` | WebAudio: 5-band EQ (60/250/1k/4k/12k), bass shelf, analyser, `outputGate` (**muted on native** — ExoPlayer is the real output), `setLoudnessNormalization`. |
| **FX rack** | `player/audioEffects.ts` | Reverb/delay/DJ filter/saturation. Used by `smartAutomix`, not by UI sliders. |
| **Native bridge** | `player/nativeBridge.ts` | All Capacitor plugin calls; degrades to no-ops on web. Contains `sanitizeUri`, `isNative`, `setNativeEqualizer`, `setNativeReverb`, `loadQueueNative`, `nativeUpdateMetadata`. Wraps `Capacitor.convertFileSrc` globally. |
| **Media scanning** | `player/useMediaScanner.ts`, `player/useVideoScanner.ts` | `safeConvertFileSrc` + `normalizeTrack`. Also `getSafeAudioSrc` / `getSafeCoverSrc` (used by PlayerContext). |
| **Lyrics** | `player/useLrcLyrics.ts`, `lrcParser.ts`, `lyricsService.ts`, `components/SyncedLyrics.tsx` | Priority: user-edited → embedded LRC → `.lrc` file → Gemini AI fallback. |
| **Gestures** | `hooks/useGestures.ts`, `components/HoldZones.tsx` | Single tap / double tap / 4-way swipe / long press. **Touch-vs-synthetic-mouse guard lives here.** |
| **Shell UI** | `components/Shell.tsx` | `StatusBar`, `Chip`, `TrackRow`, `SafeImage`, `RowBoundary`, `useClock`, `svgCover` is in PlayerContext. |
| **Library** | `screens/MyMusic.tsx` | Search, sort menu (date/A-Z/Z-A/most played), **folder picker**, chips (All/Playlists/Liked/Local Files), `VirtualList`. |
| **Now Playing** | `screens/NowPlaying.tsx` | Artwork viz, gestures, sheets (queue/lyrics/viz/timer/share), lyric tabs **read | translate | dictate | edit | style**. |
| **Simple/Drive mode** | `screens/DriveMode.tsx` | Native-safe: hides keyboard hints/fullscreen unless fine-pointer device. |
| **Other screens** | `HomeScreen`, `ExploreScreen`, `ReelsScreen`, `VideoPlayer`, `VideoLibrary`, `Equalizer`, `DJMixerScreen`, `AIScreen`, `AnalyticsScreen`, `AdminScreen`, `DiagnosticsScreen`, `AchievementsScreen`, `ExperiencesScreen`, `ProfileScreen`, `PlaylistScreen`, `SongDetails`, `ArtistScreen`, `ThemeScreen`, `ExtraScreens` (Settings) | |
| **Desktop (Tauri)** | `components/DesktopStudio.tsx`, `DesktopWidget`, `DesktopFloatingMiniPlayer`, `player/tauriBridge.ts` | Out of scope for mobile bugs; don't break it. |
| **Data** | `data/tracks.ts` | `Track` type + `LIBRARY_CHIPS` + online demo tracks. |

`Track` type is minimal: `{ id, title, artist, cover, src, songs, source: "online"|"local", tags, lyrics? }`.
Local tracks carry **extra runtime fields** (not in the type, accessed as `any`): `rawAlbumArt`, `albumArtFilePath`, `path`.

### Native Android (`android/app/src/main/java/fm/audenic/app/`)

| File | Role |
|---|---|
| `MainActivity.java` | Registers plugins (AudenicMedia, MediaScanner, VideoScanner, LrcReader), splash, predictive back, status-bar colours, **mic runtime permission + WebView `onPermissionRequest` grant** (needed for dictation). |
| `AudenicMediaPlugin.java` | JS↔native facade: `scan`, `loadQueue`, `play`, `pause`, `next`, `prev`, `seek`, `setEqualizer`, `setReverb`, `updateNotification`, `delete`, `setAsRingtone`. Emits `playbackEvent` (play/pause/next/prev/seek/trackChanged/like). |
| `AudenicPlaybackService.java` | **The actual audio engine.** ExoPlayer + MediaSession + foreground notification. Holds `Equalizer`, `BassBoost`, `PresetReverb` bound to the player's audio session. `setNativeEq(int[] bandMb, int bassStrength)` maps UI bands by nearest centre frequency. |
| `MediaScannerPlugin.java` | MediaStore audio scan, runtime permission, **art cache** in `cacheDir/aud_art/art_<key>.jpg` → returns `albumArt`, `albumArtFilePath`, `path`, `contentUri`. |
| `VideoScannerPlugin.java` | Video scan + thumbnails. |
| `LrcReaderPlugin.java` | Reads `.lrc` next to audio files. |
| `NotificationHelper.java` / `NotificationReceiver.java` | Media-style notification, action buttons. |
| `AudenicIslandService.java` | Android "dynamic island"-style accessory service. |

Manifest: `RECORD_AUDIO`, foreground media playback service, `android:usesCleartextTraffic` for the Capacitor local URL.
App id `com.audenic.app` · versionName 2.0 · versionCode 20 · compileSdk/targetSdk 36 · minSdk 26.

**Key native fact:** on Android the WebAudio graph is **muted** (`engine.muteOutput(isNative())`) because ExoPlayer owns the output. So any "effects" must be applied **natively** on ExoPlayer's audio session — WebAudio filters have no effect there.

---

## 4. Domain gotchas (learned the hard way)

1. **`URI malformed`** — `Capacitor.convertFileSrc()` calls `encodeURI()`, which throws `URIError` on any path containing a bare `%` (e.g. `Track #1 100%.mp3`). Fix pattern: sanitize **before** converting — escape `%` when not part of a valid `%XX`, plus `#`/`?` for local paths. Done in `nativeBridge.sanitizeUri` + `useMediaScanner.safeConvertFileSrc` + `useVideoScanner` + `Shell.sanitizeImgSrc`, plus a global guard in `main.tsx`.
2. **Units** — UI EQ is in **dB** (−12…+12); `android.media.audiofx.Equalizer.setBandLevel()` wants **millibels** (−1500…1500). Bass UI is 0–100 %; `BassBoost.setStrength()` wants 0–1000. Conversion lives in `nativeBridge.setNativeEqualizer`.
3. **Notification artwork** — native cannot fetch `http://localhost/_capacitor_…` URLs. Always send `albumArtFilePath` (wrapped as `file://`), then `content://`, then a real URL. Helper: `nativeCoverPath` logic in `PlayerContext.nativeCoverFor`.
4. **Audio effects go stale** — Android effects are bound to the player's audio session; re-push after every track change (already done in PlayerContext).
5. **Gesture double-fire** — Android fires synthetic mouse events after touch. `useGestures` ignores mouse events within 700 ms of a touch. Without this, one tap registered as a double tap (→ "liked" instead of play/pause).
6. **Never clear `au.localTracks`/`au.localVideos`** to "recover" from an error — that deletes the user's scanned library and he has to rescan. The ErrorBoundary now only retries the render.
7. **localStorage quota** — 300+ tracks with data-URI covers can exceed ~5 MB. Persistence retries with a slimmed copy (drops lyrics, strips `data:` covers).
8. `DriveMode` is shared by mobile **and** desktop — guard desktop-only UI with `hasKeyboard` (`matchMedia("(hover: hover) and (pointer: fine)")`), not just `isNative()`.
9. `dist/` must be rebuilt + `npx cap sync android` before assembling an APK, otherwise the APK ships the old web bundle.

---

## 5. What was fixed recently (context, don't regress)

| Commit theme | Files |
|---|---|
| Tap = play/pause, double-tap = like | `hooks/useGestures.ts` |
| Library sort menu + folder picker | `screens/MyMusic.tsx`, `player/PlayerContext.tsx`, `player/nativeBridge.ts` |
| Scroll crash containment (URI errors) | `main.tsx`, `components/Shell.tsx` (`RowBoundary`, `sanitizeImgSrc`), `components/VirtualList.tsx` |
| `VirtualList` referenced undefined `onScrollChange` | `components/VirtualList.tsx` |
| Notification / lockscreen artwork | `player/PlayerContext.tsx` (`nativeCoverFor`) |
| Non-destructive error recovery + safe library persistence | `components/ErrorBoundary.tsx`, `player/PlayerContext.tsx` |
| Real live dictation (Web Speech API) + Android mic grant | `screens/NowPlaying.tsx`, `MainActivity.java` |
| Drive Mode PC-looking chrome hidden on touch | `screens/DriveMode.tsx` |
| `current` track resolved from `rawTracks` ("No Track Selected") | `player/PlayerContext.tsx` |
| EQ/bass/reverb audible on Android (dB→mB, %→0-1000, band remap, re-push) | `player/nativeBridge.ts`, `AudenicPlaybackService.java` |
| URI sanitization on scan + art | `nativeBridge.ts`, `useMediaScanner.ts`, `useVideoScanner.ts` |

---

## 6. Open / known issues (priority order)

1. **Exact source of the remaining `URIError` on long scroll (~300 local tracks)** — not fully root-caused. The crash is now *contained* (row boundary + global guard + breadcrumb in `localStorage["au.lastUriError"]`), not necessarily eliminated. **Next step:** ask the user to reproduce, then read `au.lastUriError` + `console` via Chrome `chrome://inspect`. Candidates not yet audited: `MarqueeText`, `ContextMenu`, `artworkCache.ts`, `tagReader.ts`.
2. **True "scan only this folder/file"** — folder picker currently filters *already scanned* tracks. A real folder-scoped scan needs `MediaScanner.scanAudio({ treeUri })` + SAF `ACTION_OPEN_DOCUMENT_TREE` in `MainActivity`/`MediaScannerPlugin`.
3. **Notification cover art when the file has no embedded art** — falls back to a letter tile by design; a folder-level `cover.jpg` lookup exists in `AudenicMediaPlugin` but isn't used by the MediaStore path.
4. **Dictation language coverage** — Web Speech depends on the device's Google speech service; `sw-KE` support varies. Consider surfacing a clear message instead of an empty list.
5. **`aiActions.ts` has a pre-existing TS error** (`Cannot find name 'setDriveMode'`) and `text_to_speech` action is not in the union type. Cosmetic but blocks `tsc --noEmit` cleanliness.
6. **Repo-wide `tsc --noEmit` is noisy** (unused imports, `Theme.mode`, `Track.duration`). `vite build` passes; treat `tsc` output as advisory and filter to the files you touched.
7. **Release signing** — only debug APKs are produced. If he ever wants a "real" build, add a keystore + `signingConfigs`.

---

## 7. Working style that fits this owner

- He sends long, garbled voice-to-text. **Extract the concrete bugs, fix them, then summarise plainly.** Don't ask many questions; ask at most one, and only if truly blocked.
- He values: working APK link > explanation. Fix → build → push → link.
- He says "push to github" often — the PAT is already embedded in the `origin` remote URL. If push fails with auth, ask for a fresh PAT.
- He has limited credits: **batch work, avoid exploratory marathons, don't re-read files you already know.**
- Report honestly what is verified (web build ✅, Java compile ✅ only after a real gradle run) vs. assumed.

---

## 8. Quick commands cheat-sheet

```bash
git status --short && git log --oneline -5
npx tsc --noEmit 2>&1 | grep -E "<files you touched>"
npm run build
npx cap sync android
cd android && bash gradlew assembleDebug
adb logcat | grep -iE "audenic|chromium|capacitor"   # if a device is attached
```

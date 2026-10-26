# Audenic Music — Handover (state of the 3 fixes + API 36 bump)

Stack: **Capacitor v6 + React 19 + TypeScript** Android app. `appId com.audenic.app`, `webDir dist`.
Native layer is **100% Java, zero Kotlin**. Ignore `audenic_flutter/` — the Flutter rewrite was abandoned.

## DONE (code merged, unverified on device)

1. **API 36 bump** — `android/variables.gradle`: `compileSdkVersion = 36`, `targetSdkVersion = 36`, `minSdkVersion = 26`.
2. **Playback control buttons** — `AudenicPlaybackService.handleCommandIntent()` now accepts both `"prev"` and `"previous"` (the mismatch was the bug). `PlayerContext.tsx step()` has a native fast path: sequential playback sends a light `next`/`previous` command instead of reloading the whole queue. Errors now log via `.catch(console.warn)` instead of being swallowed.
3. **Background playback stability** — `AudenicPlaybackService` holds a non-reference-counted `PARTIAL_WAKE_LOCK` (`AudenicPlayback:wakelock`, 10 min timeout, re-acquired on play/track change, released in `onDestroy`). `WAKE_LOCK` + `FOREGROUND_SERVICE_MEDIA_PLAYBACK` + `foregroundServiceType="mediaPlayback"` were already declared correctly in `AndroidManifest.xml`.
4. **Native reverb (new)** — full chain added:
   - `AudenicPlaybackService.setNativeReverb(int wetPct, String type)`: `android.media.audiofx.PresetReverb` created/reused against `player.getAudioSessionId()`, then routed with `player.setAuxEffectInfo(new AuxEffectInfo(reverbFx.getId(), sendLevel))` (`media3-common` 1.3.1, already a dependency). `wetPct <= 0` short-circuits and disables to save CPU. Released in `onDestroy()`.
   - `AudenicMediaPlugin.setReverb(PluginCall)` → reads `wet` (int) + `type` (String, default `"hall"`).
   - `src/player/nativeBridge.ts: setNativeReverb(wetPct, type)`.
   - Called automatically from `audioEngine.ts setReverb()` and `audioEffects.ts AudioEffectsRack.setReverb()` whenever `isNative()` — so `PlayerContext`, `DJMixerScreen` and `smartAutomix` all get native reverb for free, and Web Audio behaviour is unchanged on web/PWA/desktop.
   - Preset mapping: `hall→PRESET_MEDIUMHALL`, `room→PRESET_MEDIUMROOM`, `plate→PRESET_PLATE`, `cathedral→PRESET_LARGEHALL`.
   - Bonus fix: `AudioEffectsRack.setReverb()` wrote `this.state.reverbType = type` **before** comparing `type !== this.state.reverbType`, so the IR buffer never rebuilt on a type change. Fixed with a `typeChanged` flag.

Native `Equalizer` + `BassBoost` (`setNativeEq`, bridged by `setNativeEqualizer`) already existed and were the template for the above. `npx cap sync android` ran clean. `npx tsc --noEmit` shows **no errors in the touched files** (there are many pre-existing unrelated errors elsewhere in the repo).

## DONE — round 2: Android 16/17 background + lock-screen hardening

Audited `AudenicPlaybackService` against the Android 17 **background audio hardening** rules
(<https://developer.android.com/about/versions/17/changes/bg-audio>) and fixed every gap found.

### The rules that matter (Android 17, applies **regardless of targetSdk**)
Any app doing background audio must have a **visible activity** *or* a running **foreground
service that is not of type `SHORT_SERVICE`**. If the app *targets* API 37 and is in the
background, that FGS must additionally have **while-in-use (WIU)** capability (waived only for
apps with exact-alarm permission + `USAGE_ALARM`). Non-compliance fails **silently**:
`AudioTrack.write()` is muted (media3/ExoPlayer are named explicitly in the docs),
`requestAudioFocus()` returns `AUDIOFOCUS_REQUEST_FAILED`, volume/ringer APIs are ignored —
**no exception, no crash, just dead silence**. WIU is granted by notification clicks, widget
interaction and external media-key events, and by starting the FGS while the app is visible;
it is generally *not* granted to background-started services.

### Changes made (`android/app/src/main/java/fm/audenic/app/AudenicPlaybackService.java`)
1. **ExoPlayer audio attributes + focus** — `initExoPlayer()` now calls
   `player.setAudioAttributes(new androidx.media3.common.AudioAttributes.Builder()
   .setUsage(USAGE_MEDIA).setContentType(CONTENT_TYPE_MUSIC).build(), /*handleAudioFocus=*/ true)`.
   It was previously bare `new ExoPlayer.Builder(this).build()` — no declared usage, and no audio
   focus at all. media3's `AudioFocusManager` now handles ducking, pause-on-call and
   auto-resume after `AUDIOFOCUS_LOSS_TRANSIENT` (this is exactly the "ride out transient
   failures under 10 min" mitigation Google prescribes).
   ⚠️ It must be `androidx.media3.common.AudioAttributes`, **not** `android.media.AudioAttributes` —
   `Player.setAudioAttributes` takes the media3 class.
2. **Becoming-noisy** — `player.setHandleAudioBecomingNoisy(true)`: pauses instead of streaming
   into a disconnected headphone/BT output.
3. **Player wake mode** — `player.setWakeMode(androidx.media3.exoplayer.C.WAKE_MODE_NETWORK)`.
4. **Explicit `mediaPlayback` FGS type + no more churn** — new `publishNotification(Notification)`
   replaces the old bare `startForeground(NOTIFICATION_ID, …)` that was re-invoked on *every*
   metadata/cover update. First call uses
   `ServiceCompat.startForeground(this, ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)`
   (API 29+; plain `startForeground` below that), later calls only
   `NotificationManagerCompat.notify(ID, notif)`. Guarded by a `volatile boolean foregroundActive`,
   and the whole thing is try/caught because a denied `POST_NOTIFICATIONS` or a background FGS start
   throws. This matters: **Android 17's hardener keys on the FGS being live and correctly typed.**
5. **All four deprecated `stopForeground(true)` sites** (`cmd "stop"`, `onTaskRemoved`,
   `MediaSession.onStop`, `ACTION_STOP`) now go through
   `endForegroundState(true)` → `ServiceCompat.stopForeground(this, STOP_FOREGROUND_REMOVE)`.
   The FGS is torn down **only on a permanent stop, never on pause** — pausing keeps the
   notification and lock-screen controls alive so resume is not a background FGS start.
6. **Lock-screen action order fixed** — actions are now
   `[Prev] [Play/Pause] [Next] [Like] [Close]` with `.setShowActionsInCompactView(0, 1, 2)`.
   Previously `Like` sat in slot 0, and because Android 13+/16 media UI (lock screen, shade,
   cars, watches) surfaces only the **first three** actions, `Next` was being pushed out of the
   visible row.
7. **Wake-lock renewal bug (real stability fix)** — `acquireWakeLockIfNeeded()` previously did
   `if (!wakeLock.isHeld()) acquire(10min)`, so the lock was **never renewed while held** and
   silently expired 10 minutes into any continuous session, despite the comment claiming it was
   refreshed on each track change. It now releases-then-acquires (safe: non-reference-counted).
8. **Queue end** — `advanceToNext()` on the last track sets `isJsPlaying = false` and releases the
   wake lock, but intentionally keeps the FGS running (compliant, and required so a repeat/shuffle
   restart from JS is not a background FGS start).

### Changes made elsewhere
- **`POST_NOTIFICATIONS` is now requested on the playback path, not only in onboarding.**
  Without it Android 13+ suppresses the FGS notification **and therefore all lock-screen media
  controls** — anyone who skipped onboarding silently lost them. Added a `postNotifications`
  `@Permission` alias + `requestNotifications()` `@PluginMethod` (with its own
  `@PermissionCallback`, short-circuiting on API < 33 where the permission is install-granted) to
  `AudenicMediaPlugin.java`, and `ensureNotificationPermission()` in
  `src/player/nativeBridge.ts`, awaited at the top of `loadQueueNative()` so the prompt happens on
  the user's own play tap **while the app is visible** (which is also what earns WIU under A17).
- Verified as already correct (no change needed): `foregroundServiceType="mediaPlayback"`,
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `stopWithTask="false"` + `onTaskRemoved` keep-alive,
  `MediaButtonReceiver`, `START_STICKY`, `mediaSession.setActive(true)`, full action mask,
  `MediaStyle` + `setMediaSession(token)`, `VISIBILITY_PUBLIC` channel, no auto-skip on
  `onPlayerError` (prevents skip loops).

### Tauri parity — what "at least as stable as desktop" actually means
`src-tauri/` is **~880 lines total**: `main.rs`, `lib.rs`, `commands/{downloader,scanner,widget,window}.rs`.
There is **no native audio code in the desktop build at all** — desktop playback is 100% Web Audio
inside the system webview, and `Cargo.toml` has no audio crate. So desktop is not a harder
engineering baseline, it is an *easier environment*: a desktop window is never suspended, there is
no foreground-service lifetime, no `Doze`, no OEM battery killer, no notification-permission gate,
and no audio-focus preemption model. The parity bar on Android is therefore **behavioural, not
architectural**: background playback must be as uninterrupted and the controls as responsive as the
desktop player, which is exactly what items 1–8 above protect against. Desktop *does* still beat
Android on effect fidelity (full convolution reverb + delay/flanger vs. 4 `PresetReverb` presets —
see section C) and on gapless Smart Automix (section E).

### How to test this on a device (no build needed for the hardener)
```bash
# Force the Android 17 background-audio restrictions on/off (Android 17 images / emulator):
adb shell cmd audio set-enable-hardening enable    # or: disable | throw
adb shell cmd audio get-enable-hardening
# Then play, background the app, and look for the silent-mute verdicts:
adb logcat | grep -i AudioHardening
adb shell dumpsys media.audio_flinger | grep -i AudioHardening
#   "level: full"    → FGS is running but lacks WIU  → check publishNotification()/FGS type
#   "level: partial" → no FGS at all                 → check startForeground path + POST_NOTIFICATIONS
# Other useful probes:
adb shell dumpsys media_session        # session active? actions? metadata?
adb shell dumpsys activity services com.audenic.app   # FGS + type listed?
adb shell cmd appops get com.audenic.app POST_NOTIFICATIONS
adb shell am memory-limiter status     # Android 17 RAM-based app limits (exit REASON_OTHER)
```


### A. BLOCKER: toolchain is too old for compileSdk 36 (build will fail) — **bumped, unverified**
`android/build.gradle` has been bumped from `com.android.tools.build:gradle:8.7.2` to `8.13.2`, and `android/gradle/wrapper/gradle-wrapper.properties` from Gradle `8.9-all` to `8.13-all` (AGP 8.13 supports up to API 36.1, requires Gradle ≥8.13 and JDK 17 — see Android's AGP 8.11/8.13 release notes). This is a config-only change made in a sandbox with **no Android SDK / JDK 17 / Gradle available**, so it has **not** been build-verified.
- Still needed: `cd android && ./gradlew assembleDebug` on a real toolchain to confirm the bump actually resolves, Capacitor 6 stays compatible, and no other AGP 8.13 migration warnings surface.
- If that fails, fall back to downgrading compileSdk to 35 or `android.suppressUnsupportedCompileSdk=36` in `android/gradle.properties` as a temporary measure (not recommended for release).

### B. targetSdk 36/37 leftovers
- Android 16 forces **edge-to-edge** for `targetSdk 36` and, as a consequence,
  `Window.setStatusBarColor()` / `setNavigationBarColor()` in `MainActivity.java:45-46` are now
  **dead code**. Verify the React UI isn't drawn under the status/nav bars (safe-area insets /
  `@capawesome/capacitor-android-edge-to-edge-support` or CSS `env(safe-area-inset-*)`), then delete
  those two calls.
- `AndroidManifest.xml` still sets `android:usesCleartextTraffic="true"`, which is on Android 17's
  **deprecation path**. Migrate to a `network_security_config.xml` scoped to the hosts that
  actually need cleartext (the Capacitor local server plus any LAN/SMB sources) before targeting 37.
- Bumping `targetSdkVersion` to **37** is a separate, deliberate task: it activates the WIU
  requirement for background audio (see round-2 section), removes the large-screen
  orientation/aspect-ratio opt-out, and forbids mutating `static final` fields. Current target is 36,
  so the audio path is compliant today without WIU.
- Re-check `registerReceiver` flags (`RECEIVER_EXPORTED`/`RECEIVER_NOT_EXPORTED`, mandatory since
  API 34) — `NotificationReceiver` and `MediaButtonReceiver` are exported by design, confirm nothing
  else registers dynamically.
- **Longer-term**: Google's recommended end state for A17 compliance is media3's own
  `MediaSessionService`, which manages the FGS, session, notification and focus for you. This code
  deliberately still uses `MediaSessionCompat` + a hand-rolled notification (see `SERVICE` node in
  `assets/architecture.svg`); the 8 fixes above make that hand-rolled path compliant, but a
  `MediaSessionService` migration would remove the maintenance risk. Out of scope for this round.

### C. Effects still broken on native (by platform limitation, not by omission)
- **Delay / echo**: `audiofx` has no delay-line class, so `AudioEffectsRack.setDelay()` output is silent on Android. Needs real native DSP (`NativeAudioProcessor`/`AudioProcessor` fed into `MediaEffect`, or rendering through an `AudioTrack` mix) — sizeable work.
- **Flanger**: not a native gap only — **it is unimplemented everywhere**. `AudioEffectsState.flangerWet` is a dead stub with no `setFlanger()` and no DSP nodes. Implement web first (`DelayNode` + LFO-modulated `delayTime` + feedback), then decide on native.
- **DJ filter sweep + 3-band EQ kills** (`DJMixerScreen`): still Web-Audio only, therefore silent on native. Cheapest approximation: drive the existing native `Equalizer` bands from the filter position instead of shipping DSP.
- **Reverb fidelity**: native `PresetReverb` gives 4 coarse presets + a send level, vs. the convolution IRs on web. Expect audible divergence; treat as acceptable or move to IR-based native reverb.
- `outputGate`/`engine.muteOutput(isNative())` (`PlayerContext.tsx:819`) is what mutes the whole Web Audio graph on native — that is intentional and correct, but it is also why every unmapped effect is inaudible. Any new effect must have a native counterpart or it stays silent.

### D. Nothing has been tested on hardware
No Java / `ANDROID_HOME` / Gradle in the authoring sandbox, so items 1–4 are **static-code-complete only**. Needs: `npm run build` → `npx cap sync android` → gradle build → real device on Android 8 (API 26) and Android 16 (API 36). `dist/` is gitignored and untracked, so the web bundle must be rebuilt in the build environment — never ship from a stale `dist`.
Test matrix: next/prev/play/pause from notification **and** lock screen; headphone/BT media-button events; playback surviving screen-off, app-swipe-away and 30+ min idle; aggressive OEM battery savers (Xiaomi/Huawei/Samsung) with auto-start disabled; EQ/bass/reverb audibility through the notification-controlled player.
Round-2 specific, on an **Android 16 (API 36)** and an **Android 17 (API 37)** device or emulator:
start playback → lock the screen → confirm audio continues **and** the three transport buttons are
visible and responsive on the lock screen; skip tracks while locked; answer a phone call mid-track
(duck/pause then auto-resume — proves `handleAudioFocus=true`); unplug headphones (must pause, not
blast through the speaker); let a network track buffer for >1 min while backgrounded (must not be
muted); then run the `adb shell cmd audio set-enable-hardening enable` recipe above and confirm no
`AudioHardening` line appears for `com.audenic.app`. Also verify **lock-screen controls appear for a
user who skipped onboarding** (the `POST_NOTIFICATIONS` path added this round).

### E. Cleanup / open decisions
- **~~Duplicate native plugins~~ (done)**: dead `PlaybackPlugin.java`/`AudenicPlayback` retired — deleted (moved to `.trash/`), its `registerPlugin()` call removed from `MainActivity.java`, `DiagnosticsScreen.tsx`'s tests 6/7 removed, and `nativeBridge.ts`'s `loadQueueNative` (last caller) now calls `AudenicMedia.loadQueue` directly instead of trying the dead plugin first. `AudenicMediaPlugin.java` (`AudenicMedia`) is the sole native playback plugin.
- **~~Duplicated + drifted native sources~~ (done)**: the stale `native/android/` bootstrap template (`AudenicMediaPlugin.java`, `AudenicPlaybackService.java`, `README.md` — hundreds of lines behind the live files and quoting media3 `1.4.1` against the real `1.3.1`) has been deleted (moved to `.trash/`). README.md's repo-layout and known-limitations sections updated to match. If re-adding the Android platform, copy straight from `android/app/src/main/java/fm/audenic/app/`.
- **EQ unit mismatch to confirm**: web passes 5 band values into native `setNativeEq(int[] bandLevels, ...)` while Android `Equalizer` works in millibels over device-specific band counts/ranges. Verify scaling and clamping on at least two OEM devices, and map web band count → device band count.
- **~~License conflict~~ (resolved)**: `README.md`'s License section and `LICENSE` both now state the Altraware Technologies Proprietary License (commit `c50055f`); no stray MIT text remains anywhere in the repo (verified by repo-wide grep). No further owner decision needed on this point.
- `audenic_flutter/` and `src-tauri/` (desktop) — decide keep or delete.
- Smart Automix / DJ crossfade (`smartAutomix.ts`) runs entirely on Web Audio, so it is inert on native; automix on Android needs either the native queue's own gapless/crossfade or an accepted feature-reduction.

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

## NOT DONE — read this first

### A. BLOCKER: toolchain is too old for compileSdk 36 (build will fail)
`android/build.gradle` is still `com.android.tools.build:gradle:8.7.2` and the wrapper is Gradle `8.9-all`. AGP 8.7.x tops out at compileSdk 35, so API 36 will be rejected.
- Bump **AGP to ≥ 8.11** (ideally latest stable) and **Gradle** to the matching distribution in `android/gradle/wrapper/gradle-wrapper.properties`.
- Check Capacitor 6 compatibility while doing it; if AGP/Gradle can't move, either downgrade to compileSdk 35 or add `android.suppressUnsupportedCompileSdk=36` to `android/gradle.properties` as a temporary measure (not recommended for release).
- Then: `cd android && ./gradlew assembleDebug`.

### B. targetSdk 36 behavioural changes not addressed
Android 16 forces **edge-to-edge** for `targetSdk 36` — verify the React UI isn't drawn under the status/nav bars (safe-area insets / `@capawesome/capacitor-android-edge-to-edge-support` or CSS `env(safe-area-inset-*)`). Also re-check `registerReceiver` flags (`RECEIVER_EXPORTED`/`RECEIVER_NOT_EXPORTED`, mandatory since API 34) and any notification/ PendingIntent mutability usage.

### C. Effects still broken on native (by platform limitation, not by omission)
- **Delay / echo**: `audiofx` has no delay-line class, so `AudioEffectsRack.setDelay()` output is silent on Android. Needs real native DSP (`NativeAudioProcessor`/`AudioProcessor` fed into `MediaEffect`, or rendering through an `AudioTrack` mix) — sizeable work.
- **Flanger**: not a native gap only — **it is unimplemented everywhere**. `AudioEffectsState.flangerWet` is a dead stub with no `setFlanger()` and no DSP nodes. Implement web first (`DelayNode` + LFO-modulated `delayTime` + feedback), then decide on native.
- **DJ filter sweep + 3-band EQ kills** (`DJMixerScreen`): still Web-Audio only, therefore silent on native. Cheapest approximation: drive the existing native `Equalizer` bands from the filter position instead of shipping DSP.
- **Reverb fidelity**: native `PresetReverb` gives 4 coarse presets + a send level, vs. the convolution IRs on web. Expect audible divergence; treat as acceptable or move to IR-based native reverb.
- `outputGate`/`engine.muteOutput(isNative())` (`PlayerContext.tsx:819`) is what mutes the whole Web Audio graph on native — that is intentional and correct, but it is also why every unmapped effect is inaudible. Any new effect must have a native counterpart or it stays silent.

### D. Nothing has been tested on hardware
No Java / `ANDROID_HOME` / Gradle in the authoring sandbox, so items 1–4 are **static-code-complete only**. Needs: `npm run build` → `npx cap sync android` → gradle build → real device on Android 8 (API 26) and Android 16 (API 36). `dist/` is gitignored and untracked, so the web bundle must be rebuilt in the build environment — never ship from a stale `dist`.
Test matrix: next/prev/play/pause from notification **and** lock screen; headphone/BT media-button events; playback surviving screen-off, app-swipe-away and 30+ min idle; aggressive OEM battery savers (Xiaomi/Huawei/Samsung) with auto-start disabled; EQ/bass/reverb audibility through the notification-controlled player.

### E. Cleanup / open decisions
- **Duplicate native plugins**: `AudenicMediaPlugin.java` (`AudenicMedia`) is the live one; `PlaybackPlugin.java` (`AudenicPlayback`) is registered but essentially dead. Retire one to stop future edits landing in the wrong class.
- **Duplicated + drifted native sources**: `native/android/AudenicMediaPlugin.java` and `native/android/AudenicPlaybackService.java` are bootstrap copies that `native/android/README.md` tells you to paste into `android/app/src/main/java/fm/audenic/app/` after `npx cap add android`. They are now **behind** the live files (`diff` confirms), so following that guide would silently revert the wake lock, the `"prev"`/`"previous"` fix and `setNativeReverb`. Either refresh those copies from the live sources or delete them and the guide. That README also quotes media3 `1.4.1` while `android/app/build.gradle` pins `1.3.1`.
- **EQ unit mismatch to confirm**: web passes 5 band values into native `setNativeEq(int[] bandLevels, ...)` while Android `Equalizer` works in millibels over device-specific band counts/ranges. Verify scaling and clamping on at least two OEM devices, and map web band count → device band count.
- **License conflict (unresolved)**: `README.md` says MIT while commit `c50055f chore: enforce Altraware Proprietary License` and `LICENSE` assert a proprietary licence. Needs an owner decision.
- `audenic_flutter/` and `src-tauri/` (desktop) — decide keep or delete.
- Smart Automix / DJ crossfade (`smartAutomix.ts`) runs entirely on Web Audio, so it is inert on native; automix on Android needs either the native queue's own gapless/crossfade or an accepted feature-reduction.

# AUDENIC — Flutter Migration Plan

> **Owner decision (2026-10-27):** the app moves to **Flutter**.
> This document explains *how to do it well*, in what order, and what to reuse.
> Read [AGENT_HANDOVER.md](AGENT_HANDOVER.md) first for the current app's architecture.

---

## 0. Status right now

| Item | State |
|---|---|
| Old `audenic_flutter/` tree | **Deleted from `main`** on 2026-10-27. Recover any single file with `git show 71448e0:audenic_flutter/lib/...`, or restore the whole tree with `git checkout 71448e0 -- audenic_flutter`. Use it as *reference*, not as the base. |
| Capacitor app | Still the shipping build (v2.2 APK). Keep it working until Flutter reaches parity. |
| Flutter SDK in sandbox | **Not installed.** Install per §1 before anything else. |

Why the old tree is not the base: it targets very new package majors (`flutter_riverpod 3.x`, `firebase_core 4.x`, `on_audio_query 2.9`), it is Kotlin-only with no working native EQ wiring, and none of the fixes made to the current app in the last sessions exist in it. Treat it as a parts bin.

---

## 1. Environment setup (do this first, once)

The sandbox has no Flutter. The pattern that worked for JDK/Android SDK applies.

```bash
cd /opt
curl -sL -o flutter.tar.xz https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.x-stable.tar.xz
tar xf flutter.tar.xz            # -> /opt/flutter
export PATH=/opt/flutter/bin:$PATH
export JAVA_HOME=/opt/jdk        # installed earlier (Temurin 21)
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
flutter config --no-analytics
flutter doctor -v                 # expect Android toolchain OK, licences accepted
```

Licences (reuse the Android SDK already installed):

```bash
yes | /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses
```

Add the three `export` lines to a `~/.audenic_env` file and `source` it in every shell — the build tool does not persist env between calls.

---

## 2. Why Flutter actually fixes the current pain

Be honest with the owner about this table: most of our recent bug fixes are *workarounds for the WebView*, and Flutter deletes the whole class of bug.

| Current pain (Capacitor) | Root cause | How Flutter removes it |
|---|---|---|
| "URI malformed" crashes | `encodeURI()` in `convertFileSrc` chokes on media paths containing a bare `%` | No URL conversion layer. Dart passes `File`/`content://` strings straight to the player. |
| Notification artwork missing | Native can't read `http://localhost/_capacitor_...` URLs | `MediaItem.artUri` takes a real `file://` / `content://` — one code path. |
| EQ/bass/reverb fragile | WebAudio is muted on native; effects depend on a Java audio session we must keep re-binding | `just_audio` exposes `AndroidEqualizer` + `AndroidLoudnessEnhancer` as first-class objects bound to the player. |
| Synthetic mouse + touch double-fire | WebView fires both event families | Flutter has one gesture system with explicit `GestureDetector` / `onDoubleTap`. |
| Library vanishing / quota | `localStorage` ~5 MB | `sqflite` / `drift` — no quota, indexed queries, real sort/filter. |
| 300-row scroll crash | Hand-rolled virtual list + per-row error boundaries | `ListView.builder` is native, only builds visible rows. |

---

## 3. Target architecture

```
audenic/
├─ pubspec.yaml
├─ lib/
│  ├─ main.dart                     # ProviderScope + MaterialApp + theme
│  ├─ core/
│  │  ├─ audio/audenic_audio_handler.dart   # audio_service: MediaSession, notification, lockscreen
│  │  ├─ audio/player_controller.dart       # just_audio wrapper: queue, crossfade, speed, sleep timer
│  │  ├─ audio/effects_controller.dart      # AndroidEqualizer / LoudnessEnhancer / reverb
│  │  ├─ audio/stt_controller.dart          # speech_to_text: live dictation
│  │  └─ utils/lrc_parser.dart              # .lrc → timed lines
│  ├─ data/
│  │  ├─ models/{track,playlist,video_item}.dart
│  │  ├─ db/app_database.dart               # drift/sqflite: tracks, playlists, liked, play counts
│  │  └─ repositories/media_repository.dart # MediaStore scan (on_audio_query) + file picker
│  ├─ features/
│  │  ├─ library/library_screen.dart        # search, sort, folder picker, multi-select
│  │  ├─ player/now_playing_screen.dart     # single tap = play/pause, double = like
│  │  ├─ player/lyrics_sheet.dart           # read / translate / dictate / edit / style
│  │  ├─ drive/drive_mode_screen.dart
│  │  ├─ reels/reels_screen.dart
│  │  ├─ equalizer/equalizer_screen.dart
│  │  └─ dj/ai_dj_screen.dart
│  └─ shared/widgets/{mini_player,safe_art,marquee,synced_lyrics}.dart
└─ android/app/src/main/kotlin/...   # Kotlin allowed now; keep native surface tiny
```

**Rule:** the Flutter app talks to Android only through packages or one thin platform channel. No custom Java plugin layer, no WebView, no URL conversion.

---

## 4. Package choices (and why)

| Need | Package | Note |
|---|---|---|
| Playback + background service | `just_audio` + `audio_service` | The pair is the Flutter standard. `audio_service` gives the notification, lockscreen, headset buttons. |
| Android EQ / bass | `just_audio`'s `AndroidEqualizer`, `AndroidLoudnessEnhancer` | **No millibel maths** — the API takes dB-ish `gain` per band via `AndroidEqualizerParameters`. Delete the whole class of unit bug. |
| Reverb | `just_audio` has no reverb; use `audio_session` + a small platform channel, or skip v1 | PresetReverb is auxiliary and unreliable; decide with the owner. |
| Media scan | `on_audio_query` (or `audio_metadata_reader` for tags/art) | Returns album art as bytes or a file — write art to cache, pass `file://` to `MediaItem.artUri`. |
| Folder-scoped scan | `file_picker` (`getDirectoryPath`) + recursive walk with `audio_metadata_reader` | This finally delivers "scan only this folder", which MediaStore can't do. |
| Local DB | `drift` (or `sqflite` + hand SQL) | Kills the localStorage quota bug; supports sort by date-added / play count in SQL. |
| State | `flutter_riverpod` | Keep it; predictable, testable, no rebuild storms. |
| Speech-to-text | `speech_to_text` | True streaming dictation with interim words — replaces the Web Speech hack and the Gemini-chunk upload. |
| Video / reels | `video_player` | Already in the old tree. |
| Firebase | `firebase_core` + `firebase_auth` + `cloud_firestore` | Copy `google-services.json` from `android/app/`. |
| Icons / motion | `flutter_animate`, `palette_generator` | Palette from artwork for the accent theme. |

---

## 5. Migration order (each phase ships something usable)

Do **not** attempt a big-bang port. Each phase ends with an installable APK and a short list of verified behaviours.

### Phase 1 — Skeleton + audio (3–4 days)
1. `flutter create --org fm.audenic --project-name audenic .` in a **new folder** `audenic_flutter_v2/` (never in place; keeps Capacitor shippable).
2. `just_audio` + `audio_service` handler; queue, play/pause/next/prev, seek, speed, sleep timer.
3. MediaStore scan → `Track` model → list screen (no styling).
4. **Acceptance:** plays a local MP3 with the screen off; notification shows title/artist **and artwork**; headset pause/play works.

### Phase 2 — Library parity (3–4 days)
1. Drift schema: tracks, liked, play_counts, playlists, added_at.
2. Search (title/artist/album), sort (date added / A–Z / Z–A / most played), folder picker.
3. Multi-select, queue add, playlist CRUD, delete-with-confirm.
4. **Acceptance:** 300+ tracks scroll at 60 fps with no crash; sort and folder filters combine; library survives force-stop.

### Phase 3 — Player UX parity (3–4 days)
1. Now Playing screen: artwork, visualiser, progress, transport.
2. Gestures: `onTap` → play/pause, `onDoubleTap` → like, horizontal swipe → next/prev, vertical → queue/close, long-press → speed 2×.
3. Lyrics: `.lrc` parse + synced scroll, translate, inline edit, style options.
4. **Acceptance:** one tap never likes a song; double tap always does; gesture and buttons agree.

### Phase 4 — Effects + dictation (2–3 days)
1. `AndroidEqualizer`: presets + 5-band custom, persisted per device.
2. `AndroidLoudnessEnhancer` for bass.
3. Dictation via `speech_to_text`: interim words on screen, "save as lyrics".
4. **Acceptance:** moving a band audibly changes the sound on the phone; dictation types words as you speak, offline-capable languages work.

### Phase 5 — Secondary screens (4–5 days)
Drive Mode (touch-first, no keyboard hints), Reels (video feed), Explore/radio, AI DJ, share-card render, achievements.

### Phase 6 — Data migration + cutover (2 days)
1. Export from the Capacitor app: `au.localTracks`, `au.liked`, `au.pl`, `au.pc` → JSON.
2. Import screen in Flutter (read the same JSON) → Drift.
3. Side-by-side test week; then archive the Capacitor app.

**Total realistic effort: ~3 weeks of focused work** (single developer, no new features).

---

## 6. Traps to avoid (learned the hard way)

1. **Don't share the `android/` folder with the Capacitor app.** Different Gradle setups will fight. Separate project directory.
2. **`MediaItem.artUri` must be `file://` or `content://`.** Never a network-ish URL; write extracted art to `getApplicationCacheDir()` first.
3. **EQ band levels in `just_audio` are `gain` (0.0–1.0 mapped by the plugin), not millibels.** Don't port the `×100` conversion — read `AndroidEqualizerParameters.bands` and set within its documented range.
4. **Rebind effects after `AudioPlayer` re-creates its session** — same session-lifetime issue as the Capacitor app; re-apply on `playerStateStream` track change.
5. **`on_audio_query` needs `READ_MEDIA_AUDIO` (API 33+) *and* `READ_EXTERNAL_STORAGE` (≤32).** Request both, handle "denied permanently" with a settings deep-link.
6. **Don't let a scan clear the library.** Merge by a stable key (`content://media/external/audio/media/<id>` or file path + size); missing files get flagged, not deleted.
7. **`shared_preferences` is not a database.** Small settings only.
8. **Keep the notification channel id stable** across versions or users lose their per-app notification settings.
9. **Kotlin is now allowed**, but keep native code to zero where a package exists — that is the whole point of the move.

---

## 7. Definition of done (parity checklist)

Ship the Flutter build as the default only when **all** of these are true:

- [ ] Local scan finds the same count as the Capacitor app; artwork shows in the notification and lockscreen
- [ ] No crash with 500+ tracks; scroll steady; library survives force-stop and reboot
- [ ] Single tap = play/pause, double tap = like, everywhere (player, reels, mini player)
- [ ] Search + sort (date added / A–Z / Z–A / most played) + folder filter all work together
- [ ] EQ and bass audibly change output; settings persist
- [ ] Dictation types words live and can save to the track's lyrics
- [ ] Sleep timer, crossfade, speed, repeat/shuffle behave identically
- [ ] Playlists, liked songs, play counts imported from the old app with zero loss
- [ ] Background playback ≥ 1 hour with the screen off, no service kill
- [ ] One debug APK per phase delivered to the owner via tunnel link

---

## 8. First three commands for the next agent

```bash
# 1. install toolchain (see §1), then:
cd /root/.accio/accounts/1799136321/agents/DID-82AD6B-4682AD6BU1793026-04089d731f5494ae4982-76B55A/project
flutter create --org fm.audenic --project-name audenic audenic_flutter_v2
cd audenic_flutter_v2 && flutter pub add just_audio audio_service on_audio_query drift \
  drift_flutter path_provider permission_handler flutter_riverpod speech_to_text \
  file_picker video_player cached_network_image palette_generator flutter_animate

# 2. copy Firebase config, then build the Phase-1 APK:
cp ../audenic-music/android/app/google-services.json android/app/
flutter build apk --debug
```

Deliver that first APK before writing any UI polish — the owner's trust comes from hearing sound from a Flutter build, and every phase after that is measured against it.

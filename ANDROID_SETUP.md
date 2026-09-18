# 🎵 Audenic — Android Studio Build Guide (Capacitor)

This produces a **real, installable Android APK / AAB** with lock-screen media
controls, storage scanning, background audio, haptics, achievements, and the
built-in Audenic AI assistant.

---

## 1 · Build the web bundle

```bash
npm install
npm run build          # → dist/index.html  (single self-contained file)
```

## 2 · Wire up Capacitor (already done in this repo)

The Capacitor packages are already installed and configured. To generate the
native Android project:

```bash
npx cap add android          # first time only
npx cap sync android         # after every code change
npx cap open android         # launches Android Studio
```

> `capacitor.config.json` is already in the repo — it sets the dark splash,
> translucent status bar, cleartext streaming (needed for `http://` radio),
> the notification accent colour and Keyboard resize mode.

Every native feature is wired through **`src/player/nativeBridge.ts`**, which
lazy-loads the Capacitor plugins on Android and silently falls back to Web APIs
in the browser — so `npm run dev` still works everywhere.

---

## 3 · Permissions — `android/app/src/main/AndroidManifest.xml`

Paste **above** the `<application>` tag:

```xml
<!-- Network: radio, Internet Archive, Gemini, AI providers -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

<!-- Microphone: the Record button in Explore + AI voice input -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

<!-- Media scanning · Android 13+ (API 33) -->
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VISUAL_USER_SELECTED" />
<!-- Android 12 and below -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />

<!-- Lock-screen / notification playback + achievement notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Haptics -->
<uses-permission android:name="android.permission.VIBRATE" />

<!-- Battery optimizations (so audio keeps playing when screen is off) -->
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

On the `<application>` element add:

```xml
android:usesCleartextTraffic="true"
android:hardwareAccelerated="true"
android:largeHeap="true"
```

And on the `<activity>` add so rotation/keyboard don't reload the WebView:

```xml
android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
android:launchMode="singleTask"
android:windowSoftInputMode="adjustResize"
```

---

## 4 · MainActivity — WebView tuning

Replace `android/app/src/main/java/fm/audenic/app/MainActivity.java` with:

```java
package fm.audenic.app;

import android.Manifest;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    java.util.List<String> perms = new java.util.ArrayList<>();
    perms.add(Manifest.permission.RECORD_AUDIO);
    if (Build.VERSION.SDK_INT >= 33) {
      perms.add(Manifest.permission.READ_MEDIA_AUDIO);
      perms.add(Manifest.permission.READ_MEDIA_VIDEO);
      perms.add(Manifest.permission.READ_MEDIA_IMAGES);
      perms.add(Manifest.permission.POST_NOTIFICATIONS);
    } else {
      perms.add(Manifest.permission.READ_EXTERNAL_STORAGE);
    }
    ActivityCompat.requestPermissions(this, perms.toArray(new String[0]), 42);

    WebSettings s = getBridge().getWebView().getSettings();
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setDomStorageEnabled(true);
    s.setAllowFileAccess(true);
    s.setJavaScriptEnabled(true);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);

    getBridge().getWebView().setWebChromeClient(
      new com.getcapacitor.BridgeWebChromeClient(getBridge()) {
        @Override public void onPermissionRequest(final PermissionRequest request) {
          runOnUiThread(() -> request.grant(request.getResources()));
        }
      }
    );
  }
}
```

The app already publishes **Media Session** metadata (`navigator.mediaSession`),
so Android automatically renders the album art, title, artist and
play/pause/next/previous/seek buttons on the **lock screen and in the
notification shade** — no extra plugin required.

---

## 4b · Notification icon (lock-screen + shade)

Android needs a monochrome, alpha-only icon for notifications — a colour PNG
renders as a white block. Create this vector at
`android/app/src/main/res/drawable/ic_stat_music.xml` **after** `npx cap add android`:

```xml
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="24" android:viewportHeight="24">
  <path
      android:fillColor="#FFFFFF"
      android:pathData="M12,3v10.55A4,4 0 1,0 14,17V7h4V3h-6zM10,19a2,2 0 1,1 2,-2 2,2 0 0,1 -2,2z"/>
</vector>
```

It's already referenced in `capacitor.config.json`
(`LocalNotifications.smallIcon = "ic_stat_music"`) and the Media Session
artwork is set from the track cover at multiple sizes, so the lock-screen
media card shows the real album art with play / pause / prev / next / seek.

### Puter.js on Android
`Puter` (`https://js.puter.com/v2/`) loads from a CDN, so it works inside the
Android WebView exactly like the browser — no key required. It is tried after
Groq → HuggingFace → OpenRouter → Ollama and before the offline assistant.
If the device is offline the chain simply falls through to the offline brain,
so the AI never breaks.

## 5 · Run on your phone

1. Phone → *Settings → About → tap Build number 7×* → Developer options → **USB debugging**.
2. Plug in via USB, accept the RSA prompt.
3. In Android Studio pick your device and press ▶ **Run**.

After any code change:

```bash
npm run build && npx cap sync android
```

### Signed release APK / AAB
```
Android Studio → Build → Generate Signed Bundle / APK → create keystore → release
```

---

## 6 · Feature → permission map

| Feature | Permission | Notes |
|---|---|---|
| Radio + Internet Archive | `INTERNET` | `usesCleartextTraffic` for http streams |
| Scan songs / videos / art | `READ_MEDIA_AUDIO/VIDEO/IMAGES` | folder picker via `webkitdirectory` |
| Record radio clip | `RECORD_AUDIO` | `MediaRecorder` + `captureStream()` |
| Lock-screen controls | `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | driven by Media Session API |
| Background playback | `WAKE_LOCK`, `FOREGROUND_SERVICE` | keeps audio alive when screen is off |
| Haptic feedback | `VIBRATE` | routed through `@capacitor/haptics` on Android |
| Achievement notifications | `POST_NOTIFICATIONS` | `@capacitor/local-notifications` |
| Share song / station | Share Intent | `@capacitor/share` → native share sheet |
| Audenic AI (online) | `INTERNET` | Groq → OpenRouter → Ollama Cloud with fallback |
| Audenic AI (offline) | none | Built-in rule-based assistant, zero network |

---

## 7 · Gesture cheat-sheet

**Now Playing**
| Gesture | Action |
|---|---|
| Swipe ← | Next track |
| Swipe → | Previous track |
| Swipe ↑ | Open queue |
| Swipe ↓ | Exit player |
| Double-tap **left** | Rewind 10 s |
| Double-tap **right** | Forward 10 s |
| Double-tap **centre** | Like ❤️ |
| Single tap | Play / pause |
| Long press | Open Audio Effects |
| **Long press Visualizer button** | Customize style + cover art shape |
| Hold right zone | Temporary 2× speed |
| Hold left zone | Scrubbing rewind |

**Reels:** double-tap = like, swipe ↑↓ = change reel, single tap = pause,
loop count + auto-scroll configurable in **Settings → Reels**.

---

## 8 · Audenic AI setup

Audenic AI lives behind the Home hero card and in **Settings → Audenic AI**.
Add any (or none) of these free API keys — it tries them in order and silently
falls back to a fully offline assistant that still plays music, manages
playlists, changes the theme/EQ and navigates the app with zero connection:

1. **Groq** — free tier, get a key at console.groq.com (`llama-3.3-70b-versatile`)
2. **OpenRouter** — free `:free` models, get a key at openrouter.ai/keys
3. **Ollama Cloud** — get a key at ollama.com (`gpt-oss:20b-cloud`)

---

## 9 · Achievements

Open **Settings → Achievements 🏆** — 18 built-in unlocks across Listening,
Library, Explore and Personal categories. Every unlock fires a haptic buzz,
a floating in-app toast, and a native Android notification.

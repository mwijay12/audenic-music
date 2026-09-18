# Audenic Android native layer

After `npx cap add android`, copy both Java files into:

`android/app/src/main/java/fm/audenic/app/`

Register the plugin in `MainActivity.onCreate` before `super.onCreate` is not
required with `@CapacitorPlugin`; Capacitor discovers it after `npx cap sync`.

Add these to `android/variables.gradle` or `android/app/build.gradle`:

```gradle
implementation "androidx.media3:media3-exoplayer:1.4.1"
implementation "androidx.media3:media3-session:1.4.1"
```

Add this service inside `<application>` in AndroidManifest.xml:

```xml
<service
    android:name=".AudenicPlaybackService"
    android:exported="false"
    android:foregroundServiceType="mediaPlayback" />
```

The plugin provides:

- `AudenicMedia.scan({ kind: "audio" | "video" })` — Android MediaStore with
  persistent `content://` URIs, title, artist, album, duration, size, art URI.
- `AudenicMedia.download(...)` — Android DownloadManager into Music/Audenic,
  with progress/completion in the notification shade.
- `AudenicMedia.playback(...)` — Media3 foreground playback service for
  process-independent lock-screen and notification controls.
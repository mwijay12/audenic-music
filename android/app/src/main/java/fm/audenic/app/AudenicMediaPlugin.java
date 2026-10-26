package fm.audenic.app;

import android.app.DownloadManager;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "AudenicMedia",
    permissions = {
        @Permission(
            alias = "readAudio",
            strings = { Manifest.permission.READ_MEDIA_AUDIO }
        ),
        @Permission(
            alias = "readStorage",
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE }
        ),
        @Permission(
            alias = "postNotifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class AudenicMediaPlugin extends Plugin {
  private static final int MAX_SCAN_RESULTS = 2000;
  private static AudenicMediaPlugin instance;
  private final ExecutorService bgExecutor = Executors.newSingleThreadExecutor();

  @Override
  public void load() {
    super.load();
    instance = this;
  }

  /** Static bridge for sending native MediaSession / PendingIntent events into JavaScript */
  public static void sendPlaybackEvent(String action) {
    if (instance != null) {
      JSObject ret = new JSObject();
      ret.put("action", action);
      instance.notifyListeners("onNativePlayback", ret);
    }
  }

  /** Static bridge for sending seek commands from lockscreen scrubber into JavaScript */
  public static void sendSeekEvent(long positionMs) {
    if (instance != null) {
      JSObject ret = new JSObject();
      ret.put("action", "seek");
      ret.put("position", positionMs);
      instance.notifyListeners("onNativePlayback", ret);
    }
  }

  /** Static bridge for track change transitions in native ExoPlayer */
  public static void sendTrackChangedEvent(String trackId, int index) {
    if (instance != null) {
      JSObject ret = new JSObject();
      ret.put("action", "trackChanged");
      ret.put("trackId", trackId);
      ret.put("index", index);
      instance.notifyListeners("onNativePlayback", ret);
    }
  }

  /** Static bridge for sending current playback position to JS (background-safe scrubber sync) */
  public static void sendProgressEvent(long positionMs, long durationMs) {
    if (instance != null) {
      JSObject ret = new JSObject();
      ret.put("action", "progress");
      ret.put("position", positionMs);
      ret.put("duration", durationMs);
      instance.notifyListeners("onNativePlayback", ret);
    }
  }

  @PluginMethod
  public void scan(PluginCall call) {
    boolean hasPermission = false;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      hasPermission = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED;
    } else {
      hasPermission = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    if (hasPermission) {
      doScan(call);
    } else {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        requestPermissionForAlias("readAudio", call, "permissionCallback");
      } else {
        requestPermissionForAlias("readStorage", call, "permissionCallback");
      }
    }
  }

  @PermissionCallback
  private void permissionCallback(PluginCall call) {
    boolean granted = false;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED;
    } else {
      granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }
    if (granted) {
      doScan(call);
    } else {
      call.reject("PERMISSION_DENIED", "Storage permission is required to scan media");
    }
  }

  /**
   * Ensures POST_NOTIFICATIONS is granted. Without it, Android 13+ suppresses the
   * mediaPlayback foreground-service notification entirely, which also removes the
   * lock-screen / notification-shade media controls. Previously this was only requested
   * from the onboarding flow, so anyone who skipped onboarding lost lock-screen controls.
   * Safe to call repeatedly — Android only shows the dialog while the permission is undetermined.
   */
  @PluginMethod
  public void requestNotifications(PluginCall call) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      // Pre-Android 13: notification permission is installed-granted, nothing to ask.
      JSObject granted = new JSObject();
      granted.put("granted", true);
      call.resolve(granted);
      return;
    }
    if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
        == PackageManager.PERMISSION_GRANTED) {
      JSObject granted = new JSObject();
      granted.put("granted", true);
      call.resolve(granted);
      return;
    }
    requestPermissionForAlias("postNotifications", call, "notificationsPermissionCallback");
  }

  @PermissionCallback
  private void notificationsPermissionCallback(PluginCall call) {
    boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
        == PackageManager.PERMISSION_GRANTED;
    JSObject ret = new JSObject();
    ret.put("granted", granted);
    call.resolve(ret);
  }

  private void doScan(PluginCall call) {
    call.setKeepAlive(true);
    bgExecutor.execute(() -> {
      String kind = call.getString("kind", "audio");
      Uri collection = kind.equals("video")
        ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;

      String[] projection = kind.equals("video")
        ? new String[]{
            MediaStore.Video.Media._ID,
            MediaStore.Video.Media.TITLE,
            MediaStore.Video.Media.DISPLAY_NAME,
            MediaStore.Video.Media.DATA,
            MediaStore.Video.Media.DURATION,
            MediaStore.Video.Media.SIZE,
            MediaStore.Video.Media.MIME_TYPE,
            MediaStore.Video.Media.DATE_ADDED,
            MediaStore.Video.Media.WIDTH,
            MediaStore.Video.Media.HEIGHT
          }
        : new String[]{
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.MIME_TYPE,
            MediaStore.Audio.Media.DATE_ADDED
          };

      String selection = kind.equals("audio")
        ? MediaStore.Audio.Media.DURATION + " > 3000"
        : null;

      JSArray items = new JSArray();
      File cacheDir = getContext().getCacheDir();

      try (Cursor c = getContext().getContentResolver().query(
          collection, projection, selection, null,
          MediaStore.MediaColumns.DATE_ADDED + " DESC")) {
        if (c != null) {
          int count = 0;
          while (c.moveToNext() && count < MAX_SCAN_RESULTS) {
            long id = c.getLong(c.getColumnIndexOrThrow(MediaStore.MediaColumns._ID));
            Uri uri = ContentUris.withAppendedId(collection, id);

            String rawTitle = value(c, MediaStore.MediaColumns.TITLE);
            String displayName = value(c, MediaStore.MediaColumns.DISPLAY_NAME);
            String filePath = value(c, MediaStore.MediaColumns.DATA);
            String rawArtist = kind.equals("audio") ? value(c, MediaStore.Audio.Media.ARTIST) : "";
            String rawAlbum = kind.equals("audio") ? value(c, MediaStore.Audio.Media.ALBUM) : "";

            // 1. Title & Artist fallback: parse "Artist - Title" from filename if unknown
            String title = rawTitle;
            String artist = rawArtist;

            if (title == null || title.trim().isEmpty() || title.equalsIgnoreCase("unknown")) {
              title = parseTitleFromFilename(displayName, filePath);
            }

            if (artist == null || artist.trim().isEmpty() || artist.equalsIgnoreCase("<unknown>")) {
              artist = "Unknown Artist";
            }

            // Check if filename is in "Artist - Title" format (e.g., "Diamond Platnumz - Komasava.mp3")
            if (artist.equals("Unknown Artist") && filePath != null) {
              String base = new File(filePath).getName();
              int dot = base.lastIndexOf('.');
              if (dot > 0) base = base.substring(0, dot);
              if (base.contains(" - ")) {
                String[] parts = base.split(" - ", 2);
                if (parts.length == 2 && !parts[0].trim().isEmpty() && !parts[1].trim().isEmpty()) {
                  artist = parts[0].trim();
                  title = parts[1].trim();
                }
              }
            }

            JSObject o = new JSObject();
            o.put("id", String.valueOf(id));
            o.put("uri", uri.toString());
            o.put("webPath", uri.toString());
            o.put("title", title);
            o.put("artist", artist);
            o.put("album", rawAlbum != null ? rawAlbum : "");
            o.put("duration", longValue(c, kind.equals("audio") ? MediaStore.Audio.Media.DURATION : MediaStore.Video.Media.DURATION));
            o.put("size", longValue(c, MediaStore.MediaColumns.SIZE));
            o.put("mimeType", value(c, MediaStore.MediaColumns.MIME_TYPE));
            o.put("dateAdded", longValue(c, MediaStore.MediaColumns.DATE_ADDED) * 1000L);

            // 3. Smart classification for Video (Reels vs generic Videos)
            if (kind.equals("video")) {
                int wIdx = c.getColumnIndex(MediaStore.Video.Media.WIDTH);
                int hIdx = c.getColumnIndex(MediaStore.Video.Media.HEIGHT);
                int width = wIdx >= 0 ? c.getInt(wIdx) : 0;
                int height = hIdx >= 0 ? c.getInt(hIdx) : 0;
                long duration = longValue(c, MediaStore.Video.Media.DURATION);
                
                boolean isPortrait = height > width;
                boolean isShort = duration < 180000; // Under 3 minutes
                
                String category = (isPortrait && isShort) ? "reels" : "videos";
                
                if (filePath != null) {
                    String lowerPath = filePath.toLowerCase();
                    if (lowerPath.contains("reel") || lowerPath.contains("shorts") || lowerPath.contains("tiktok") || lowerPath.contains("status")) {
                        category = "reels";
                    }
                }
                o.put("category", category);
            }

            // 4. Cover art fallback (MediaStore albumart URI -> MediaMetadataRetriever embedded artwork -> Folder art)
            if (kind.equals("audio")) {
              String artworkUrl = "";
              long albumId = longValue(c, MediaStore.Audio.Media.ALBUM_ID);

              if (albumId > 0) {
                artworkUrl = "content://media/external/audio/albumart/" + albumId;
              }

              // Check if artwork exists or fallback to embedded ID3 artwork
              if (filePath != null && !filePath.isEmpty() && (artworkUrl.isEmpty() || !hasValidArtwork(artworkUrl))) {
                String embeddedArt = extractEmbeddedArtwork(filePath, id, cacheDir);
                if (embeddedArt != null) {
                  artworkUrl = embeddedArt;
                } else {
                  String folderArt = findFolderArtwork(filePath);
                  if (folderArt != null) {
                    artworkUrl = folderArt;
                  }
                }
              }

              if (!artworkUrl.isEmpty()) {
                o.put("artwork", artworkUrl);
              }

              // 4. Auto-detect & load matching .lrc lyrics file (SnapTube / Music / Download directories)
              String lrcContent = findAndReadLrcFile(filePath, displayName);
              if (lrcContent != null && !lrcContent.isEmpty()) {
                o.put("lrc", lrcContent);
              }
            }

            items.put(o);
            count++;
          }
        }
      } catch (Exception e) {
        call.reject("MediaStore scan failed", e);
        return;
      }
      JSObject out = new JSObject();
      out.put("items", items);
      call.resolve(out);
    });
  }

  private String findAndReadLrcFile(String filePath, String displayName) {
    if (filePath == null || filePath.isEmpty()) return null;
    File audioFile = new File(filePath);
    File parentDir = audioFile.getParentFile();

    String baseName = audioFile.getName();
    int dot = baseName.lastIndexOf('.');
    if (dot > 0) baseName = baseName.substring(0, dot);

    if (parentDir != null && parentDir.exists()) {
      File lrcFile = new File(parentDir, baseName + ".lrc");
      if (lrcFile.exists() && lrcFile.isFile()) {
        return readTextFile(lrcFile);
      }
    }

    String[] commonDirs = new String[]{
      Environment.getExternalStorageDirectory().getAbsolutePath() + "/snaptube/download/SnapTube Audio",
      Environment.getExternalStorageDirectory().getAbsolutePath() + "/Music",
      Environment.getExternalStorageDirectory().getAbsolutePath() + "/Download"
    };
    for (String dirPath : commonDirs) {
      File dir = new File(dirPath);
      if (dir.exists() && dir.isDirectory()) {
        File lrcFile = new File(dir, baseName + ".lrc");
        if (lrcFile.exists() && lrcFile.isFile()) {
          return readTextFile(lrcFile);
        }
      }
    }
    return null;
  }

  private String readTextFile(File f) {
    try (java.io.BufferedReader br = new java.io.BufferedReader(new java.io.FileReader(f))) {
      StringBuilder sb = new StringBuilder();
      String line;
      while ((line = br.readLine()) != null) {
        sb.append(line).append("\n");
      }
      return sb.toString().trim();
    } catch (Exception e) {
      return null;
    }
  }

  private String parseTitleFromFilename(String displayName, String filePath) {
    String filename = displayName;
    if (filename == null || filename.isEmpty()) {
      if (filePath != null && !filePath.isEmpty()) {
        filename = new File(filePath).getName();
      }
    }
    if (filename == null || filename.isEmpty()) {
      return "Unknown Track";
    }
    int dotIndex = filename.lastIndexOf('.');
    if (dotIndex > 0) {
      filename = filename.substring(0, dotIndex);
    }
    return filename.replace('_', ' ').replace('-', ' ').trim();
  }

  private boolean hasValidArtwork(String contentUrl) {
    try (InputStream is = getContext().getContentResolver().openInputStream(Uri.parse(contentUrl))) {
      return is != null;
    } catch (Exception e) {
      return false;
    }
  }

  private String extractEmbeddedArtwork(String filePath, long id, File cacheDir) {
    MediaMetadataRetriever mmr = new MediaMetadataRetriever();
    try {
      mmr.setDataSource(filePath);
      byte[] artBytes = mmr.getEmbeddedPicture();
      if (artBytes != null && artBytes.length > 0) {
        File artFile = new File(cacheDir, "art_" + id + ".jpg");
        if (!artFile.exists() || artFile.length() == 0) {
          FileOutputStream fos = new FileOutputStream(artFile);
          fos.write(artBytes);
          fos.close();
        }
        return Uri.fromFile(artFile).toString();
      }
    } catch (Exception e) {
      // Ignore
    } finally {
      try { mmr.release(); } catch (Exception e) { /* */ }
    }
    return null;
  }

  private String findFolderArtwork(String filePath) {
    if (filePath == null || filePath.isEmpty()) return null;
    File audioFile = new File(filePath);
    File parentDir = audioFile.getParentFile();
    if (parentDir != null && parentDir.exists() && parentDir.isDirectory()) {
      String[] possibleNames = new String[]{"cover.jpg", "folder.jpg", "album.jpg", "art.jpg", "cover.png", "folder.png"};
      for (String name : possibleNames) {
        File f = new File(parentDir, name);
        if (f.exists() && f.isFile() && f.length() > 0) {
          return Uri.fromFile(f).toString();
        }
      }
    }
    return null;
  }

  @PluginMethod
  public void download(PluginCall call) {
    String url = call.getString("url");
    String filename = call.getString("filename", "audenic-audio.mp3");
    String mime = call.getString("mimeType", "audio/mpeg");
    if (url == null) { call.reject("Missing url"); return; }
    DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
    req.setTitle(filename);
    req.setDescription("Downloading with Audenic");
    req.setMimeType(mime);
    req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
    req.setDestinationInExternalPublicDir(Environment.DIRECTORY_MUSIC, "Audenic/" + filename);
    DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
    long id = dm.enqueue(req);
    JSObject out = new JSObject(); out.put("id", id); call.resolve(out);
  }

  @PluginMethod
  public void playback(PluginCall call) {
    String command = call.getString("command", "play");
    long pos = call.getLong("positionMs", 0L);
    long dur = call.getLong("durationMs", 0L);
    AudenicPlaybackService.command(
      getContext(), command,
      call.getString("uri"),
      call.getString("title"),
      call.getString("artist"),
      call.getString("coverUrl"),
      pos, dur
    );
    call.resolve();
  }

  @PluginMethod
  public void loadQueue(PluginCall call) {
    JSArray itemsArray = call.getArray("items");
    int startIndex = call.getInt("startIndex", 0);
    long startPosMs = call.getLong("startPosMs", 0L);
    if (itemsArray == null) {
      call.reject("Missing items");
      return;
    }
    ArrayList<String> ids = new ArrayList<>();
    ArrayList<String> uris = new ArrayList<>();
    ArrayList<String> titles = new ArrayList<>();
    ArrayList<String> artists = new ArrayList<>();
    ArrayList<String> covers = new ArrayList<>();
    for (int i = 0; i < itemsArray.length(); i++) {
      try {
        JSONObject obj = itemsArray.getJSONObject(i);
        ids.add(obj.optString("id", String.valueOf(i)));
        uris.add(obj.optString("uri", obj.optString("src", "")));
        titles.add(obj.optString("title", "Unknown Track"));
        artists.add(obj.optString("artist", "Unknown Artist"));
        covers.add(obj.optString("coverUrl", obj.optString("cover", "")));
      } catch (Exception ignored) {}
    }
    AudenicPlaybackService.loadQueueNative(getContext(), ids, uris, titles, artists, covers, startIndex, startPosMs);
    call.resolve();
  }

  @PluginMethod
  public void updatePosition(PluginCall call) {
    long pos = call.getLong("positionMs", 0L);
    long dur = call.getLong("durationMs", 0L);
    AudenicPlaybackService.command(
      getContext(), "updatePos",
      null, null, null, null,
      pos, dur
    );
    call.resolve();
  }

  @PluginMethod
  public void setEqualizer(PluginCall call) {
    JSArray bandsArray = call.getArray("bands");
    int bassBoost = call.getInt("bassBoost", 0);
    int[] bandLevels = null;

    if (bandsArray != null) {
      try {
        bandLevels = new int[bandsArray.length()];
        for (int i = 0; i < bandsArray.length(); i++) {
          bandLevels[i] = bandsArray.getInt(i);
        }
      } catch (Exception e) {
        bandLevels = null;
      }
    }

    AudenicPlaybackService svc = AudenicPlaybackService.getInstance();
    if (svc != null) {
      svc.setNativeEq(bandLevels, bassBoost);
    }
    call.resolve();
  }

  @PluginMethod
  public void setReverb(PluginCall call) {
    int wetPct = call.getInt("wet", 0);
    String type = call.getString("type", "hall");

    AudenicPlaybackService svc = AudenicPlaybackService.getInstance();
    if (svc != null) {
      svc.setNativeReverb(wetPct, type);
    }
    call.resolve();
  }

  @PluginMethod
  public void updateNotification(PluginCall call) {
    String title = call.getString("title", "Audenic");
    String artist = call.getString("artist", "");
    String coverUrl = call.getString("coverUrl", null);
    boolean isPlaying = call.getBoolean("isPlaying", true);
    boolean isLiked = call.getBoolean("isLiked", false);
    long pos = call.getLong("positionMs", 0L);
    long dur = call.getLong("durationMs", 0L);
    AudenicPlaybackService.updateNotificationState(
      getContext(), title, artist, coverUrl, isPlaying, pos, dur, isLiked
    );
    call.resolve();
  }

  @PluginMethod
  public void delete(PluginCall call) {
    String id = call.getString("id");
    String kind = call.getString("kind", "audio");
    if (id == null) { call.reject("Missing id"); return; }

    Uri collection = kind.equals("video")
      ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI
      : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
    Uri uri = ContentUris.withAppendedId(collection, Long.parseLong(id));

    try {
      int deleted = getContext().getContentResolver().delete(uri, null, null);
      JSObject out = new JSObject();
      out.put("deleted", deleted > 0);
      call.resolve(out);
    } catch (Exception e) {
      call.reject("Delete failed", e);
    }
  }

  @PluginMethod
  public void hasOverlayPermission(PluginCall call) {
    boolean granted = true;
    if (android.os.Build.VERSION.SDK_INT >= 23) {
      granted = android.provider.Settings.canDrawOverlays(getContext());
    }
    JSObject out = new JSObject();
    out.put("granted", granted);
    call.resolve(out);
  }

  @PluginMethod
  public void requestOverlayPermission(PluginCall call) {
    if (android.os.Build.VERSION.SDK_INT >= 23 && !android.provider.Settings.canDrawOverlays(getContext())) {
      android.content.Intent intent = new android.content.Intent(
        android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        android.net.Uri.parse("package:" + getContext().getPackageName())
      );
      intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(intent);
    }
    call.resolve();
  }

  @PluginMethod
  public void toggleIsland(PluginCall call) {
    boolean enable = call.getBoolean("enable", true);
    if (enable) {
      AudenicIslandService.startIsland(getContext());
    } else {
      AudenicIslandService.stopIsland(getContext());
    }
    call.resolve();
  }

  private String value(Cursor c, String col) {
    int i = c.getColumnIndex(col); return i >= 0 && !c.isNull(i) ? c.getString(i) : "";
  }
  private long longValue(Cursor c, String col) {
    int i = c.getColumnIndex(col); return i >= 0 && !c.isNull(i) ? c.getLong(i) : 0L;
  }
}

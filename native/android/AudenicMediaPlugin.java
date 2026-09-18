package fm.audenic.app;

import android.app.DownloadManager;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Copy this file into android/app/src/main/java/fm/audenic/app/ after
 * `npx cap add android`. It exposes Android MediaStore and DownloadManager to
 * src/player/nativeBridge.ts. Content URIs remain persistent across restarts.
 */
@CapacitorPlugin(name = "AudenicMedia")
public class AudenicMediaPlugin extends Plugin {
  @PluginMethod
  public void scan(PluginCall call) {
    String kind = call.getString("kind", "audio");
    Uri collection = kind.equals("video")
      ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI
      : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;

    String[] projection = kind.equals("video")
      ? new String[]{ MediaStore.Video.Media._ID, MediaStore.Video.Media.TITLE,
          MediaStore.Video.Media.DURATION, MediaStore.Video.Media.SIZE,
          MediaStore.Video.Media.MIME_TYPE, MediaStore.Video.Media.DATE_ADDED }
      : new String[]{ MediaStore.Audio.Media._ID, MediaStore.Audio.Media.TITLE,
          MediaStore.Audio.Media.ARTIST, MediaStore.Audio.Media.ALBUM,
          MediaStore.Audio.Media.ALBUM_ID, MediaStore.Audio.Media.DURATION,
          MediaStore.Audio.Media.SIZE, MediaStore.Audio.Media.MIME_TYPE,
          MediaStore.Audio.Media.DATE_ADDED };

    JSArray items = new JSArray();
    try (Cursor c = getContext().getContentResolver().query(
        collection, projection, null, null, MediaStore.MediaColumns.DATE_ADDED + " DESC")) {
      if (c != null) while (c.moveToNext()) {
        long id = c.getLong(c.getColumnIndexOrThrow(MediaStore.MediaColumns._ID));
        Uri uri = ContentUris.withAppendedId(collection, id);
        JSObject o = new JSObject();
        o.put("id", String.valueOf(id));
        o.put("uri", uri.toString());
        o.put("webPath", uri.toString());
        o.put("title", value(c, MediaStore.MediaColumns.TITLE));
        o.put("artist", kind.equals("audio") ? value(c, MediaStore.Audio.Media.ARTIST) : "");
        o.put("album", kind.equals("audio") ? value(c, MediaStore.Audio.Media.ALBUM) : "");
        o.put("duration", longValue(c, kind.equals("audio") ? MediaStore.Audio.Media.DURATION : MediaStore.Video.Media.DURATION));
        o.put("size", longValue(c, MediaStore.MediaColumns.SIZE));
        o.put("mimeType", value(c, MediaStore.MediaColumns.MIME_TYPE));
        o.put("dateAdded", longValue(c, MediaStore.MediaColumns.DATE_ADDED) * 1000L);
        if (kind.equals("audio")) {
          long albumId = longValue(c, MediaStore.Audio.Media.ALBUM_ID);
          if (albumId > 0) o.put("artwork", "content://media/external/audio/albumart/" + albumId);
        }
        items.put(o);
      }
    } catch (Exception e) {
      call.reject("MediaStore scan failed", e);
      return;
    }
    JSObject out = new JSObject();
    out.put("items", items);
    call.resolve(out);
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
    AudenicPlaybackService.command(getContext(), command, call.getString("uri"), call.getString("title"), call.getString("artist"));
    call.resolve();
  }

  private String value(Cursor c, String col) {
    int i = c.getColumnIndex(col); return i >= 0 && !c.isNull(i) ? c.getString(i) : "";
  }
  private long longValue(Cursor c, String col) {
    int i = c.getColumnIndex(col); return i >= 0 && !c.isNull(i) ? c.getLong(i) : 0L;
  }
}
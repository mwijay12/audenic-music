package fm.audenic.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@CapacitorPlugin(
    name = "MediaScanner",
    permissions = {
        @Permission(
            alias = "readAudio",
            strings = { Manifest.permission.READ_MEDIA_AUDIO }
        ),
        @Permission(
            alias = "readStorage",
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE }
        )
    }
)
public class MediaScannerPlugin extends Plugin {
    private static final String TAG = "MediaScannerPlugin";
    private File artCacheDir;

    @Override
    public void load() {
        super.load();
        artCacheDir = new File(getContext().getCacheDir(), "aud_art");
        if (!artCacheDir.exists()) {
            artCacheDir.mkdirs();
        }
        Log.d(TAG, "MediaScannerPlugin initialized. Art cache dir: " + artCacheDir.getAbsolutePath());
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("sdkVersion", Build.VERSION.SDK_INT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            result.put("needed", "READ_MEDIA_AUDIO");
            boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED;
            result.put("READ_MEDIA_AUDIO", granted);
            result.put("granted", granted);
        } else {
            result.put("needed", "READ_EXTERNAL_STORAGE");
            boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
            result.put("READ_EXTERNAL_STORAGE", granted);
            result.put("granted", granted);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void triggerMediaScan(PluginCall call) {
        String path = call.getString("path", Environment.getExternalStorageDirectory().getAbsolutePath());
        try {
            Intent intent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
            intent.setData(Uri.fromFile(new File(path)));
            getContext().sendBroadcast(intent);
            Log.d(TAG, "Triggered media scanner broadcast for path: " + path);
            JSObject r = new JSObject();
            r.put("triggered", true);
            call.resolve(r);
        } catch (Exception e) {
            Log.e(TAG, "Failed to trigger media scan: " + e.getMessage(), e);
            call.reject("SCAN_TRIGGER_FAILED", e.getMessage(), e);
        }
    }

    @PluginMethod
    public void scanAudio(PluginCall call) {
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
            call.reject("PERMISSION_DENIED", "Media storage permission was not granted by user");
        }
    }

    private void doScan(PluginCall call) {
        try {
            Log.d(TAG, "doScan started on SDK " + Build.VERSION.SDK_INT);
            ContentResolver resolver = getContext().getContentResolver();
            Uri audioUri;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                audioUri = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
            } else {
                audioUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            }

            String[] projection = {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.ALBUM_ID,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.DATA,
                MediaStore.Audio.Media.SIZE,
                MediaStore.Audio.Media.DATE_ADDED,
                MediaStore.Audio.Media.MIME_TYPE,
                MediaStore.Audio.Media.DISPLAY_NAME,
                MediaStore.Audio.Media.TRACK
            };

            String selection = MediaStore.Audio.Media.DURATION + " >= 10000";

            Cursor cursor = resolver.query(
                audioUri,
                projection,
                selection,
                null,
                MediaStore.Audio.Media.DATE_ADDED + " DESC"
            );

            int count = cursor != null ? cursor.getCount() : -1;
            Log.d(TAG, "EXTERNAL MediaStore count: " + count);

            if (count <= 0) {
                if (cursor != null) cursor.close();
                cursor = resolver.query(
                    MediaStore.Audio.Media.INTERNAL_CONTENT_URI,
                    projection,
                    selection,
                    null,
                    MediaStore.Audio.Media.DATE_ADDED + " DESC"
                );
                Log.d(TAG, "INTERNAL MediaStore count: " + (cursor != null ? cursor.getCount() : -1));
            }

            if (cursor == null || cursor.getCount() == 0) {
                if (cursor != null) cursor.close();
                Log.d(TAG, "MediaStore query empty, executing filesystem walk fallback");
                JSArray walkedTracks = walkFilesystem();
                JSObject r = new JSObject();
                r.put("tracks", walkedTracks);
                r.put("total", walkedTracks.length());
                r.put("source", "filesystem");
                call.resolve(r);
                return;
            }

            JSArray tracksArray = new JSArray();

            int colId = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
            int colTitle = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
            int colArtist = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
            int colAlbum = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
            int colAlbumId = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID);
            int colDuration = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
            int colData = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA);
            int colSize = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);
            int colDateAdded = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED);
            int colMime = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE);
            int colDisplayName = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
            int colTrack = cursor.getColumnIndex(MediaStore.Audio.Media.TRACK);

            while (cursor.moveToNext()) {
                try {
                    long id = cursor.getLong(colId);
                    String msTitle = cursor.getString(colTitle);
                    String msArtist = cursor.getString(colArtist);
                    String msAlbum = cursor.getString(colAlbum);
                    long albumId = cursor.getLong(colAlbumId);
                    long duration = cursor.getLong(colDuration);
                    String filePath = cursor.getString(colData);
                    long size = cursor.getLong(colSize);
                    long dateAdded = cursor.getLong(colDateAdded);
                    String mimeType = cursor.getString(colMime);
                    String displayName = cursor.getString(colDisplayName);

                    Uri contentUri = ContentUris.withAppendedId(audioUri, id);

                    String title = isValid(msTitle) ? msTitle : null;
                    String artist = isValid(msArtist) ? msArtist : null;
                    String album = isValid(msAlbum) ? msAlbum : null;

                    // Extract and cache local cover art JPEG for WebView and MediaSession
                    String artUri = getTrackArt(resolver, id, albumId, filePath, contentUri);
                    // Also resolve the raw file path for the art (for direct native loading)
                    String artFilePath = "";
                    if (artUri != null && artUri.startsWith("file://")) {
                        artFilePath = artUri.substring(7);
                    }

                    // Extract additional metadata: genre, year, bitrate, track number
                    String genre = "";
                    String year = "";
                    int bitrate = 0;
                    int trackNumber = (colTrack >= 0 && !cursor.isNull(colTrack)) ? cursor.getInt(colTrack) : 0;

                    // MediaMetadataRetriever fallback for missing text metadata + extra fields
                    if (filePath != null) {
                        MediaMetadataRetriever mmr = new MediaMetadataRetriever();
                        try {
                            mmr.setDataSource(filePath);
                            if (title == null) {
                                String t = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
                                title = isValid(t) ? t : null;
                            }
                            if (artist == null) {
                                String a = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST);
                                if (!isValid(a)) {
                                    a = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST);
                                }
                                artist = isValid(a) ? a : null;
                            }
                            if (album == null) {
                                String al = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);
                                album = isValid(al) ? al : null;
                            }
                            // Genre
                            String g = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_GENRE);
                            if (isValid(g)) genre = g;
                            // Year
                            String y = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR);
                            if (isValid(y)) year = y;
                            // Bitrate
                            String b = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE);
                            if (b != null) {
                                try { bitrate = Integer.parseInt(b); } catch (Exception ignored) {}
                            }
                        } catch (Exception mmrEx) {
                            Log.w(TAG, "MMR metadata fallback failed for " + filePath + ": " + mmrEx.getMessage());
                        } finally {
                            try {
                                mmr.release();
                            } catch (Exception ignored) {}
                        }
                    }

                    if (title == null) title = cleanFilename(displayName);
                    if (artist == null) artist = "Unknown Artist";
                    if (album == null) album = "Unknown Album";

                    JSObject track = new JSObject();
                    track.put("id", String.valueOf(id));
                    track.put("title", title);
                    track.put("artist", artist);
                    track.put("album", album);
                    track.put("duration", duration);
                    track.put("path", filePath != null ? filePath : "");
                    track.put("contentUri", contentUri.toString());
                    track.put("albumArt", artUri != null ? artUri : "");
                    track.put("albumArtFilePath", artFilePath);
                    track.put("size", size);
                    track.put("dateAdded", dateAdded);
                    track.put("mimeType", mimeType != null ? mimeType : "audio/mpeg");
                    track.put("genre", genre);
                    track.put("year", year);
                    track.put("bitrate", bitrate);
                    track.put("trackNumber", trackNumber);

                    tracksArray.put(track);
                    Log.d(TAG, "Scanned track: " + title + " | Art: " + artUri);
                } catch (Exception rowEx) {
                    Log.w(TAG, "Skipping bad cursor row: " + rowEx.getMessage());
                }
            }

            cursor.close();
            Log.d(TAG, "Scan complete. Total tracks: " + tracksArray.length());

            JSObject result = new JSObject();
            result.put("tracks", tracksArray);
            result.put("total", tracksArray.length());
            result.put("source", "mediastore");
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "doScan failed: " + e.getMessage(), e);
            call.reject("SCAN_FAILED", e.getMessage(), e);
        }
    }

    private String getTrackArt(ContentResolver resolver, long id, long albumId, String filePath, Uri contentUri) {
        String cacheKey = (albumId > 0) ? "alb_" + albumId : "tr_" + id;
        File artFile = new File(artCacheDir, "art_" + cacheKey + ".jpg");
        if (artFile.exists() && artFile.length() > 0) {
            return "file://" + artFile.getAbsolutePath();
        }

        // 1. Try Android 10+ (API 29+) ContentResolver.loadThumbnail
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && contentUri != null) {
            try {
                Bitmap thumbnail = resolver.loadThumbnail(contentUri, new android.util.Size(512, 512), null);
                if (thumbnail != null) {
                    String cached = saveBitmapToCache(thumbnail, cacheKey);
                    if (cached != null) return "file://" + cached;
                }
            } catch (Exception ignored) {}
        }

        // 2. Try embedded ID3 picture
        if (filePath != null && !filePath.isEmpty()) {
            MediaMetadataRetriever mmr = new MediaMetadataRetriever();
            try {
                mmr.setDataSource(filePath);
                byte[] artBytes = mmr.getEmbeddedPicture();
                if (artBytes != null && artBytes.length > 0) {
                    String cached = saveArtToCache(artBytes, cacheKey);
                    if (cached != null) return "file://" + cached;
                }
            } catch (Exception ignored) {
            } finally {
                try {
                    mmr.release();
                } catch (Exception ignored) {}
            }
        }

        // 2. Try MediaStore albumart ContentResolver fallback
        if (albumId > 0) {
            try {
                Uri base = Uri.parse("content://media/external/audio/albumart");
                Uri artCandidate = ContentUris.withAppendedId(base, albumId);
                ParcelFileDescriptor pfd = resolver.openFileDescriptor(artCandidate, "r");
                if (pfd != null) {
                    Bitmap bmp = BitmapFactory.decodeFileDescriptor(pfd.getFileDescriptor());
                    pfd.close();
                    if (bmp != null) {
                        String cached = saveBitmapToCache(bmp, cacheKey);
                        if (cached != null) return "file://" + cached;
                    }
                }
            } catch (Exception ignored) {}
        }

        return null;
    }

    private JSArray walkFilesystem() {
        JSArray results = new JSArray();

        List<String> searchDirs = Arrays.asList(
            "/storage/emulated/0/Music",
            "/storage/emulated/0/Download",
            "/storage/emulated/0/Downloads",
            "/storage/emulated/0/snaptube/download/SnapTube Audio",
            "/storage/emulated/0/Telegram",
            "/storage/emulated/0/WhatsApp/Media/WhatsApp Audio",
            Environment.getExternalStorageDirectory().getAbsolutePath() + "/Music"
        );

        List<String> audioExtensions = Arrays.asList(
            ".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".opus", ".wma"
        );

        for (String dirPath : searchDirs) {
            File dir = new File(dirPath);
            if (!dir.exists() || !dir.isDirectory()) continue;

            File[] files = dir.listFiles();
            if (files == null) continue;

            for (File file : files) {
                if (!file.isFile()) continue;
                String name = file.getName().toLowerCase();
                boolean isAudio = false;
                for (String ext : audioExtensions) {
                    if (name.endsWith(ext)) {
                        isAudio = true;
                        break;
                    }
                }
                if (!isAudio) continue;

                String title = cleanFilename(file.getName());
                String artist = "Unknown Artist";
                String album = "Unknown Album";
                String artUri = null;
                long duration = 0;

                MediaMetadataRetriever mmr = new MediaMetadataRetriever();
                try {
                    mmr.setDataSource(file.getAbsolutePath());
                    String t = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
                    if (isValid(t)) title = t;
                    String a = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST);
                    if (isValid(a)) artist = a;
                    String al = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);
                    if (isValid(al)) album = al;
                    String d = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
                    if (d != null) {
                        try {
                            duration = Long.parseLong(d);
                        } catch (Exception ignored) {}
                    }
                    byte[] art = mmr.getEmbeddedPicture();
                    if (art != null && art.length > 0) {
                        String cached = saveArtToCache(art, String.valueOf(file.getName().hashCode()));
                        if (cached != null) artUri = "file://" + cached;
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Filesystem MMR failed for " + file.getName() + ": " + e.getMessage());
                } finally {
                    try {
                        mmr.release();
                    } catch (Exception ignored) {}
                }

                JSObject track = new JSObject();
                track.put("id", String.valueOf(file.hashCode()));
                track.put("title", title);
                track.put("artist", artist);
                track.put("album", album);
                track.put("duration", duration);
                track.put("path", file.getAbsolutePath());
                track.put("contentUri", "file://" + file.getAbsolutePath());
                track.put("albumArt", artUri != null ? artUri : "");
                track.put("size", file.length());
                track.put("dateAdded", file.lastModified() / 1000);
                track.put("mimeType", getMimeType(file.getName()));

                results.put(track);
                Log.d(TAG, "Filesystem walk found track: " + title);
            }
        }

        Log.d(TAG, "Filesystem walk total found: " + results.length());
        return results;
    }

    private boolean isValid(String value) {
        if (value == null || value.trim().isEmpty()) return false;
        String v = value.trim();
        if (v.equalsIgnoreCase("<unknown>") || v.equalsIgnoreCase("unknown")) return false;
        if (v.startsWith("/storage/")) return false;
        return true;
    }

    private String saveArtToCache(byte[] artBytes, String key) {
        if (artCacheDir == null) return null;
        File artFile = new File(artCacheDir, "art_" + key + ".jpg");
        if (artFile.exists() && artFile.length() > 0) {
            return artFile.getAbsolutePath();
        }
        try {
            Bitmap bmp = BitmapFactory.decodeByteArray(artBytes, 0, artBytes.length);
            if (bmp == null) return null;
            return saveBitmapToCache(bmp, key);
        } catch (Exception e) {
            Log.w(TAG, "Failed to save art to cache: " + e.getMessage());
            return null;
        }
    }

    private String saveBitmapToCache(Bitmap bmp, String key) {
        if (artCacheDir == null || bmp == null) return null;
        File artFile = new File(artCacheDir, "art_" + key + ".jpg");
        try {
            int w = bmp.getWidth();
            int h = bmp.getHeight();
            if (w > 512 || h > 512) {
                float scale = Math.min(512f / w, 512f / h);
                bmp = Bitmap.createScaledBitmap(bmp, (int)(w * scale), (int)(h * scale), true);
            }

            FileOutputStream fos = new FileOutputStream(artFile);
            bmp.compress(Bitmap.CompressFormat.JPEG, 90, fos);
            fos.flush();
            fos.close();
            return artFile.getAbsolutePath();
        } catch (IOException e) {
            Log.w(TAG, "Failed to save bitmap: " + e.getMessage());
            return null;
        }
    }

    private String cleanFilename(String raw) {
        if (raw == null || raw.trim().isEmpty()) return "Unknown Track";
        String cleaned = raw.replaceAll("\\.[^.]+$", "");
        cleaned = cleaned.replaceAll("[_\\-]+", " ");
        cleaned = cleaned.replaceAll("^\\d+[.\\s]+", "");
        cleaned = cleaned.trim();
        return cleaned.isEmpty() ? "Unknown Track" : cleaned;
    }

    private String getMimeType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".flac")) return "audio/flac";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".aac")) return "audio/aac";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        if (lower.endsWith(".m4a")) return "audio/mp4";
        if (lower.endsWith(".opus")) return "audio/opus";
        return "audio/mpeg";
    }

    @PluginMethod
    public void clearArtCache(PluginCall call) {
        int count = 0;
        if (artCacheDir != null && artCacheDir.exists()) {
            File[] files = artCacheDir.listFiles();
            if (files != null) {
                for (File f : files) {
                    if (f.delete()) count++;
                }
            }
        }
        JSObject r = new JSObject();
        r.put("cleared", true);
        r.put("deletedFiles", count);
        call.resolve(r);
    }
}

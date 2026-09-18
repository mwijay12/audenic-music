package fm.audenic.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
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

@CapacitorPlugin(
    name = "VideoScanner",
    permissions = {
        @Permission(
            alias = "readVideo",
            strings = { Manifest.permission.READ_MEDIA_VIDEO }
        ),
        @Permission(
            alias = "readStorage",
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE }
        )
    }
)
public class VideoScannerPlugin extends Plugin {
    private static final String TAG = "VideoScannerPlugin";
    private File thumbCacheDir;

    @Override
    public void load() {
        super.load();
        thumbCacheDir = new File(getContext().getCacheDir(), "audenic_video_thumbs");
        if (!thumbCacheDir.exists()) {
            thumbCacheDir.mkdirs();
        }
    }

    @PluginMethod
    public void scanVideos(PluginCall call) {
        boolean hasPermission;
        if (Build.VERSION.SDK_INT >= 33) {
            hasPermission = ContextCompat.checkSelfPermission(
                getContext(), Manifest.permission.READ_MEDIA_VIDEO
            ) == PackageManager.PERMISSION_GRANTED;
        } else {
            hasPermission = ContextCompat.checkSelfPermission(
                getContext(), Manifest.permission.READ_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED;
        }

        if (hasPermission) {
            doVideoScan(call);
        } else {
            if (Build.VERSION.SDK_INT >= 33) {
                requestPermissionForAlias("readVideo", call, "videoPermCallback");
            } else {
                requestPermissionForAlias("readStorage", call, "videoPermCallback");
            }
        }
    }

    @PermissionCallback
    private void videoPermCallback(PluginCall call) {
        boolean granted = (Build.VERSION.SDK_INT >= 33)
            ? getPermissionState("readVideo").toString().equalsIgnoreCase("granted")
            : getPermissionState("readStorage").toString().equalsIgnoreCase("granted");

        if (granted) doVideoScan(call);
        else call.reject("PERMISSION_DENIED", "Video permission required to scan videos.");
    }

    private void doVideoScan(PluginCall call) {
        try {
            ContentResolver resolver = getContext().getContentResolver();
            Uri videoUri = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                ? MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
                : MediaStore.Video.Media.EXTERNAL_CONTENT_URI;

            String[] projection = new String[] {
                MediaStore.Video.Media._ID,
                MediaStore.Video.Media.TITLE,
                MediaStore.Video.Media.DISPLAY_NAME,
                MediaStore.Video.Media.DURATION,
                MediaStore.Video.Media.SIZE,
                MediaStore.Video.Media.DATA,
                MediaStore.Video.Media.DATE_ADDED,
                MediaStore.Video.Media.WIDTH,
                MediaStore.Video.Media.HEIGHT,
                MediaStore.Video.Media.MIME_TYPE,
                MediaStore.Video.Media.BUCKET_DISPLAY_NAME
            };

            String selection = MediaStore.Video.Media.DURATION + " > 5000 AND " + MediaStore.Video.Media.SIZE + " > 512000";
            String sortOrder = MediaStore.Video.Media.DATE_ADDED + " DESC";

            Cursor cursor = resolver.query(videoUri, projection, selection, null, sortOrder);
            JSArray videosArray = new JSArray();

            if (cursor != null) {
                int colId = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID);
                int colTitle = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.TITLE);
                int colDisplayName = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME);
                int colDuration = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION);
                int colSize = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE);
                int colData = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DATA);
                int colDateAdded = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DATE_ADDED);
                int colWidth = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.WIDTH);
                int colHeight = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.HEIGHT);
                int colMime = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.MIME_TYPE);
                int colBucket = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.BUCKET_DISPLAY_NAME);

                while (cursor.moveToNext()) {
                    try {
                        long id = cursor.getLong(colId);
                        String title = cursor.getString(colTitle);
                        String displayName = cursor.getString(colDisplayName);
                        long duration = cursor.getLong(colDuration);
                        long size = cursor.getLong(colSize);
                        String filePath = cursor.getString(colData);
                        long dateAdded = cursor.getLong(colDateAdded);
                        int width = cursor.getInt(colWidth);
                        int height = cursor.getInt(colHeight);
                        String mimeType = cursor.getString(colMime);
                        String bucket = cursor.getString(colBucket);

                        Uri contentUri = ContentUris.withAppendedId(videoUri, id);
                        if (title == null || title.trim().isEmpty()) {
                            title = cleanVideoTitle(displayName);
                        }

                        String thumbPath = extractVideoThumbnail(filePath, id);
                        double aspectRatio = (height > 0) ? (double) width / height : 1.78;
                        long durationSecs = duration / 1000;
                        long bitrate = (durationSecs > 0) ? (size * 8) / durationSecs : 0;

                        JSObject video = new JSObject();
                        video.put("id", "vid-" + id);
                        video.put("title", title);
                        video.put("displayName", displayName != null ? displayName : "");
                        video.put("duration", duration);
                        video.put("size", size);
                        video.put("path", filePath != null ? filePath : "");
                        video.put("contentUri", contentUri.toString());
                        video.put("thumbnail", thumbPath != null ? "file://" + thumbPath : "");
                        video.put("dateAdded", dateAdded);
                        video.put("width", width);
                        video.put("height", height);
                        video.put("aspectRatio", aspectRatio);
                        video.put("mimeType", mimeType != null ? mimeType : "video/mp4");
                        video.put("bucket", bucket != null ? bucket : "");
                        video.put("bitrate", bitrate);

                        videosArray.put(video);
                    } catch (Exception rowEx) {
                        Log.w(TAG, "Skipped video row: " + rowEx.getMessage());
                    }
                }
                cursor.close();
            }

            JSObject result = new JSObject();
            result.put("videos", videosArray);
            result.put("total", videosArray.length());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("SCAN_FAILED", "Video scan error: " + e.getMessage());
        }
    }

    private String extractVideoThumbnail(String filePath, long videoId) {
        if (filePath == null || filePath.isEmpty()) return null;
        File thumbFile = new File(thumbCacheDir, "thumb_" + videoId + ".jpg");
        if (thumbFile.exists() && thumbFile.length() > 0) return thumbFile.getAbsolutePath();

        MediaMetadataRetriever mmr = new MediaMetadataRetriever();
        try {
            mmr.setDataSource(filePath);
            Bitmap frame = mmr.getFrameAtTime(1_000_000, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            if (frame == null) frame = mmr.getFrameAtTime(0);

            if (frame != null) {
                Bitmap scaled = Bitmap.createScaledBitmap(frame, 320, 180, true);
                frame.recycle();

                FileOutputStream fos = new FileOutputStream(thumbFile);
                scaled.compress(Bitmap.CompressFormat.JPEG, 80, fos);
                fos.flush();
                fos.close();
                scaled.recycle();
                return thumbFile.getAbsolutePath();
            }
        } catch (Exception e) {
            Log.w(TAG, "Thumbnail failed for id=" + videoId + ": " + e.getMessage());
        } finally {
            try { mmr.release(); } catch (Exception ignored) {}
        }
        return null;
    }

    private String cleanVideoTitle(String displayName) {
        if (displayName == null || displayName.isEmpty()) return "Unknown Video";
        String name = displayName.replaceAll("\\.[^.]+$", "").replaceAll("[_\\-]+", " ").replaceAll("^\\d+[.\\s]+", "");
        return name.trim().isEmpty() ? "Unknown Video" : name.trim();
    }

    @PluginMethod
    public void clearThumbCache(PluginCall call) {
        if (thumbCacheDir != null && thumbCacheDir.exists()) {
            File[] files = thumbCacheDir.listFiles();
            if (files != null) {
                for (File f : files) f.delete();
            }
        }
        JSObject r = new JSObject();
        r.put("cleared", true);
        call.resolve(r);
    }
}

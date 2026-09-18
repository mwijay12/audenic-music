package fm.audenic.app;

import com.audenic.app.R;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.net.Uri;
import android.os.Binder;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;

import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AudenicPlaybackService extends Service {
    public static final String TAG = "AudenicPlayback";
    public static final String CHANNEL_ID = "audenic_playback_ch";
    public static final int NOTIFICATION_ID = 2001;

    public static final String ACTION_PLAY = "fm.audenic.app.ACTION_PLAY";
    public static final String ACTION_PAUSE = "fm.audenic.app.ACTION_PAUSE";
    public static final String ACTION_NEXT = "fm.audenic.app.ACTION_NEXT";
    public static final String ACTION_PREV = "fm.audenic.app.ACTION_PREV";
    public static final String ACTION_STOP = "fm.audenic.app.ACTION_STOP";
    public static final String ACTION_LIKE = "fm.audenic.app.ACTION_LIKE";

    private static AudenicPlaybackService instance;

    public static class TrackData {
        public String id;
        public String title;
        public String artist;
        public String album;
        public String src;
        public String cover;
        public long duration;

        public TrackData(String id, String title, String artist, String album, String src, String cover, long duration) {
            this.id = id != null ? id : "";
            this.title = title != null ? title : "Unknown Track";
            this.artist = artist != null ? artist : "Unknown Artist";
            this.album = album != null ? album : "Unknown Album";
            this.src = src != null ? src : "";
            this.cover = cover != null ? cover : "";
            this.duration = duration;
        }
    }

    public interface PlaybackEventListener {
        void onTrackChanged(int index, TrackData track);
        void onPlaybackStateChanged(boolean isPlaying);
        void onProgressTick(long position, long duration);
        void onQueueEnded();
        void onError(String message);
    }

    public class LocalBinder extends Binder {
        public AudenicPlaybackService getService() {
            return AudenicPlaybackService.this;
        }
    }

    private final IBinder binder = new LocalBinder();
    private ExoPlayer player;
    private MediaSessionCompat mediaSession;
    private final List<TrackData> queue = new ArrayList<>();
    private int currentIndex = 0;
    private PlaybackEventListener eventListener;
    private Equalizer equalizer;
    private BassBoost bassBoostFx;
    private int activeAudioSessionId = -1;
    private boolean isCurrentLiked = false;

    private final ExecutorService artLoader = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable progressRunnable;
    private Bitmap currentCoverBitmap;

    private void runOnMainThread(Runnable runnable) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            runnable.run();
        } else {
            mainHandler.post(runnable);
        }
    }

    private boolean isJsPlaying = false;

    public static AudenicPlaybackService getInstance() {
        return instance;
    }

    public static void command(Context context, String cmd, String uri, String title, String artist, String coverUrl, long positionMs, long durationMs) {
        if (context == null) return;
        Intent intent = new Intent(context, AudenicPlaybackService.class);
        intent.putExtra("cmd", cmd);
        intent.putExtra("uri", uri);
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("coverUrl", coverUrl);
        intent.putExtra("positionMs", positionMs);
        intent.putExtra("durationMs", durationMs);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void updateNotificationState(Context context, String title, String artist, String coverUrl, boolean isPlaying, long positionMs, long durationMs) {
        updateNotificationState(context, title, artist, coverUrl, isPlaying, positionMs, durationMs, false);
    }

    public static void updateNotificationState(Context context, String title, String artist, String coverUrl, boolean isPlaying, long positionMs, long durationMs, boolean isLiked) {
        if (context == null) return;
        Intent intent = new Intent(context, AudenicPlaybackService.class);
        intent.putExtra("cmd", "updateState");
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("coverUrl", coverUrl);
        intent.putExtra("isPlaying", isPlaying);
        intent.putExtra("positionMs", positionMs);
        intent.putExtra("durationMs", durationMs);
        intent.putExtra("isLiked", isLiked);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start service for updateNotificationState: " + e.getMessage());
        }
    }

    public static void loadQueueNative(Context context, ArrayList<String> ids, ArrayList<String> uris, ArrayList<String> titles, ArrayList<String> artists, ArrayList<String> covers, int startIndex, long startPosMs) {
        if (context == null || ids == null || uris == null) return;
        List<TrackData> tracks = new ArrayList<>();
        for (int i = 0; i < ids.size(); i++) {
            String id = i < ids.size() ? ids.get(i) : String.valueOf(i);
            String uri = i < uris.size() ? uris.get(i) : "";
            String title = (titles != null && i < titles.size()) ? titles.get(i) : "Unknown Track";
            String artist = (artists != null && i < artists.size()) ? artists.get(i) : "Unknown Artist";
            String cover = (covers != null && i < covers.size()) ? covers.get(i) : "";
            tracks.add(new TrackData(id, title, artist, "Audenic Music", uri, cover, 0));
        }

        AudenicPlaybackService svc = getInstance();
        if (svc != null) {
            svc.setQueue(tracks, startIndex);
            if (startPosMs > 0) {
                svc.seekTo(startPosMs);
            }
        } else {
            Intent intent = new Intent(context, AudenicPlaybackService.class);
            intent.putExtra("cmd", "loadQueue");
            intent.putExtra("startIndex", startIndex);
            intent.putExtra("startPosMs", startPosMs);
            intent.putStringArrayListExtra("ids", ids);
            intent.putStringArrayListExtra("uris", uris);
            intent.putStringArrayListExtra("titles", titles);
            intent.putStringArrayListExtra("artists", artists);
            intent.putStringArrayListExtra("covers", covers);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        runOnMainThread(() -> {
            createNotificationChannel();
            initExoPlayer();
            initMediaSession();
            initProgressTicker();
            Log.d(TAG, "AudenicPlaybackService created");
        });
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (Intent.ACTION_MEDIA_BUTTON.equals(action)) {
                if (mediaSession != null) {
                    androidx.media.session.MediaButtonReceiver.handleIntent(mediaSession, intent);
                }
            } else if (action != null) {
                handleAction(action);
            }

            String cmd = intent.getStringExtra("cmd");
            if (cmd != null) {
                handleCommandIntent(intent, cmd);
            }
        }
        return START_STICKY;
    }

    private void handleCommandIntent(Intent intent, String cmd) {
        runOnMainThread(() -> {
            switch (cmd) {
                case "play":
                    String uri = intent.getStringExtra("uri");
                    if (uri != null && !uri.isEmpty()) {
                        String title = intent.getStringExtra("title");
                        String artist = intent.getStringExtra("artist");
                        String coverUrl = intent.getStringExtra("coverUrl");
                        long pos = intent.getLongExtra("positionMs", 0L);
                        long dur = intent.getLongExtra("durationMs", 0L);

                        TrackData t = new TrackData("single", title, artist, "Audenic", uri, coverUrl, dur);
                        List<TrackData> singleQueue = new ArrayList<>();
                        singleQueue.add(t);
                        setQueue(singleQueue, 0);
                        if (pos > 0) seekTo(pos);
                    } else {
                        play();
                    }
                    break;
                case "pause":
                    pause();
                    break;
                case "next":
                    skipToNext();
                    break;
                case "prev":
                    skipToPrev();
                    break;
                case "like":
                    handleLikeAction();
                    break;
                case "updateLike":
                    isCurrentLiked = intent.getBooleanExtra("isLiked", false);
                    updateMediaSessionState(isPlaying());
                    updateNotification();
                    break;
                case "updateState":
                    String stTitle = intent.getStringExtra("title");
                    String stArtist = intent.getStringExtra("artist");
                    String stCover = intent.getStringExtra("coverUrl");
                    boolean stPlaying = intent.getBooleanExtra("isPlaying", true);
                    long stDur = intent.getLongExtra("durationMs", 0L);
                    if (intent.hasExtra("isLiked")) {
                        isCurrentLiked = intent.getBooleanExtra("isLiked", false);
                    }

                    isJsPlaying = stPlaying;
                    TrackData curTrack = getCurrentTrack();
                    if (curTrack == null) {
                        curTrack = new TrackData("single", stTitle != null ? stTitle : "Playing", stArtist != null ? stArtist : "Audenic", "Audenic Music", "", stCover != null ? stCover : "", stDur);
                        List<TrackData> singleQueue = new ArrayList<>();
                        singleQueue.add(curTrack);
                        queue.clear();
                        queue.addAll(singleQueue);
                        currentIndex = 0;
                    } else {
                        if (stTitle != null && !stTitle.isEmpty()) curTrack.title = stTitle;
                        if (stArtist != null && !stArtist.isEmpty()) curTrack.artist = stArtist;
                        if (stCover != null && !stCover.isEmpty()) curTrack.cover = stCover;
                        if (stDur > 0) curTrack.duration = stDur;
                    }

                    updateMediaSessionState(isPlaying());
                    loadCoverAndRefresh(curTrack);
                    break;
                case "stop":
                    pause();
                    stopForeground(true);
                    stopSelf();
                    break;
                case "updatePos":
                    long posMs = intent.getLongExtra("positionMs", 0L);
                    if (posMs > 0 && player != null) {
                        player.seekTo(posMs);
                    }
                    break;
                case "updateMeta":
                    TrackData current = getCurrentTrack();
                    if (current != null) {
                        String tTitle = intent.getStringExtra("title");
                        String tArtist = intent.getStringExtra("artist");
                        String tCover = intent.getStringExtra("coverUrl");
                        if (tTitle != null) current.title = tTitle;
                        if (tArtist != null) current.artist = tArtist;
                        if (tCover != null) current.cover = tCover;
                        loadCoverAndRefresh(current);
                    }
                    break;
                case "loadQueue":
                    ArrayList<String> ids = intent.getStringArrayListExtra("ids");
                    ArrayList<String> uris = intent.getStringArrayListExtra("uris");
                    ArrayList<String> titles = intent.getStringArrayListExtra("titles");
                    ArrayList<String> artists = intent.getStringArrayListExtra("artists");
                    ArrayList<String> covers = intent.getStringArrayListExtra("covers");
                    int startIndex = intent.getIntExtra("startIndex", 0);
                    long startPosMs = intent.getLongExtra("startPosMs", 0L);

                    if (ids != null && uris != null) {
                        List<TrackData> tracks = new ArrayList<>();
                        for (int i = 0; i < ids.size(); i++) {
                            String id = ids.get(i);
                            String tUri = i < uris.size() ? uris.get(i) : "";
                            String title = (titles != null && i < titles.size()) ? titles.get(i) : "Unknown Track";
                            String artist = (artists != null && i < artists.size()) ? artists.get(i) : "Unknown Artist";
                            String cover = (covers != null && i < covers.size()) ? covers.get(i) : "";
                            tracks.add(new TrackData(id, title, artist, "Audenic Music", tUri, cover, 0));
                        }
                        setQueue(tracks, startIndex);
                        if (startPosMs > 0) seekTo(startPosMs);
                    }
                    break;
            }
        });
    }

    private void handleLikeAction() {
        runOnMainThread(() -> {
            isCurrentLiked = !isCurrentLiked;
            updateMediaSessionState(isPlaying());
            updateNotification();
            AudenicMediaPlugin.sendPlaybackEvent("like");
            Log.d(TAG, "Toggled like from lock screen card: " + isCurrentLiked);
        });
    }

    public void setNativeEq(int[] bandLevels, int bassBoost) {
        runOnMainThread(() -> {
            if (player == null) return;
            int audioSessionId = player.getAudioSessionId();
            if (audioSessionId == 0) return;
            try {
                if (bandLevels != null && bandLevels.length > 0) {
                    if (equalizer == null || activeAudioSessionId != audioSessionId) {
                        if (equalizer != null) {
                            equalizer.release();
                            equalizer = null;
                        }
                        equalizer = new Equalizer(0, audioSessionId);
                        equalizer.setEnabled(true);
                    }
                    short numBands = equalizer.getNumberOfBands();
                    for (int i = 0; i < Math.min(bandLevels.length, numBands); i++) {
                        equalizer.setBandLevel((short) i, (short) bandLevels[i]);
                    }
                }
                if (bassBoost > 0) {
                    if (bassBoostFx == null || activeAudioSessionId != audioSessionId) {
                        if (bassBoostFx != null) {
                            bassBoostFx.release();
                            bassBoostFx = null;
                        }
                        bassBoostFx = new BassBoost(0, audioSessionId);
                        bassBoostFx.setEnabled(true);
                    }
                    bassBoostFx.setStrength((short) bassBoost);
                }
                activeAudioSessionId = audioSessionId;
            } catch (Exception e) {
                Log.w(TAG, "Error setting native EQ: " + e.getMessage());
            }
        });
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        runOnMainThread(() -> {
            if (mainHandler != null && progressRunnable != null) {
                mainHandler.removeCallbacks(progressRunnable);
            }
            if (equalizer != null) {
                equalizer.release();
                equalizer = null;
            }
            if (bassBoostFx != null) {
                bassBoostFx.release();
                bassBoostFx = null;
            }
            if (player != null) {
                player.release();
                player = null;
            }
            if (mediaSession != null) {
                mediaSession.setActive(false);
                mediaSession.release();
                mediaSession = null;
            }
            instance = null;
            Log.d(TAG, "AudenicPlaybackService destroyed");
        });
        super.onDestroy();
    }

    private void initExoPlayer() {
        player = new ExoPlayer.Builder(this).build();
        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED) {
                    advanceToNext();
                } else if (state == Player.STATE_READY) {
                    // Capture accurate duration from ExoPlayer and update the track
                    long exoDuration = player.getDuration();
                    TrackData current = getCurrentTrack();
                    if (current != null && exoDuration > 0 && current.duration <= 0) {
                        current.duration = exoDuration;
                    }
                    updateMediaSessionState(player.isPlaying());
                    updateMediaSessionMetadata(current, currentCoverBitmap);
                    updateNotification();
                }
                Log.d(TAG, "ExoPlayer state changed: " + state);
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                isJsPlaying = isPlaying;
                updateMediaSessionState(isPlaying);
                updateNotification();
                if (eventListener != null) {
                    eventListener.onPlaybackStateChanged(isPlaying);
                }
                AudenicMediaPlugin.sendPlaybackEvent(isPlaying ? "play" : "pause");
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                Log.e(TAG, "ExoPlayer error: " + error.getMessage(), error);
                if (eventListener != null) {
                    eventListener.onError(error.getMessage() != null ? error.getMessage() : "Playback error");
                }
                // Do NOT call advanceToNext() on error to prevent infinite rapid skipping loops
            }
        });
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "AudenicSession");
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                play();
            }

            @Override
            public void onPause() {
                pause();
            }

            @Override
            public void onSkipToNext() {
                skipToNext();
            }

            @Override
            public void onSkipToPrevious() {
                skipToPrev();
            }

            @Override
            public void onSeekTo(long pos) {
                seekTo(pos);
            }

            @Override
            public void onCustomAction(String action, Bundle extras) {
                if (ACTION_LIKE.equals(action)) {
                    handleLikeAction();
                }
            }

            @Override
            public void onStop() {
                pause();
                stopForeground(true);
                stopSelf();
            }
        });
        mediaSession.setActive(true);
        Log.d(TAG, "MediaSession active");
    }

    private void initProgressTicker() {
        progressRunnable = new Runnable() {
            @Override
            public void run() {
                if (player != null && player.isPlaying()) {
                    long position = player.getCurrentPosition();
                    long duration = player.getDuration();
                    if (duration > 0) {
                        if (eventListener != null) {
                            eventListener.onProgressTick(position, duration);
                        }
                        AudenicMediaPlugin.sendProgressEvent(position, duration);
                    }
                }
                mainHandler.postDelayed(this, 1000);
            }
        };
        mainHandler.post(progressRunnable);
    }

    public void advanceToNext() {
        runOnMainThread(() -> {
            int next = currentIndex + 1;
            if (next < queue.size()) {
                currentIndex = next;
                playTrackAtIndex(currentIndex);
            } else {
                if (player != null) {
                    player.stop();
                }
                if (eventListener != null) {
                    eventListener.onQueueEnded();
                }
                updateNotification();
            }
        });
    }

    public void setQueue(List<TrackData> tracks, int startIndex) {
        runOnMainThread(() -> {
            queue.clear();
            if (tracks != null) {
                queue.addAll(tracks);
            }
            currentIndex = Math.max(0, Math.min(startIndex, queue.isEmpty() ? 0 : queue.size() - 1));
            if (!queue.isEmpty()) {
                playTrackAtIndex(currentIndex);
            }
            Log.d(TAG, "Queue set with " + queue.size() + " tracks, starting at " + currentIndex);
        });
    }

    private Uri parsePlayableUri(String rawSrc) {
        if (rawSrc == null || rawSrc.isEmpty()) return null;
        try {
            if (rawSrc.startsWith("http://localhost/_capacitor_file_") || rawSrc.startsWith("https://localhost/_capacitor_file_")) {
                String prefix = rawSrc.startsWith("https") ? "https://localhost/_capacitor_file_" : "http://localhost/_capacitor_file_";
                String path = Uri.decode(rawSrc.substring(prefix.length()));
                while (path.startsWith("//")) path = path.substring(1);
                File file = new File(path);
                if (file.exists()) {
                    return Uri.fromFile(file);
                }
                return Uri.parse(path.startsWith("/") ? "file://" + path : "file:///" + path);
            }
            if (rawSrc.startsWith("http://localhost/_capacitor_content_") || rawSrc.startsWith("https://localhost/_capacitor_content_")) {
                String prefix = rawSrc.startsWith("https") ? "https://localhost/_capacitor_content_" : "http://localhost/_capacitor_content_";
                String contentPath = Uri.decode(rawSrc.substring(prefix.length()));
                while (contentPath.startsWith("/")) contentPath = contentPath.substring(1);
                return Uri.parse("content://" + contentPath);
            }
            if (rawSrc.startsWith("content://")) {
                return Uri.parse(rawSrc);
            }
            if (rawSrc.startsWith("file://")) {
                return Uri.parse(rawSrc);
            }
            if (rawSrc.startsWith("/storage/") || rawSrc.startsWith("/sdcard/")) {
                return Uri.fromFile(new File(rawSrc));
            }
            return Uri.parse(rawSrc);
        } catch (Exception e) {
            Log.w(TAG, "Failed to parse playable URI for " + rawSrc + ": " + e.getMessage());
            return Uri.parse(rawSrc);
        }
    }

    public void playTrackAtIndex(int index) {
        runOnMainThread(() -> {
            if (index < 0 || index >= queue.size()) {
                Log.w(TAG, "Invalid track index: " + index);
                return;
            }
            currentIndex = index;
            TrackData track = queue.get(currentIndex);
            Log.d(TAG, "Playing track: " + track.title + " | src: " + track.src);

            if (player != null && track.src != null && !track.src.isEmpty()) {
                Uri playUri = parsePlayableUri(track.src);
                Log.d(TAG, "ExoPlayer playing resolved URI: " + playUri);
                if (playUri != null) {
                    MediaItem item = MediaItem.fromUri(playUri);
                    player.setMediaItem(item);
                    player.prepare();
                    player.play();
                    loadCoverAndRefresh(track);
                    if (eventListener != null) {
                        eventListener.onTrackChanged(currentIndex, track);
                    }
                    AudenicMediaPlugin.sendTrackChangedEvent(track.id, currentIndex);
                }
            }
        });
    }

    private Bitmap createFallbackBitmap(String title) {
        try {
            int size = 512;
            Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);

            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            LinearGradient gradient = new LinearGradient(
                    0, 0, size, size,
                    0xFF3A0B5B, 0xFFC8F249,
                    Shader.TileMode.CLAMP
            );
            paint.setShader(gradient);
            canvas.drawRect(0, 0, size, size, paint);

            Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            textPaint.setColor(Color.WHITE);
            textPaint.setTextSize(180);
            textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            textPaint.setTextAlign(Paint.Align.CENTER);

            String initial = (title != null && !title.trim().isEmpty())
                    ? title.trim().substring(0, 1).toUpperCase()
                    : "♪";

            Paint.FontMetrics fm = textPaint.getFontMetrics();
            float y = (size / 2f) - ((fm.descent + fm.ascent) / 2f);
            canvas.drawText(initial, size / 2f, y, textPaint);

            return bitmap;
        } catch (Exception e) {
            Log.w(TAG, "Failed to create fallback bitmap: " + e.getMessage());
            return null;
        }
    }

    private void loadCoverAndRefresh(TrackData track) {
        Bitmap fallback = createFallbackBitmap(track.title);
        currentCoverBitmap = fallback;
        updateMediaSessionMetadata(track, fallback);
        updateNotificationWithBitmap(track, fallback);

        if (track.cover != null && !track.cover.isEmpty() && !track.cover.startsWith("data:image/svg")) {
            loadCoverBitmap(track.cover, (bitmap) -> {
                if (bitmap != null) {
                    currentCoverBitmap = bitmap;
                    updateMediaSessionMetadata(track, bitmap);
                    updateNotificationWithBitmap(track, bitmap);
                }
            });
        }
    }

    private void loadCoverBitmap(String coverPathOrUrl, BitmapCallback callback) {
        artLoader.execute(() -> {
            Bitmap bitmap = null;
            try {
                if (coverPathOrUrl.startsWith("file://")) {
                    String localPath = coverPathOrUrl.substring(7);
                    bitmap = BitmapFactory.decodeFile(localPath);
                } else if (coverPathOrUrl.startsWith("content://")) {
                    Uri uri = Uri.parse(coverPathOrUrl);
                    InputStream is = getContentResolver().openInputStream(uri);
                    bitmap = BitmapFactory.decodeStream(is);
                    if (is != null) is.close();
                } else if (coverPathOrUrl.startsWith("http://") || coverPathOrUrl.startsWith("https://")) {
                    URL url = new URL(coverPathOrUrl);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(4000);
                    conn.setReadTimeout(4000);
                    conn.connect();
                    InputStream is = conn.getInputStream();
                    bitmap = BitmapFactory.decodeStream(is);
                    is.close();
                } else {
                    bitmap = BitmapFactory.decodeFile(coverPathOrUrl);
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to decode cover bitmap: " + e.getMessage());
            }

            Bitmap finalBmp = bitmap;
            mainHandler.post(() -> callback.onBitmapLoaded(finalBmp));
        });
    }

    interface BitmapCallback {
        void onBitmapLoaded(@Nullable Bitmap bitmap);
    }

    public void play() {
        runOnMainThread(() -> {
            isJsPlaying = true;
            if (player != null) {
                player.play();
            }
            updateMediaSessionState(true);
            updateNotification();
            AudenicMediaPlugin.sendPlaybackEvent("play");
        });
    }

    public void pause() {
        runOnMainThread(() -> {
            isJsPlaying = false;
            if (player != null) {
                player.pause();
            }
            updateMediaSessionState(false);
            updateNotification();
            AudenicMediaPlugin.sendPlaybackEvent("pause");
        });
    }

    public void skipToNext() {
        advanceToNext();
    }

    public void skipToPrev() {
        runOnMainThread(() -> {
            if (currentIndex - 1 >= 0) {
                currentIndex--;
                playTrackAtIndex(currentIndex);
            } else if (player != null) {
                player.seekTo(0);
            }
        });
    }

    public void seekTo(long ms) {
        runOnMainThread(() -> {
            if (player != null) {
                player.seekTo(ms);
            }
        });
    }

    public boolean isPlaying() {
        return isJsPlaying || (player != null && player.isPlaying());
    }

    public long getCurrentPosition() {
        return player != null ? player.getCurrentPosition() : 0;
    }

    public long getDuration() {
        return player != null ? player.getDuration() : 0;
    }

    public int getCurrentIndex() {
        return currentIndex;
    }

    @Nullable
    public TrackData getCurrentTrack() {
        if (currentIndex >= 0 && currentIndex < queue.size()) {
            return queue.get(currentIndex);
        }
        return null;
    }

    public void setEventListener(PlaybackEventListener listener) {
        this.eventListener = listener;
    }

    private void updateMediaSessionMetadata(TrackData track, @Nullable Bitmap coverBitmap) {
        if (mediaSession == null || track == null) return;

        // Use ExoPlayer's accurate duration if the track data didn't provide one
        long durationMs = track.duration;
        if (durationMs <= 0 && player != null && player.getDuration() > 0) {
            durationMs = player.getDuration();
        }

        MediaMetadataCompat.Builder metadataBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, track.title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, track.artist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, track.album)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs);

        if (coverBitmap != null) {
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, coverBitmap);
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, coverBitmap);
        }

        mediaSession.setMetadata(metadataBuilder.build());
    }

    private void updateMediaSessionState(boolean isPlaying) {
        if (mediaSession == null) return;

        long actions = PlaybackStateCompat.ACTION_PLAY
                | PlaybackStateCompat.ACTION_PAUSE
                | PlaybackStateCompat.ACTION_PLAY_PAUSE
                | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                | PlaybackStateCompat.ACTION_SEEK_TO
                | PlaybackStateCompat.ACTION_STOP;

        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        long position = player != null ? player.getCurrentPosition() : 0;

        PlaybackStateCompat.CustomAction likeAction = new PlaybackStateCompat.CustomAction.Builder(
                ACTION_LIKE,
                isCurrentLiked ? "Unlike" : "Like",
                isCurrentLiked ? R.drawable.ic_heart_filled : R.drawable.ic_heart_outline
        ).build();

        PlaybackStateCompat stateCompat = new PlaybackStateCompat.Builder()
                .setActions(actions)
                .addCustomAction(likeAction)
                .setState(state, position, isPlaying ? 1.0f : 0.0f)
                .build();

        mediaSession.setPlaybackState(stateCompat);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Audenic Music",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Background audio playback controls for Audenic Music");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setShowBadge(false);
            channel.setSound(null, null);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void updateNotification() {
        updateNotificationWithBitmap(getCurrentTrack(), currentCoverBitmap);
    }

    private void updateNotificationWithBitmap(TrackData track, @Nullable Bitmap coverBitmap) {
        if (track == null) return;
        boolean playing = isPlaying();
        int pendingFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;

        // Tap → open app
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openAppPending = PendingIntent.getActivity(
                this, 0, openAppIntent, pendingFlags);

        // Action: Like / Unlike (heart)
        Intent likeIntent = new Intent(this, NotificationReceiver.class);
        likeIntent.setAction(ACTION_LIKE);
        PendingIntent likePending = PendingIntent.getBroadcast(this, 101, likeIntent, pendingFlags);

        // Action: Previous
        Intent prevIntent = new Intent(this, NotificationReceiver.class);
        prevIntent.setAction(ACTION_PREV);
        PendingIntent prevPending = PendingIntent.getBroadcast(this, 102, prevIntent, pendingFlags);

        // Action: Play / Pause
        Intent playPauseIntent = new Intent(this, NotificationReceiver.class);
        playPauseIntent.setAction(playing ? ACTION_PAUSE : ACTION_PLAY);
        PendingIntent playPausePending = PendingIntent.getBroadcast(this, 103, playPauseIntent, pendingFlags);

        // Action: Next
        Intent nextIntent = new Intent(this, NotificationReceiver.class);
        nextIntent.setAction(ACTION_NEXT);
        PendingIntent nextPending = PendingIntent.getBroadcast(this, 104, nextIntent, pendingFlags);

        // Action: Close / Dismiss
        Intent closeIntent = new Intent(this, NotificationReceiver.class);
        closeIntent.setAction(ACTION_STOP);
        PendingIntent closePending = PendingIntent.getBroadcast(this, 105, closeIntent, pendingFlags);

        // Build modern notification with 5 action slots:
        //   [Like] [Previous] [Play/Pause] [Next] [Close]
        // Compact view shows the 3 core controls: Previous | Play/Pause | Next (indices 1, 2, 3)
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_music)
                .setContentTitle(track.title)
                .setContentText(track.artist)
                .setSubText(track.album)
                .setContentIntent(openAppPending)
                .setDeleteIntent(closePending)
                .setOngoing(playing)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setStyle(
                        new androidx.media.app.NotificationCompat.MediaStyle()
                                .setMediaSession(mediaSession != null ? mediaSession.getSessionToken() : null)
                                .setShowActionsInCompactView(1, 2, 3)
                                .setShowCancelButton(!playing)
                                .setCancelButtonIntent(closePending)
                )
                // Slot 0: Like (heart)
                .addAction(isCurrentLiked ? R.drawable.ic_heart_filled : R.drawable.ic_heart_outline,
                        isCurrentLiked ? "Unlike" : "Like", likePending)
                // Slot 1: Previous
                .addAction(R.drawable.ic_media_previous, "Previous", prevPending)
                // Slot 2: Play/Pause
                .addAction(playing ? R.drawable.ic_media_pause : R.drawable.ic_media_play,
                        playing ? "Pause" : "Play", playPausePending)
                // Slot 3: Next
                .addAction(R.drawable.ic_media_next, "Next", nextPending)
                // Slot 4: Close/Dismiss
                .addAction(R.drawable.ic_notif_close, "Close", closePending);

        if (coverBitmap != null) {
            builder.setLargeIcon(coverBitmap);
            // Material You: extract dominant color from album art for notification accent
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try {
                    androidx.palette.graphics.Palette palette =
                            androidx.palette.graphics.Palette.from(coverBitmap).generate();
                    int dominantColor = palette.getDominantColor(0xFF1DB954);
                    builder.setColorized(true);
                    builder.setColor(dominantColor);
                } catch (Exception e) {
                    Log.w(TAG, "Palette extraction failed: " + e.getMessage());
                }
            }
        }

        startForeground(NOTIFICATION_ID, builder.build());
    }

    public void handleNotificationAction(String action) {
        handleAction(action);
    }

    private void handleAction(String action) {
        runOnMainThread(() -> {
            if (action == null) return;
            switch (action) {
                case ACTION_PLAY:
                    play();
                    break;
                case ACTION_PAUSE:
                    pause();
                    break;
                case ACTION_NEXT:
                    skipToNext();
                    break;
                case ACTION_PREV:
                    skipToPrev();
                    break;
                case ACTION_LIKE:
                    handleLikeAction();
                    break;
                case ACTION_STOP:
                    pause();
                    stopForeground(true);
                    stopSelf();
                    break;
            }
        });
    }
}

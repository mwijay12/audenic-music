package fm.audenic.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Native Media3 foreground service for Audenic Music.
 * Handles lock-screen controls, notification media buttons, artwork, and seekbar.
 * Bridges lockscreen events back to JavaScript via AudenicMediaPlugin.sendPlaybackEvent().
 */
public class AudenicPlaybackService extends Service {
  private static final String CHANNEL = "audenic_playback";
  private static final int NOTIFICATION_ID = 2210;

  // Actions for notification buttons
  private static final String ACTION_PLAY = "fm.audenic.app.PLAY";
  private static final String ACTION_PAUSE = "fm.audenic.app.PAUSE";
  private static final String ACTION_NEXT = "fm.audenic.app.NEXT";
  private static final String ACTION_PREV = "fm.audenic.app.PREV";
  private static final String ACTION_STOP = "fm.audenic.app.STOP";

  private ExoPlayer player;
  private MediaSession media3Session;
  private MediaSessionCompat mediaSessionCompat;
  private final ExecutorService artLoader = Executors.newSingleThreadExecutor();
  private final Handler mainHandler = new Handler(Looper.getMainLooper());

  // Track queue management
  private List<TrackData> queue = new ArrayList<>();
  private int currentIndex = 0;
  private PlaybackEventListener eventListener;

  private String currentTitle = "Audenic";
  private String currentArtist = "";
  private Bitmap currentArt = null;
  private boolean isPlaying = false;

  /**
   * Data model for a track in the queue
   */
  public static class TrackData {
    public String id;
    public String title;
    public String artist;
    public String album;
    public String src;
    public String cover;
    public long duration;

    public TrackData(String id, String title, String artist, String album, 
                    String src, String cover, long duration) {
      this.id = id;
      this.title = title;
      this.artist = artist;
      this.album = album;
      this.src = src;
      this.cover = cover;
      this.duration = duration;
    }
  }

  /**
   * Interface for events sent to Capacitor plugin
   */
  public interface PlaybackEventListener {
    void onTrackChanged(int index, TrackData track);
    void onPlaybackStateChanged(boolean isPlaying);
    void onQueueEnded();
    void onError(String message);
  }

  public static void command(Context c, String command, String uri, String title, String artist, String coverUrl) {
    Intent i = new Intent(c, AudenicPlaybackService.class);
    i.setAction(command);
    if (uri != null) i.putExtra("uri", uri);
    i.putExtra("title", title == null ? "Audenic" : title);
    i.putExtra("artist", artist == null ? "" : artist);
    if (coverUrl != null) i.putExtra("coverUrl", coverUrl);
    if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
    else c.startService(i);
  }

  @Override
  public void onCreate() {
    super.onCreate();
    createChannel();
    player = new ExoPlayer.Builder(this).build();
    media3Session = new MediaSession.Builder(this, player).build();

    // Compat session for notification controls (Android 12-15+ system UI)
    mediaSessionCompat = new MediaSessionCompat(this, "AudenicMedia");
    mediaSessionCompat.setActive(true);
    mediaSessionCompat.setCallback(new MediaSessionCompat.Callback() {
      @Override public void onPlay() {
        isPlaying = true;
        updateState(true);
        AudenicMediaPlugin.sendPlaybackEvent("play");
      }
      @Override public void onPause() {
        isPlaying = false;
        updateState(false);
        AudenicMediaPlugin.sendPlaybackEvent("pause");
      }
      @Override public void onSkipToNext() {
        AudenicMediaPlugin.sendPlaybackEvent("next");
      }
      @Override public void onSkipToPrevious() {
        AudenicMediaPlugin.sendPlaybackEvent("previous");
      }
      @Override public void onStop() {
        AudenicMediaPlugin.sendPlaybackEvent("stop");
        stopSelf();
      }
      @Override public void onSeekTo(long pos) {
        // Handled via JS
      }
    });
  }

  @Override
  public int onStartCommand(Intent i, int flags, int id) {
    if (i == null) { showNotification(); return START_STICKY; }

    String action = i.getAction();
    if (action == null) action = "play";

    switch (action) {
      case "stop":
      case ACTION_STOP:
        AudenicMediaPlugin.sendPlaybackEvent("stop");
        stopSelf();
        return START_NOT_STICKY;

      case ACTION_PAUSE:
      case "pause":
        isPlaying = false;
        updateState(false);
        showNotification();
        AudenicMediaPlugin.sendPlaybackEvent("pause");
        break;

      case ACTION_PLAY:
        isPlaying = true;
        updateState(true);
        showNotification();
        AudenicMediaPlugin.sendPlaybackEvent("play");
        break;

      case ACTION_NEXT:
      case "next":
        AudenicMediaPlugin.sendPlaybackEvent("next");
        break;

      case ACTION_PREV:
      case "previous":
        AudenicMediaPlugin.sendPlaybackEvent("previous");
        break;

      case "updateMeta":
        currentTitle = i.getStringExtra("title");
        currentArtist = i.getStringExtra("artist");
        if (currentTitle == null) currentTitle = "Audenic";
        if (currentArtist == null) currentArtist = "";
        loadArtwork(i.getStringExtra("coverUrl"));
        break;

      default: // "play" or any other action
        isPlaying = true;
        currentTitle = i.getStringExtra("title");
        currentArtist = i.getStringExtra("artist");
        if (currentTitle == null) currentTitle = "Audenic";
        if (currentArtist == null) currentArtist = "";
        loadArtwork(i.getStringExtra("coverUrl"));
        break;
    }

    updateState(isPlaying);
    showNotification();
    return START_STICKY;
  }

  private void loadArtwork(String coverUrl) {
    if (coverUrl == null || coverUrl.isEmpty() || coverUrl.startsWith("data:")) {
      currentArt = null;
      showNotification();
      return;
    }
    artLoader.execute(() -> {
      try {
        HttpURLConnection conn = (HttpURLConnection) new URL(coverUrl).openConnection();
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);
        InputStream is = conn.getInputStream();
        Bitmap bmp = BitmapFactory.decodeStream(is);
        is.close();
        conn.disconnect();
        if (bmp != null) {
          if (bmp.getWidth() > 512 || bmp.getHeight() > 512) {
            float scale = 512f / Math.max(bmp.getWidth(), bmp.getHeight());
            bmp = Bitmap.createScaledBitmap(bmp,
              (int)(bmp.getWidth() * scale),
              (int)(bmp.getHeight() * scale), true);
          }
          currentArt = bmp;
          mainHandler.post(() -> showNotification());
        }
      } catch (Exception e) {
        // Best-effort
      }
    });
  }

  private void updateState(boolean playing) {
    isPlaying = playing;
    long pos = player != null ? player.getCurrentPosition() : 0;
    PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
      .setActions(
        PlaybackStateCompat.ACTION_PLAY |
        PlaybackStateCompat.ACTION_PAUSE |
        PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
        PlaybackStateCompat.ACTION_SEEK_TO |
        PlaybackStateCompat.ACTION_STOP
      )
      .setState(
        playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
        pos, playing ? 1.0f : 0f
      );
    mediaSessionCompat.setPlaybackState(stateBuilder.build());

    MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
      .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
      .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
      .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Audenic Music");
    if (currentArt != null) {
      metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentArt);
    }
    mediaSessionCompat.setMetadata(metaBuilder.build());
  }

  private void showNotification() {
    Intent openApp = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent tapIntent = PendingIntent.getActivity(
      this, 0, openApp,
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
    );

    NotificationCompat.Action prevAction = new NotificationCompat.Action.Builder(
      android.R.drawable.ic_media_previous, "Previous",
      actionIntent(ACTION_PREV, 1)
    ).build();

    NotificationCompat.Action playPauseAction;
    if (isPlaying) {
      playPauseAction = new NotificationCompat.Action.Builder(
        android.R.drawable.ic_media_pause, "Pause",
        actionIntent(ACTION_PAUSE, 2)
      ).build();
    } else {
      playPauseAction = new NotificationCompat.Action.Builder(
        android.R.drawable.ic_media_play, "Play",
        actionIntent(ACTION_PLAY, 2)
      ).build();
    }

    NotificationCompat.Action nextAction = new NotificationCompat.Action.Builder(
      android.R.drawable.ic_media_next, "Next",
      actionIntent(ACTION_NEXT, 3)
    ).build();

    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(getApplicationInfo().icon)
      .setContentTitle(currentTitle)
      .setContentText(currentArtist)
      .setContentIntent(tapIntent)
      .setOngoing(isPlaying)
      .setOnlyAlertOnce(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .addAction(prevAction)
      .addAction(playPauseAction)
      .addAction(nextAction)
      .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
        .setMediaSession(mediaSessionCompat.getSessionToken())
        .setShowActionsInCompactView(0, 1, 2)
        .setShowCancelButton(true)
        .setCancelButtonIntent(actionIntent(ACTION_STOP, 4))
      );

    if (currentArt != null) {
      builder.setLargeIcon(currentArt);
    }

    startForeground(NOTIFICATION_ID, builder.build());
  }

  private PendingIntent actionIntent(String action, int requestCode) {
    Intent i = new Intent(this, AudenicPlaybackService.class);
    i.setAction(action);
    return PendingIntent.getService(
      this, requestCode, i,
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
    );
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel c = new NotificationChannel(
        CHANNEL, "Audenic playback", NotificationManager.IMPORTANCE_LOW
      );
      c.setDescription("Lock-screen and notification music controls");
      c.setShowBadge(false);
      c.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
      getSystemService(NotificationManager.class).createNotificationChannel(c);
    }
  }

  // Queue and playback methods
  public void setQueue(List<TrackData> tracks, int startIndex) {
    queue.clear();
    queue.addAll(tracks);
    currentIndex = startIndex;

    if (!queue.isEmpty()) {
      playTrackAtIndex(currentIndex);
    }

    Log.d("AudenicPlayback", "Queue set with " + tracks.size() + " tracks, starting at " + startIndex);
  }

  public void playTrackAtIndex(int index) {
    if (index < 0 || index >= queue.size()) {
      Log.e("AudenicPlayback", "Invalid track index: " + index);
      return;
    }

    currentIndex = index;
    TrackData track = queue.get(index);
    Log.d("AudenicPlayback", "Playing: " + track.title + " | src: " + track.src);

    // Set media item
    MediaItem mediaItem = MediaItem.fromUri(Uri.parse(track.src));
    player.setMediaItem(mediaItem);
    player.prepare();
    player.play();

    // Update metadata
    currentTitle = track.title;
    currentArtist = track.artist;
    updateState(true);
    showNotification();

    // Notify listeners
    if (eventListener != null) {
      eventListener.onTrackChanged(currentIndex, track);
    }
  }

  public void play() {
    if (player != null) {
      player.play();
    }
  }

  public void pause() {
    if (player != null) {
      player.pause();
    }
  }

  public void skipToNext() {
    advanceToNext();
  }

  public void skipToPrev() {
    if (currentIndex - 1 >= 0) {
      playTrackAtIndex(currentIndex - 1);
    }
  }

  public void seekTo(long positionMs) {
    if (player != null) {
      player.seekTo(positionMs);
    }
  }

  public boolean isPlaying() {
    return player != null && player.isPlaying();
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

  public TrackData getCurrentTrack() {
    return currentIndex >= 0 && currentIndex < queue.size() ? queue.get(currentIndex) : null;
  }

  public void setEventListener(PlaybackEventListener listener) {
    this.eventListener = listener;
  }

  private void advanceToNext() {
    int nextIndex = currentIndex + 1;
    if (nextIndex < queue.size()) {
      playTrackAtIndex(nextIndex);
    } else {
      Log.d("AudenicPlayback", "Queue ended at index " + currentIndex);
      player.stop();
      if (eventListener != null) {
        eventListener.onQueueEnded();
      }
      updateNotification();
    }
  }

  @Override
  public void onDestroy() {
    mediaSessionCompat.setActive(false);
    mediaSessionCompat.release();
    media3Session.release();
    player.release();
    artLoader.shutdownNow();
    super.onDestroy();
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) { return null; }
}

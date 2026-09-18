package fm.audenic.app;

import com.audenic.app.R;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.DisplayMetrics;
import android.view.DisplayCutout;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;

/**
 * Dynamic Island-style floating overlay service for Audenic Music.
 * Positions a floating overlay pill near the device camera notch/display cutout.
 * Features smooth tap-to-expand/collapse animation, media controls, and zero split-brain desync.
 */
public class AudenicIslandService extends Service {
  private static AudenicIslandService instance;
  private WindowManager windowManager;
  private View islandView;
  private WindowManager.LayoutParams params;

  private ImageView imgCover;
  private TextView txtTitle;
  private TextView txtArtist;
  private ImageView btnPrev;
  private ImageView btnPlayPause;
  private ImageView btnNext;
  private LinearLayout controlsContainer;

  private boolean isExpanded = false;
  private boolean isPlaying = false;
  private String currentTitle = "Audenic Music";
  private String currentArtist = "Playing local & online tracks";
  private Bitmap currentArt = null;

  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private final Runnable collapseRunnable = () -> setExpandedState(false);

  public static boolean isRunning() {
    return instance != null;
  }

  public static void updateIslandState(Context c, String title, String artist, Bitmap cover, boolean playing) {
    if (instance != null) {
      instance.updateData(title, artist, cover, playing);
    }
  }

  public static void startIsland(Context c) {
    if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(c)) return;
    Intent i = new Intent(c, AudenicIslandService.class);
    try {
      c.startService(i);
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  public static void stopIsland(Context c) {
    if (instance != null) {
      c.stopService(new Intent(c, AudenicIslandService.class));
    }
  }

  @Override
  public void onCreate() {
    super.onCreate();
    instance = this;

    if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this)) {
      stopSelf();
      return;
    }

    windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    createIslandView();
  }

  private void createIslandView() {
    int layoutType = Build.VERSION.SDK_INT >= 26
      ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      : WindowManager.LayoutParams.TYPE_PHONE;

    params = new WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      dpToPx(38),
      layoutType,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_LAYOUT_INSET_DECOR,
      PixelFormat.TRANSLUCENT
    );

    params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
    params.y = getTopMarginForNotch();

    // Create Main Island Container
    LinearLayout mainLayout = new LinearLayout(this);
    mainLayout.setOrientation(LinearLayout.HORIZONTAL);
    mainLayout.setGravity(Gravity.CENTER_VERTICAL);
    mainLayout.setPadding(dpToPx(6), dpToPx(4), dpToPx(8), dpToPx(4));

    GradientDrawable bg = new GradientDrawable();
    bg.setColor(Color.parseColor("#121216"));
    bg.setCornerRadius(dpToPx(24));
    bg.setStroke(dpToPx(1), Color.parseColor("#33ffffff"));
    mainLayout.setBackground(bg);

    // 1. Cover Art Thumbnail
    imgCover = new ImageView(this);
    LinearLayout.LayoutParams coverParams = new LinearLayout.LayoutParams(dpToPx(28), dpToPx(28));
    coverParams.setMargins(0, 0, dpToPx(8), 0);
    imgCover.setLayoutParams(coverParams);
    imgCover.setImageResource(getApplicationInfo().icon);
    mainLayout.addView(imgCover);

    // 2. Title & Artist Box
    LinearLayout textLayout = new LinearLayout(this);
    textLayout.setOrientation(LinearLayout.VERTICAL);
    LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    textLayout.setLayoutParams(textParams);

    txtTitle = new TextView(this);
    txtTitle.setTextColor(Color.WHITE);
    txtTitle.setTextSize(12f);
    txtTitle.setTypeface(null, Typeface.BOLD);
    txtTitle.setSingleLine(true);
    txtTitle.setEllipsize(TextUtils.TruncateAt.END);
    txtTitle.setText(currentTitle);
    textLayout.addView(txtTitle);

    txtArtist = new TextView(this);
    txtArtist.setTextColor(Color.parseColor("#99ffffff"));
    txtArtist.setTextSize(10f);
    txtArtist.setSingleLine(true);
    txtArtist.setEllipsize(TextUtils.TruncateAt.END);
    txtArtist.setText(currentArtist);
    txtArtist.setVisibility(View.GONE);
    textLayout.addView(txtArtist);

    mainLayout.addView(textLayout);

    // 3. Media Controls Container (Prev, Play/Pause, Next)
    controlsContainer = new LinearLayout(this);
    controlsContainer.setOrientation(LinearLayout.HORIZONTAL);
    controlsContainer.setGravity(Gravity.CENTER_VERTICAL);
    controlsContainer.setVisibility(View.GONE);

    btnPrev = new ImageView(this);
    btnPrev.setImageResource(R .drawable.ic_media_previous);
    LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(dpToPx(26), dpToPx(26));
    btnParams.setMargins(dpToPx(6), 0, dpToPx(4), 0);
    btnPrev.setLayoutParams(btnParams);
    btnPrev.setOnClickListener(v -> {
      AudenicMediaPlugin.sendPlaybackEvent("previous");
      resetCollapseTimer();
    });
    controlsContainer.addView(btnPrev);

    btnPlayPause = new ImageView(this);
    btnPlayPause.setImageResource(R.drawable.ic_media_pause);
    LinearLayout.LayoutParams playParams = new LinearLayout.LayoutParams(dpToPx(30), dpToPx(30));
    playParams.setMargins(dpToPx(4), 0, dpToPx(4), 0);
    btnPlayPause.setLayoutParams(playParams);
    btnPlayPause.setOnClickListener(v -> {
      if (isPlaying) AudenicMediaPlugin.sendPlaybackEvent("pause");
      else AudenicMediaPlugin.sendPlaybackEvent("play");
      resetCollapseTimer();
    });
    controlsContainer.addView(btnPlayPause);

    btnNext = new ImageView(this);
    btnNext.setImageResource(R.drawable.ic_media_next);
    btnNext.setLayoutParams(btnParams);
    btnNext.setOnClickListener(v -> {
      AudenicMediaPlugin.sendPlaybackEvent("next");
      resetCollapseTimer();
    });
    controlsContainer.addView(btnNext);

    mainLayout.addView(controlsContainer);

    mainLayout.setOnTouchListener(new View.OnTouchListener() {
      private float startY;
      @Override
      public boolean onTouch(View v, MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
          startY = event.getRawY();
        } else if (event.getAction() == MotionEvent.ACTION_UP) {
          if (Math.abs(event.getRawY() - startY) < dpToPx(10)) {
            toggleExpandedState();
          }
        }
        return true;
      }
    });

    islandView = mainLayout;
    try {
      windowManager.addView(islandView, params);
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  private void toggleExpandedState() {
    setExpandedState(!isExpanded);
  }

  private void setExpandedState(boolean expand) {
    isExpanded = expand;
    mainHandler.removeCallbacks(collapseRunnable);

    if (islandView != null && params != null) {
      DisplayMetrics dm = getResources().getDisplayMetrics();
      if (expand) {
        params.width = (int) (dm.widthPixels * 0.85f);
        params.height = dpToPx(54);
        txtArtist.setVisibility(View.VISIBLE);
        controlsContainer.setVisibility(View.VISIBLE);
        resetCollapseTimer();
      } else {
        params.width = (int) (dm.widthPixels * 0.52f);
        params.height = dpToPx(38);
        txtArtist.setVisibility(View.GONE);
        controlsContainer.setVisibility(View.GONE);
      }
      try {
        windowManager.updateViewLayout(islandView, params);
      } catch (Exception e) {
        e.printStackTrace();
      }
    }
  }

  private void resetCollapseTimer() {
    mainHandler.removeCallbacks(collapseRunnable);
    mainHandler.postDelayed(collapseRunnable, 4500);
  }

  public void updateData(String title, String artist, Bitmap cover, boolean playing) {
    isPlaying = playing;
    if (title != null && !title.isEmpty()) currentTitle = title;
    if (artist != null) currentArtist = artist;
    if (cover != null) currentArt = cover;

    mainHandler.post(() -> {
      if (txtTitle != null) txtTitle.setText(currentTitle);
      if (txtArtist != null) txtArtist.setText(currentArtist);
      if (imgCover != null) {
        if (currentArt != null) imgCover.setImageBitmap(currentArt);
        else imgCover.setImageResource(getApplicationInfo().icon);
      }
      if (btnPlayPause != null) {
        btnPlayPause.setImageResource(playing ? R.drawable.ic_media_pause : R.drawable.ic_media_play);
      }
    });
  }

  private int getTopMarginForNotch() {
    int margin = dpToPx(12);
    if (Build.VERSION.SDK_INT >= 28 && islandView != null) {
      try {
        WindowInsets insets = islandView.getRootWindowInsets();
        if (insets != null) {
          DisplayCutout cutout = insets.getDisplayCutout();
          if (cutout != null) {
            margin = Math.max(margin, cutout.getSafeInsetTop());
          }
        }
      } catch (Exception e) {
        // Fallback
      }
    }
    return margin;
  }

  private int dpToPx(int dp) {
    return (int) (dp * getResources().getDisplayMetrics().density);
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    return START_STICKY;
  }

  @Override
  public void onDestroy() {
    instance = null;
    mainHandler.removeCallbacks(collapseRunnable);
    if (islandView != null && windowManager != null) {
      try {
        windowManager.removeView(islandView);
      } catch (Exception e) {
        e.printStackTrace();
      }
    }
    super.onDestroy();
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) { return null; }
}

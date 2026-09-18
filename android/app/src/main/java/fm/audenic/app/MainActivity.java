package fm.audenic.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.window.OnBackInvokedDispatcher;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ALL registerPlugin() calls MUST be here BEFORE super.onCreate()
        // This is critical so Capacitor bridge registers plugins properly on initialization.
        registerPlugin(AudenicMediaPlugin.class);
        registerPlugin(MediaScannerPlugin.class);
        registerPlugin(PlaybackPlugin.class);
        registerPlugin(VideoScannerPlugin.class);
        registerPlugin(LrcReaderPlugin.class);

        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        // ── Android 13+ Predictive Back Gesture Support ──
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                () -> {
                    if (getBridge() != null) {
                        getBridge().triggerJSEvent("backButton", "document");
                    }
                }
            );
        }

        int darkColor = Color.parseColor("#0A0A0D");

        // ── Solid dark window & system bar colors ──
        Window window = getWindow();
        try {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(darkColor);
            window.setNavigationBarColor(darkColor);
        } catch (Exception e) {
            // Ignore if custom window flags fail on older devices
        }
    }
}

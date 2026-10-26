package fm.audenic.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.window.OnBackInvokedDispatcher;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ALL registerPlugin() calls MUST be here BEFORE super.onCreate()
        // This is critical so Capacitor bridge registers plugins properly on initialization.
        registerPlugin(AudenicMediaPlugin.class);
        registerPlugin(MediaScannerPlugin.class);
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

        // ── Microphone for live speech-to-text (WebView getUserMedia) ──
        // Without this the WebView denies every mic request, so the speech
        // engine fails instantly and dictation looks like it "does nothing".
        requestMicPermissionIfNeeded();
        grantWebViewPermissions();

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

    /** Ask the OS for RECORD_AUDIO once, at startup. */
    private void requestMicPermissionIfNeeded() {
        try {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{ Manifest.permission.RECORD_AUDIO },
                        9001
                );
            }
        } catch (Exception e) {
            // Never crash startup over an optional permission
        }
    }

    /**
     * Grant WebView-originated permission requests (mic) so SpeechRecognition /
     * getUserMedia work inside the Capacitor WebView. Grants only when the OS
     * permission is already held.
     */
    private void grantWebViewPermissions() {
        try {
            Bridge bridge = getBridge();
            if (bridge == null || bridge.getWebView() == null) return;
            bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        boolean micGranted = ContextCompat.checkSelfPermission(
                                MainActivity.this, Manifest.permission.RECORD_AUDIO)
                                == PackageManager.PERMISSION_GRANTED;
                        if (!micGranted) {
                            request.deny();
                            return;
                        }
                        java.util.List<String> allowed = new java.util.ArrayList<>();
                        for (String res : request.getResources()) {
                            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                                allowed.add(res);
                            }
                        }
                        if (allowed.isEmpty()) {
                            request.deny();
                        } else {
                            request.grant(allowed.toArray(new String[0]));
                        }
                    });
                }
            });
        } catch (Exception e) {
            // Keep the default client if anything is unavailable
        }
    }
}

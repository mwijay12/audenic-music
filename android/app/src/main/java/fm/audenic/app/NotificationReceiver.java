package fm.audenic.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * BroadcastReceiver for handling notification media control clicks.
 * Uses BroadcastReceiver so action clicks work instantly without background service restrictions on Android 12+.
 */
public class NotificationReceiver extends BroadcastReceiver {
    private static final String TAG = "NotificationReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        Log.d(TAG, "Notification action received: " + action);

        AudenicPlaybackService service = AudenicPlaybackService.getInstance();
        if (service != null) {
            service.handleNotificationAction(action);
        } else {
            try {
                Intent serviceIntent = new Intent(context, AudenicPlaybackService.class);
                serviceIntent.setAction(action);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to forward notification action to service: " + e.getMessage(), e);
            }
        }
    }
}

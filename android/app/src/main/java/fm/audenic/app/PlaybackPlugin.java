package fm.audenic.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "AudenicPlayback")
public class PlaybackPlugin extends Plugin implements AudenicPlaybackService.PlaybackEventListener {
    private static final String TAG = "PlaybackPlugin";
    private AudenicPlaybackService playbackService;
    private boolean serviceBound = false;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            AudenicPlaybackService.LocalBinder localBinder = (AudenicPlaybackService.LocalBinder) binder;
            playbackService = localBinder.getService();
            playbackService.setEventListener(PlaybackPlugin.this);
            serviceBound = true;
            Log.d(TAG, "Connected to AudenicPlaybackService");
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            serviceBound = false;
            playbackService = null;
            Log.w(TAG, "Disconnected from AudenicPlaybackService");
        }
    };

    @Override
    public void load() {
        super.load();
        try {
            Context ctx = getContext();
            Intent serviceIntent = new Intent(ctx, AudenicPlaybackService.class);
            ctx.startService(serviceIntent);
            ctx.bindService(serviceIntent, connection, Context.BIND_AUTO_CREATE);
            Log.d(TAG, "PlaybackPlugin loaded and starting service binding");
        } catch (Exception e) {
            Log.e(TAG, "Error binding service in load(): " + e.getMessage(), e);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (serviceBound) {
            try {
                getContext().unbindService(connection);
            } catch (Exception e) {
                Log.w(TAG, "Error unbinding service in handleOnDestroy(): " + e.getMessage());
            }
            serviceBound = false;
        }
        super.handleOnDestroy();
    }

    private AudenicPlaybackService getOrConnectService() {
        if (playbackService != null) return playbackService;
        AudenicPlaybackService instance = AudenicPlaybackService.getInstance();
        if (instance != null) {
            playbackService = instance;
            playbackService.setEventListener(this);
            serviceBound = true;
            return playbackService;
        }
        try {
            Context ctx = getContext();
            Intent serviceIntent = new Intent(ctx, AudenicPlaybackService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(serviceIntent);
            } else {
                ctx.startService(serviceIntent);
            }
            ctx.bindService(serviceIntent, connection, Context.BIND_AUTO_CREATE);
        } catch (Exception e) {
            Log.e(TAG, "Error starting service in getOrConnectService: " + e.getMessage());
        }
        return AudenicPlaybackService.getInstance();
    }

    @PluginMethod
    public void setQueueAndPlay(PluginCall call) {
        JSArray tracksArray = call.getArray("tracks");
        int startIndex = call.getInt("startIndex", 0);
        if (tracksArray == null) {
            call.reject("INVALID_ARGS", "Missing tracks array");
            return;
        }

        AudenicPlaybackService service = getOrConnectService();

        ArrayList<String> ids = new ArrayList<>();
        ArrayList<String> uris = new ArrayList<>();
        ArrayList<String> titles = new ArrayList<>();
        ArrayList<String> artists = new ArrayList<>();
        ArrayList<String> covers = new ArrayList<>();
        List<AudenicPlaybackService.TrackData> tracks = new ArrayList<>();

        try {
            for (int i = 0; i < tracksArray.length(); i++) {
                JSONObject obj = tracksArray.getJSONObject(i);
                String id = obj.optString("id", String.valueOf(i));
                String title = obj.optString("title", "Unknown Track");
                String artist = obj.optString("artist", "Unknown Artist");
                String album = obj.optString("album", "Unknown Album");
                String src = obj.optString("src", "");
                String cover = obj.optString("cover", "");
                long duration = obj.optLong("duration", 0L);

                ids.add(id);
                uris.add(src);
                titles.add(title);
                artists.add(artist);
                covers.add(cover);

                tracks.add(new AudenicPlaybackService.TrackData(id, title, artist, album, src, cover, duration));
            }

            if (service != null) {
                service.setQueue(tracks, startIndex);
            } else {
                AudenicPlaybackService.loadQueueNative(getContext(), ids, uris, titles, artists, covers, startIndex, 0L);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("PARSE_ERROR", "Error parsing tracks: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        AudenicPlaybackService service = getOrConnectService();
        if (service != null) {
            service.play();
        } else {
            AudenicPlaybackService.command(getContext(), "play", null, null, null, null, 0, 0);
        }
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        AudenicPlaybackService service = getOrConnectService();
        if (service != null) {
            service.pause();
        } else {
            AudenicPlaybackService.command(getContext(), "pause", null, null, null, null, 0, 0);
        }
        call.resolve();
    }

    @PluginMethod
    public void next(PluginCall call) {
        AudenicPlaybackService service = getOrConnectService();
        if (service != null) {
            service.skipToNext();
        } else {
            AudenicPlaybackService.command(getContext(), "next", null, null, null, null, 0, 0);
        }
        call.resolve();
    }

    @PluginMethod
    public void previous(PluginCall call) {
        AudenicPlaybackService service = getOrConnectService();
        if (service != null) {
            service.skipToPrev();
        } else {
            AudenicPlaybackService.command(getContext(), "prev", null, null, null, null, 0, 0);
        }
        call.resolve();
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        long position = call.getLong("position", 0L);
        AudenicPlaybackService service = getOrConnectService();
        if (service != null) {
            service.seekTo(position);
        } else {
            AudenicPlaybackService.command(getContext(), "seek", null, null, null, null, position, 0);
        }
        call.resolve();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        if (!serviceBound || playbackService == null) {
            JSObject emptyState = new JSObject();
            emptyState.put("isPlaying", false);
            emptyState.put("position", 0);
            emptyState.put("duration", 0);
            emptyState.put("currentIndex", 0);
            emptyState.put("currentTrack", null);
            call.resolve(emptyState);
            return;
        }

        JSObject state = new JSObject();
        state.put("isPlaying", playbackService.isPlaying());
        state.put("position", playbackService.getCurrentPosition());
        state.put("duration", playbackService.getDuration());
        state.put("currentIndex", playbackService.getCurrentIndex());

        AudenicPlaybackService.TrackData current = playbackService.getCurrentTrack();
        if (current != null) {
            JSObject t = new JSObject();
            t.put("id", current.id);
            t.put("title", current.title);
            t.put("artist", current.artist);
            t.put("album", current.album);
            t.put("src", current.src);
            t.put("cover", current.cover);
            t.put("duration", current.duration);
            state.put("currentTrack", t);
        } else {
            state.put("currentTrack", null);
        }

        call.resolve(state);
    }

    // PlaybackEventListener implementations
    @Override
    public void onTrackChanged(int index, AudenicPlaybackService.TrackData track) {
        JSObject data = new JSObject();
        data.put("index", index);
        data.put("id", track.id);
        data.put("title", track.title);
        data.put("artist", track.artist);
        data.put("album", track.album);
        data.put("src", track.src);
        data.put("cover", track.cover);
        data.put("duration", track.duration);

        notifyListeners("trackChanged", data);
        Log.d(TAG, "Event emitted: trackChanged -> " + track.title);
    }

    @Override
    public void onPlaybackStateChanged(boolean isPlaying) {
        JSObject data = new JSObject();
        data.put("isPlaying", isPlaying);
        notifyListeners("playbackStateChanged", data);
    }

    @Override
    public void onProgressTick(long position, long duration) {
        JSObject data = new JSObject();
        data.put("position", position);
        data.put("duration", duration);
        notifyListeners("progressUpdate", data);
    }

    @Override
    public void onQueueEnded() {
        JSObject data = new JSObject();
        data.put("ended", true);
        notifyListeners("queueEnded", data);
    }

    @Override
    public void onError(String message) {
        JSObject data = new JSObject();
        data.put("message", message != null ? message : "Unknown playback error");
        notifyListeners("playbackError", data);
    }
}

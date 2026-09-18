package fm.audenic.audenic_flutter

import android.content.Intent
import android.media.audiofx.AudioEffect
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import com.ryanheise.audioservice.AudioServiceActivity

class MainActivity : AudioServiceActivity() {
    private val CHANNEL = "fm.audenic.audio/effects"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "openAudioEffectSession" -> {
                    val sessionId = call.argument<Int>("sessionId") ?: 0
                    val intent = Intent(AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION).apply {
                        putExtra(AudioEffect.EXTRA_AUDIO_SESSION, sessionId)
                        putExtra(AudioEffect.EXTRA_PACKAGE_NAME, packageName)
                        putExtra(AudioEffect.EXTRA_CONTENT_TYPE, AudioEffect.CONTENT_TYPE_MUSIC)
                    }
                    sendBroadcast(intent)
                    result.success(true)
                }
                "closeAudioEffectSession" -> {
                    val sessionId = call.argument<Int>("sessionId") ?: 0
                    val intent = Intent(AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION).apply {
                        putExtra(AudioEffect.EXTRA_AUDIO_SESSION, sessionId)
                        putExtra(AudioEffect.EXTRA_PACKAGE_NAME, packageName)
                    }
                    sendBroadcast(intent)
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
    }
}

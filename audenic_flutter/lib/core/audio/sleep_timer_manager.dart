import 'dart:async';
import 'package:flutter/foundation.dart';
import 'audenic_audio_handler.dart';

class SleepTimerManager {
  final AudenicAudioHandler _handler;
  Timer? _timer;
  int _remainingSeconds = 0;
  bool _isFadeOutEnabled = true;

  final StreamController<int> _remainingController = StreamController<int>.broadcast();
  Stream<int> get remainingSecondsStream => _remainingController.stream;
  int get remainingSeconds => _remainingSeconds;
  bool get isActive => _timer != null && _timer!.isActive;

  SleepTimerManager(this._handler);

  /// Start sleep timer in minutes (e.g. 15, 30, 45, 60)
  void start(int minutes, {bool fadeOut = true}) {
    cancel();
    _remainingSeconds = minutes * 60;
    _isFadeOutEnabled = fadeOut;
    _remainingController.add(_remainingSeconds);

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) async {
      if (_remainingSeconds <= 1) {
        timer.cancel();
        _remainingSeconds = 0;
        _remainingController.add(0);

        try {
          await _handler.pause();
          // Restore volume back to full for next session
          await _handler.player.setVolume(1.0);
        } catch (e) {
          debugPrint('[SleepTimer] Error pausing on timer completion: $e');
        }
      } else {
        _remainingSeconds--;
        _remainingController.add(_remainingSeconds);

        // Musify-style smooth fade out during last 60 seconds
        if (_isFadeOutEnabled && _remainingSeconds <= 60) {
          final targetVolume = (_remainingSeconds / 60.0).clamp(0.05, 1.0);
          _handler.player.setVolume(targetVolume);
        }
      }
    });
  }

  void cancel() {
    _timer?.cancel();
    _timer = null;
    _remainingSeconds = 0;
    _remainingController.add(0);
    _handler.player.setVolume(1.0);
  }
}

import 'dart:async';
import 'package:audio_service/audio_service.dart';
import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../../data/models/track.dart';
import '../effects/audio_effects_manager.dart';

class AudenicAudioHandler extends BaseAudioHandler with QueueHandler, SeekHandler {
  final AudioPlayer _player;
  late final AudioEffectsManager effectsManager;

  List<Track> _playlist = [];
  int _currentIndex = -1;

  final StreamController<Track?> _currentTrackController = StreamController<Track?>.broadcast();
  Stream<Track?> get currentTrackStream => _currentTrackController.stream;
  Track? get currentTrack => _currentIndex >= 0 && _currentIndex < _playlist.length ? _playlist[_currentIndex] : null;

  AudenicAudioHandler._(this._player, AndroidEqualizer? eq, AndroidLoudnessEnhancer? le) {
    effectsManager = AudioEffectsManager(androidEqualizer: eq, androidLoudness: le);
  }

  static Future<AudenicAudioHandler> create() async {
    AndroidEqualizer? eq;
    AndroidLoudnessEnhancer? le;

    if (defaultTargetPlatform == TargetPlatform.android) {
      try {
        eq = AndroidEqualizer();
        le = AndroidLoudnessEnhancer();
      } catch (e) {
        debugPrint('[AudioHandler] Failed to initialize native effects: $e');
      }
    }

    final pipeline = AudioPipeline(
      androidAudioEffects: [
        ?eq,
        ?le,
      ],
    );

    final player = AudioPlayer(audioPipeline: pipeline);
    final handler = AudenicAudioHandler._(player, eq, le);
    await handler._setup();
    return handler;
  }

  Future<void> _setup() async {
    // 1. Audio focus management
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.music());

    session.becomingNoisyEventStream.listen((_) {
      pause();
    });

    session.interruptionEventStream.listen((event) {
      if (event.begin) {
        switch (event.type) {
          case AudioInterruptionType.duck:
            _player.setVolume(0.3);
            break;
          case AudioInterruptionType.pause:
          case AudioInterruptionType.unknown:
            pause();
            break;
        }
      } else {
        switch (event.type) {
          case AudioInterruptionType.duck:
            _player.setVolume(1.0);
            break;
          case AudioInterruptionType.pause:
            play();
            break;
          case AudioInterruptionType.unknown:
            break;
        }
      }
    });

    // 2. Initialize AudioEffectsManager
    await effectsManager.init();

    // 3. Listen to Android AudioSession ID to broadcast to system EQ / Dolby Atmos
    _player.androidAudioSessionIdStream.listen((sessionId) {
      if (sessionId != null && sessionId > 0) {
        effectsManager.onAudioSessionId(sessionId);
      }
    });

    // 4. Map player playback state to AudioService PlaybackState
    _player.playbackEventStream.listen(_broadcastState);

    // 5. Handle song completion -> play next
    _player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        skipToNext();
      }
    });

    // 6. Listen to duration stream to update mediaItem
    _player.durationStream.listen((duration) {
      if (duration != null && mediaItem.value != null) {
        mediaItem.add(mediaItem.value!.copyWith(duration: duration));
      }
    });
  }

  void _broadcastState(PlaybackEvent event) {
    final playing = _player.playing;
    playbackState.add(
      playbackState.value.copyWith(
        controls: [
          MediaControl.skipToPrevious,
          if (playing) MediaControl.pause else MediaControl.play,
          MediaControl.skipToNext,
          MediaControl.stop,
        ],
        systemActions: const {
          MediaAction.seek,
          MediaAction.seekForward,
          MediaAction.seekBackward,
        },
        androidCompactActionIndices: const [0, 1, 2],
        processingState: const {
          ProcessingState.idle: AudioProcessingState.idle,
          ProcessingState.loading: AudioProcessingState.loading,
          ProcessingState.buffering: AudioProcessingState.buffering,
          ProcessingState.ready: AudioProcessingState.ready,
          ProcessingState.completed: AudioProcessingState.completed,
        }[_player.processingState]!,
        playing: playing,
        updatePosition: _player.position,
        bufferedPosition: _player.bufferedPosition,
        speed: _player.speed,
        queueIndex: _currentIndex,
      ),
    );
  }

  /// Set the playlist and start playing a specific track
  Future<void> setQueueAndPlay(List<Track> tracks, {int startIndex = 0}) async {
    if (tracks.isEmpty) return;
    _playlist = List.from(tracks);
    _currentIndex = startIndex.clamp(0, _playlist.length - 1);

    queue.add(_playlist.map((t) => t.toMediaItem()).toList());
    await _playCurrent();
  }

  Future<void> _playCurrent() async {
    if (_currentIndex < 0 || _currentIndex >= _playlist.length) return;
    final track = _playlist[_currentIndex];

    // Broadcast current track to UI and AudioService Notification
    _currentTrackController.add(track);
    mediaItem.add(track.toMediaItem());

    try {
      if (track.isLocal) {
        if (track.src.startsWith('content://') || track.src.startsWith('http://') || track.src.startsWith('https://')) {
          await _player.setAudioSource(AudioSource.uri(Uri.parse(track.src)));
        } else {
          await _player.setFilePath(track.src);
        }
      } else {
        await _player.setUrl(track.src);
      }
      await _player.play();
    } catch (e) {
      debugPrint('[AudioHandler] Error playing track ${track.title}: $e');
    }
  }

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> stop() async {
    await _player.stop();
    await effectsManager.releaseSession();
    await super.stop();
  }

  @override
  Future<void> seek(Duration position) => _player.seek(position);

  @override
  Future<void> skipToNext() async {
    if (_playlist.isEmpty) return;
    if (_player.shuffleModeEnabled) {
      _currentIndex = (_currentIndex + 1) % _playlist.length;
    } else {
      _currentIndex = (_currentIndex + 1) % _playlist.length;
    }
    await _playCurrent();
  }

  @override
  Future<void> skipToPrevious() async {
    if (_playlist.isEmpty) return;
    if (_player.position.inSeconds > 3) {
      // If played more than 3 seconds, replay from start of current track
      await _player.seek(Duration.zero);
      return;
    }
    _currentIndex = (_currentIndex - 1 + _playlist.length) % _playlist.length;
    await _playCurrent();
  }

  @override
  Future<void> setSpeed(double speed) => _player.setSpeed(speed);

  @override
  Future<void> setShuffleMode(AudioServiceShuffleMode shuffleMode) async {
    final enabled = shuffleMode != AudioServiceShuffleMode.none;
    await _player.setShuffleModeEnabled(enabled);
  }

  @override
  Future<void> setRepeatMode(AudioServiceRepeatMode repeatMode) async {
    switch (repeatMode) {
      case AudioServiceRepeatMode.none:
        await _player.setLoopMode(LoopMode.off);
        break;
      case AudioServiceRepeatMode.one:
        await _player.setLoopMode(LoopMode.one);
        break;
      case AudioServiceRepeatMode.all:
      case AudioServiceRepeatMode.group:
        await _player.setLoopMode(LoopMode.all);
        break;
    }
  }

  AudioPlayer get player => _player;
  List<Track> get currentPlaylist => List.unmodifiable(_playlist);
  int get currentIndex => _currentIndex;
}

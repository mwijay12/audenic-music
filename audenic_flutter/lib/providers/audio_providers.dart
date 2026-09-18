import 'package:audio_service/audio_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:palette_generator/palette_generator.dart';

import '../core/audio/audenic_audio_handler.dart';
import '../core/effects/audio_effects_manager.dart';
import '../core/theme/app_theme.dart';
import '../data/models/track.dart';
import '../data/repositories/local_media_repository.dart';

/// Singleton AudioHandler Provider (initialized in main.dart)
final audioHandlerProvider = Provider<AudenicAudioHandler>((ref) {
  throw UnimplementedError('audioHandlerProvider must be overridden in ProviderScope');
});

/// Local Media Repository Provider
final localMediaRepoProvider = Provider<LocalMediaRepository>((ref) {
  return LocalMediaRepository();
});

/// Device Scanned Local Tracks Provider
final localTracksProvider = FutureProvider<List<Track>>((ref) async {
  final repo = ref.watch(localMediaRepoProvider);
  return await repo.getLocalTracks();
});

/// Current Playing Track Stream Provider
final currentTrackProvider = StreamProvider<Track?>((ref) {
  final handler = ref.watch(audioHandlerProvider);
  return handler.currentTrackStream;
});

/// AudioService PlaybackState Stream Provider
final playbackStateProvider = StreamProvider<PlaybackState>((ref) {
  final handler = ref.watch(audioHandlerProvider);
  return handler.playbackState;
});

/// Current Playback Position Stream Provider
final positionStreamProvider = StreamProvider<Duration>((ref) {
  final handler = ref.watch(audioHandlerProvider);
  return handler.player.positionStream;
});

/// Current Playback Duration Stream Provider
final durationStreamProvider = StreamProvider<Duration?>((ref) {
  final handler = ref.watch(audioHandlerProvider);
  return handler.player.durationStream;
});

/// Dynamic Accent Color Provider (Spotube-style cover art palette generation)
class DynamicAccentNotifier extends Notifier<Color> {
  @override
  Color build() {
    ref.listen<AsyncValue<Track?>>(currentTrackProvider, (prev, next) {
      final track = next.value;
      if (track != null && track.coverUrl != null && track.coverUrl!.isNotEmpty) {
        _extractColor(track.coverUrl!);
      } else {
        state = AppColors.primary;
      }
    });
    return AppColors.primary;
  }

  Future<void> _extractColor(String url) async {
    try {
      final palette = await PaletteGenerator.fromImageProvider(
        NetworkImage(url),
        maximumColorCount: 12,
      );
      final dominant = palette.vibrantColor?.color ??
          palette.dominantColor?.color ??
          AppColors.primary;

      // Ensure color is not too dark or light for readability
      final hsl = HSLColor.fromColor(dominant);
      final adjusted = hsl.withLightness(hsl.lightness.clamp(0.45, 0.70)).toColor();
      state = adjusted;
    } catch (_) {
      state = AppColors.primary;
    }
  }
}

final dynamicAccentColorProvider = NotifierProvider<DynamicAccentNotifier, Color>(
  () => DynamicAccentNotifier(),
);

/// Equalizer State
class EqualizerState {
  final bool isEnabled;
  final List<double> bands;
  final double bassBoost;
  final double loudness;
  final String currentPreset;

  const EqualizerState({
    required this.isEnabled,
    required this.bands,
    required this.bassBoost,
    required this.loudness,
    required this.currentPreset,
  });

  EqualizerState copyWith({
    bool? isEnabled,
    List<double>? bands,
    double? bassBoost,
    double? loudness,
    String? currentPreset,
  }) {
    return EqualizerState(
      isEnabled: isEnabled ?? this.isEnabled,
      bands: bands ?? this.bands,
      bassBoost: bassBoost ?? this.bassBoost,
      loudness: loudness ?? this.loudness,
      currentPreset: currentPreset ?? this.currentPreset,
    );
  }
}

class EqualizerNotifier extends Notifier<EqualizerState> {
  @override
  EqualizerState build() {
    final effects = ref.watch(audioHandlerProvider).effectsManager;
    return EqualizerState(
      isEnabled: effects.isEnabled,
      bands: effects.bandLevels,
      bassBoost: effects.bassBoost,
      loudness: effects.loudnessGain,
      currentPreset: effects.currentPreset,
    );
  }

  Future<void> setEnabled(bool enabled) async {
    final effects = ref.read(audioHandlerProvider).effectsManager;
    await effects.setEnabled(enabled);
    state = state.copyWith(isEnabled: enabled);
  }

  Future<void> setBand(int bandIndex, double gainDb) async {
    final effects = ref.read(audioHandlerProvider).effectsManager;
    await effects.setBandLevel(bandIndex, gainDb);
    state = state.copyWith(
      bands: effects.bandLevels,
      currentPreset: effects.currentPreset,
    );
  }

  Future<void> setBassBoost(double value) async {
    final effects = ref.read(audioHandlerProvider).effectsManager;
    await effects.setBassBoost(value);
    state = state.copyWith(
      bassBoost: value,
      bands: effects.bandLevels,
      currentPreset: effects.currentPreset,
    );
  }

  Future<void> setLoudness(double value) async {
    final effects = ref.read(audioHandlerProvider).effectsManager;
    await effects.setLoudness(value);
    state = state.copyWith(loudness: value);
  }

  Future<void> applyPreset(EqualizerPreset preset) async {
    final effects = ref.read(audioHandlerProvider).effectsManager;
    await effects.applyPreset(preset);
    state = state.copyWith(
      bands: effects.bandLevels,
      bassBoost: effects.bassBoost,
      currentPreset: preset.name,
    );
  }
}

final equalizerProvider = NotifierProvider<EqualizerNotifier, EqualizerState>(
  () => EqualizerNotifier(),
);

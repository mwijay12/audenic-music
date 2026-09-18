import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:shared_preferences/shared_preferences.dart';

class EqualizerPreset {
  final String name;
  final List<double> bands; // gain values in dB (typically -10.0 to +10.0)
  final double bassBoost;   // 0.0 to 1.0

  const EqualizerPreset({
    required this.name,
    required this.bands,
    this.bassBoost = 0.0,
  });

  Map<String, dynamic> toJson() => {
    'name': name,
    'bands': bands,
    'bassBoost': bassBoost,
  };

  factory EqualizerPreset.fromJson(Map<String, dynamic> json) => EqualizerPreset(
    name: json['name'] as String,
    bands: (json['bands'] as List<dynamic>).map((e) => (e as num).toDouble()).toList(),
    bassBoost: (json['bassBoost'] as num?)?.toDouble() ?? 0.0,
  );
}

class AudioEffectsManager {
  static const MethodChannel _channel = MethodChannel('fm.audenic.audio/effects');
  static const String _prefKeyEnabled = 'audenic_eq_enabled';
  static const String _prefKeyBands = 'audenic_eq_bands';
  static const String _prefKeyBassBoost = 'audenic_eq_bass_boost';
  static const String _prefKeyLoudness = 'audenic_eq_loudness';
  static const String _prefKeyPreset = 'audenic_eq_preset';

  static final List<EqualizerPreset> presets = [
    const EqualizerPreset(name: 'Flat', bands: [0.0, 0.0, 0.0, 0.0, 0.0], bassBoost: 0.0),
    const EqualizerPreset(name: 'Bass Boost', bands: [6.0, 4.5, 1.0, 0.0, 0.0], bassBoost: 0.8),
    const EqualizerPreset(name: 'Rock', bands: [4.0, 2.0, -1.0, 2.5, 4.5], bassBoost: 0.4),
    const EqualizerPreset(name: 'Pop', bands: [-1.0, 2.0, 4.0, 2.0, -1.0], bassBoost: 0.3),
    const EqualizerPreset(name: 'Vocal Boost', bands: [-2.0, 1.0, 4.5, 3.0, 1.0], bassBoost: 0.1),
    const EqualizerPreset(name: 'Electronic', bands: [5.0, 3.5, 0.0, 2.0, 4.0], bassBoost: 0.6),
    const EqualizerPreset(name: 'Acoustic', bands: [3.5, 2.0, 1.0, 2.5, 3.0], bassBoost: 0.2),
    const EqualizerPreset(name: 'Jazz', bands: [3.0, 1.5, -1.0, 2.0, 3.5], bassBoost: 0.3),
  ];

  final AndroidEqualizer? androidEqualizer;
  final AndroidLoudnessEnhancer? androidLoudness;

  bool _isEnabled = true;
  List<double> _bandLevels = [0.0, 0.0, 0.0, 0.0, 0.0];
  double _bassBoost = 0.0;
  double _loudnessGain = 0.0;
  String _currentPreset = 'Flat';
  int? _activeSessionId;

  AudioEffectsManager({
    this.androidEqualizer,
    this.androidLoudness,
  });

  bool get isEnabled => _isEnabled;
  List<double> get bandLevels => List.unmodifiable(_bandLevels);
  double get bassBoost => _bassBoost;
  double get loudnessGain => _loudnessGain;
  String get currentPreset => _currentPreset;
  int? get activeSessionId => _activeSessionId;

  /// Load persisted EQ settings
  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _isEnabled = prefs.getBool(_prefKeyEnabled) ?? true;
      _bassBoost = prefs.getDouble(_prefKeyBassBoost) ?? 0.0;
      _loudnessGain = prefs.getDouble(_prefKeyLoudness) ?? 0.0;
      _currentPreset = prefs.getString(_prefKeyPreset) ?? 'Flat';

      final bandsStr = prefs.getString(_prefKeyBands);
      if (bandsStr != null) {
        final decoded = jsonDecode(bandsStr) as List<dynamic>;
        _bandLevels = decoded.map((e) => (e as num).toDouble()).toList();
      }

      if (androidEqualizer != null) {
        await androidEqualizer!.setEnabled(_isEnabled);
        await _applyBandsToNative();
      }

      if (androidLoudness != null) {
        await androidLoudness!.setEnabled(_loudnessGain > 0.0);
        await androidLoudness!.setTargetGain(_loudnessGain);
      }
    } catch (e) {
      debugPrint('[AudioEffects] Init error: $e');
    }
  }

  /// Attach to Android AudioSession ID and broadcast system intent
  Future<void> onAudioSessionId(int sessionId) async {
    if (sessionId == 0 || sessionId == _activeSessionId) return;
    _activeSessionId = sessionId;

    if (defaultTargetPlatform == TargetPlatform.android) {
      try {
        await _channel.invokeMethod('openAudioEffectSession', {
          'sessionId': sessionId,
        });
        debugPrint('[AudioEffects] Successfully opened AudioEffect session $sessionId');
      } catch (e) {
        debugPrint('[AudioEffects] Broadcast session error: $e');
      }
    }
  }

  /// Release Android AudioSession
  Future<void> releaseSession() async {
    if (_activeSessionId == null) return;
    if (defaultTargetPlatform == TargetPlatform.android) {
      try {
        await _channel.invokeMethod('closeAudioEffectSession', {
          'sessionId': _activeSessionId,
        });
      } catch (e) {
        debugPrint('[AudioEffects] Close session error: $e');
      }
    }
    _activeSessionId = null;
  }

  Future<void> setEnabled(bool enabled) async {
    _isEnabled = enabled;
    if (androidEqualizer != null) {
      await androidEqualizer!.setEnabled(enabled);
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefKeyEnabled, enabled);
  }

  Future<void> setBandLevel(int bandIndex, double gainDb) async {
    if (bandIndex < 0 || bandIndex >= _bandLevels.length) return;
    _bandLevels[bandIndex] = gainDb.clamp(-10.0, 10.0);
    _currentPreset = 'Custom';

    await _applyBandsToNative();
    await _persist();
  }

  Future<void> setBassBoost(double value) async {
    _bassBoost = value.clamp(0.0, 1.0);
    _currentPreset = 'Custom';

    // Boost lowest two bands proportionally for hardware-independent bass impact
    final boostGain = _bassBoost * 6.0;
    _bandLevels[0] = boostGain;
    _bandLevels[1] = boostGain * 0.75;

    await _applyBandsToNative();
    await _persist();
  }

  Future<void> setLoudness(double gainDb) async {
    _loudnessGain = gainDb.clamp(0.0, 12.0);
    if (androidLoudness != null) {
      await androidLoudness!.setEnabled(_loudnessGain > 0.0);
      await androidLoudness!.setTargetGain(_loudnessGain);
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_prefKeyLoudness, _loudnessGain);
  }

  Future<void> applyPreset(EqualizerPreset preset) async {
    _currentPreset = preset.name;
    _bandLevels = List.from(preset.bands);
    _bassBoost = preset.bassBoost;

    await _applyBandsToNative();
    await _persist();
  }

  Future<void> _applyBandsToNative() async {
    if (androidEqualizer == null || !_isEnabled) return;
    try {
      final params = await androidEqualizer!.parameters;
      final nativeBands = params.bands;

      for (int i = 0; i < nativeBands.length && i < _bandLevels.length; i++) {
        final band = nativeBands[i];
        final minDecibels = params.minDecibels;
        final maxDecibels = params.maxDecibels;

        // Map our -10dB..+10dB to native range
        final targetDb = _bandLevels[i].clamp(minDecibels, maxDecibels);
        await band.setGain(targetDb);
      }
    } catch (e) {
      debugPrint('[AudioEffects] Apply bands error: $e');
    }
  }

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefKeyBands, jsonEncode(_bandLevels));
      await prefs.setDouble(_prefKeyBassBoost, _bassBoost);
      await prefs.setString(_prefKeyPreset, _currentPreset);
    } catch (e) {
      debugPrint('[AudioEffects] Persist error: $e');
    }
  }
}

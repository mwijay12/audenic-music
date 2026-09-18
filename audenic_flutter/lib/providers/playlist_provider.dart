import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/audio/sleep_timer_manager.dart';
import '../data/models/playlist.dart';
import 'audio_providers.dart';

/// Favorites Notifier
class FavoritesNotifier extends Notifier<Set<String>> {
  static const String _prefKey = 'audenic_favorite_ids';

  @override
  Set<String> build() {
    _load();
    return {};
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList(_prefKey) ?? [];
      state = list.toSet();
    } catch (_) {}
  }

  Future<void> toggle(String trackId) async {
    final next = Set<String>.from(state);
    if (next.contains(trackId)) {
      next.remove(trackId);
    } else {
      next.add(trackId);
    }
    state = next;

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_prefKey, next.toList());
    } catch (_) {}
  }

  bool isFavorite(String trackId) => state.contains(trackId);
}

final favoritesProvider = NotifierProvider<FavoritesNotifier, Set<String>>(
  () => FavoritesNotifier(),
);

/// Playlists Notifier
class PlaylistsNotifier extends Notifier<List<Playlist>> {
  static const String _prefKey = 'audenic_custom_playlists';

  @override
  List<Playlist> build() {
    _load();
    return [];
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = prefs.getString(_prefKey);
      if (jsonString != null) {
        final decoded = jsonDecode(jsonString) as List<dynamic>;
        state = decoded.map((e) => Playlist.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
  }

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final encoded = jsonEncode(state.map((p) => p.toJson()).toList());
      await prefs.setString(_prefKey, encoded);
    } catch (_) {}
  }

  Future<void> createPlaylist(String name) async {
    final newPl = Playlist(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      name: name.trim().isEmpty ? 'My Playlist' : name.trim(),
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
    state = [...state, newPl];
    await _persist();
  }

  Future<void> deletePlaylist(String id) async {
    state = state.where((p) => p.id != id).toList();
    await _persist();
  }

  Future<void> addTrack(String playlistId, String trackId) async {
    state = [
      for (final p in state)
        if (p.id == playlistId)
          if (!p.trackIds.contains(trackId))
            p.copyWith(trackIds: [...p.trackIds, trackId])
          else
            p
        else
          p
    ];
    await _persist();
  }

  Future<void> removeTrack(String playlistId, String trackId) async {
    state = [
      for (final p in state)
        if (p.id == playlistId)
          p.copyWith(trackIds: p.trackIds.where((id) => id != trackId).toList())
        else
          p
    ];
    await _persist();
  }
}

final playlistsProvider = NotifierProvider<PlaylistsNotifier, List<Playlist>>(
  () => PlaylistsNotifier(),
);

/// Sleep Timer Provider
final sleepTimerManagerProvider = Provider<SleepTimerManager>((ref) {
  final handler = ref.watch(audioHandlerProvider);
  final manager = SleepTimerManager(handler);
  ref.onDispose(() => manager.cancel());
  return manager;
});

final sleepTimerRemainingProvider = StreamProvider<int>((ref) {
  final manager = ref.watch(sleepTimerManagerProvider);
  return manager.remainingSecondsStream;
});

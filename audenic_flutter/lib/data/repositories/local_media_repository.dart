import 'package:flutter/foundation.dart';
import 'package:on_audio_query/on_audio_query.dart';
import 'package:permission_handler/permission_handler.dart';

import '../models/track.dart';

class LocalMediaRepository {
  final OnAudioQuery _audioQuery = OnAudioQuery();

  OnAudioQuery get audioQuery => _audioQuery;

  /// Check and request Android/iOS media permissions
  Future<bool> checkAndRequestPermissions() async {
    if (kIsWeb) return true;

    try {
      // For Android 13+ (SDK 33+), check audio permission
      final audioStatus = await Permission.audio.status;
      if (audioStatus.isGranted) return true;

      // Request audio permission
      final requestResult = await Permission.audio.request();
      if (requestResult.isGranted) return true;

      // Fallback for Android 12 and below (READ_EXTERNAL_STORAGE)
      final storageStatus = await Permission.storage.request();
      if (storageStatus.isGranted) return true;

      // Fallback using OnAudioQuery's internal checker
      return await _audioQuery.checkAndRequest(retryRequest: true);
    } catch (e) {
      debugPrint('[LocalMediaRepository] Permission error: $e');
      return await _audioQuery.checkAndRequest(retryRequest: true);
    }
  }

  /// Query all local audio files from device MediaStore
  Future<List<Track>> getLocalTracks() async {
    try {
      final hasPerm = await checkAndRequestPermissions();
      if (!hasPerm) {
        debugPrint('[LocalMediaRepository] Storage/Audio permission not granted');
        return [];
      }

      final songs = await _audioQuery.querySongs(
        sortType: SongSortType.DATE_ADDED,
        orderType: OrderType.DESC_OR_GREATER,
        uriType: UriType.EXTERNAL,
        ignoreCase: true,
      );

      final List<Track> tracks = [];
      for (final song in songs) {
        // Filter out tiny ringtones or zero-duration files (e.g. < 5 seconds)
        final durationSec = (song.duration ?? 0) ~/ 1000;
        if (durationSec < 5 && (song.size < 100000)) continue;

        tracks.add(
          Track(
            id: song.id.toString(),
            title: song.title.trim().isNotEmpty ? song.title : 'Unknown Title',
            artist: song.artist != null && song.artist != '<unknown>' ? song.artist! : 'Unknown Artist',
            album: song.album != null && song.album != '<unknown>' ? song.album! : 'On Device',
            src: song.uri ?? song.data,
            duration: durationSec,
            isLocal: true,
            dateAdded: song.dateAdded,
            size: song.size,
          ),
        );
      }

      return tracks;
    } catch (e) {
      debugPrint('[LocalMediaRepository] Error querying songs: $e');
      return [];
    }
  }

  /// Query all local albums
  Future<List<AlbumModel>> getAlbums() async {
    try {
      final hasPerm = await checkAndRequestPermissions();
      if (!hasPerm) return [];
      return await _audioQuery.queryAlbums();
    } catch (e) {
      debugPrint('[LocalMediaRepository] Error querying albums: $e');
      return [];
    }
  }

  /// Query all local artists
  Future<List<ArtistModel>> getArtists() async {
    try {
      final hasPerm = await checkAndRequestPermissions();
      if (!hasPerm) return [];
      return await _audioQuery.queryArtists();
    } catch (e) {
      debugPrint('[LocalMediaRepository] Error querying artists: $e');
      return [];
    }
  }
}

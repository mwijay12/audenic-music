import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import '../data/models/track.dart';

class FirestoreMusicService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  static const Set<String> adminEmails = {
    'audenic.audio@gmail.com',
    'mwijaydavie@gmail.com',
  };

  bool isAdmin(String? email) {
    if (email == null) return false;
    final clean = email.trim().toLowerCase();
    return adminEmails.contains(clean) || clean.endsWith('@audenic.fm');
  }

  /// Real-time stream of admin published songs from Cloudflare R2
  Stream<List<Track>> getPublishedSongsStream() {
    return _firestore
        .collection('songs')
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs.map((doc) {
        final data = doc.data();
        return Track(
          id: doc.id,
          title: data['title'] as String? ?? 'Untitled',
          artist: data['artist'] as String? ?? 'Audenic Artist',
          album: data['album'] as String? ?? 'Cloudflare Stream',
          src: data['src'] as String? ?? '',
          coverUrl: data['cover'] as String? ?? data['coverUrl'] as String?,
          duration: (data['duration'] as num?)?.toInt() ?? 0,
          isLocal: false,
          dateAdded: (data['createdAt'] is int)
              ? data['createdAt'] as int
              : DateTime.now().millisecondsSinceEpoch,
        );
      }).where((t) => t.src.isNotEmpty).toList();
    });
  }

  /// Publish new song to Firestore
  Future<bool> publishSong({
    required String id,
    required String title,
    required String artist,
    String album = 'Cloudflare Stream',
    required String src,
    String? coverUrl,
    int duration = 0,
    List<String> tags = const [],
  }) async {
    try {
      await _firestore.collection('songs').doc(id).set({
        'id': id,
        'title': title,
        'artist': artist,
        'album': album,
        'src': src,
        'cover': coverUrl ?? '',
        'coverUrl': coverUrl ?? '',
        'duration': duration,
        'tags': tags,
        'createdAt': DateTime.now().millisecondsSinceEpoch,
      });
      return true;
    } catch (e) {
      debugPrint('[FirestoreMusicService] Error saving song: $e');
      return false;
    }
  }

  /// Delete published song
  Future<bool> deletePublishedSong(String id) async {
    try {
      await _firestore.collection('songs').doc(id).delete();
      return true;
    } catch (e) {
      debugPrint('[FirestoreMusicService] Error deleting song: $e');
      return false;
    }
  }
}

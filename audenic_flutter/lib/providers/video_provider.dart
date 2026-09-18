import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/models/video_item.dart';

// Sample fallback reels for demo & offline enjoyment
const List<VideoItem> defaultDemoReels = [
  VideoItem(
    id: 'demo_1',
    title: 'Neon Cyber Beats - Synthwave Live',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
    duration: 15,
    isLocal: false,
    category: 'music',
  ),
  VideoItem(
    id: 'demo_2',
    title: 'Deep Focus Lo-Fi Coding Beats',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600',
    duration: 15,
    isLocal: false,
    category: 'study',
  ),
  VideoItem(
    id: 'demo_3',
    title: 'Acoustic Guitar Sunrise Chords',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    coverUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600',
    duration: 15,
    isLocal: false,
    category: 'reels',
  ),
];

class ReelsCategoryNotifier extends Notifier<String> {
  @override
  String build() => 'all';

  void setCategory(String cat) => state = cat;
}

final reelsCategoryProvider = NotifierProvider<ReelsCategoryNotifier, String>(
  () => ReelsCategoryNotifier(),
);

class ReelsNotifier extends Notifier<List<VideoItem>> {
  static const String _prefKeyLikes = 'audenic_liked_reels';

  @override
  List<VideoItem> build() {
    _loadLiked();
    return defaultDemoReels;
  }

  Future<void> _loadLiked() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final likedIds = prefs.getStringList(_prefKeyLikes) ?? [];
      state = [
        for (final item in state)
          item.copyWith(isLiked: likedIds.contains(item.id))
      ];
    } catch (_) {}
  }

  Future<void> toggleLike(String id) async {
    state = [
      for (final item in state)
        if (item.id == id) item.copyWith(isLiked: !item.isLiked) else item
    ];
    try {
      final prefs = await SharedPreferences.getInstance();
      final liked = state.where((v) => v.isLiked).map((v) => v.id).toList();
      await prefs.setStringList(_prefKeyLikes, liked);
    } catch (_) {}
  }

  void addVideo(VideoItem item) {
    state = [item, ...state];
  }
}

final reelsProvider = NotifierProvider<ReelsNotifier, List<VideoItem>>(
  () => ReelsNotifier(),
);

/// Filtered Reels based on currently selected category
final filteredReelsProvider = Provider<List<VideoItem>>((ref) {
  final all = ref.watch(reelsProvider);
  final cat = ref.watch(reelsCategoryProvider);

  if (cat == 'all') return all;
  return all.where((item) => item.category == cat).toList();
});

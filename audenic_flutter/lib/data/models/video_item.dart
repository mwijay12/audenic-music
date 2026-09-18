class VideoItem {
  final String id;
  final String title;
  final String src;
  final String? coverUrl;
  final int duration; // in seconds
  final bool isLocal;
  final String category; // 'reels', 'music', 'study'
  final bool isLiked;

  const VideoItem({
    required this.id,
    required this.title,
    required this.src,
    this.coverUrl,
    this.duration = 0,
    this.isLocal = true,
    this.category = 'reels',
    this.isLiked = false,
  });

  VideoItem copyWith({
    String? id,
    String? title,
    String? src,
    String? coverUrl,
    int? duration,
    bool? isLocal,
    String? category,
    bool? isLiked,
  }) {
    return VideoItem(
      id: id ?? this.id,
      title: title ?? this.title,
      src: src ?? this.src,
      coverUrl: coverUrl ?? this.coverUrl,
      duration: duration ?? this.duration,
      isLocal: isLocal ?? this.isLocal,
      category: category ?? this.category,
      isLiked: isLiked ?? this.isLiked,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'src': src,
    'coverUrl': coverUrl,
    'duration': duration,
    'isLocal': isLocal,
    'category': category,
    'isLiked': isLiked,
  };

  factory VideoItem.fromJson(Map<String, dynamic> json) => VideoItem(
    id: json['id'] as String,
    title: json['title'] as String? ?? 'Untitled Video',
    src: json['src'] as String? ?? '',
    coverUrl: json['coverUrl'] as String?,
    duration: json['duration'] as int? ?? 0,
    isLocal: json['isLocal'] as bool? ?? true,
    category: json['category'] as String? ?? 'reels',
    isLiked: json['isLiked'] as bool? ?? false,
  );
}

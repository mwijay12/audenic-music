class Playlist {
  final String id;
  final String name;
  final int createdAt;
  final List<String> trackIds;
  final String? coverUrl;

  const Playlist({
    required this.id,
    required this.name,
    required this.createdAt,
    this.trackIds = const [],
    this.coverUrl,
  });

  Playlist copyWith({
    String? id,
    String? name,
    int? createdAt,
    List<String>? trackIds,
    String? coverUrl,
  }) {
    return Playlist(
      id: id ?? this.id,
      name: name ?? this.name,
      createdAt: createdAt ?? this.createdAt,
      trackIds: trackIds ?? this.trackIds,
      coverUrl: coverUrl ?? this.coverUrl,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'createdAt': createdAt,
    'trackIds': trackIds,
    'coverUrl': coverUrl,
  };

  factory Playlist.fromJson(Map<String, dynamic> json) => Playlist(
    id: json['id'] as String,
    name: json['name'] as String? ?? 'New Playlist',
    createdAt: json['createdAt'] as int? ?? DateTime.now().millisecondsSinceEpoch,
    trackIds: (json['trackIds'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
    coverUrl: json['coverUrl'] as String?,
  );
}

import 'package:audio_service/audio_service.dart';

class LyricLine {
  final int timeMs;
  final String text;

  const LyricLine({
    required this.timeMs,
    required this.text,
  });

  Map<String, dynamic> toJson() => {
    'timeMs': timeMs,
    'text': text,
  };

  factory LyricLine.fromJson(Map<String, dynamic> json) => LyricLine(
    timeMs: json['timeMs'] as int? ?? 0,
    text: json['text'] as String? ?? '',
  );
}

class Track {
  final String id;
  final String title;
  final String artist;
  final String album;
  final String src;
  final String? coverUrl;
  final int duration; // in seconds
  final bool isLocal;
  final int? dateAdded;
  final int? size;
  final bool isLiked;
  final List<LyricLine>? lyrics;

  const Track({
    required this.id,
    required this.title,
    required this.artist,
    this.album = 'On Device',
    required this.src,
    this.coverUrl,
    this.duration = 0,
    this.isLocal = true,
    this.dateAdded,
    this.size,
    this.isLiked = false,
    this.lyrics,
  });

  Track copyWith({
    String? id,
    String? title,
    String? artist,
    String? album,
    String? src,
    String? coverUrl,
    int? duration,
    bool? isLocal,
    int? dateAdded,
    int? size,
    bool? isLiked,
    List<LyricLine>? lyrics,
  }) {
    return Track(
      id: id ?? this.id,
      title: title ?? this.title,
      artist: artist ?? this.artist,
      album: album ?? this.album,
      src: src ?? this.src,
      coverUrl: coverUrl ?? this.coverUrl,
      duration: duration ?? this.duration,
      isLocal: isLocal ?? this.isLocal,
      dateAdded: dateAdded ?? this.dateAdded,
      size: size ?? this.size,
      isLiked: isLiked ?? this.isLiked,
      lyrics: lyrics ?? this.lyrics,
    );
  }

  MediaItem toMediaItem() {
    return MediaItem(
      id: id,
      title: title,
      artist: artist,
      album: album,
      duration: Duration(seconds: duration),
      artUri: coverUrl != null && coverUrl!.isNotEmpty ? Uri.tryParse(coverUrl!) : null,
      extras: {
        'src': src,
        'isLocal': isLocal,
        'size': size,
      },
    );
  }

  factory Track.fromMediaItem(MediaItem item) {
    return Track(
      id: item.id,
      title: item.title,
      artist: item.artist ?? 'Unknown Artist',
      album: item.album ?? 'Audenic',
      src: item.extras?['src'] as String? ?? item.id,
      coverUrl: item.artUri?.toString(),
      duration: item.duration?.inSeconds ?? 0,
      isLocal: item.extras?['isLocal'] as bool? ?? false,
      size: item.extras?['size'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'artist': artist,
    'album': album,
    'src': src,
    'coverUrl': coverUrl,
    'duration': duration,
    'isLocal': isLocal,
    'dateAdded': dateAdded,
    'size': size,
    'isLiked': isLiked,
  };

  factory Track.fromJson(Map<String, dynamic> json) => Track(
    id: json['id'] as String,
    title: json['title'] as String? ?? 'Unknown',
    artist: json['artist'] as String? ?? 'Unknown Artist',
    album: json['album'] as String? ?? 'On Device',
    src: json['src'] as String? ?? '',
    coverUrl: json['coverUrl'] as String?,
    duration: json['duration'] as int? ?? 0,
    isLocal: json['isLocal'] as bool? ?? true,
    dateAdded: json['dateAdded'] as int?,
    size: json['size'] as int?,
    isLiked: json['isLiked'] as bool? ?? false,
  );
}

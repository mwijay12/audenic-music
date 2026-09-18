import '../../data/models/track.dart';

class LrcWord {
  final int timeMs;
  final String text;

  const LrcWord({required this.timeMs, required this.text});
}

class LrcMetadata {
  String? title;
  String? artist;
  String? album;
  String? author;
  int offset;

  LrcMetadata({
    this.title,
    this.artist,
    this.album,
    this.author,
    this.offset = 0,
  });
}

class ParsedLrc {
  final List<LyricLine> lines;
  final LrcMetadata metadata;
  final String raw;

  const ParsedLrc({
    required this.lines,
    required this.metadata,
    required this.raw,
  });
}

class LrcParser {
  static final RegExp _metaRegex = RegExp(r'^\[(\w+):(.+)\]$');
  static final RegExp _tsRegex = RegExp(r'\[(\d{1,2}):(\d{2})\.(\d{2,3})\]');

  static int _timestampToMs(String min, String sec, String centisec) {
    final m = int.tryParse(min) ?? 0;
    final s = int.tryParse(sec) ?? 0;
    final cs = centisec.length == 3
        ? (int.tryParse(centisec) ?? 0)
        : (int.tryParse(centisec) ?? 0) * 10;
    return m * 60 * 1000 + s * 1000 + cs;
  }

  static ParsedLrc parse(String rawContent) {
    final metadata = LrcMetadata();
    final List<LyricLine> rawLines = [];

    if (rawContent.trim().isEmpty) {
      return ParsedLrc(lines: [], metadata: metadata, raw: rawContent);
    }

    final normalized = rawContent.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
    final fileLines = normalized.split('\n');

    for (final fileLine in fileLines) {
      final trimmed = fileLine.trim();
      if (trimmed.isEmpty) continue;

      // Check metadata
      final metaMatch = _metaRegex.firstMatch(trimmed);
      if (metaMatch != null) {
        final tag = metaMatch.group(1)!.toLowerCase().trim();
        final val = metaMatch.group(2)!.trim();
        switch (tag) {
          case 'ti': metadata.title = val; break;
          case 'ar': metadata.artist = val; break;
          case 'al': metadata.album = val; break;
          case 'by': metadata.author = val; break;
          case 'offset': metadata.offset = int.tryParse(val) ?? 0; break;
        }
        continue;
      }

      // Find all timestamps on this line: [01:23.45]
      final matches = _tsRegex.allMatches(trimmed).toList();
      if (matches.isEmpty) continue;

      final lastTsEnd = trimmed.lastIndexOf(']') + 1;
      final textPart = trimmed.substring(lastTsEnd).trim();

      for (final m in matches) {
        final ms = _timestampToMs(m.group(1)!, m.group(2)!, m.group(3)!);
        final adjusted = (ms + metadata.offset).clamp(0, 86400000);
        rawLines.add(LyricLine(timeMs: adjusted, text: textPart));
      }
    }

    // Sort chronologically and deduplicate
    rawLines.sort((a, b) => a.timeMs.compareTo(b.timeMs));

    final List<LyricLine> lines = [];
    final seen = <int>{};
    for (final l in rawLines) {
      if (!seen.contains(l.timeMs)) {
        seen.add(l.timeMs);
        lines.add(l);
      }
    }

    return ParsedLrc(lines: lines, metadata: metadata, raw: rawContent);
  }

  /// Binary search or linear scan to find active lyric index given current position in ms
  static int findActiveIndex(List<LyricLine> lyrics, int currentPosMs) {
    if (lyrics.isEmpty) return -1;
    if (currentPosMs < lyrics.first.timeMs) return 0;

    int low = 0;
    int high = lyrics.length - 1;
    int result = 0;

    while (low <= high) {
      final mid = (low + high) ~/ 2;
      if (lyrics[mid].timeMs <= currentPosMs) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return result;
  }
}

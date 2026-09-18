import 'package:flutter_test/flutter_test.dart';
import 'package:audenic_flutter/core/utils/lrc_parser.dart';

void main() {
  group('LrcParser Tests', () {
    test('Parses standard LRC timestamps and metadata', () {
      const sampleLrc = '''
[ti:Audenic Theme]
[ar:Audenic]
[al:Flutter Edition]
[00:05.50]Welcome to the new era
[00:12.80]Pure hardware audio effects
[00:20.10]High fidelity sound
''';

      final result = LrcParser.parse(sampleLrc);

      expect(result.metadata.title, equals('Audenic Theme'));
      expect(result.metadata.artist, equals('Audenic'));
      expect(result.metadata.album, equals('Flutter Edition'));
      expect(result.lines.length, equals(3));
      expect(result.lines[0].timeMs, equals(5500));
      expect(result.lines[0].text, equals('Welcome to the new era'));
      expect(result.lines[1].timeMs, equals(12800));
    });

    test('Finds active lyric index by playback position', () {
      const sampleLrc = '''
[00:02.00]Line 1
[00:06.00]Line 2
[00:10.00]Line 3
''';

      final result = LrcParser.parse(sampleLrc);

      expect(LrcParser.findActiveIndex(result.lines, 1000), equals(0));
      expect(LrcParser.findActiveIndex(result.lines, 2500), equals(0));
      expect(LrcParser.findActiveIndex(result.lines, 7000), equals(1));
      expect(LrcParser.findActiveIndex(result.lines, 15000), equals(2));
    });
  });
}

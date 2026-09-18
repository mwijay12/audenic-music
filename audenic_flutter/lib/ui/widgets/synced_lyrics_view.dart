import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:scrollable_positioned_list/scrollable_positioned_list.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/lrc_parser.dart';
import '../../data/models/track.dart';
import '../../providers/audio_providers.dart';

class SyncedLyricsView extends ConsumerStatefulWidget {
  final List<LyricLine> lyrics;
  final VoidCallback? onDismiss;

  const SyncedLyricsView({
    super.key,
    required this.lyrics,
    this.onDismiss,
  });

  @override
  ConsumerState<SyncedLyricsView> createState() => _SyncedLyricsViewState();
}

class _SyncedLyricsViewState extends ConsumerState<SyncedLyricsView> {
  final ItemScrollController _itemScrollController = ItemScrollController();
  final ItemPositionsListener _itemPositionsListener = ItemPositionsListener.create();
  int _lastActiveIndex = -1;

  @override
  Widget build(BuildContext context) {
    final positionAsync = ref.watch(positionStreamProvider);
    final accentColor = ref.watch(dynamicAccentColorProvider);
    final positionMs = positionAsync.value?.inMilliseconds ?? 0;

    if (widget.lyrics.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lyrics_outlined, size: 48, color: AppColors.textMuted.withValues(alpha: 0.5)),
            const SizedBox(height: 12),
            const Text(
              'No synchronized lyrics available',
              style: TextStyle(color: AppColors.textMuted, fontSize: 14),
            ),
          ],
        ),
      );
    }

    final activeIndex = LrcParser.findActiveIndex(widget.lyrics, positionMs);

    // Auto-scroll when line changes
    if (activeIndex != _lastActiveIndex && activeIndex >= 0) {
      _lastActiveIndex = activeIndex;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_itemScrollController.isAttached) {
          _itemScrollController.scrollTo(
            index: activeIndex,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOutCubic,
            alignment: 0.4, // Keep active lyric slightly above center
          );
        }
      });
    }

    return ScrollablePositionedList.builder(
      itemCount: widget.lyrics.length,
      itemScrollController: _itemScrollController,
      itemPositionsListener: _itemPositionsListener,
      padding: const EdgeInsets.symmetric(vertical: 80, horizontal: 24),
      itemBuilder: (context, index) {
        final line = widget.lyrics[index];
        final isActive = index == activeIndex;

        return GestureDetector(
          onTap: () {
            ref.read(audioHandlerProvider).seek(Duration(milliseconds: line.timeMs));
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeOut,
              style: TextStyle(
                fontSize: isActive ? 22 : 17,
                fontWeight: isActive ? FontWeight.w800 : FontWeight.w500,
                color: isActive
                    ? accentColor
                    : Colors.white.withValues(alpha: index < activeIndex ? 0.35 : 0.6),
                height: 1.4,
                letterSpacing: isActive ? -0.2 : 0,
              ),
              child: Text(
                line.text.isEmpty ? '♪' : line.text,
                textAlign: TextAlign.center,
              ),
            ),
          ),
        );
      },
    );
  }
}

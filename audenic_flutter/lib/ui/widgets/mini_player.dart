import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:on_audio_query/on_audio_query.dart';

import '../../core/theme/app_theme.dart';
import '../../providers/audio_providers.dart';
import '../screens/player/now_playing_screen.dart';

class MiniPlayer extends ConsumerWidget {
  const MiniPlayer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentTrackAsync = ref.watch(currentTrackProvider);
    final playbackStateAsync = ref.watch(playbackStateProvider);
    final positionAsync = ref.watch(positionStreamProvider);
    final durationAsync = ref.watch(durationStreamProvider);
    final accentColor = ref.watch(dynamicAccentColorProvider);

    final track = currentTrackAsync.value;
    if (track == null) return const SizedBox.shrink();

    final isPlaying = playbackStateAsync.value?.playing ?? false;
    final position = positionAsync.value ?? Duration.zero;
    final duration = durationAsync.value ?? Duration(seconds: track.duration);

    final progress = duration.inMilliseconds > 0
        ? (position.inMilliseconds / duration.inMilliseconds).clamp(0.0, 1.0)
        : 0.0;

    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => const NowPlayingScreen(),
            fullscreenDialog: true,
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated.withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.4),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Thin progress indicator bar
              LinearProgressIndicator(
                value: progress,
                minHeight: 2.5,
                backgroundColor: Colors.white.withValues(alpha: 0.06),
                valueColor: AlwaysStoppedAnimation<Color>(accentColor),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    // Album artwork
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: SizedBox(
                        width: 44,
                        height: 44,
                        child: track.isLocal && int.tryParse(track.id) != null
                            ? QueryArtworkWidget(
                                id: int.parse(track.id),
                                type: ArtworkType.AUDIO,
                                nullArtworkWidget: Container(
                                  color: AppColors.surface,
                                  child: Icon(Icons.music_note, color: accentColor, size: 22),
                                ),
                              )
                            : Container(
                                color: AppColors.surface,
                                child: Icon(Icons.music_note, color: accentColor, size: 22),
                              ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Track Title and Artist
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            track.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            track.artist,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Play/Pause Button
                    IconButton(
                      icon: Icon(
                        isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                        color: Colors.white,
                        size: 30,
                      ),
                      onPressed: () {
                        final handler = ref.read(audioHandlerProvider);
                        if (isPlaying) {
                          handler.pause();
                        } else {
                          handler.play();
                        }
                      },
                    ),
                    // Skip Next Button
                    IconButton(
                      icon: const Icon(
                        Icons.skip_next_rounded,
                        color: AppColors.textSecondary,
                        size: 26,
                      ),
                      onPressed: () {
                        ref.read(audioHandlerProvider).skipToNext();
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

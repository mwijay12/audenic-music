import 'package:audio_service/audio_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:on_audio_query/on_audio_query.dart';

import '../../../core/theme/app_theme.dart';
import '../../../providers/audio_providers.dart';
import '../../../providers/playlist_provider.dart';
import '../../widgets/synced_lyrics_view.dart';
import '../drive/drive_mode_screen.dart';
import '../equalizer/equalizer_screen.dart';

class NowPlayingScreen extends ConsumerStatefulWidget {
  const NowPlayingScreen({super.key});

  @override
  ConsumerState<NowPlayingScreen> createState() => _NowPlayingScreenState();
}

class _NowPlayingScreenState extends ConsumerState<NowPlayingScreen> {
  bool _showLyrics = false;

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  void _showSleepTimerSheet(BuildContext context) {
    final sleepManager = ref.read(sleepTimerManagerProvider);
    final accentColor = ref.read(dynamicAccentColorProvider);

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Icon(Icons.bedtime_rounded, color: accentColor, size: 22),
                    const SizedBox(width: 10),
                    const Text(
                      'Smart Sleep Timer',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Smoothly fades out audio over the final 60 seconds.',
                  style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [10, 15, 30, 45, 60].map((mins) {
                    return ActionChip(
                      label: Text('$mins minutes'),
                      backgroundColor: AppColors.surface,
                      labelStyle: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
                      side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                      onPressed: () {
                        sleepManager.start(mins, fadeOut: true);
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Sleep timer set for $mins minutes'),
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      },
                    );
                  }).toList(),
                ),
                if (sleepManager.isActive) ...[
                  const SizedBox(height: 16),
                  Center(
                    child: TextButton.icon(
                      onPressed: () {
                        sleepManager.cancel();
                        Navigator.pop(ctx);
                      },
                      icon: const Icon(Icons.close_rounded, color: AppColors.error),
                      label: const Text('Turn Off Timer', style: TextStyle(color: AppColors.error)),
                    ),
                  ),
                ],
                const SizedBox(height: 8),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showQueueSheet(BuildContext context) {
    final playlist = ref.read(audioHandlerProvider).currentPlaylist;
    final currentTrack = ref.read(currentTrackProvider).value;
    final accentColor = ref.read(dynamicAccentColorProvider);

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            children: [
              const SizedBox(height: 12),
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Up Next (${playlist.length})',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                    Icon(Icons.queue_music_rounded, color: accentColor, size: 20),
                  ],
                ),
              ),
              const Divider(color: AppColors.divider, height: 20),
              Expanded(
                child: ListView.builder(
                  itemCount: playlist.length,
                  itemBuilder: (context, index) {
                    final item = playlist[index];
                    final isNow = item.id == currentTrack?.id;
                    return ListTile(
                      dense: true,
                      leading: Icon(
                        isNow ? Icons.volume_up_rounded : Icons.music_note_rounded,
                        color: isNow ? accentColor : AppColors.textMuted,
                        size: 20,
                      ),
                      title: Text(
                        item.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isNow ? accentColor : AppColors.textPrimary,
                          fontWeight: isNow ? FontWeight.w700 : FontWeight.w500,
                        ),
                      ),
                      subtitle: Text(
                        item.artist,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                      ),
                      onTap: () {
                        ref.read(audioHandlerProvider).setQueueAndPlay(playlist, startIndex: index);
                        Navigator.pop(ctx);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentTrackAsync = ref.watch(currentTrackProvider);
    final playbackStateAsync = ref.watch(playbackStateProvider);
    final positionAsync = ref.watch(positionStreamProvider);
    final durationAsync = ref.watch(durationStreamProvider);
    final accentColor = ref.watch(dynamicAccentColorProvider);
    final favorites = ref.watch(favoritesProvider);
    final sleepSecAsync = ref.watch(sleepTimerRemainingProvider);

    final track = currentTrackAsync.value;
    final isPlaying = playbackStateAsync.value?.playing ?? false;
    final position = positionAsync.value ?? Duration.zero;
    final duration = durationAsync.value ?? (track != null ? Duration(seconds: track.duration) : Duration.zero);

    if (track == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('No track playing')),
      );
    }

    final double maxSec = duration.inMilliseconds > 0 ? duration.inSeconds.toDouble() : 1.0;
    final double curSec = position.inSeconds.toDouble().clamp(0.0, maxSec);
    final isFav = favorites.contains(track.id);
    final sleepSec = sleepSecAsync.value ?? 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 30),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('NOW PLAYING', style: TextStyle(fontSize: 13, letterSpacing: 1.5, fontWeight: FontWeight.w700)),
        actions: [
          // Queue Sheet
          IconButton(
            icon: const Icon(Icons.queue_music_rounded),
            onPressed: () => _showQueueSheet(context),
          ),
          // Sleep Timer with Countdown Badge
          IconButton(
            icon: Badge(
              isLabelVisible: sleepSec > 0,
              label: Text('${sleepSec ~/ 60}m', style: const TextStyle(fontSize: 10)),
              child: Icon(
                sleepSec > 0 ? Icons.bedtime_rounded : Icons.bedtime_outlined,
                color: sleepSec > 0 ? accentColor : AppColors.textSecondary,
              ),
            ),
            onPressed: () => _showSleepTimerSheet(context),
          ),
          // Equalizer
          IconButton(
            icon: const Icon(Icons.equalizer_rounded),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const EqualizerScreen()),
              );
            },
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 6),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              // Flip area: Album Art or Live Synced Lyrics
              GestureDetector(
                onTap: () => setState(() => _showLyrics = !_showLyrics),
                child: Center(
                  child: Container(
                    width: MediaQuery.of(context).size.width * 0.82,
                    height: MediaQuery.of(context).size.width * 0.82,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: accentColor.withValues(alpha: 0.35),
                          blurRadius: 36,
                          spreadRadius: 4,
                          offset: const Offset(0, 12),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: _showLyrics
                          ? SyncedLyricsView(lyrics: track.lyrics ?? const [])
                          : (track.isLocal && int.tryParse(track.id) != null
                              ? QueryArtworkWidget(
                                  id: int.parse(track.id),
                                  type: ArtworkType.AUDIO,
                                  artworkWidth: double.infinity,
                                  artworkHeight: double.infinity,
                                  nullArtworkWidget: Container(
                                    color: AppColors.surfaceElevated,
                                    child: Icon(Icons.music_note_rounded, color: accentColor, size: 80),
                                  ),
                                )
                              : Container(
                                  color: AppColors.surfaceElevated,
                                  child: Icon(Icons.music_note_rounded, color: accentColor, size: 80),
                                )),
                    ),
                  ),
                ),
              ),

              // Title, Artist, and Favorite Heart Toggle
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          track.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          track.artist,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 16,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: Icon(
                      isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                      color: isFav ? accentColor : AppColors.textMuted,
                      size: 28,
                    ),
                    onPressed: () {
                      ref.read(favoritesProvider.notifier).toggle(track.id);
                    },
                  ),
                ],
              ),

              // Scrub Slider and Times
              Column(
                children: [
                  Slider(
                    value: curSec,
                    min: 0.0,
                    max: maxSec,
                    activeColor: accentColor,
                    inactiveColor: Colors.white.withValues(alpha: 0.1),
                    onChanged: (val) {
                      ref.read(audioHandlerProvider).seek(Duration(seconds: val.toInt()));
                    },
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _formatDuration(position),
                          style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                        ),
                        Text(
                          _formatDuration(duration),
                          style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              // Playback Controls Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  // Shuffle
                  IconButton(
                    icon: const Icon(Icons.shuffle_rounded),
                    color: AppColors.textSecondary,
                    iconSize: 24,
                    onPressed: () {
                      final handler = ref.read(audioHandlerProvider);
                      final isShuffle = handler.player.shuffleModeEnabled;
                      handler.setShuffleMode(isShuffle ? AudioServiceShuffleMode.none : AudioServiceShuffleMode.all);
                    },
                  ),
                  // Previous
                  IconButton(
                    icon: const Icon(Icons.skip_previous_rounded),
                    color: Colors.white,
                    iconSize: 38,
                    onPressed: () => ref.read(audioHandlerProvider).skipToPrevious(),
                  ),
                  // Play/Pause Big Button
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: accentColor,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: accentColor.withValues(alpha: 0.4),
                          blurRadius: 18,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: IconButton(
                      icon: Icon(
                        isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                        color: Colors.white,
                        size: 40,
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
                  ),
                  // Next
                  IconButton(
                    icon: const Icon(Icons.skip_next_rounded),
                    color: Colors.white,
                    iconSize: 38,
                    onPressed: () => ref.read(audioHandlerProvider).skipToNext(),
                  ),
                  // Repeat
                  IconButton(
                    icon: const Icon(Icons.repeat_rounded),
                    color: AppColors.textSecondary,
                    iconSize: 24,
                    onPressed: () {
                      final handler = ref.read(audioHandlerProvider);
                      handler.setRepeatMode(AudioServiceRepeatMode.all);
                    },
                  ),
                ],
              ),

              // Bottom Lyrics / Speed Switches
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton.icon(
                    onPressed: () => setState(() => _showLyrics = !_showLyrics),
                    icon: Icon(
                      _showLyrics ? Icons.image_rounded : Icons.lyrics_rounded,
                      size: 18,
                      color: _showLyrics ? accentColor : AppColors.textSecondary,
                    ),
                    label: Text(
                      _showLyrics ? 'Album Art' : 'Lyrics',
                      style: TextStyle(
                        color: _showLyrics ? accentColor : AppColors.textSecondary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 20),
                  TextButton.icon(
                    onPressed: () {
                      final player = ref.read(audioHandlerProvider).player;
                      final currentSpeed = player.speed;
                      final nextSpeed = currentSpeed >= 2.0 ? 1.0 : currentSpeed + 0.25;
                      player.setSpeed(nextSpeed);
                    },
                    icon: const Icon(Icons.speed_rounded, size: 18, color: AppColors.textSecondary),
                    label: Text(
                      '${ref.watch(audioHandlerProvider).player.speed.toStringAsFixed(2)}x',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                  ),
                  const SizedBox(width: 20),
                  TextButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const DriveModeScreen(),
                          fullscreenDialog: true,
                        ),
                      );
                    },
                    icon: const Icon(Icons.directions_car_rounded, size: 18, color: AppColors.textSecondary),
                    label: const Text(
                      'Drive',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

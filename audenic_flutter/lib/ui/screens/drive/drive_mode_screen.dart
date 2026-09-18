import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:on_audio_query/on_audio_query.dart';

import '../../../core/theme/app_theme.dart';
import '../../../providers/audio_providers.dart';

class DriveModeScreen extends ConsumerStatefulWidget {
  const DriveModeScreen({super.key});

  @override
  ConsumerState<DriveModeScreen> createState() => _DriveModeScreenState();
}

class _DriveModeScreenState extends ConsumerState<DriveModeScreen> with SingleTickerProviderStateMixin {
  late final Timer _clockTimer;
  DateTime _currentTime = DateTime.now();
  late final AnimationController _spinController;

  @override
  void initState() {
    super.initState();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _currentTime = DateTime.now());
    });
    _spinController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 20),
    )..repeat();
  }

  @override
  void dispose() {
    _clockTimer.cancel();
    _spinController.dispose();
    super.dispose();
  }

  String _formatDuration(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final currentTrack = ref.watch(currentTrackProvider).value;
    final playbackState = ref.watch(playbackStateProvider).value;
    final position = ref.watch(positionStreamProvider).value ?? Duration.zero;
    final duration = ref.watch(durationStreamProvider).value ??
        (currentTrack != null ? Duration(seconds: currentTrack.duration) : Duration.zero);
    final accentColor = ref.watch(dynamicAccentColorProvider);
    final isPlaying = playbackState?.playing ?? false;

    if (!isPlaying && _spinController.isAnimating) {
      _spinController.stop();
    } else if (isPlaying && !_spinController.isAnimating) {
      _spinController.repeat();
    }

    final h = _currentTime.hour.toString().padLeft(2, '0');
    final m = _currentTime.minute.toString().padLeft(2, '0');

    return Scaffold(
      backgroundColor: const Color(0xFF08090C),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Giant Clock Header
              Column(
                children: [
                  Text(
                    '$h:$m',
                    style: const TextStyle(
                      fontSize: 52,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: -1.5,
                    ),
                  ),
                  const Text(
                    'CAR / DRIVE MODE',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 2.0,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),

              // Center Circular Spinning Vinyl / Artwork
              if (currentTrack != null)
                Column(
                  children: [
                    RotationTransition(
                      turns: _spinController,
                      child: Container(
                        width: 170,
                        height: 170,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white.withValues(alpha: 0.15), width: 3),
                          boxShadow: [
                            BoxShadow(
                              color: accentColor.withValues(alpha: 0.3),
                              blurRadius: 30,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: ClipOval(
                          child: int.tryParse(currentTrack.id) != null
                              ? QueryArtworkWidget(
                                  id: int.parse(currentTrack.id),
                                  type: ArtworkType.AUDIO,
                                  artworkWidth: double.infinity,
                                  artworkHeight: double.infinity,
                                  nullArtworkWidget: Container(
                                    color: AppColors.surfaceElevated,
                                    child: Icon(Icons.music_note_rounded, color: accentColor, size: 64),
                                  ),
                                )
                              : Container(
                                  color: AppColors.surfaceElevated,
                                  child: Icon(Icons.music_note_rounded, color: accentColor, size: 64),
                                ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      currentTrack.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      currentTrack.artist,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 18, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${_formatDuration(position)} / ${_formatDuration(duration)}',
                      style: const TextStyle(fontSize: 14, color: AppColors.textMuted),
                    ),
                  ],
                )
              else
                const Text('No song playing', style: TextStyle(color: AppColors.textMuted, fontSize: 18)),

              // Giant Driving Touch Targets
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Prev
                  GestureDetector(
                    onTap: () => ref.read(audioHandlerProvider).skipToPrevious(),
                    child: Container(
                      width: 76,
                      height: 76,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                      ),
                      child: const Icon(Icons.skip_previous_rounded, color: Colors.white, size: 40),
                    ),
                  ),
                  const SizedBox(width: 24),
                  // Play/Pause Big Button
                  GestureDetector(
                    onTap: () {
                      final handler = ref.read(audioHandlerProvider);
                      if (isPlaying) {
                        handler.pause();
                      } else {
                        handler.play();
                      }
                    },
                    child: Container(
                      width: 96,
                      height: 96,
                      decoration: BoxDecoration(
                        color: accentColor,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: accentColor.withValues(alpha: 0.45),
                            blurRadius: 28,
                            spreadRadius: 4,
                          ),
                        ],
                      ),
                      child: Icon(
                        isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                        color: Colors.white,
                        size: 54,
                      ),
                    ),
                  ),
                  const SizedBox(width: 24),
                  // Next
                  GestureDetector(
                    onTap: () => ref.read(audioHandlerProvider).skipToNext(),
                    child: Container(
                      width: 76,
                      height: 76,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                      ),
                      child: const Icon(Icons.skip_next_rounded, color: Colors.white, size: 40),
                    ),
                  ),
                ],
              ),

              // Exit Button
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white70,
                  side: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded, size: 18),
                label: const Text('Exit Drive Mode', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/models/video_item.dart';
import '../../../providers/audio_providers.dart';
import '../../../providers/video_provider.dart';

class ReelsScreen extends ConsumerStatefulWidget {
  const ReelsScreen({super.key});

  @override
  ConsumerState<ReelsScreen> createState() => _ReelsScreenState();
}

class _ReelsScreenState extends ConsumerState<ReelsScreen> {
  late final PageController _pageController;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    // Pause background audio when entering reels
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(audioHandlerProvider).pause();
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reels = ref.watch(filteredReelsProvider);
    final activeCategory = ref.watch(reelsCategoryProvider);
    final accentColor = ref.watch(dynamicAccentColorProvider);

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Vertical Video Swiper
          if (reels.isEmpty)
            const Center(
              child: Text(
                'No reels available in this category',
                style: TextStyle(color: AppColors.textMuted),
              ),
            )
          else
            PageView.builder(
              controller: _pageController,
              scrollDirection: Axis.vertical,
              itemCount: reels.length,
              onPageChanged: (index) => setState(() => _currentPage = index),
              itemBuilder: (context, index) {
                return ReelPlayerItem(
                  video: reels[index],
                  isActive: index == _currentPage,
                  accentColor: accentColor,
                );
              },
            ),

          // Top Category Filter Bar
          SafeArea(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.black.withValues(alpha: 0.7),
                    Colors.transparent,
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
              child: Row(
                children: [
                  _buildCategoryChip('All', 'all', activeCategory, accentColor),
                  const SizedBox(width: 8),
                  _buildCategoryChip('Music', 'music', activeCategory, accentColor),
                  const SizedBox(width: 8),
                  _buildCategoryChip('Study Focus', 'study', activeCategory, accentColor),
                  const SizedBox(width: 8),
                  _buildCategoryChip('Shorts', 'reels', activeCategory, accentColor),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryChip(String label, String id, String activeId, Color accent) {
    final isSelected = id == activeId;
    return GestureDetector(
      onTap: () => ref.read(reelsCategoryProvider.notifier).setCategory(id),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? accent : Colors.black.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? accent : Colors.white.withValues(alpha: 0.15),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

class ReelPlayerItem extends ConsumerStatefulWidget {
  final VideoItem video;
  final bool isActive;
  final Color accentColor;

  const ReelPlayerItem({
    super.key,
    required this.video,
    required this.isActive,
    required this.accentColor,
  });

  @override
  ConsumerState<ReelPlayerItem> createState() => _ReelPlayerItemState();
}

class _ReelPlayerItemState extends ConsumerState<ReelPlayerItem> {
  VideoPlayerController? _controller;
  bool _isMuted = false;
  bool _showPlayIcon = false;

  @override
  void initState() {
    super.initState();
    if (widget.isActive) {
      _initVideo();
    }
  }

  @override
  void didUpdateWidget(ReelPlayerItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive != oldWidget.isActive) {
      if (widget.isActive) {
        if (_controller == null) {
          _initVideo();
        } else {
          _controller?.play();
        }
      } else {
        _controller?.pause();
      }
    }
  }

  Future<void> _initVideo() async {
    final src = widget.video.src;
    final controller = widget.video.isLocal && !src.startsWith('http')
        ? VideoPlayerController.file(File(src))
        : VideoPlayerController.networkUrl(Uri.parse(src));

    _controller = controller;
    try {
      await controller.initialize();
      await controller.setLooping(true);
      if (mounted && widget.isActive) {
        await controller.play();
        setState(() {});
      }
    } catch (e) {
      debugPrint('[Reels] Failed to load video: $e');
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  void _togglePlay() {
    if (_controller == null || !_controller!.value.isInitialized) return;
    setState(() {
      if (_controller!.value.isPlaying) {
        _controller!.pause();
        _showPlayIcon = true;
      } else {
        _controller!.play();
        _showPlayIcon = false;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final video = widget.video;
    final controller = _controller;

    return Stack(
      fit: StackFit.expand,
      children: [
        // Video Surface
        GestureDetector(
          onTap: _togglePlay,
          child: Container(
            color: Colors.black,
            child: controller != null && controller.value.isInitialized
                ? Center(
                    child: AspectRatio(
                      aspectRatio: controller.value.aspectRatio,
                      child: VideoPlayer(controller),
                    ),
                  )
                : const Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  ),
          ),
        ),

        // Animated Play/Pause feedback icon
        if (_showPlayIcon)
          Center(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.6),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 48),
            ),
          ),

        // Right-side Action Column
        Positioned(
          right: 16,
          bottom: 40,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Like Button
              IconButton(
                icon: Icon(
                  video.isLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  color: video.isLiked ? widget.accentColor : Colors.white,
                  size: 32,
                ),
                onPressed: () {
                  ref.read(reelsProvider.notifier).toggleLike(video.id);
                },
              ),
              const SizedBox(height: 12),
              // Mute/Unmute
              IconButton(
                icon: Icon(
                  _isMuted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                  color: Colors.white,
                  size: 28,
                ),
                onPressed: () {
                  setState(() {
                    _isMuted = !_isMuted;
                    _controller?.setVolume(_isMuted ? 0.0 : 1.0);
                  });
                },
              ),
              const SizedBox(height: 12),
              // Category Badge
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  video.category == 'study' ? Icons.menu_book_rounded : Icons.music_video_rounded,
                  color: widget.accentColor,
                  size: 20,
                ),
              ),
            ],
          ),
        ),

        // Bottom Details (Title, Description, Waveform)
        Positioned(
          left: 16,
          bottom: 30,
          right: 80,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: widget.accentColor.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  video.category.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: widget.accentColor,
                    letterSpacing: 1.0,
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                video.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  shadows: [
                    Shadow(color: Colors.black, blurRadius: 8),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

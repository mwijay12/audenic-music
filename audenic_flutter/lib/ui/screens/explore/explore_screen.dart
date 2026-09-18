import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/models/track.dart';
import '../../../providers/audio_providers.dart';
import '../../../services/firestore_music_service.dart';
import '../../../services/r2_storage_service.dart';

final firestoreMusicServiceProvider = Provider<FirestoreMusicService>((ref) {
  return FirestoreMusicService();
});

final publishedSongsProvider = StreamProvider<List<Track>>((ref) {
  final service = ref.watch(firestoreMusicServiceProvider);
  return service.getPublishedSongsStream();
});

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  String _searchQuery = '';

  void _showPublishDialog(BuildContext context) {
    final titleCtrl = TextEditingController();
    final artistCtrl = TextEditingController();
    final srcCtrl = TextEditingController();
    final coverCtrl = TextEditingController();
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          backgroundColor: AppColors.surfaceElevated,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: const [
              Icon(Icons.cloud_upload_rounded, color: AppColors.primary, size: 24),
              SizedBox(width: 8),
              Text('Publish Song (Admin)', style: TextStyle(color: AppColors.textPrimary, fontSize: 18)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Cloudflare R2 Bucket: mwijay-music\nCDN: pub-c26084d7ca874fcda47de161be8ded27.r2.dev',
                  style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: titleCtrl,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    labelText: 'Song Title',
                    labelStyle: const TextStyle(color: AppColors.textSecondary),
                    filled: true,
                    fillColor: AppColors.surface,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: artistCtrl,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    labelText: 'Artist',
                    labelStyle: const TextStyle(color: AppColors.textSecondary),
                    filled: true,
                    fillColor: AppColors.surface,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: srcCtrl,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    labelText: 'Cloudflare R2 Audio URL',
                    hintText: '${R2StorageService.publicUrl}/uploads/song.mp3',
                    hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    labelStyle: const TextStyle(color: AppColors.textSecondary),
                    filled: true,
                    fillColor: AppColors.surface,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: coverCtrl,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    labelText: 'Cloudinary / Cover Image URL',
                    hintText: 'https://res.cloudinary.com/xesr11j5/...',
                    hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    labelStyle: const TextStyle(color: AppColors.textSecondary),
                    filled: true,
                    fillColor: AppColors.surface,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: ref.read(dynamicAccentColorProvider),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: isSubmitting
                  ? null
                  : () async {
                      if (titleCtrl.text.trim().isEmpty || srcCtrl.text.trim().isEmpty) {
                        return;
                      }
                      setDialogState(() => isSubmitting = true);
                      final service = ref.read(firestoreMusicServiceProvider);
                      final success = await service.publishSong(
                        id: 'r2_${DateTime.now().millisecondsSinceEpoch}',
                        title: titleCtrl.text.trim(),
                        artist: artistCtrl.text.trim().isNotEmpty ? artistCtrl.text.trim() : 'Audenic Music',
                        src: srcCtrl.text.trim(),
                        coverUrl: coverCtrl.text.trim().isNotEmpty ? coverCtrl.text.trim() : null,
                      );

                      if (dialogContext.mounted) {
                        Navigator.pop(ctx);
                      }
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(success ? 'Song published to Cloudflare stream!' : 'Failed to publish song.'),
                          ),
                        );
                      }
                    },
              child: Text(isSubmitting ? 'Publishing...' : 'Publish to R2 Stream'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final publishedAsync = ref.watch(publishedSongsProvider);
    final accentColor = ref.watch(dynamicAccentColorProvider);
    final currentTrack = ref.watch(currentTrackProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Audenic Cloud Stream', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.cloud_upload_rounded),
            tooltip: 'Publish Song (Admin)',
            onPressed: () => _showPublishDialog(context),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: publishedAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_rounded, size: 48, color: AppColors.textMuted),
                const SizedBox(height: 12),
                Text('Connecting to Firestore & Cloudflare R2 stream...', textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary)),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () => _showPublishDialog(context),
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Publish First Cloud Song'),
                ),
              ],
            ),
          ),
        ),
        data: (songs) {
          final filtered = _searchQuery.isEmpty
              ? songs
              : songs.where((s) {
                  final q = _searchQuery.toLowerCase();
                  return s.title.toLowerCase().contains(q) || s.artist.toLowerCase().contains(q);
                }).toList();

          return Column(
            children: [
              // Cloudflare & Cloudinary CDN Banner
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      accentColor.withValues(alpha: 0.2),
                      AppColors.surfaceElevated,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: accentColor.withValues(alpha: 0.25)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: accentColor.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.bolt_rounded, color: accentColor, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'High-Fidelity Cloud Stream',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Served globally via Cloudflare R2 & Cloudinary CDN',
                            style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Search Bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: TextField(
                  onChanged: (val) => setState(() => _searchQuery = val),
                  decoration: InputDecoration(
                    hintText: 'Search cloud releases...',
                    hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
                    prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.surfaceElevated,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  ),
                ),
              ),

              // Action Bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${filtered.length} online tracks',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textMuted),
                    ),
                    if (filtered.isNotEmpty)
                      TextButton.icon(
                        onPressed: () {
                          final shuffled = List<Track>.from(filtered)..shuffle();
                          ref.read(audioHandlerProvider).setQueueAndPlay(shuffled);
                        },
                        icon: Icon(Icons.shuffle_rounded, size: 18, color: accentColor),
                        label: Text('Stream All', style: TextStyle(color: accentColor, fontWeight: FontWeight.w600)),
                      ),
                  ],
                ),
              ),

              // Songs List
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.cloud_queue_rounded, size: 48, color: AppColors.textMuted.withValues(alpha: 0.5)),
                            const SizedBox(height: 12),
                            const Text('No cloud songs published yet.', style: TextStyle(color: AppColors.textMuted)),
                            const SizedBox(height: 12),
                            ElevatedButton.icon(
                              onPressed: () => _showPublishDialog(context),
                              icon: const Icon(Icons.add_rounded),
                              label: const Text('Publish a Song to R2'),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.only(bottom: 90),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          final track = filtered[index];
                          final isCurrent = currentTrack?.id == track.id;

                          return ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                            leading: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: SizedBox(
                                width: 48,
                                height: 48,
                                child: track.coverUrl != null && track.coverUrl!.isNotEmpty
                                    ? CachedNetworkImage(
                                        imageUrl: track.coverUrl!,
                                        fit: BoxFit.cover,
                                        placeholder: (context, url) => Container(color: AppColors.surfaceElevated),
                                        errorWidget: (context, url, error) => Container(
                                          color: AppColors.surfaceElevated,
                                          child: Icon(Icons.music_note_rounded, color: accentColor),
                                        ),
                                      )
                                    : Container(
                                        color: AppColors.surfaceElevated,
                                        child: Icon(Icons.cloud_rounded, color: accentColor),
                                      ),
                              ),
                            ),
                            title: Text(
                              track.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
                                color: isCurrent ? accentColor : AppColors.textPrimary,
                              ),
                            ),
                            subtitle: Text(
                              '${track.artist} • Cloudflare R2',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                            trailing: IconButton(
                              icon: Icon(
                                isCurrent ? Icons.pause_circle_filled_rounded : Icons.play_circle_fill_rounded,
                                color: isCurrent ? accentColor : Colors.white,
                                size: 34,
                              ),
                              onPressed: () {
                                ref.read(audioHandlerProvider).setQueueAndPlay(filtered, startIndex: index);
                              },
                            ),
                            onTap: () {
                              ref.read(audioHandlerProvider).setQueueAndPlay(filtered, startIndex: index);
                            },
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

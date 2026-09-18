import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:on_audio_query/on_audio_query.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/models/playlist.dart';
import '../../../data/models/track.dart';
import '../../../providers/audio_providers.dart';
import '../../../providers/playlist_provider.dart';

class LibraryScreen extends ConsumerStatefulWidget {
  const LibraryScreen({super.key});

  @override
  ConsumerState<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends ConsumerState<LibraryScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String _formatDuration(int sec) {
    final m = (sec ~/ 60).toString().padLeft(2, '0');
    final s = (sec % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  void _showCreatePlaylistDialog() {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceElevated,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Create New Playlist', style: TextStyle(color: AppColors.textPrimary)),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: const TextStyle(color: AppColors.textPrimary),
          decoration: InputDecoration(
            hintText: 'Playlist Name',
            hintStyle: const TextStyle(color: AppColors.textMuted),
            filled: true,
            fillColor: AppColors.surface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
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
            onPressed: () {
              if (controller.text.trim().isNotEmpty) {
                ref.read(playlistsProvider.notifier).createPlaylist(controller.text.trim());
              }
              Navigator.pop(ctx);
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  void _showAddToPlaylistSheet(Track track) {
    final playlists = ref.read(playlistsProvider);
    final accentColor = ref.read(dynamicAccentColorProvider);

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceElevated,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => SafeArea(
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
              const SizedBox(height: 14),
              Text(
                'Add "${track.title}" to Playlist',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 12),
              if (playlists.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: TextButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        _showCreatePlaylistDialog();
                      },
                      icon: const Icon(Icons.add_rounded),
                      label: const Text('Create your first playlist'),
                    ),
                  ),
                )
              else
                ...playlists.map((pl) => ListTile(
                      leading: Icon(Icons.playlist_play_rounded, color: accentColor),
                      title: Text(pl.name, style: const TextStyle(color: AppColors.textPrimary)),
                      subtitle: Text('${pl.trackIds.length} tracks', style: const TextStyle(color: AppColors.textMuted)),
                      onTap: () {
                        ref.read(playlistsProvider.notifier).addTrack(pl.id, track.id);
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Added to ${pl.name}'),
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      },
                    )),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final localTracksAsync = ref.watch(localTracksProvider);
    final accentColor = ref.watch(dynamicAccentColorProvider);
    final favorites = ref.watch(favoritesProvider);
    final playlists = ref.watch(playlistsProvider);
    final currentTrack = ref.watch(currentTrackProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Music', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(localTracksProvider),
          ),
          const SizedBox(width: 8),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: accentColor,
          labelColor: accentColor,
          unselectedLabelColor: AppColors.textMuted,
          tabs: [
            const Tab(text: 'Songs'),
            Tab(text: 'Favorites (${favorites.length})'),
            Tab(text: 'Playlists (${playlists.length})'),
          ],
        ),
      ),
      body: localTracksAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
              const SizedBox(height: 12),
              Text('Failed to load music: $err', style: const TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => ref.invalidate(localTracksProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (tracks) {
          final filteredTracks = _searchQuery.isEmpty
              ? tracks
              : tracks.where((t) {
                  final q = _searchQuery.toLowerCase();
                  return t.title.toLowerCase().contains(q) ||
                      t.artist.toLowerCase().contains(q) ||
                      t.album.toLowerCase().contains(q);
                }).toList();

          final favoriteTracks = tracks.where((t) => favorites.contains(t.id)).toList();

          return TabBarView(
            controller: _tabController,
            children: [
              // TAB 0: All Songs
              _buildTracksTab(filteredTracks, currentTrack, accentColor, showSearch: true),

              // TAB 1: Favorites
              _buildTracksTab(favoriteTracks, currentTrack, accentColor, emptyMessage: 'No favorite songs added yet! Tap the heart on any song.'),

              // TAB 2: Custom Playlists
              _buildPlaylistsTab(playlists, tracks, accentColor),
            ],
          );
        },
      ),
    );
  }

  Widget _buildTracksTab(List<Track> tracks, Track? currentTrack, Color accentColor, {bool showSearch = false, String? emptyMessage}) {
    return Column(
      children: [
        if (showSearch)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextField(
              onChanged: (val) => setState(() => _searchQuery = val),
              decoration: InputDecoration(
                hintText: 'Search songs, artists, albums...',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
                prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textMuted),
                filled: true,
                fillColor: AppColors.surfaceElevated,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              ),
            ),
          ),
        if (tracks.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${tracks.length} tracks',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textMuted),
                ),
                TextButton.icon(
                  onPressed: () {
                    final shuffled = List<Track>.from(tracks)..shuffle();
                    ref.read(audioHandlerProvider).setQueueAndPlay(shuffled);
                  },
                  icon: Icon(Icons.shuffle_rounded, size: 18, color: accentColor),
                  label: Text('Shuffle All', style: TextStyle(color: accentColor, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        Expanded(
          child: tracks.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      emptyMessage ?? 'No tracks found.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.textMuted),
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.only(bottom: 90),
                  itemCount: tracks.length,
                  itemBuilder: (context, index) {
                    final track = tracks[index];
                    final isCurrent = currentTrack?.id == track.id;

                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                      leading: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: SizedBox(
                          width: 48,
                          height: 48,
                          child: int.tryParse(track.id) != null
                              ? QueryArtworkWidget(
                                  id: int.parse(track.id),
                                  type: ArtworkType.AUDIO,
                                  nullArtworkWidget: Container(
                                    color: AppColors.surfaceElevated,
                                    child: Icon(
                                      Icons.music_note_rounded,
                                      color: isCurrent ? accentColor : AppColors.textMuted,
                                      size: 24,
                                    ),
                                  ),
                                )
                              : Container(
                                  color: AppColors.surfaceElevated,
                                  child: Icon(
                                    Icons.music_note_rounded,
                                    color: isCurrent ? accentColor : AppColors.textMuted,
                                    size: 24,
                                  ),
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
                        '${track.artist} • ${track.album}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _formatDuration(track.duration),
                            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                          ),
                          IconButton(
                            icon: const Icon(Icons.more_vert_rounded, size: 20, color: AppColors.textMuted),
                            onPressed: () => _showAddToPlaylistSheet(track),
                          ),
                        ],
                      ),
                      onTap: () {
                        ref.read(audioHandlerProvider).setQueueAndPlay(tracks, startIndex: index);
                      },
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildPlaylistsTab(List<Playlist> playlists, List<Track> allTracks, Color accentColor) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${playlists.length} custom playlists',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textMuted),
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: accentColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                ),
                onPressed: _showCreatePlaylistDialog,
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('New Playlist'),
              ),
            ],
          ),
        ),
        Expanded(
          child: playlists.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.queue_music_rounded, size: 48, color: AppColors.textMuted.withValues(alpha: 0.5)),
                      const SizedBox(height: 12),
                      const Text(
                        'No playlists yet. Create one to organize your music!',
                        style: TextStyle(color: AppColors.textMuted, fontSize: 14),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.only(bottom: 90),
                  itemCount: playlists.length,
                  itemBuilder: (context, index) {
                    final pl = playlists[index];
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                      leading: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: accentColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(Icons.playlist_play_rounded, color: accentColor, size: 28),
                      ),
                      title: Text(
                        pl.name,
                        style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                      ),
                      subtitle: Text(
                        '${pl.trackIds.length} tracks',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline_rounded, size: 20, color: AppColors.textMuted),
                        onPressed: () => ref.read(playlistsProvider.notifier).deletePlaylist(pl.id),
                      ),
                      onTap: () {
                        // Play playlist tracks
                        final plTracks = allTracks.where((t) => pl.trackIds.contains(t.id)).toList();
                        if (plTracks.isNotEmpty) {
                          ref.read(audioHandlerProvider).setQueueAndPlay(plTracks);
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('This playlist is empty! Add tracks from the Songs tab.'),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        }
                      },
                    );
                  },
                ),
        ),
      ],
    );
  }
}

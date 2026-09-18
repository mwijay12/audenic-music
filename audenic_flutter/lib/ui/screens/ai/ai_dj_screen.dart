import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/effects/audio_effects_manager.dart';
import '../../../core/theme/app_theme.dart';
import '../../../providers/audio_providers.dart';
import '../../../providers/playlist_provider.dart';
import '../../../services/ai_dj_service.dart';

final aiDjServiceProvider = Provider<AiDjService>((ref) {
  final service = AiDjService();
  service.init();
  return service;
});

class AiDjScreen extends ConsumerStatefulWidget {
  const AiDjScreen({super.key});

  @override
  ConsumerState<AiDjScreen> createState() => _AiDjScreenState();
}

class _AiDjScreenState extends ConsumerState<AiDjScreen> {
  String _djCommentary = '';
  String _songExplanation = '';
  List<Map<String, String>> _generatedPlaylist = [];
  bool _isLoadingDj = false;
  bool _isLoadingExplain = false;
  bool _isLoadingPlaylist = false;

  void _showApiKeyDialog() {
    final service = ref.read(aiDjServiceProvider);
    final controller = TextEditingController(text: service.apiKey ?? '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surfaceElevated,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Gemini API Key', style: TextStyle(color: AppColors.textPrimary)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Audenic includes a resilient multi-key pool. Optionally enter your personal Google Gemini API key to override:',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'AIzaSy... (leave blank for default pool)',
                hintStyle: const TextStyle(color: AppColors.textMuted),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
          ],
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
            ),
            onPressed: () async {
              await service.setApiKey(controller.text.trim());
              if (ctx.mounted) {
                Navigator.pop(ctx);
              }
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Gemini settings updated!')),
                );
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _generateDjIntro() async {
    final currentTrack = ref.read(currentTrackProvider).value;
    if (currentTrack == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Play a song first to generate DJ commentary!')),
      );
      return;
    }

    setState(() => _isLoadingDj = true);
    final service = ref.read(aiDjServiceProvider);
    final intro = await service.generateDjIntro(currentTrack);
    if (mounted) {
      setState(() {
        _djCommentary = intro;
        _isLoadingDj = false;
      });
    }
  }

  Future<void> _explainCurrentSong() async {
    final currentTrack = ref.read(currentTrackProvider).value;
    if (currentTrack == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Play a song first to explain its meaning!')),
      );
      return;
    }

    setState(() => _isLoadingExplain = true);
    final service = ref.read(aiDjServiceProvider);
    final explanation = await service.explainSong(
      title: currentTrack.title,
      artist: currentTrack.artist,
      lyrics: currentTrack.lyrics?.map((l) => l.text).take(6).join('\n'),
    );
    if (mounted) {
      setState(() {
        _songExplanation = explanation;
        _isLoadingExplain = false;
      });
    }
  }

  Future<void> _generatePlaylistPrompt(String prompt) async {
    setState(() {
      _isLoadingPlaylist = true;
      _generatedPlaylist = [];
    });
    final service = ref.read(aiDjServiceProvider);
    final list = await service.generatePlaylist(prompt: prompt, count: 5);
    if (mounted) {
      setState(() {
        _generatedPlaylist = list;
        _isLoadingPlaylist = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentTrack = ref.watch(currentTrackProvider).value;
    final accentColor = ref.watch(dynamicAccentColorProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Audenic AI DJ', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.key_rounded, color: AppColors.textSecondary),
            tooltip: 'Gemini Settings',
            onPressed: _showApiKeyDialog,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        children: [
          // On-Air Live DJ Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  accentColor.withValues(alpha: 0.25),
                  AppColors.surfaceElevated,
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: accentColor.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.error,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.circle, color: Colors.white, size: 8),
                              SizedBox(width: 6),
                              Text(
                                'ON AIR',
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        const Text(
                          'Audenic Radio Host',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                    Icon(Icons.graphic_eq_rounded, color: accentColor, size: 24),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  currentTrack != null
                      ? 'Current Track: "${currentTrack.title}" • ${currentTrack.artist}'
                      : 'No track playing currently',
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 14),
                if (_djCommentary.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surface.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '🎙️ "$_djCommentary"',
                      style: TextStyle(
                        fontSize: 14,
                        fontStyle: FontStyle.italic,
                        color: accentColor,
                        height: 1.4,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                ],
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: accentColor,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onPressed: _isLoadingDj ? null : _generateDjIntro,
                        icon: _isLoadingDj
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.mic_rounded, size: 18),
                        label: Text(_isLoadingDj ? 'Speaking...' : 'DJ Track Intro'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onPressed: _isLoadingExplain ? null : _explainCurrentSong,
                        icon: _isLoadingExplain
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.psychology_rounded, size: 18),
                        label: Text(_isLoadingExplain ? 'Analyzing...' : 'Song Meaning'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          if (_songExplanation.isNotEmpty) ...[
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surfaceElevated,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.menu_book_rounded, color: accentColor, size: 20),
                      const SizedBox(width: 8),
                      const Text(
                        'Song Breakdown & Meaning',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    _songExplanation,
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.5),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 28),

          // Vibe Playlist Generator
          const Text(
            'CURATE SMART VIBE PLAYLIST',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 12),

          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _buildVibeChip('⚡ Workout Hype', 'Fast-paced high-energy gym workout tracks', accentColor),
              _buildVibeChip('🌙 Midnight Lo-Fi', 'Smooth late-night lo-fi chill tracks', accentColor),
              _buildVibeChip('☕ Coding Focus', 'Ambient, deep focus, and synthwave coding music', accentColor),
              _buildVibeChip('🔥 Afrobeats Party', 'Vibrant Afrobeats and Amapiano dance party', accentColor),
            ],
          ),

          if (_isLoadingPlaylist) ...[
            const SizedBox(height: 24),
            const Center(child: CircularProgressIndicator()),
          ] else if (_generatedPlaylist.isNotEmpty) ...[
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surfaceElevated,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.auto_awesome_rounded, color: accentColor, size: 20),
                          const SizedBox(width: 8),
                          const Text(
                            'AI Suggested Tracks',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                          ),
                        ],
                      ),
                      TextButton(
                        onPressed: () {
                          // Create new playlist with these tracks
                          final plName = 'AI Vibe: ${DateTime.now().hour}:${DateTime.now().minute}';
                          ref.read(playlistsProvider.notifier).createPlaylist(plName);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Created playlist "$plName" in Library!')),
                          );
                        },
                        child: const Text('Save Playlist'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ..._generatedPlaylist.map((t) => ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(Icons.music_note_rounded, color: accentColor, size: 20),
                        title: Text(
                          t['title'] ?? '',
                          style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                        ),
                        subtitle: Text(
                          t['artist'] ?? '',
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                        ),
                      )),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton.icon(
                      onPressed: () {
                        ref.read(equalizerProvider.notifier).applyPreset(AudioEffectsManager.presets[1]);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Applied Bass Boost EQ preset!')),
                        );
                      },
                      icon: const Icon(Icons.tune_rounded, size: 16),
                      label: const Text('Apply Optimal EQ'),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Widget _buildVibeChip(String label, String query, Color accent) {
    return ActionChip(
      label: Text(label),
      backgroundColor: AppColors.surfaceElevated,
      labelStyle: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13),
      side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
      onPressed: () => _generatePlaylistPrompt(query),
    );
  }
}

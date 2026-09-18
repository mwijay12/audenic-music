import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/effects/audio_effects_manager.dart';
import '../../../core/theme/app_theme.dart';
import '../../../providers/audio_providers.dart';

class EqualizerScreen extends ConsumerWidget {
  const EqualizerScreen({super.key});

  static const List<String> frequencyLabels = [
    '60 Hz',
    '230 Hz',
    '910 Hz',
    '3.6 kHz',
    '14 kHz',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eqState = ref.watch(equalizerProvider);
    final eqNotifier = ref.read(equalizerProvider.notifier);
    final accentColor = ref.watch(dynamicAccentColorProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sound Effects & EQ'),
        actions: [
          // Reset Button
          TextButton.icon(
            onPressed: () {
              eqNotifier.applyPreset(AudioEffectsManager.presets[0]); // Flat
            },
            icon: const Icon(Icons.refresh_rounded, size: 18, color: AppColors.textSecondary),
            label: const Text('Reset', style: TextStyle(color: AppColors.textSecondary)),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        children: [
          // Master Toggle Card
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: accentColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.equalizer_rounded, color: accentColor, size: 24),
                    ),
                    const SizedBox(width: 14),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Hardware Audio Equalizer',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        Text(
                          eqState.isEnabled ? 'Active (DSP / AudioSession Bound)' : 'Bypassed',
                          style: TextStyle(
                            fontSize: 12,
                            color: eqState.isEnabled ? AppColors.success : AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Switch(
                  value: eqState.isEnabled,
                  activeThumbColor: accentColor,
                  onChanged: (val) => eqNotifier.setEnabled(val),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Preset Chips
          const Text(
            'PRESETS',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: AudioEffectsManager.presets.length,
              separatorBuilder: (context, index) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final p = AudioEffectsManager.presets[index];
                final isSelected = eqState.currentPreset == p.name;
                return ChoiceChip(
                  label: Text(p.name),
                  selected: isSelected,
                  selectedColor: accentColor.withValues(alpha: 0.2),
                  backgroundColor: AppColors.surfaceElevated,
                  labelStyle: TextStyle(
                    color: isSelected ? accentColor : AppColors.textSecondary,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    fontSize: 13,
                  ),
                  side: BorderSide(
                    color: isSelected ? accentColor : Colors.white.withValues(alpha: 0.08),
                  ),
                  onSelected: (selected) {
                    if (selected) {
                      eqNotifier.applyPreset(p);
                    }
                  },
                );
              },
            ),
          ),

          const SizedBox(height: 28),

          // 5-Band Vertical Equalizer Display
          Container(
            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 10),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
            ),
            child: Column(
              children: [
                // Top Decibel Range Indicators
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: const [
                      Text('+10 dB', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                      Text('0 dB', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                      Text('-10 dB', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                // Vertical Sliders Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: List.generate(frequencyLabels.length, (index) {
                    final gain = index < eqState.bands.length ? eqState.bands[index] : 0.0;
                    return Column(
                      children: [
                        Text(
                          '${gain > 0 ? '+' : ''}${gain.toStringAsFixed(1)}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: gain != 0.0 ? accentColor : AppColors.textMuted,
                          ),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          height: 160,
                          child: RotatedBox(
                            quarterTurns: -1,
                            child: SliderTheme(
                              data: SliderTheme.of(context).copyWith(
                                trackHeight: 4,
                                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
                              ),
                              child: Slider(
                                value: gain,
                                min: -10.0,
                                max: 10.0,
                                activeColor: accentColor,
                                inactiveColor: Colors.white.withValues(alpha: 0.1),
                                onChanged: eqState.isEnabled
                                    ? (val) => eqNotifier.setBand(index, val)
                                    : null,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          frequencyLabels[index],
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    );
                  }),
                ),
              ],
            ),
          ),

          const SizedBox(height: 28),

          // Bass Boost Control Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.speaker_group_rounded, color: accentColor, size: 20),
                        const SizedBox(width: 10),
                        const Text(
                          'Bass Boost',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '${(eqState.bassBoost * 100).round()}%',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: accentColor,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Slider(
                  value: eqState.bassBoost,
                  min: 0.0,
                  max: 1.0,
                  activeColor: accentColor,
                  inactiveColor: Colors.white.withValues(alpha: 0.1),
                  onChanged: eqState.isEnabled
                      ? (val) => eqNotifier.setBassBoost(val)
                      : null,
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Loudness / Preamp Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.volume_up_rounded, color: accentColor, size: 20),
                        const SizedBox(width: 10),
                        const Text(
                          'Loudness Enhancer (Preamp)',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '+${eqState.loudness.toStringAsFixed(1)} dB',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: accentColor,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Slider(
                  value: eqState.loudness,
                  min: 0.0,
                  max: 12.0,
                  activeColor: accentColor,
                  inactiveColor: Colors.white.withValues(alpha: 0.1),
                  onChanged: eqState.isEnabled
                      ? (val) => eqNotifier.setLoudness(val)
                      : null,
                ),
              ],
            ),
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }
}

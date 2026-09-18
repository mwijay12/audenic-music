import 'package:audio_service/audio_service.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/audio/audenic_audio_handler.dart';
import 'core/theme/app_theme.dart';
import 'providers/audio_providers.dart';
import 'ui/screens/ai/ai_dj_screen.dart';
import 'ui/screens/equalizer/equalizer_screen.dart';
import 'ui/screens/explore/explore_screen.dart';
import 'ui/screens/library/library_screen.dart';
import 'ui/screens/reels/reels_screen.dart';
import 'ui/widgets/mini_player.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Dark navigation bar and status bar
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppColors.background,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // Initialize Firebase
  try {
    await Firebase.initializeApp();
  } catch (e) {
    debugPrint('[Firebase] Initialization note: $e');
  }

  // Initialize background AudioService
  final handler = await AudenicAudioHandler.create();
  final audioHandler = await AudioService.init<AudenicAudioHandler>(
    builder: () => handler,
    config: const AudioServiceConfig(
      androidNotificationChannelId: 'fm.audenic.channel.audio',
      androidNotificationChannelName: 'Audenic Playback',
      androidNotificationOngoing: true,
      androidStopForegroundOnPause: true,
      androidNotificationIcon: 'mipmap/ic_launcher',
    ),
  );

  runApp(
    ProviderScope(
      overrides: [
        audioHandlerProvider.overrideWithValue(audioHandler),
      ],
      child: const AudenicApp(),
    ),
  );
}

class AudenicApp extends ConsumerWidget {
  const AudenicApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dynamicAccent = ref.watch(dynamicAccentColorProvider);

    return MaterialApp(
      title: 'Audenic Music',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme(accentColor: dynamicAccent),
      home: const MainShell(),
    );
  }
}

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    ExploreScreen(),
    LibraryScreen(),
    ReelsScreen(),
    AiDjScreen(),
    EqualizerScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    // Hide miniplayer when on Reels screen so full screen video is unobstructed
    final isReels = _currentIndex == 2;

    return Scaffold(
      body: Stack(
        children: [
          IndexedStack(
            index: _currentIndex,
            children: _screens,
          ),
          // Floating MiniPlayer docked above bottom bar (when not on Reels)
          if (!isReels)
            const Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: MiniPlayer(),
            ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.primarySoft,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.cloud_outlined),
            selectedIcon: Icon(Icons.cloud_rounded),
            label: 'Cloud',
          ),
          NavigationDestination(
            icon: Icon(Icons.library_music_outlined),
            selectedIcon: Icon(Icons.library_music_rounded),
            label: 'Library',
          ),
          NavigationDestination(
            icon: Icon(Icons.play_circle_outline_rounded),
            selectedIcon: Icon(Icons.play_circle_rounded),
            label: 'Reels',
          ),
          NavigationDestination(
            icon: Icon(Icons.auto_awesome_outlined),
            selectedIcon: Icon(Icons.auto_awesome_rounded),
            label: 'AI DJ',
          ),
          NavigationDestination(
            icon: Icon(Icons.equalizer_outlined),
            selectedIcon: Icon(Icons.equalizer_rounded),
            label: 'Equalizer',
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';

class AppColors {
  // Base dark palette
  static const Color background = Color(0xFF0A0B0E);
  static const Color surface = Color(0xFF13151D);
  static const Color surfaceElevated = Color(0xFF1B1E2B);
  static const Color card = Color(0xFF161822);
  
  // Accents
  static const Color primary = Color(0xFF8B5CF6); // Purple
  static const Color primarySoft = Color(0x338B5CF6);
  static const Color secondary = Color(0xFF06B6D4); // Cyan
  static const Color accent = Color(0xFFEC4899); // Pink

  // Text
  static const Color textPrimary = Color(0xFFF3F4F6);
  static const Color textSecondary = Color(0xFF9CA3AF);
  static const Color textMuted = Color(0xFF6B7280);

  // Status & Utility
  static const Color error = Color(0xFFEF4444);
  static const Color success = Color(0xFF10B981);
  static const Color divider = Color(0x1FFFFFFF);
}

class AppTheme {
  static ThemeData darkTheme({Color accentColor = AppColors.primary}) {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.background,
      primaryColor: accentColor,
      colorScheme: ColorScheme.dark(
        primary: accentColor,
        secondary: AppColors.secondary,
        surface: AppColors.surface,
        error: AppColors.error,
        onPrimary: Colors.white,
        onSurface: AppColors.textPrimary,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        scrolledUnderElevation: 0,
        titleTextStyle: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
          letterSpacing: -0.3,
        ),
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: accentColor,
        inactiveTrackColor: Colors.white.withValues(alpha: 0.12),
        thumbColor: Colors.white,
        overlayColor: accentColor.withValues(alpha: 0.2),
        trackHeight: 3.5,
        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        color: AppColors.card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0x14FFFFFF)),
        ),
      ),
    );
  }
}

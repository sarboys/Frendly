import 'package:flutter/material.dart';

class DateasyColors {
  static const background = Color(0xFF1F0C3F);
  static const backgroundDeep = Color(0xFF15082C);
  static const surface = Color(0xFF2C1751);
  static const surface2 = Color(0xFF382264);
  static const foreground = Color(0xFFF9F7FE);
  static const muted = Color(0xFFB9B3CF);
  static const lime = Color(0xFFBEFF67);
  static const lime2 = Color(0xFF5AF169);
  static const lilac = Color(0xFFF1A0FF);
  static const pink = Color(0xFFFF639F);
  static const border = Color(0x1AFFFFFF);
  static const glass = Color(0xB32C1751);
  static const navSurface = Color(0xB32C1751);
}

class DateasyTheme {
  static ThemeData get theme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: DateasyColors.background,
      fontFamily: 'Manrope',
      colorScheme: const ColorScheme.dark(
        primary: DateasyColors.lime,
        secondary: DateasyColors.lilac,
        tertiary: DateasyColors.pink,
        surface: DateasyColors.surface,
        onPrimary: DateasyColors.backgroundDeep,
        onSurface: DateasyColors.foreground,
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(
            fontFamily: 'Sora',
            fontSize: 40,
            height: 1.05,
            fontWeight: FontWeight.w600),
        headlineLarge: TextStyle(
            fontFamily: 'Sora',
            fontSize: 34,
            height: 1.06,
            fontWeight: FontWeight.w700),
        headlineMedium: TextStyle(
            fontFamily: 'Sora',
            fontSize: 24,
            height: 1.12,
            fontWeight: FontWeight.w700),
        titleLarge: TextStyle(
            fontFamily: 'Sora',
            fontSize: 20,
            height: 1.18,
            fontWeight: FontWeight.w700),
        titleMedium:
            TextStyle(fontSize: 16, height: 1.25, fontWeight: FontWeight.w700),
        bodyLarge: TextStyle(fontSize: 16, height: 1.35),
        bodyMedium: TextStyle(fontSize: 14, height: 1.35),
        bodySmall: TextStyle(fontSize: 12, height: 1.3),
      ).apply(
          bodyColor: DateasyColors.foreground,
          displayColor: DateasyColors.foreground),
    );
  }
}

const dateasyHeroGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [
    Color(0xFF3A1C6C),
    DateasyColors.background,
    DateasyColors.background,
  ],
  stops: [0, 0.6, 1],
);

const dateasyLimeGradient =
    LinearGradient(colors: [DateasyColors.lime, DateasyColors.lime2]);
const dateasyPinkGradient =
    LinearGradient(colors: [DateasyColors.lilac, DateasyColors.pink]);

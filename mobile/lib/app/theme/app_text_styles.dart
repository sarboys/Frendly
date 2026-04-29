import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:flutter/material.dart';

class AppTextStyles {
  const AppTextStyles._();

  static TextStyle get screenTitle => const TextStyle(
        fontFamily: 'Sora',
        fontSize: 26,
        fontWeight: FontWeight.w400,
        height: 1.15,
        letterSpacing: -0.52,
      );

  static TextStyle get sectionTitle => const TextStyle(
        fontFamily: 'Sora',
        fontSize: 20,
        fontWeight: FontWeight.w400,
        height: 1.2,
        letterSpacing: -0.4,
      );

  static TextStyle get cardTitle => const TextStyle(
        fontFamily: 'Sora',
        fontSize: 18,
        fontWeight: FontWeight.w400,
        height: 1.25,
        letterSpacing: -0.36,
      );

  static TextStyle get itemTitle => const TextStyle(
        fontFamily: 'Sora',
        fontSize: 15,
        fontWeight: FontWeight.w400,
        height: 1.15,
        letterSpacing: -0.24,
      );

  static TextStyle get body => const TextStyle(
        fontFamily: 'Manrope',
        fontSize: 15,
        fontWeight: FontWeight.w400,
        height: 1.35,
        fontFeatures: [
          FontFeature.enable('ss01'),
          FontFeature.enable('cv11'),
        ],
      );

  static TextStyle get bodySoft => const TextStyle(
        fontFamily: 'Manrope',
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 1.4,
        fontFeatures: [
          FontFeature.enable('ss01'),
          FontFeature.enable('cv11'),
        ],
      );

  static TextStyle get meta => const TextStyle(
        fontFamily: 'Manrope',
        fontSize: 12,
        fontWeight: FontWeight.w500,
        height: 1.25,
        fontFeatures: [
          FontFeature.enable('ss01'),
          FontFeature.enable('cv11'),
        ],
      );

  static TextStyle get caption => const TextStyle(
        fontFamily: 'Manrope',
        fontSize: 11,
        fontWeight: FontWeight.w500,
        height: 1.2,
        fontFeatures: [
          FontFeature.enable('ss01'),
          FontFeature.enable('cv11'),
        ],
      );

  static TextStyle get button => const TextStyle(
        fontFamily: 'Sora',
        fontSize: 16,
        fontWeight: FontWeight.w500,
        height: 1.1,
        letterSpacing: -0.24,
      );

  static TextTheme theme(BigBreakThemeColors colors) {
    return TextTheme(
      displaySmall: screenTitle.copyWith(color: colors.foreground),
      titleLarge: sectionTitle.copyWith(color: colors.foreground),
      titleMedium: cardTitle.copyWith(color: colors.foreground),
      titleSmall: itemTitle.copyWith(color: colors.foreground),
      bodyLarge: body.copyWith(color: colors.foreground),
      bodyMedium: bodySoft.copyWith(color: colors.inkSoft),
      bodySmall: meta.copyWith(color: colors.inkMute),
      labelSmall: caption.copyWith(color: colors.inkMute),
      labelLarge: button.copyWith(color: colors.foreground),
    );
  }
}

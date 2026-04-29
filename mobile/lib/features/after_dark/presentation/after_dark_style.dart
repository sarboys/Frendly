import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:flutter/material.dart';

Color afterDarkGlowColor(String? glow) {
  switch (glow) {
    case 'cyan':
      return AppColors.adCyan;
    case 'gold':
      return AppColors.adGold;
    case 'violet':
      return AppColors.adViolet;
    case 'magenta':
    default:
      return AppColors.adMagenta;
  }
}

Color afterDarkGlowSurface(String? glow) {
  return afterDarkGlowColor(glow).withValues(alpha: 0.14);
}

BigBreakThemeColors buildAfterDarkChatColors(
  BigBreakThemeColors base, {
  String? glow,
}) {
  final accent = afterDarkGlowColor(glow);
  final accentSoft = afterDarkGlowSurface(glow);
  return base.copyWith(
    background: AppColors.adBg,
    foreground: AppColors.adFg,
    card: AppColors.adSurface,
    cardForeground: AppColors.adFg,
    popover: AppColors.adSurface,
    popoverForeground: AppColors.adFg,
    primary: accent,
    primaryForeground: AppColors.adFg,
    primarySoft: accentSoft,
    secondary: AppColors.adFgSoft,
    secondaryForeground: AppColors.adFg,
    secondarySoft: AppColors.adSurfaceElev,
    muted: AppColors.adSurface,
    mutedForeground: AppColors.adFgMute,
    accent: AppColors.adSurfaceElev,
    accentForeground: AppColors.adFg,
    border: AppColors.adBorder,
    input: AppColors.adBorder,
    ring: accent,
    inkSoft: AppColors.adFgSoft,
    inkMute: AppColors.adFgMute,
    bubbleMe: accent,
    bubbleMeForeground: AppColors.adFg,
    bubbleThem: AppColors.adSurfaceElev,
    bubbleThemForeground: AppColors.adFg,
    online: AppColors.adCyan,
    warmStart: accentSoft,
    warmEnd: AppColors.adSurfaceElev,
    eveningStart: AppColors.afterDarkGradientStart,
    eveningEnd: AppColors.afterDarkGradientEnd,
    viewportBackground: AppColors.adBg,
    phoneFrameShadowStrong: const Color(0x99000000),
    phoneFrameShadowSoft: const Color(0x66000000),
  );
}

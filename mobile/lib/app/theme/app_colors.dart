import 'package:flutter/material.dart';

@immutable
class BigBreakThemeColors extends ThemeExtension<BigBreakThemeColors> {
  const BigBreakThemeColors({
    required this.isDark,
    required this.background,
    required this.foreground,
    required this.card,
    required this.cardForeground,
    required this.popover,
    required this.popoverForeground,
    required this.primary,
    required this.primaryForeground,
    required this.primarySoft,
    required this.secondary,
    required this.secondaryForeground,
    required this.secondarySoft,
    required this.muted,
    required this.mutedForeground,
    required this.accent,
    required this.accentForeground,
    required this.destructive,
    required this.destructiveForeground,
    required this.border,
    required this.input,
    required this.ring,
    required this.inkSoft,
    required this.inkMute,
    required this.bubbleMe,
    required this.bubbleMeForeground,
    required this.bubbleThem,
    required this.bubbleThemForeground,
    required this.online,
    required this.warmStart,
    required this.warmEnd,
    required this.eveningStart,
    required this.eveningEnd,
    required this.viewportBackground,
    required this.phoneFrameShadowStrong,
    required this.phoneFrameShadowSoft,
  });

  final bool isDark;
  final Color background;
  final Color foreground;
  final Color card;
  final Color cardForeground;
  final Color popover;
  final Color popoverForeground;
  final Color primary;
  final Color primaryForeground;
  final Color primarySoft;
  final Color secondary;
  final Color secondaryForeground;
  final Color secondarySoft;
  final Color muted;
  final Color mutedForeground;
  final Color accent;
  final Color accentForeground;
  final Color destructive;
  final Color destructiveForeground;
  final Color border;
  final Color input;
  final Color ring;
  final Color inkSoft;
  final Color inkMute;
  final Color bubbleMe;
  final Color bubbleMeForeground;
  final Color bubbleThem;
  final Color bubbleThemForeground;
  final Color online;
  final Color warmStart;
  final Color warmEnd;
  final Color eveningStart;
  final Color eveningEnd;
  final Color viewportBackground;
  final Color phoneFrameShadowStrong;
  final Color phoneFrameShadowSoft;

  @override
  BigBreakThemeColors copyWith({
    bool? isDark,
    Color? background,
    Color? foreground,
    Color? card,
    Color? cardForeground,
    Color? popover,
    Color? popoverForeground,
    Color? primary,
    Color? primaryForeground,
    Color? primarySoft,
    Color? secondary,
    Color? secondaryForeground,
    Color? secondarySoft,
    Color? muted,
    Color? mutedForeground,
    Color? accent,
    Color? accentForeground,
    Color? destructive,
    Color? destructiveForeground,
    Color? border,
    Color? input,
    Color? ring,
    Color? inkSoft,
    Color? inkMute,
    Color? bubbleMe,
    Color? bubbleMeForeground,
    Color? bubbleThem,
    Color? bubbleThemForeground,
    Color? online,
    Color? warmStart,
    Color? warmEnd,
    Color? eveningStart,
    Color? eveningEnd,
    Color? viewportBackground,
    Color? phoneFrameShadowStrong,
    Color? phoneFrameShadowSoft,
  }) {
    return BigBreakThemeColors(
      isDark: isDark ?? this.isDark,
      background: background ?? this.background,
      foreground: foreground ?? this.foreground,
      card: card ?? this.card,
      cardForeground: cardForeground ?? this.cardForeground,
      popover: popover ?? this.popover,
      popoverForeground: popoverForeground ?? this.popoverForeground,
      primary: primary ?? this.primary,
      primaryForeground: primaryForeground ?? this.primaryForeground,
      primarySoft: primarySoft ?? this.primarySoft,
      secondary: secondary ?? this.secondary,
      secondaryForeground: secondaryForeground ?? this.secondaryForeground,
      secondarySoft: secondarySoft ?? this.secondarySoft,
      muted: muted ?? this.muted,
      mutedForeground: mutedForeground ?? this.mutedForeground,
      accent: accent ?? this.accent,
      accentForeground: accentForeground ?? this.accentForeground,
      destructive: destructive ?? this.destructive,
      destructiveForeground:
          destructiveForeground ?? this.destructiveForeground,
      border: border ?? this.border,
      input: input ?? this.input,
      ring: ring ?? this.ring,
      inkSoft: inkSoft ?? this.inkSoft,
      inkMute: inkMute ?? this.inkMute,
      bubbleMe: bubbleMe ?? this.bubbleMe,
      bubbleMeForeground: bubbleMeForeground ?? this.bubbleMeForeground,
      bubbleThem: bubbleThem ?? this.bubbleThem,
      bubbleThemForeground: bubbleThemForeground ?? this.bubbleThemForeground,
      online: online ?? this.online,
      warmStart: warmStart ?? this.warmStart,
      warmEnd: warmEnd ?? this.warmEnd,
      eveningStart: eveningStart ?? this.eveningStart,
      eveningEnd: eveningEnd ?? this.eveningEnd,
      viewportBackground: viewportBackground ?? this.viewportBackground,
      phoneFrameShadowStrong:
          phoneFrameShadowStrong ?? this.phoneFrameShadowStrong,
      phoneFrameShadowSoft: phoneFrameShadowSoft ?? this.phoneFrameShadowSoft,
    );
  }

  @override
  BigBreakThemeColors lerp(
    covariant ThemeExtension<BigBreakThemeColors>? other,
    double t,
  ) {
    if (other is! BigBreakThemeColors) {
      return this;
    }

    return BigBreakThemeColors(
      isDark: t < 0.5 ? isDark : other.isDark,
      background: Color.lerp(background, other.background, t)!,
      foreground: Color.lerp(foreground, other.foreground, t)!,
      card: Color.lerp(card, other.card, t)!,
      cardForeground: Color.lerp(cardForeground, other.cardForeground, t)!,
      popover: Color.lerp(popover, other.popover, t)!,
      popoverForeground:
          Color.lerp(popoverForeground, other.popoverForeground, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      primaryForeground:
          Color.lerp(primaryForeground, other.primaryForeground, t)!,
      primarySoft: Color.lerp(primarySoft, other.primarySoft, t)!,
      secondary: Color.lerp(secondary, other.secondary, t)!,
      secondaryForeground:
          Color.lerp(secondaryForeground, other.secondaryForeground, t)!,
      secondarySoft: Color.lerp(secondarySoft, other.secondarySoft, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      mutedForeground: Color.lerp(mutedForeground, other.mutedForeground, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      accentForeground:
          Color.lerp(accentForeground, other.accentForeground, t)!,
      destructive: Color.lerp(destructive, other.destructive, t)!,
      destructiveForeground:
          Color.lerp(destructiveForeground, other.destructiveForeground, t)!,
      border: Color.lerp(border, other.border, t)!,
      input: Color.lerp(input, other.input, t)!,
      ring: Color.lerp(ring, other.ring, t)!,
      inkSoft: Color.lerp(inkSoft, other.inkSoft, t)!,
      inkMute: Color.lerp(inkMute, other.inkMute, t)!,
      bubbleMe: Color.lerp(bubbleMe, other.bubbleMe, t)!,
      bubbleMeForeground:
          Color.lerp(bubbleMeForeground, other.bubbleMeForeground, t)!,
      bubbleThem: Color.lerp(bubbleThem, other.bubbleThem, t)!,
      bubbleThemForeground:
          Color.lerp(bubbleThemForeground, other.bubbleThemForeground, t)!,
      online: Color.lerp(online, other.online, t)!,
      warmStart: Color.lerp(warmStart, other.warmStart, t)!,
      warmEnd: Color.lerp(warmEnd, other.warmEnd, t)!,
      eveningStart: Color.lerp(eveningStart, other.eveningStart, t)!,
      eveningEnd: Color.lerp(eveningEnd, other.eveningEnd, t)!,
      viewportBackground:
          Color.lerp(viewportBackground, other.viewportBackground, t)!,
      phoneFrameShadowStrong:
          Color.lerp(phoneFrameShadowStrong, other.phoneFrameShadowStrong, t)!,
      phoneFrameShadowSoft:
          Color.lerp(phoneFrameShadowSoft, other.phoneFrameShadowSoft, t)!,
    );
  }
}

class AppColors {
  const AppColors._();

  static const lightTheme = BigBreakThemeColors(
    isDark: false,
    background: Color(0xFFF8F5F0),
    foreground: Color(0xFF1A1A1F),
    card: Colors.white,
    cardForeground: Color(0xFF1A1A1F),
    popover: Colors.white,
    popoverForeground: Color(0xFF1A1A1F),
    primary: Color(0xFFE26A52),
    primaryForeground: Color(0xFFFEFBF7),
    primarySoft: Color(0xFFFCE7E2),
    secondary: Color(0xFF7FA88E),
    secondaryForeground: Colors.white,
    secondarySoft: Color(0xFFEAF3EC),
    muted: Color(0xFFF0EAE1),
    mutedForeground: Color(0xFF68686E),
    accent: Color(0xFFE8DFD2),
    accentForeground: Color(0xFF1A1A1F),
    destructive: Color(0xFFDD3F3F),
    destructiveForeground: Colors.white,
    border: Color(0xFFE4DED6),
    input: Color(0xFFE4DED6),
    ring: Color(0xFFE26A52),
    inkSoft: Color(0xFF44454C),
    inkMute: Color(0xFF8C8C91),
    bubbleMe: Color(0xFFE26A52),
    bubbleMeForeground: Color(0xFFFEFBF7),
    bubbleThem: Color(0xFFF3EEE7),
    bubbleThemForeground: Color(0xFF1A1A1F),
    online: Color(0xFF39AC67),
    warmStart: Color(0xFFF6F0E4),
    warmEnd: Color(0xFFEEE3D8),
    eveningStart: Color(0xFFF1D6C6),
    eveningEnd: Color(0xFFEFB4A1),
    viewportBackground: Color(0xFFEFE7DB),
    phoneFrameShadowStrong: Color(0x591A1A1F),
    phoneFrameShadowSoft: Color(0x401A1A1F),
  );

  static const darkTheme = BigBreakThemeColors(
    isDark: true,
    background: Color(0xFF121217),
    foreground: Color(0xFFF3EEE7),
    card: Color(0xFF1C1C22),
    cardForeground: Color(0xFFF3EEE7),
    popover: Color(0xFF1C1C22),
    popoverForeground: Color(0xFFF3EEE7),
    primary: Color(0xFFE3725C),
    primaryForeground: Color(0xFF121217),
    primarySoft: Color(0xFF412621),
    secondary: Color(0xFF76A885),
    secondaryForeground: Color(0xFF121217),
    secondarySoft: Color(0xFF252F29),
    muted: Color(0xFF27272D),
    mutedForeground: Color(0xFFA3A3AB),
    accent: Color(0xFF2A2A31),
    accentForeground: Color(0xFFF3EEE7),
    destructive: Color(0xFFD54C4C),
    destructiveForeground: Colors.white,
    border: Color(0xFF2E2E35),
    input: Color(0xFF2E2E35),
    ring: Color(0xFFE3725C),
    inkSoft: Color(0xFFD7CFBF),
    inkMute: Color(0xFF999AA0),
    bubbleMe: Color(0xFFE06A50),
    bubbleMeForeground: Color(0xFFFEFBF7),
    bubbleThem: Color(0xFF2E2E35),
    bubbleThemForeground: Color(0xFFF3EEE7),
    online: Color(0xFF3FC673),
    warmStart: Color(0xFF24242B),
    warmEnd: Color(0xFF312A28),
    eveningStart: Color(0xFF472B24),
    eveningEnd: Color(0xFF63372D),
    viewportBackground: Color(0xFF18181E),
    phoneFrameShadowStrong: Color(0x80000000),
    phoneFrameShadowSoft: Color(0x59000000),
  );

  static BigBreakThemeColors of(BuildContext context) {
    final palette = Theme.of(context).extension<BigBreakThemeColors>();
    return palette ?? lightTheme;
  }

  static const background = Color(0xFFF8F5F0);
  static const foreground = Color(0xFF1A1A1F);
  static const card = Colors.white;
  static const cardForeground = foreground;
  static const popover = Colors.white;
  static const popoverForeground = foreground;
  static const primary = Color(0xFFE26A52);
  static const primaryForeground = Color(0xFFFEFBF7);
  static const primarySoft = Color(0xFFFCE7E2);
  static const secondary = Color(0xFF7FA88E);
  static const secondaryForeground = Colors.white;
  static const secondarySoft = Color(0xFFEAF3EC);
  static const muted = Color(0xFFF0EAE1);
  static const mutedForeground = Color(0xFF68686E);
  static const accent = Color(0xFFE8DFD2);
  static const accentForeground = foreground;
  static const destructive = Color(0xFFDD3F3F);
  static const destructiveForeground = Colors.white;
  static const border = Color(0xFFE4DED6);
  static const input = border;
  static const ring = primary;
  static const inkSoft = Color(0xFF44454C);
  static const inkMute = Color(0xFF8C8C91);
  static const bubbleMe = primary;
  static const bubbleMeForeground = primaryForeground;
  static const bubbleThem = Color(0xFFF3EEE7);
  static const bubbleThemForeground = foreground;
  static const online = Color(0xFF39AC67);
  static const warmStart = Color(0xFFF6F0E4);
  static const warmEnd = Color(0xFFEEE3D8);
  static const eveningStart = Color(0xFFF1D6C6);
  static const eveningEnd = Color(0xFFEFB4A1);
  static const darkBackground = Color(0xFF121217);
  static const darkForeground = Color(0xFFF3EEE7);
  static const adBg = Color(0xFF120B17);
  static const adSurface = Color(0xFF1C1323);
  static const adSurfaceElev = Color(0xFF24172D);
  static const adBorder = Color(0xFF3E2E48);
  static const adFg = Color(0xFFF8F0FA);
  static const adFgSoft = Color(0xFFCDBBD3);
  static const adFgMute = Color(0xFF9C8BA5);
  static const adMagenta = Color(0xFFFF3EA5);
  static const adMagentaSoft = Color(0xFF5B1C43);
  static const adViolet = Color(0xFF9962FF);
  static const adVioletSoft = Color(0xFF34204D);
  static const adCyan = Color(0xFF2FE3FF);
  static const adGold = Color(0xFFFFC83D);
  static const afterDarkGradientStart = Color(0xFF241136);
  static const afterDarkGradientMid = Color(0xFF2E173F);
  static const afterDarkGradientEnd = Color(0xFF45142D);
  static const neonStart = adMagenta;
  static const neonEnd = adViolet;
}

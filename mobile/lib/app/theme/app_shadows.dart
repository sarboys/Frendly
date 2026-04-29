import 'package:flutter/material.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';

class AppShadows {
  const AppShadows._();

  static const card = [
    BoxShadow(
      color: Color(0x0A1A1A1F),
      blurRadius: 24,
      offset: Offset(0, 8),
      spreadRadius: -8,
    ),
    BoxShadow(
      color: Color(0x0A1A1A1F),
      blurRadius: 2,
      offset: Offset(0, 1),
    ),
  ];

  static const soft = [
    BoxShadow(
      color: Color(0x0A1A1A1F),
      blurRadius: 2,
      offset: Offset(0, 1),
    ),
  ];

  static const nav = [
    BoxShadow(
      color: Color(0x1F1A1A1F),
      blurRadius: 24,
      offset: Offset(0, -2),
      spreadRadius: -8,
    ),
  ];

  static const neon = [
    BoxShadow(
      color: Color(0x73FF3EA5),
      blurRadius: 24,
      offset: Offset(0, 0),
      spreadRadius: -4,
    ),
    BoxShadow(
      color: Color(0x592FE3FF),
      blurRadius: 48,
      offset: Offset(0, 0),
      spreadRadius: -10,
    ),
  ];

  static List<BoxShadow> navFor(BigBreakThemeColors colors) {
    if (colors.isDark) {
      return const [
        BoxShadow(
          color: Color(0x80000000),
          blurRadius: 24,
          offset: Offset(0, -2),
          spreadRadius: -8,
        ),
      ];
    }

    return nav;
  }
}

import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:flutter/material.dart';

class AppTheme {
  const AppTheme._();

  static final ThemeData light = _buildTheme(AppColors.lightTheme);
  static final ThemeData dark = _buildTheme(AppColors.darkTheme);

  static ThemeData _buildTheme(BigBreakThemeColors colors) {
    final brightness = colors.isDark ? Brightness.dark : Brightness.light;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: colors.background,
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: colors.primary,
        onPrimary: colors.primaryForeground,
        secondary: colors.secondary,
        onSecondary: colors.secondaryForeground,
        error: colors.destructive,
        onError: colors.destructiveForeground,
        surface: colors.card,
        onSurface: colors.foreground,
      ),
      textTheme: AppTextStyles.theme(colors),
      dividerColor: colors.border,
      cardColor: colors.card,
      extensions: [colors],
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: colors.foreground,
        centerTitle: false,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        fillColor: colors.card,
        hintStyle: AppTextStyles.bodySoft.copyWith(color: colors.inkMute),
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        disabledBorder: InputBorder.none,
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: colors.foreground,
        selectionColor: colors.primarySoft,
        selectionHandleColor: colors.foreground,
      ),
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      focusColor: Colors.transparent,
    );
  }
}

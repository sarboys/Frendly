import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('primary color matches design token', () {
    expect(AppColors.primary.toARGB32(), 0xFFE26A52);
  });

  test('background color matches design token', () {
    expect(AppColors.background.toARGB32(), 0xFFF8F5F0);
  });

  test('dark background color matches design token', () {
    expect(AppColors.darkBackground.toARGB32(), 0xFF121217);
  });

  test('after dark magenta matches design token', () {
    expect(AppColors.adMagenta.toARGB32(), 0xFFFF3EA5);
  });
}

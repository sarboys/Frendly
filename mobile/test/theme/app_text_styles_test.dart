import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('display styles use local Sora family', () {
    expect(AppTextStyles.screenTitle.fontFamily, 'Sora');
    expect(AppTextStyles.sectionTitle.fontFamily, 'Sora');
    expect(AppTextStyles.cardTitle.fontFamily, 'Sora');
    expect(AppTextStyles.itemTitle.fontFamily, 'Sora');
    expect(AppTextStyles.button.fontFamily, 'Sora');
    expect(AppTextStyles.screenTitle.fontWeight, FontWeight.w400);
    expect(AppTextStyles.sectionTitle.fontWeight, FontWeight.w400);
    expect(AppTextStyles.cardTitle.fontWeight, FontWeight.w400);
    expect(AppTextStyles.itemTitle.fontWeight, FontWeight.w400);
  });

  test('ui styles use local Manrope family', () {
    expect(AppTextStyles.body.fontFamily, 'Manrope');
    expect(AppTextStyles.bodySoft.fontFamily, 'Manrope');
    expect(AppTextStyles.meta.fontFamily, 'Manrope');
    expect(AppTextStyles.caption.fontFamily, 'Manrope');
  });
}

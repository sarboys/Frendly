import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('native launch screens do not flash the old beige background', () {
    final iosLaunch = File('ios/Runner/Base.lproj/LaunchScreen.storyboard')
        .readAsStringSync();
    final androidColors =
        File('android/app/src/main/res/values/colors.xml').readAsStringSync();
    final androidStyles =
        File('android/app/src/main/res/values/styles.xml').readAsStringSync();
    final androidV31Styles =
        File('android/app/src/main/res/values-v31/styles.xml')
            .readAsStringSync();

    expect(iosLaunch, isNot(contains('0.9450980392')));
    expect(iosLaunch, contains('0.0823529412'));
    expect(androidColors, contains('#15082C'));
    expect(androidStyles, contains('@color/splash_background'));
    expect(androidV31Styles, contains('@color/splash_background'));
  });
}

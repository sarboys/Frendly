import 'package:big_break_mobile/app/app.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/session/app_session_controller.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../test_overrides.dart';

void main() {
  testWidgets('root resets app session when auth tokens are cleared',
      (tester) async {
    SharedPreferences.setMockInitialValues({
      'auth.tokens':
          '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    });
    final preferences = await SharedPreferences.getInstance();
    _RecordingAppSessionController? controller;

    await tester.pumpWidget(
      BigBreakRoot(
        overrides: [
          ...buildTestOverrides(),
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          sharedPreferencesProvider.overrideWithValue(preferences),
          appSessionControllerProvider.overrideWith((ref) {
            controller = _RecordingAppSessionController(ref);
            return controller!;
          }),
        ],
      ),
    );
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(MaterialApp)),
    );
    container.read(authTokensProvider.notifier).clear();
    await tester.pump();
    await tester.pump();

    expect(controller?.clearCalls, 1);
    expect(controller?.persistedFlags, [true]);
  });
}

class _RecordingAppSessionController extends AppSessionController {
  _RecordingAppSessionController(super.ref);

  int clearCalls = 0;
  final persistedFlags = <bool>[];

  @override
  Future<void> clearSessionRuntime({
    required bool clearPersistedChatState,
  }) async {
    clearCalls += 1;
    persistedFlags.add(clearPersistedChatState);
  }
}

import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/navigation/app_router.dart';
import 'package:big_break_mobile/app/session/app_session_controller.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_theme.dart';
import 'package:big_break_mobile/app/theme/app_theme_mode.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:big_break_mobile/shared/widgets/bb_brand_icon.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class BigBreakRoot extends StatelessWidget {
  const BigBreakRoot({
    super.key,
    this.overrides = const [],
  });

  final List<Override> overrides;

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: overrides,
      child: const _RootAppView(),
    );
  }
}

class _RootAppView extends ConsumerStatefulWidget {
  const _RootAppView();

  @override
  ConsumerState<_RootAppView> createState() => _RootAppViewState();
}

class _RootAppViewState extends ConsumerState<_RootAppView> {
  late final ValueNotifier<bool> _authenticatedNotifier;
  late final ValueNotifier<String?> _pendingSetupNotifier;
  late final GoRouter _router;
  bool _sessionClearQueued = false;
  bool _pendingPersistedChatClear = false;

  @override
  void initState() {
    super.initState();
    _authenticatedNotifier = ValueNotifier<bool>(
      ref.read(authTokensProvider) != null,
    );
    _pendingSetupNotifier = ValueNotifier<String?>(null);
    _router = buildAppRouter(
      authenticated: _authenticatedNotifier.value,
      refreshListenable: Listenable.merge(
        [_authenticatedNotifier, _pendingSetupNotifier],
      ),
      isAuthenticated: () => _authenticatedNotifier.value,
      pendingSetupPath: () => _pendingSetupNotifier.value,
    );
  }

  @override
  void dispose() {
    _router.dispose();
    _authenticatedNotifier.dispose();
    _pendingSetupNotifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthTokens?>(authTokensProvider, (previous, next) {
      if (previous != null && next == null) {
        _queueSessionRuntimeClear(clearPersistedChatState: true);
      }
    });
    ref.listen<String?>(currentUserIdProvider, (previous, next) {
      if (previous != null && next != null && previous != next) {
        _queueSessionRuntimeClear(clearPersistedChatState: true);
      }
    });

    final themeMode = ref.watch(appThemeModeProvider);
    final authTokens = ref.watch(authTokensProvider);
    ref.watch(authBootstrapProvider);
    final isAuthenticated = authTokens != null;
    final onboardingAsync =
        isAuthenticated ? ref.watch(onboardingProvider) : null;

    if (isAuthenticated) {
      ref.watch(chatRealtimeSyncProvider);
    }

    if (_authenticatedNotifier.value != isAuthenticated) {
      _authenticatedNotifier.value = isAuthenticated;
    }

    if (onboardingAsync case final value?) {
      final pendingSetup =
          value.hasValue ? resolvePendingSetupRoute(value.valueOrNull) : null;
      if (_pendingSetupNotifier.value != pendingSetup) {
        _pendingSetupNotifier.value = pendingSetup;
      }
    } else if (_pendingSetupNotifier.value != null) {
      _pendingSetupNotifier.value = null;
    }

    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'Frendly',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      routerConfig: _router,
      builder: (context, child) => _AppViewportFrame(
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }

  void _queueSessionRuntimeClear({
    required bool clearPersistedChatState,
  }) {
    _pendingPersistedChatClear =
        _pendingPersistedChatClear || clearPersistedChatState;
    if (_sessionClearQueued) {
      return;
    }

    _sessionClearQueued = true;
    Future<void>.microtask(() async {
      final shouldClearPersistedChatState = _pendingPersistedChatClear;
      _pendingPersistedChatClear = false;
      _sessionClearQueued = false;

      if (!mounted) {
        return;
      }

      await ref.read(appSessionControllerProvider).clearSessionRuntime(
            clearPersistedChatState: shouldClearPersistedChatState,
          );
    });
  }
}

// ignore: unused_element
class _AppStartupScreen extends StatelessWidget {
  const _AppStartupScreen();

  static const _brandGreen = Color(0xFF88A28C);
  static const _brandWhite = Color(0xFFF8F5EF);

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      key: Key('app-startup-screen'),
      backgroundColor: _brandGreen,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            BbBrandIcon(
              size: 112,
              radius: 32,
            ),
            SizedBox(height: 24),
            SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2.4,
                valueColor: AlwaysStoppedAnimation<Color>(_brandWhite),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AppViewportFrame extends StatelessWidget {
  const _AppViewportFrame({
    required this.child,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final forcePhoneViewport =
            !kIsWeb && defaultTargetPlatform == TargetPlatform.macOS;
        final shouldUsePhoneViewport =
            forcePhoneViewport || constraints.maxWidth > 460;

        if (!shouldUsePhoneViewport) {
          return child;
        }

        const phoneWidth = 390.0;
        const phoneHeight = 820.0;

        return ColoredBox(
          color: colors.viewportBackground,
          child: Center(
            child: DecoratedBox(
              decoration: BoxDecoration(
                boxShadow: [
                  BoxShadow(
                    color: colors.phoneFrameShadowStrong,
                    blurRadius: 100,
                    spreadRadius: -30,
                    offset: const Offset(0, 50),
                  ),
                  BoxShadow(
                    color: colors.phoneFrameShadowSoft,
                    blurRadius: 60,
                    spreadRadius: -30,
                    offset: const Offset(0, 30),
                  ),
                ],
              ),
              child: Container(
                width: phoneWidth + 16,
                height: phoneHeight + 16,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: colors.foreground,
                  borderRadius: BorderRadius.circular(48),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(40),
                  child: Stack(
                    children: [
                      Positioned.fill(
                        top: 44,
                        child: child,
                      ),
                      const Positioned(
                        left: 0,
                        top: 0,
                        right: 0,
                        height: 44,
                        child: _PhoneStatusBar(),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _PhoneStatusBar extends StatelessWidget {
  const _PhoneStatusBar();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return ColoredBox(
      color: colors.background,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Stack(
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '21:14',
                style: TextStyle(
                  fontFamily: 'Sora',
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: colors.foreground,
                ),
              ),
            ),
            Align(
              alignment: Alignment.topCenter,
              child: Container(
                margin: const EdgeInsets.only(top: 8),
                width: 112,
                height: 24,
                decoration: BoxDecoration(
                  color: colors.foreground,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const Align(
              alignment: Alignment.centerRight,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _SignalBars(),
                  SizedBox(width: 6),
                  _BatteryIcon(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignalBars extends StatelessWidget {
  const _SignalBars();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 16,
      height: 10,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _SignalBar(height: 3),
          _SignalBar(height: 5),
          _SignalBar(height: 7),
          _SignalBar(height: 9),
        ],
      ),
    );
  }
}

class _SignalBar extends StatelessWidget {
  const _SignalBar({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      width: 2,
      height: height,
      decoration: BoxDecoration(
        color: colors.foreground,
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }
}

class _BatteryIcon extends StatelessWidget {
  const _BatteryIcon();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return SizedBox(
      width: 22,
      height: 11,
      child: Stack(
        children: [
          Positioned.fill(
            right: 2,
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: colors.foreground, width: 1),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
          Positioned(
            left: 2,
            top: 2,
            right: 5,
            bottom: 2,
            child: Container(
              decoration: BoxDecoration(
                color: colors.foreground,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Positioned(
            right: 0,
            top: 3.5,
            child: Container(
              width: 2,
              height: 4,
              decoration: BoxDecoration(
                color: colors.foreground,
                borderRadius: BorderRadius.circular(1),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

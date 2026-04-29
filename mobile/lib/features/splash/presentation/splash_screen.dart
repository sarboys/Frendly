import 'dart:async';

import 'package:big_break_mobile/app/core/device/app_haptic_service.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/app/navigation/app_router.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  static const _letters = 'Frendly';
  static const _minSplashDuration = Duration(milliseconds: 250);
  late final AnimationController _controller;
  Timer? _finishTimer;
  Timer? _hapticTimer;
  bool _readyToClose = false;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: _minSplashDuration,
    )..forward();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _hapticTimer = Timer(const Duration(milliseconds: 140), () {
        if (!mounted) {
          return;
        }
        ref.read(appHapticServiceProvider).lightImpact();
      });
    });
    _finishTimer = Timer(_minSplashDuration, () {
      if (!mounted) {
        return;
      }
      setState(() {
        _readyToClose = true;
      });
    });
  }

  @override
  void dispose() {
    _finishTimer?.cancel();
    _hapticTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final authTokens = ref.watch(authTokensProvider);
    final authBootstrap = ref.watch(authBootstrapProvider);
    final onboardingAsync =
        authTokens != null ? ref.watch(onboardingProvider) : null;
    final onboardingLoading =
        authTokens != null && (onboardingAsync?.isLoading ?? false);
    final onboarding = onboardingAsync?.valueOrNull;

    if (_readyToClose &&
        !_navigated &&
        !authBootstrap.isLoading &&
        !onboardingLoading) {
      _navigated = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) {
          return;
        }
        final pendingSetup = resolvePendingSetupRoute(onboarding);
        if (authTokens == null) {
          context.goRoute(AppRoute.welcome);
          return;
        }
        if (pendingSetup != null) {
          context.go(pendingSetup);
          return;
        }
        context.goRoute(AppRoute.tonight);
      });
    }

    return Scaffold(
      backgroundColor: colors.background,
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              colors.secondarySoft,
              colors.background,
              colors.background,
            ],
          ),
        ),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedBuilder(
                  animation: _controller,
                  builder: (context, child) {
                    final animation = CurvedAnimation(
                      parent: _controller,
                      curve:
                          const Interval(0.0, 0.28, curve: Curves.easeOutBack),
                    );
                    return FadeTransition(
                      opacity: animation,
                      child: ScaleTransition(
                        scale: Tween<double>(
                          begin: 0.84,
                          end: 1,
                        ).animate(animation),
                        child: Container(
                          width: 112,
                          height: 112,
                          clipBehavior: Clip.antiAlias,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(32),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x12000000),
                                blurRadius: 28,
                                offset: Offset(0, 16),
                              ),
                            ],
                          ),
                          child: Image.asset(
                            'assets/images/icon-v5-sage.png',
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 28),
                AnimatedBuilder(
                  animation: _controller,
                  builder: (context, child) {
                    return Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(_letters.length, (index) {
                        final start = (0.12 + index * 0.07).clamp(0.0, 0.95);
                        final end = (start + 0.24).clamp(start, 1.0);
                        final animation = CurvedAnimation(
                          parent: _controller,
                          curve:
                              Interval(start, end, curve: Curves.easeOutCubic),
                        );
                        return FadeTransition(
                          opacity: animation,
                          child: SlideTransition(
                            position: Tween<Offset>(
                              begin: const Offset(0, -0.4),
                              end: Offset.zero,
                            ).animate(animation),
                            child: Text(
                              _letters[index],
                              style: AppTextStyles.screenTitle.copyWith(
                                fontSize: 42,
                                height: 1,
                                color: index == 0
                                    ? colors.primary
                                    : colors.foreground,
                              ),
                            ),
                          ),
                        );
                      }),
                    );
                  },
                ),
                const SizedBox(height: 16),
                Text(
                  'Вечер начинается мягко, с твоих людей, мест plus совпадений.',
                  textAlign: TextAlign.center,
                  style: AppTextStyles.bodySoft.copyWith(
                    color: colors.inkMute,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/session/app_session_controller.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/welcome/application/social_auth_controller.dart';
import 'package:big_break_mobile/shared/models/auth_flow.dart';
import 'package:big_break_mobile/shared/widgets/bb_brand_icon.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen> {
  String? _pendingProvider;

  Future<void> _submitSocialAuth(
    String provider,
    Future<PhoneAuthSession> Function() signIn,
  ) async {
    if (_pendingProvider != null) {
      return;
    }

    setState(() {
      _pendingProvider = provider;
    });

    try {
      final session = await signIn();
      if (!mounted) {
        return;
      }

      await ref.read(appSessionControllerProvider).replaceAuthenticatedSession(
            tokens: session.tokens,
            userId: session.userId,
          );
      if (!mounted) {
        return;
      }
      context.goRoute(
        session.isNewUser ? AppRoute.permissions : AppRoute.tonight,
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$provider вход пока не настроен')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _pendingProvider = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final socialAuth = ref.watch(socialAuthServiceProvider);
    final pendingProvider = _pendingProvider;
    return Scaffold(
      backgroundColor: colors.background,
      body: Container(
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
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: IntrinsicHeight(
                    child: Column(
                      children: [
                        const Spacer(),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 32),
                          child: Column(
                            children: [
                              const BbBrandIcon(
                                size: 96,
                                radius: 28,
                                boxShadow: AppShadows.card,
                              ),
                              const SizedBox(height: AppSpacing.xxl),
                              Text(
                                'Знакомства\nчерез вечера,\nа не свайпы.',
                                textAlign: TextAlign.center,
                                style: AppTextStyles.screenTitle.copyWith(
                                  fontSize: 34,
                                  height: 1.05,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: AppSpacing.md),
                              Text(
                                'Frendly собирает камерные встречи с людьми, которые рядом и в твоём настроении.',
                                textAlign: TextAlign.center,
                                style: AppTextStyles.body.copyWith(
                                  color: colors.inkMute,
                                  fontSize: 15,
                                  height: 1.45,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Spacer(),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                          child: Column(
                            children: [
                              SizedBox(
                                width: double.infinity,
                                height: 56,
                                child: FilledButton(
                                  style: FilledButton.styleFrom(
                                    backgroundColor: colors.foreground,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(18),
                                    ),
                                  ),
                                  onPressed: () =>
                                      context.pushRoute(AppRoute.phoneAuth),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        'Начать',
                                        style: AppTextStyles.button.copyWith(
                                          color: colors.primaryForeground,
                                        ),
                                      ),
                                      const SizedBox(width: AppSpacing.xs),
                                      Icon(
                                        Icons.arrow_forward_rounded,
                                        color: colors.primaryForeground,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              Row(
                                children: [
                                  Expanded(
                                    child: _AuthIconButton(
                                      key: const Key('auth-provider-google'),
                                      label: 'Войти через Google',
                                      onPressed: pendingProvider == null
                                          ? () => _submitSocialAuth(
                                                'Google',
                                                socialAuth.signInWithGoogle,
                                              )
                                          : null,
                                      child: _AuthIconContent(
                                        loading: pendingProvider == 'Google',
                                        child: Text(
                                          'G',
                                          style: AppTextStyles.button.copyWith(
                                            color: colors.foreground,
                                            fontSize: 20,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: AppSpacing.sm),
                                  Expanded(
                                    child: _AuthIconButton(
                                      key: const Key('auth-provider-yandex'),
                                      label: 'Войти через Yandex',
                                      onPressed: pendingProvider == null
                                          ? () => _submitSocialAuth(
                                                'Yandex',
                                                socialAuth.signInWithYandex,
                                              )
                                          : null,
                                      child: _AuthIconContent(
                                        loading: pendingProvider == 'Yandex',
                                        child: Text(
                                          'Я',
                                          style: AppTextStyles.button.copyWith(
                                            color: colors.primary,
                                            fontSize: 20,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: AppSpacing.sm),
                                  Expanded(
                                    child: _AuthIconButton(
                                      key: const Key('auth-provider-telegram'),
                                      label: 'Войти через Telegram',
                                      onPressed: pendingProvider == null
                                          ? () => context.pushRoute(
                                                AppRoute.telegramAuth,
                                              )
                                          : null,
                                      child: _AuthIconContent(
                                        loading: false,
                                        child: Icon(
                                          Icons.send_rounded,
                                          color: colors.foreground,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              Text(
                                'Продолжая, ты принимаешь Условия и\nПолитику приватности',
                                textAlign: TextAlign.center,
                                style: AppTextStyles.caption,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _AuthIconContent extends StatelessWidget {
  const _AuthIconContent({
    required this.loading,
    required this.child,
  });

  final bool loading;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!loading) {
      return child;
    }

    return const SizedBox.square(
      dimension: 22,
      child: CircularProgressIndicator(strokeWidth: 2),
    );
  }
}

class _AuthIconButton extends StatelessWidget {
  const _AuthIconButton({
    super.key,
    required this.label,
    required this.onPressed,
    required this.child,
  });

  final String label;
  final VoidCallback? onPressed;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Semantics(
      label: label,
      button: true,
      child: SizedBox(
        height: 56,
        child: OutlinedButton(
          style: OutlinedButton.styleFrom(
            backgroundColor: colors.card,
            side: BorderSide(color: colors.border),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
          ),
          onPressed: onPressed,
          child: Center(child: child),
        ),
      ),
    );
  }
}

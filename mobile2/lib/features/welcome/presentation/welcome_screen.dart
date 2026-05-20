import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_highlight_text.dart';
import 'package:mobile2/shared/widgets/dateasy_logo.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_social_icons.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 16, 24, 40),
                  child: IntrinsicHeight(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const DateasyLogo(size: DateasyLogoSize.md),
                        const SizedBox(height: 40),
                        Expanded(
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: _WelcomeHero(theme: Theme.of(context)),
                          ),
                        ),
                        const SizedBox(height: 32),
                        const _WelcomeActions(),
                        const SizedBox(height: 24),
                        const _LegalText(),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _WelcomeHero extends StatelessWidget {
  const _WelcomeHero({required this.theme});

  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    final headlineStyle = theme.textTheme.displayLarge?.copyWith(
      color: DateasyColors.foreground,
      letterSpacing: 0,
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(
          TextSpan(
            children: [
              const TextSpan(text: 'Реальные '),
              dateasyHeadlineHighlightSpan(
                text: 'встречи',
                style: headlineStyle,
              ),
              const TextSpan(text: ' рядом с тобой'),
            ],
          ),
          style: headlineStyle,
        ),
        const SizedBox(height: 16),
        Text(
          'Собирай вечера, знакомься на событиях и находи свою компанию в городе.',
          style: theme.textTheme.bodyLarge?.copyWith(
            color: DateasyColors.muted,
            height: 1.35,
          ),
        ),
      ],
    );
  }
}

class _WelcomeActions extends StatelessWidget {
  const _WelcomeActions();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _SocialButton(
          label: 'Войти по номеру телефона',
          icon: const Icon(
            Icons.phone_rounded,
            size: 20,
            color: DateasyColors.backgroundDeep,
          ),
          isPrimary: true,
          onTap: () => context.go('/auth/phone'),
        ),
        const SizedBox(height: 12),
        _SocialButton(
          label: 'Через Telegram',
          icon: const DateasyTelegramIcon(size: 20),
          onTap: () => context.go('/auth/telegram'),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _CompactSocialButton(
                label: 'Google',
                icon: const DateasyGoogleIcon(size: 20),
                onTap: () => context.go('/onboarding'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _CompactSocialButton(
                label: 'Яндекс',
                icon: const DateasyYandexIcon(size: 20),
                onTap: () => context.go('/onboarding'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.label,
    required this.icon,
    required this.onTap,
    this.isPrimary = false,
  });

  final String label;
  final Widget icon;
  final VoidCallback onTap;
  final bool isPrimary;

  @override
  Widget build(BuildContext context) {
    return _ButtonSurface(
      height: 68,
      isPrimary: isPrimary,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: isPrimary
                    ? Colors.white.withValues(alpha: 0.18)
                    : Colors.white.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: icon,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: isPrimary
                      ? DateasyColors.backgroundDeep
                      : DateasyColors.foreground,
                  fontSize: 16,
                  height: 1.2,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CompactSocialButton extends StatelessWidget {
  const _CompactSocialButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final Widget icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _ButtonSurface(
      height: 52,
      onTap: onTap,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          icon,
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: DateasyColors.foreground,
                fontSize: 16,
                height: 1.2,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ButtonSurface extends StatelessWidget {
  const _ButtonSurface({
    required this.height,
    required this.child,
    required this.onTap,
    this.isPrimary = false,
  });

  final double height;
  final Widget child;
  final VoidCallback onTap;
  final bool isPrimary;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: isPrimary ? dateasyLimeGradient : null,
            color: isPrimary ? null : DateasyColors.glass,
            border: isPrimary
                ? null
                : Border.all(color: Colors.white.withValues(alpha: 0.1)),
            boxShadow: isPrimary
                ? const [
                    BoxShadow(
                      color: Color(0x59BEFF67),
                      blurRadius: 60,
                      spreadRadius: -20,
                      offset: Offset(0, 20),
                    ),
                  ]
                : null,
          ),
          child: child,
        ),
      ),
    );
  }
}

class _LegalText extends StatelessWidget {
  const _LegalText();

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodySmall?.copyWith(
          color: DateasyColors.muted,
          height: 1.3,
        );
    final linkStyle = style?.copyWith(decoration: TextDecoration.underline);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Text.rich(
        TextSpan(
          children: [
            const TextSpan(text: 'Продолжая, ты соглашаешься с '),
            TextSpan(text: 'условиями использования', style: linkStyle),
            const TextSpan(text: ' и '),
            TextSpan(text: 'политикой конфиденциальности', style: linkStyle),
          ],
        ),
        textAlign: TextAlign.center,
        style: style,
      ),
    );
  }
}

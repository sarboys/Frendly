import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

class MatchScreen extends StatelessWidget {
  const MatchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: DateasyColors.background,
      body: LayoutBuilder(
        builder: (context, constraints) {
          final width =
              constraints.maxWidth > 420 ? 420.0 : constraints.maxWidth;

          return Center(
            child: SizedBox(
              width: width,
              height: constraints.maxHeight,
              child: const DecoratedBox(
                decoration: BoxDecoration(gradient: dateasyHeroGradient),
                child: Stack(
                  children: [
                    _Glow(
                      alignment: Alignment(-1.2, -1.16),
                      gradient: dateasyLimeGradient,
                      opacity: 0.5,
                    ),
                    _Glow(
                      alignment: Alignment(1.16, 1.18),
                      gradient: dateasyPinkGradient,
                      opacity: 0.42,
                    ),
                    _Content(),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Content extends ConsumerWidget {
  const _Content();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUser = ref.watch(currentUserProvider);
    final matches = ref.watch(matchesProvider);
    final match = matches.valueOrNull?.items.firstOrNull;
    final title = match == null
        ? 'Новый мэтч'
        : 'Вы совпали с ${match.title.split(',').first}';
    final subtitle = match?.subtitle ?? match?.city ?? 'Можно начать диалог';

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Spacer(flex: 4),
            Text(
              'match'.toUpperCase(),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.lime,
                    fontSize: 14,
                    letterSpacing: 4.2,
                  ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.fromLTRB(24, 6, 24, 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                gradient: dateasyLimeGradient,
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x55BEFF67),
                    blurRadius: 30,
                    offset: Offset(0, 12),
                  ),
                ],
              ),
              child: Text(
                "It's a vibe!",
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.displayLarge?.copyWith(
                      color: DateasyColors.backgroundDeep,
                      fontFamily: 'Sora',
                      fontSize: 60,
                      height: 1.04,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: 286,
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: '$title. '),
                    TextSpan(
                      text: subtitle,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: DateasyColors.foreground,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ],
                ),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.muted,
                      height: 1.35,
                    ),
              ),
            ),
            const SizedBox(height: 40),
            _AvatarPair(
              currentAvatarUrl: currentUser?.avatarUrl,
              matchAvatarUrl: match?.imageUrl,
            ),
            const Spacer(flex: 3),
            _PrimaryAction(
              icon: LucideIcons.messageCircle,
              label: 'Написать сообщение',
              onTap: () => context.go('/chats'),
            ),
            const SizedBox(height: 12),
            _GlassAction(
              icon: LucideIcons.sparkles,
              label: 'Позвать на встречу',
              onTap: () => context.go('/meetings/new'),
            ),
            const SizedBox(height: 12),
            _TextAction(
              icon: LucideIcons.x,
              label: 'Свайпать дальше',
              onTap: () => context.go('/dating'),
            ),
            const Spacer(),
          ],
        ),
      ),
    );
  }
}

class _AvatarPair extends StatelessWidget {
  const _AvatarPair({
    required this.currentAvatarUrl,
    required this.matchAvatarUrl,
  });

  final String? currentAvatarUrl;
  final String? matchAvatarUrl;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 288,
      height: 224,
      child: Stack(
        children: [
          Positioned(
            left: 0,
            top: 16,
            child: Transform.rotate(
              angle: -0.14,
              child: _RoundAvatar(
                imageUrl: currentAvatarUrl,
                glow: false,
              ),
            ),
          ),
          Positioned(
            right: 0,
            bottom: 0,
            child: Transform.rotate(
              angle: 0.14,
              child: _RoundAvatar(
                imageUrl: matchAvatarUrl,
                glow: true,
              ),
            ),
          ),
          Center(
            child: Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: dateasyLimeGradient,
                boxShadow: [
                  BoxShadow(
                    color: Color(0x66BEFF67),
                    blurRadius: 28,
                    offset: Offset(0, 12),
                  ),
                ],
              ),
              child: const Icon(
                Icons.favorite,
                size: 30,
                color: DateasyColors.backgroundDeep,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RoundAvatar extends StatelessWidget {
  const _RoundAvatar({
    required this.imageUrl,
    required this.glow,
  });

  final String? imageUrl;
  final bool glow;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160,
      height: 160,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: DateasyColors.background, width: 4),
        boxShadow: [
          BoxShadow(
            color: (glow ? DateasyColors.lime : Colors.black)
                .withValues(alpha: glow ? 0.38 : 0.28),
            blurRadius: glow ? 28 : 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: DateasyRemoteImage(
        imageUrl: imageUrl,
        usage: DateasyImageUsage.avatar,
      ),
    );
  }
}

class _PrimaryAction extends StatelessWidget {
  const _PrimaryAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 56,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: dateasyLimeGradient,
          boxShadow: const [
            BoxShadow(
              color: Color(0x55BEFF67),
              blurRadius: 26,
              offset: Offset(0, 12),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 21, color: DateasyColors.backgroundDeep),
            const SizedBox(width: 8),
            Text(
              label,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: DateasyColors.backgroundDeep,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GlassAction extends StatelessWidget {
  const _GlassAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 56,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: DateasyColors.glass,
          border: Border.all(color: DateasyColors.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 21, color: DateasyColors.lime),
            const SizedBox(width: 8),
            Text(
              label,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TextAction extends StatelessWidget {
  const _TextAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: DateasyColors.muted),
            const SizedBox(width: 6),
            Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.muted,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  const _Glow({
    required this.alignment,
    required this.gradient,
    required this.opacity,
  });

  final Alignment alignment;
  final Gradient gradient;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: IgnorePointer(
        child: Align(
          alignment: alignment,
          child: Opacity(
            opacity: opacity,
            child: ImageFiltered(
              imageFilter: ImageFilter.blur(sigmaX: 52, sigmaY: 52),
              child: Container(
                width: 320,
                height: 320,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: gradient,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

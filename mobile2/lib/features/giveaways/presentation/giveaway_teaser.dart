import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

class GiveawayTeaser extends StatelessWidget {
  const GiveawayTeaser({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: GestureDetector(
        onTap: () => context.go('/giveaways'),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x80000000),
                  blurRadius: 40,
                  spreadRadius: -16,
                  offset: Offset(0, 12),
                ),
              ],
            ),
            child: Stack(
              children: [
                const Positioned.fill(
                  child: DecoratedBox(
                      decoration: BoxDecoration(gradient: dateasyHeroGradient)),
                ),
                const Positioned(
                  top: -40,
                  right: -40,
                  child: _BlurBlob(
                    size: 160,
                    colors: [DateasyColors.lime, DateasyColors.lime2],
                    opacity: 0.5,
                  ),
                ),
                const Positioned(
                  left: -40,
                  bottom: -40,
                  child: _BlurBlob(
                    size: 160,
                    colors: [DateasyColors.lilac, DateasyColors.pink],
                    opacity: 0.25,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 56,
                        height: 56,
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              decoration: const BoxDecoration(
                                gradient: dateasyLimeGradient,
                                borderRadius:
                                    BorderRadius.all(Radius.circular(16)),
                                boxShadow: [
                                  BoxShadow(
                                    color: Color(0x66BEFF67),
                                    blurRadius: 24,
                                    spreadRadius: -8,
                                    offset: Offset(0, 10),
                                  ),
                                ],
                              ),
                              child: const Stack(
                                children: [
                                  Positioned.fill(
                                    child: DecoratedBox(
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.all(
                                            Radius.circular(16)),
                                        gradient: LinearGradient(
                                          begin: Alignment.topCenter,
                                          end: Alignment.bottomCenter,
                                          colors: [
                                            Color(0x66FFFFFF),
                                            Color(0x00FFFFFF)
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                  Center(
                                    child: Icon(
                                      LucideIcons.gift,
                                      color: DateasyColors.backgroundDeep,
                                      size: 24,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Positioned(
                              top: -6,
                              right: -6,
                              child: Container(
                                width: 20,
                                height: 20,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: DateasyColors.pink,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: DateasyColors.background,
                                    width: 2,
                                  ),
                                ),
                                child: const Text(
                                  '3',
                                  style: TextStyle(
                                    color: DateasyColors.foreground,
                                    fontSize: 10,
                                    height: 1,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const _GlassChip(
                              icon: LucideIcons.ticket,
                              label: 'frendly drops · июнь',
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Июньский Drop · 3 × iPhone 16 Pro',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(
                                    fontWeight: FontWeight.w600,
                                    height: 1.2,
                                  ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              'Бесплатно для верифицированных · получай билеты за активность',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: DateasyColors.muted,
                                    fontSize: 11,
                                    height: 1.2,
                                  ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Icon(
                        LucideIcons.chevronRight,
                        color: DateasyColors.muted,
                        size: 20,
                      ),
                    ],
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

class _GlassChip extends StatelessWidget {
  const _GlassChip({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          decoration: BoxDecoration(
            color: DateasyColors.surface.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 10, color: DateasyColors.lime),
              const SizedBox(width: 6),
              Text(
                label,
                style: const TextStyle(
                  color: DateasyColors.foreground,
                  fontSize: 9,
                  height: 1.2,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 1.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BlurBlob extends StatelessWidget {
  const _BlurBlob({
    required this.size,
    required this.colors,
    required this.opacity,
  });

  final double size;
  final List<Color> colors;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Opacity(
        opacity: opacity,
        child: ImageFiltered(
          imageFilter: ImageFilter.blur(sigmaX: 32, sigmaY: 32),
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(colors: colors),
            ),
          ),
        ),
      ),
    );
  }
}

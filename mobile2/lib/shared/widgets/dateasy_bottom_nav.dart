import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

class DateasyBottomNav extends StatelessWidget {
  const DateasyBottomNav({super.key});

  @override
  Widget build(BuildContext context) {
    final path = _currentPath(context);
    return Positioned(
      left: 0,
      right: 0,
      bottom: 16,
      child: Center(
        child: FractionallySizedBox(
          widthFactor: 0.92,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.5),
                    blurRadius: 40,
                    spreadRadius: -16,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                  child: Container(
                    key: const ValueKey('dateasy-bottom-nav-surface'),
                    height: 64,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: DateasyColors.navSurface,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: DateasyColors.border),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _DateasyBottomNavItem(
                          icon: LucideIcons.calendarHeart,
                          route: '/meetings',
                          label: 'Встречи',
                          activePath: path,
                        ),
                        _DateasyBottomNavItem(
                          icon: LucideIcons.compass,
                          route: '/',
                          label: 'Главная',
                          activePath: path,
                        ),
                        _DateasyBottomNavCreateButton(
                          onTap: () => context.go('/meetings/new'),
                        ),
                        _DateasyBottomNavItem(
                          icon: LucideIcons.messageCircle,
                          route: '/chats',
                          label: 'Чаты',
                          activePath: path,
                        ),
                        _DateasyBottomNavItem(
                          icon: LucideIcons.heart,
                          route: '/dating',
                          label: 'Дейтинг',
                          activePath: path,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DateasyBottomNavItem extends StatelessWidget {
  const _DateasyBottomNavItem({
    required this.icon,
    required this.route,
    required this.label,
    required this.activePath,
  });

  final IconData icon;
  final String route;
  final String label;
  final String activePath;

  @override
  Widget build(BuildContext context) {
    final active = _isActiveRoute(activePath, route);
    return Semantics(
      label: label,
      button: true,
      selected: active,
      child: GestureDetector(
        onTap: () => context.go(route),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          decoration: BoxDecoration(
            color: active ? DateasyColors.lilac : Colors.transparent,
            shape: BoxShape.circle,
          ),
          width: 44,
          height: 44,
          child: Center(
            child: Icon(
              icon,
              size: 20,
              color: active
                  ? DateasyColors.backgroundDeep
                  : DateasyColors.foreground.withValues(alpha: 0.7),
            ),
          ),
        ),
      ),
    );
  }
}

bool _isActiveRoute(String path, String route) {
  if (route == '/') {
    return path == '/';
  }
  return path == route || path.startsWith('$route/');
}

String _currentPath(BuildContext context) {
  try {
    return GoRouterState.of(context).uri.path;
  } catch (_) {
    return ModalRoute.of(context)?.settings.name ?? '/';
  }
}

class _DateasyBottomNavCreateButton extends StatelessWidget {
  const _DateasyBottomNavCreateButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Создать встречу',
      button: true,
      child: GestureDetector(
        onTap: onTap,
        child: SizedBox(
          width: 56,
          height: 44,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: dateasyLimeGradient,
                  border: Border.all(
                    color: DateasyColors.background.withValues(alpha: 0.4),
                    width: 4,
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x66BEFF67),
                      blurRadius: 24,
                      spreadRadius: -8,
                      offset: Offset(0, 10),
                    ),
                  ],
                ),
                child: const Icon(
                  LucideIcons.plus,
                  size: 24,
                  color: DateasyColors.backgroundDeep,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

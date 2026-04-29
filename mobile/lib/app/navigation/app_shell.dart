import 'dart:ui';

import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/widgets/bb_bottom_nav.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

final shellBottomBarVisibleProvider = StateProvider<bool>((ref) => true);

class AppShell extends ConsumerWidget {
  const AppShell({
    required this.location,
    required this.child,
    super.key,
  });

  final String location;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final bottomBarVisible = ref.watch(shellBottomBarVisibleProvider);
    final showCreateMeetup =
        bottomBarVisible && location.startsWith(AppRoute.tonight.path);
    final showEveningShortcut = bottomBarVisible && !showCreateMeetup;

    return Scaffold(
      body: child,
      extendBody: true,
      floatingActionButton: showCreateMeetup
          ? FloatingActionButton(
              heroTag: 'frendly-create-meetup',
              onPressed: () => context.pushRoute(AppRoute.createMeetup),
              backgroundColor: colors.primary,
              foregroundColor: colors.primaryForeground,
              elevation: 0,
              child: const Icon(LucideIcons.plus, size: 28),
            )
          : showEveningShortcut
              ? _EveningShellFab(
                  onTap: () => context.pushRoute(AppRoute.eveningBuilder),
                )
              : null,
      floatingActionButtonLocation: showCreateMeetup
          ? FloatingActionButtonLocation.endFloat
          : FloatingActionButtonLocation.startFloat,
      bottomNavigationBar: bottomBarVisible
          ? ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: colors.background.withValues(alpha: 0.85),
                    border: Border(
                      top: BorderSide(
                        color: colors.border.withValues(alpha: 0.6),
                      ),
                    ),
                    boxShadow: AppShadows.navFor(colors),
                  ),
                  child: SafeArea(
                    top: false,
                    child: BbBottomNav(
                      location: location,
                      onTap: (tab) {
                        context.goRoute(tab.route);
                      },
                    ),
                  ),
                ),
              ),
            )
          : null,
    );
  }
}

class _EveningShellFab extends StatelessWidget {
  const _EveningShellFab({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: 48,
        padding: const EdgeInsets.only(left: 8, right: 16),
        decoration: BoxDecoration(
          color: colors.foreground,
          borderRadius: BorderRadius.circular(999),
          boxShadow: AppShadows.card,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [colors.primary, colors.secondary],
                ),
              ),
              alignment: Alignment.center,
              child: Icon(
                LucideIcons.sparkles,
                size: 16,
                color: colors.primaryForeground,
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Text(
              'План вечера',
              style: AppTextStyles.meta.copyWith(
                fontFamily: 'Sora',
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: colors.background,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum AppTab {
  tonight(AppRoute.tonight),
  communities(AppRoute.communities),
  chats(AppRoute.chats),
  dating(AppRoute.dating),
  profile(AppRoute.profile);

  const AppTab(this.route);

  final AppRoute route;
}

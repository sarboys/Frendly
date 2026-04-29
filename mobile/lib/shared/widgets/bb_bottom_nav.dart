import 'package:big_break_mobile/app/navigation/app_shell.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class BbBottomNav extends ConsumerWidget {
  const BbBottomNav({
    required this.location,
    required this.onTap,
    super.key,
  });

  final String location;
  final ValueChanged<AppTab> onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final unread =
        ref.exists(meetupChatsProvider) && ref.exists(personalChatsProvider)
            ? ref.watch(chatUnreadBadgeProvider)
            : 0;
    final hasLiveChat =
        ref.exists(meetupChatsProvider) && ref.watch(hasLiveMeetupChatProvider);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.xs, AppSpacing.xs, AppSpacing.xs, AppSpacing.sm),
      child: Row(
        children: AppTab.values.map((tab) {
          final active = location.startsWith(tab.route.path);
          final showBadge = tab == AppTab.chats && unread > 0;
          final showLiveDot = tab == AppTab.chats && hasLiveChat;

          return Expanded(
            child: InkWell(
              onTap: () => onTap(tab),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Icon(
                          _iconFor(tab),
                          size: 21,
                          color: active ? colors.primary : colors.inkMute,
                        ),
                        if (showLiveDot)
                          Positioned(
                            right: -3,
                            top: -3,
                            child: Container(
                              width: 9,
                              height: 9,
                              decoration: BoxDecoration(
                                color: colors.destructive,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: colors.destructive
                                        .withValues(alpha: 0.35),
                                    blurRadius: 8,
                                    spreadRadius: 2,
                                  ),
                                ],
                              ),
                            ),
                          )
                        else if (showBadge)
                          Positioned(
                            right: -8,
                            top: -4,
                            child: Container(
                              constraints: const BoxConstraints(
                                  minWidth: 18, minHeight: 18),
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 4),
                              decoration: BoxDecoration(
                                color: colors.primary,
                                shape: BoxShape.rectangle,
                                borderRadius:
                                    const BorderRadius.all(Radius.circular(99)),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                '$unread',
                                style: AppTextStyles.caption.copyWith(
                                  fontFamily: 'Sora',
                                  fontWeight: FontWeight.w700,
                                  color: colors.primaryForeground,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      _labelFor(tab),
                      style: AppTextStyles.meta.copyWith(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: active ? colors.foreground : colors.inkMute,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(growable: false),
      ),
    );
  }

  IconData _iconFor(AppTab tab) {
    switch (tab) {
      case AppTab.tonight:
        return LucideIcons.calendar;
      case AppTab.communities:
        return LucideIcons.users;
      case AppTab.chats:
        return LucideIcons.message_circle;
      case AppTab.dating:
        return LucideIcons.heart;
      case AppTab.profile:
        return LucideIcons.user;
    }
  }

  String _labelFor(AppTab tab) {
    switch (tab) {
      case AppTab.tonight:
        return 'Вечер';
      case AppTab.communities:
        return 'Клубы';
      case AppTab.chats:
        return 'Чаты';
      case AppTab.dating:
        return 'Dating';
      case AppTab.profile:
        return 'Профиль';
    }
  }
}

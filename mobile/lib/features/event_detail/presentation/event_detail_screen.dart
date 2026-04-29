import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/event_detail.dart';
import 'package:big_break_mobile/shared/widgets/async_value_view.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class EventDetailScreen extends ConsumerStatefulWidget {
  const EventDetailScreen({
    required this.eventId,
    super.key,
  });

  final String eventId;

  @override
  ConsumerState<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends ConsumerState<EventDetailScreen> {
  bool _actionBusy = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final eventAsync = ref.watch(eventDetailProvider(widget.eventId));

    return Scaffold(
      backgroundColor: colors.background,
      body: AsyncValueView<EventDetail>(
        value: eventAsync,
        data: (event) => _EventDetailBody(
          event: event,
          actionBusy: _actionBusy,
          onJoinOrOpen: _actionBusy
              ? null
              : () async {
                  final requiresRequest =
                      event.joinMode == EventJoinMode.request ||
                          event.accessMode == 'request' ||
                          event.visibilityMode == 'friends';

                  if (event.isHost) {
                    if (context.mounted) {
                      context.pushRoute(
                        AppRoute.hostEvent,
                        pathParameters: {'eventId': event.id},
                      );
                    }
                    return;
                  }

                  if (!event.joined && requiresRequest) {
                    if (context.mounted) {
                      context.pushRoute(
                        AppRoute.joinRequest,
                        pathParameters: {'eventId': event.id},
                      );
                    }
                    return;
                  }

                  setState(() {
                    _actionBusy = true;
                  });
                  try {
                    final repository = ref.read(backendRepositoryProvider);
                    final detail = event.joined
                        ? event
                        : await repository.joinEvent(event.id);
                    ref.invalidate(eventDetailProvider(event.id));
                    ref.invalidate(eventsProvider('nearby'));
                    ref.invalidate(mapEventsProvider);
                    ref.invalidate(eventsProvider('now'));
                    ref.invalidate(eventsProvider('calm'));
                    ref.invalidate(eventsProvider('newcomers'));
                    ref.invalidate(eventsProvider('date'));
                    ref.invalidate(meetupChatsProvider);
                    if (context.mounted && detail.chatId != null) {
                      context.pushRoute(
                        AppRoute.meetupChat,
                        pathParameters: {'chatId': detail.chatId!},
                      );
                    }
                  } catch (_) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text('Не получилось обновить участие')),
                      );
                    }
                  } finally {
                    if (mounted) {
                      setState(() {
                        _actionBusy = false;
                      });
                    }
                  }
                },
          onSecondaryAction: _actionBusy
              ? null
              : (!event.joined &&
                          event.joinRequestStatus ==
                              EventJoinRequestStatus.pending) ||
                      (event.joined && !event.isHost)
                  ? () async {
                      setState(() {
                        _actionBusy = true;
                      });
                      try {
                        final repository = ref.read(backendRepositoryProvider);
                        if (!event.joined &&
                            event.joinRequestStatus ==
                                EventJoinRequestStatus.pending) {
                          await repository.cancelJoinRequest(event.id);
                        } else if (event.joined && !event.isHost) {
                          await repository.leaveEvent(event.id);
                        }

                        ref.invalidate(eventDetailProvider(event.id));
                        ref.invalidate(eventsProvider('nearby'));
                        ref.invalidate(mapEventsProvider);
                        ref.invalidate(eventsProvider('now'));
                        ref.invalidate(eventsProvider('calm'));
                        ref.invalidate(eventsProvider('newcomers'));
                        ref.invalidate(eventsProvider('date'));
                        ref.invalidate(meetupChatsProvider);
                      } catch (_) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Не получилось обновить заявку')),
                          );
                        }
                      } finally {
                        if (mounted) {
                          setState(() {
                            _actionBusy = false;
                          });
                        }
                      }
                    }
                  : null,
        ),
      ),
    );
  }
}

class _EventDetailBody extends StatelessWidget {
  const _EventDetailBody({
    required this.event,
    required this.onJoinOrOpen,
    required this.actionBusy,
    this.onSecondaryAction,
  });

  final EventDetail event;
  final Future<void> Function()? onJoinOrOpen;
  final bool actionBusy;
  final Future<void> Function()? onSecondaryAction;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final requiresRequest = event.joinMode == EventJoinMode.request ||
        event.accessMode == 'request' ||
        event.visibilityMode == 'friends';
    final criteria = _buildCriteria(event);
    return Stack(
      children: [
        CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                height: 288,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [colors.eveningStart, colors.eveningEnd],
                  ),
                ),
                child: Stack(
                  children: [
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        child: Row(
                          children: [
                            _OverlayIconButton(
                              icon: LucideIcons.chevron_left,
                              onTap: () => context.pop(),
                            ),
                            const Spacer(),
                            _OverlayIconButton(
                              icon: LucideIcons.share_2,
                              onTap: () => context.pushRoute(
                                AppRoute.shareCard,
                                pathParameters: {'eventId': event.id},
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    Center(
                      child: Text(
                        event.emoji,
                        style: const TextStyle(fontSize: 120),
                      ),
                    ),
                    Positioned(
                      left: 20,
                      bottom: 16,
                      child: Row(
                        children: [
                          _HeroBadge(label: event.vibe, dark: false),
                          const SizedBox(width: AppSpacing.xs),
                          _HeroBadge(
                              label: '${event.distance} от тебя', dark: true),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Transform.translate(
                offset: const Offset(0, -24),
                child: Container(
                  decoration: BoxDecoration(
                    color: colors.background,
                    borderRadius: const BorderRadius.vertical(
                      top: AppRadii.shell,
                    ),
                  ),
                  padding: const EdgeInsets.fromLTRB(20, 36, 20, 120),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(event.title, style: AppTextStyles.screenTitle),
                      const SizedBox(height: AppSpacing.md),
                      _MetaRow(
                        icon: LucideIcons.clock_3,
                        title: event.time,
                        subtitle: 'примерно на 2 часа',
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      _MetaRow(
                        icon: LucideIcons.map_pin,
                        title: event.place,
                        subtitle: '${event.distance} · 14 мин пешком',
                        onTap: () => context.pushRoute(
                          AppRoute.map,
                          queryParameters: {'eventId': event.id},
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: AppRadii.cardBorder,
                          border: Border.all(color: colors.border),
                          boxShadow: AppShadows.soft,
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                BbAvatar(
                                  name: event.host.displayName,
                                  size: BbAvatarSize.lg,
                                  online: true,
                                  imageUrl: event.host.avatarUrl,
                                ),
                                const SizedBox(width: AppSpacing.sm),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text('Организатор',
                                          style: AppTextStyles.meta),
                                      Row(
                                        children: [
                                          Text(event.host.displayName,
                                              style: AppTextStyles.itemTitle),
                                          if (event.host.verified) ...[
                                            const SizedBox(width: 6),
                                            Icon(
                                              LucideIcons.shield_check,
                                              size: 16,
                                              color: colors.secondary,
                                            ),
                                          ],
                                        ],
                                      ),
                                      Row(
                                        children: [
                                          Icon(
                                            LucideIcons.star,
                                            size: 14,
                                            color: colors.foreground,
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            '${event.host.rating.toStringAsFixed(1)} · ${event.host.meetupCount} встречи',
                                            style: AppTextStyles.meta,
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                OutlinedButton(
                                  onPressed: () => context.pushRoute(
                                    AppRoute.userProfile,
                                    pathParameters: {'userId': event.host.id},
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    side: BorderSide(color: colors.border),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 10,
                                    ),
                                  ),
                                  child: Text(
                                    'Профиль',
                                    style: AppTextStyles.meta.copyWith(
                                      color: colors.foreground,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (event.hostNote != null) ...[
                              const SizedBox(height: AppSpacing.sm),
                              Text('«${event.hostNote}»',
                                  style: AppTextStyles.bodySoft),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text('О встрече',
                          style:
                              AppTextStyles.itemTitle.copyWith(fontSize: 16)),
                      const SizedBox(height: AppSpacing.xs),
                      Text(event.description, style: AppTextStyles.bodySoft),
                      if (criteria.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Wrap(
                          spacing: AppSpacing.xs,
                          runSpacing: AppSpacing.xs,
                          children: [
                            for (final criterion in criteria)
                              _EventCriterionChip(label: criterion),
                          ],
                        ),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Кто идёт',
                              style: AppTextStyles.itemTitle
                                  .copyWith(fontSize: 16),
                            ),
                          ),
                          Text(
                            '${event.going} из ${event.capacity}',
                            style: AppTextStyles.meta,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Row(
                        children: [
                          BbAvatarStack(
                            names: event.attendees
                                .map((item) => item.displayName)
                                .toList(growable: false),
                            size: BbAvatarSize.md,
                            max: 4,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              _attendeesSummary(event),
                              style: AppTextStyles.meta.copyWith(
                                color: colors.inkSoft,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (event.partnerName != null) ...[
                        const SizedBox(height: AppSpacing.lg),
                        Container(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          decoration: BoxDecoration(
                            color: colors.warmStart,
                            borderRadius: AppRadii.cardBorder,
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: colors.background,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                alignment: Alignment.center,
                                child: const Text('🍇',
                                    style: TextStyle(fontSize: 24)),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Партнёр места',
                                      style: AppTextStyles.caption.copyWith(
                                        color: colors.inkSoft,
                                        letterSpacing: 1,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(event.partnerName!,
                                        style: AppTextStyles.itemTitle),
                                    Text(event.partnerOffer ?? '',
                                        style: AppTextStyles.meta.copyWith(
                                          color: colors.inkSoft,
                                        )),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: colors.background.withValues(alpha: 0.95),
              border: Border(
                top: BorderSide(color: colors.border.withValues(alpha: 0.6)),
              ),
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (onSecondaryAction != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                        child: TextButton(
                          onPressed: onSecondaryAction,
                          child: Text(
                            actionBusy
                                ? 'Подождите'
                                : event.joined
                                    ? 'Выйти из встречи'
                                    : 'Отменить заявку',
                            style: AppTextStyles.meta.copyWith(
                              color: colors.inkSoft,
                            ),
                          ),
                        ),
                      ),
                    Row(
                      children: [
                        Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            color: colors.card,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: colors.border),
                          ),
                          child: IconButton(
                            onPressed: event.chatId == null
                                ? null
                                : () => context.pushRoute(
                                      AppRoute.meetupChat,
                                      pathParameters: {'chatId': event.chatId!},
                                    ),
                            icon: const Icon(LucideIcons.message_circle),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: SizedBox(
                            height: 56,
                            child: FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: colors.foreground,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(18),
                                ),
                              ),
                              onPressed: onJoinOrOpen,
                              child: Text(
                                actionBusy
                                    ? 'Подождите'
                                    : event.isHost
                                        ? 'Открыть хост-панель'
                                        : event.joined
                                            ? 'Открыть чат встречи'
                                            : requiresRequest
                                                ? 'Отправить заявку'
                                                : 'Присоединиться',
                                style: AppTextStyles.button.copyWith(
                                  color: colors.primaryForeground,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  String _attendeesSummary(EventDetail event) {
    if (event.attendees.isEmpty) {
      return event.going > 0 ? 'Уже ${event.going} участников' : 'Пока никого';
    }

    final shownNames = event.attendees
        .take(3)
        .map((item) => item.displayName)
        .toList(growable: false);
    final knownText = shownNames.join(', ');
    final hiddenCount = event.going - shownNames.length;

    if (hiddenCount > 0) {
      return '$knownText и ещё $hiddenCount';
    }
    return knownText;
  }

  List<String> _buildCriteria(EventDetail event) {
    final criteria = <String>[];

    if (event.capacity > 0) {
      criteria.add('До ${event.capacity} участников');
    }

    final lifestyle = _lifestyleLabel(event.lifestyle);
    if (lifestyle != null) {
      criteria.add(lifestyle);
    }

    final price = _priceLabel(event);
    if (price != null) {
      criteria.add(price);
    }

    final access = _accessLabel(event.accessMode);
    if (access != null) {
      criteria.add(access);
    }

    final gender = _genderLabel(event.genderMode);
    if (gender != null) {
      criteria.add(gender);
    }

    return criteria;
  }

  String? _lifestyleLabel(String? raw) {
    switch (raw) {
      case 'zozh':
        return 'ЗОЖ';
      case 'neutral':
        return 'Нейтрально';
      case 'anti':
        return 'Не ЗОЖ';
      default:
        return null;
    }
  }

  String? _priceLabel(EventDetail event) {
    switch (event.priceMode) {
      case 'free':
        return 'Бесплатно';
      case 'split':
        return 'Скидываемся';
      case 'fixed':
        return event.priceAmountFrom == null
            ? null
            : '${event.priceAmountFrom} ₽';
      case 'from':
        return event.priceAmountFrom == null
            ? null
            : 'от ${event.priceAmountFrom} ₽';
      case 'upto':
        return event.priceAmountTo == null
            ? null
            : 'до ${event.priceAmountTo} ₽';
      case 'range':
        if (event.priceAmountFrom != null && event.priceAmountTo != null) {
          return '${event.priceAmountFrom}-${event.priceAmountTo} ₽';
        }
        if (event.priceAmountFrom != null) {
          return 'от ${event.priceAmountFrom} ₽';
        }
        if (event.priceAmountTo != null) {
          return 'до ${event.priceAmountTo} ₽';
        }
        return null;
      default:
        return null;
    }
  }

  String? _genderLabel(String? raw) {
    switch (raw) {
      case 'all':
        return 'Все';
      case 'female':
        return 'Девушки';
      case 'male':
        return 'Парни';
      default:
        return null;
    }
  }

  String? _accessLabel(String? raw) {
    switch (raw) {
      case 'open':
        return 'Открытое вступление';
      case 'request':
        return 'По заявке';
      case 'free':
        return 'Свободный приход';
      default:
        return null;
    }
  }
}

class _EventCriterionChip extends StatelessWidget {
  const _EventCriterionChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: colors.muted,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Text(
        label,
        style: AppTextStyles.body.copyWith(
          color: colors.foreground,
          fontSize: 14,
          fontWeight: FontWeight.w500,
          height: 1.1,
        ),
      ),
    );
  }
}

class _OverlayIconButton extends StatelessWidget {
  const _OverlayIconButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: colors.background.withValues(alpha: 0.8),
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 20, color: colors.foreground),
        ),
      ),
    );
  }
}

class _HeroBadge extends StatelessWidget {
  const _HeroBadge({
    required this.label,
    required this.dark,
  });

  final String label;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: dark
            ? colors.foreground.withValues(alpha: 0.85)
            : colors.background.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: AppTextStyles.caption.copyWith(
          color: dark ? colors.primaryForeground : colors.foreground,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: colors.muted,
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 16, color: colors.inkSoft),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: AppTextStyles.itemTitle.copyWith(fontSize: 14)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: AppTextStyles.meta),
                  ],
                ),
              ),
              if (onTap != null)
                Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: colors.inkMute,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

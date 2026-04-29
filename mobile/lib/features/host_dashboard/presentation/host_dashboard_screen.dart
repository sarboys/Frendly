import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/host_dashboard.dart';
import 'package:big_break_mobile/shared/widgets/async_value_view.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class HostDashboardScreen extends ConsumerStatefulWidget {
  const HostDashboardScreen({
    super.key,
    this.initialEventId,
  });

  final String? initialEventId;

  @override
  ConsumerState<HostDashboardScreen> createState() =>
      _HostDashboardScreenState();
}

class _HostDashboardScreenState extends ConsumerState<HostDashboardScreen> {
  String? _selectedEventId;
  _HostedMeetupsTab _tab = _HostedMeetupsTab.upcoming;
  final Set<String> _processingRequestIds = <String>{};

  @override
  void initState() {
    super.initState();
    _selectedEventId = widget.initialEventId;
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final dashboardAsync = ref.watch(hostDashboardProvider);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: AsyncValueView<HostDashboardData>(
          value: dashboardAsync,
          data: (dashboard) {
            final selectedEventId = _selectedEventId ??
                (dashboard.events.isEmpty ? null : dashboard.events.first.id);
            final heroNames = <String>{
              ...dashboard.requests.map((request) => request.userName),
              ...dashboard.events.expand((event) => event.attendees),
            }.toList(growable: false);
            final now = DateTime.now();
            final upcomingEvents = dashboard.events.where((event) {
              final startsAtIso = event.startsAtIso;
              if (startsAtIso == null) {
                return true;
              }
              final startsAt = DateTime.tryParse(startsAtIso);
              return startsAt == null || startsAt.isAfter(now);
            }).toList(growable: false);
            final pastEvents = dashboard.events.where((event) {
              final startsAtIso = event.startsAtIso;
              if (startsAtIso == null) {
                return false;
              }
              final startsAt = DateTime.tryParse(startsAtIso);
              return startsAt != null && !startsAt.isAfter(now);
            }).toList(growable: false);
            final visibleEvents = _tab == _HostedMeetupsTab.upcoming
                ? upcomingEvents
                : pastEvents;
            final selectedEventAsync = selectedEventId == null
                ? null
                : ref.watch(hostEventProvider(selectedEventId));

            return Column(
              children: [
                Container(
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: colors.border.withValues(alpha: 0.6),
                      ),
                    ),
                  ),
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => context.pop(),
                        icon: const Icon(Icons.chevron_left_rounded, size: 28),
                      ),
                      Expanded(
                        child: Text(
                          'Хост-панель',
                          textAlign: TextAlign.center,
                          style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
                        ),
                      ),
                      const SizedBox(width: 48),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    children: [
                      Row(
                        children: [
                          _StatCard(
                            icon: LucideIcons.calendar_days,
                            value: '${dashboard.stats.meetupsCount}',
                            label: 'Встреч',
                          ),
                          const SizedBox(width: 8),
                          _StatCard(
                            icon: LucideIcons.star,
                            value: dashboard.stats.rating.toStringAsFixed(1),
                            label: 'Рейтинг',
                          ),
                          const SizedBox(width: 8),
                          _StatCard(
                            icon: LucideIcons.trending_up,
                            value: '${dashboard.stats.fillRate}%',
                            label: 'Заполняемость',
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              colors.primary,
                              colors.primary.withValues(alpha: 0.8),
                            ],
                          ),
                          borderRadius: AppRadii.cardBorder,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Этот месяц',
                              style: AppTextStyles.caption.copyWith(
                                color: colors.primaryForeground
                                    .withValues(alpha: 0.85),
                                letterSpacing: 1,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '${dashboard.stats.meetupsCount}',
                                  style: AppTextStyles.screenTitle.copyWith(
                                    color: colors.primaryForeground,
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.xs),
                                Expanded(
                                  child: Padding(
                                    padding: const EdgeInsets.only(bottom: 6),
                                    child: Text(
                                      'встреч ты уже собрал',
                                      style: AppTextStyles.meta.copyWith(
                                        color: colors.primaryForeground
                                            .withValues(alpha: 0.92),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (heroNames.isNotEmpty) ...[
                              const SizedBox(height: AppSpacing.md),
                              Row(
                                children: [
                                  BbAvatarStack(
                                    names: heroNames,
                                    size: BbAvatarSize.sm,
                                    max: 5,
                                  ),
                                  const SizedBox(width: AppSpacing.sm),
                                  Expanded(
                                    child: Text(
                                      dashboard.pendingRequestsCount > 0
                                          ? '+ ещё ${dashboard.pendingRequestsCount} заявки ждут ответа'
                                          : 'Все новые заявки разобраны',
                                      style: AppTextStyles.caption.copyWith(
                                        color: colors.primaryForeground
                                            .withValues(alpha: 0.88),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      if (dashboard.requests.isNotEmpty) ...[
                        Row(
                          children: [
                            Text(
                              'Новые заявки',
                              style: AppTextStyles.caption.copyWith(
                                color: colors.inkMute,
                                letterSpacing: 1,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: colors.primary,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                '${dashboard.requests.length}',
                                style: AppTextStyles.caption.copyWith(
                                  color: colors.primaryForeground,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        ...dashboard.requests.map(
                          (request) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _RequestCard(
                              request: request,
                              busy: _processingRequestIds.contains(request.id),
                              onApprove: () async {
                                if (_processingRequestIds
                                    .contains(request.id)) {
                                  return;
                                }
                                final messenger = ScaffoldMessenger.of(context);
                                setState(() {
                                  _processingRequestIds.add(request.id);
                                });
                                try {
                                  await ref
                                      .read(backendRepositoryProvider)
                                      .approveJoinRequest(request.id);
                                  _invalidateHostData(request.eventId);
                                } catch (_) {
                                  messenger.showSnackBar(
                                    const SnackBar(
                                      content:
                                          Text('Не получилось принять заявку'),
                                    ),
                                  );
                                } finally {
                                  if (mounted) {
                                    setState(() {
                                      _processingRequestIds.remove(request.id);
                                    });
                                  }
                                }
                              },
                              onReject: () async {
                                if (_processingRequestIds
                                    .contains(request.id)) {
                                  return;
                                }
                                final messenger = ScaffoldMessenger.of(context);
                                setState(() {
                                  _processingRequestIds.add(request.id);
                                });
                                try {
                                  await ref
                                      .read(backendRepositoryProvider)
                                      .rejectJoinRequest(request.id);
                                  _invalidateHostData(request.eventId);
                                } catch (_) {
                                  messenger.showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                          'Не получилось отклонить заявку'),
                                    ),
                                  );
                                } finally {
                                  if (mounted) {
                                    setState(() {
                                      _processingRequestIds.remove(request.id);
                                    });
                                  }
                                }
                              },
                            ),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                      ],
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: colors.muted,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: _MeetupsTabButton(
                                label: 'Предстоящие',
                                selected: _tab == _HostedMeetupsTab.upcoming,
                                onTap: () {
                                  setState(() {
                                    _tab = _HostedMeetupsTab.upcoming;
                                  });
                                },
                              ),
                            ),
                            Expanded(
                              child: _MeetupsTabButton(
                                label: 'Прошедшие',
                                selected: _tab == _HostedMeetupsTab.past,
                                onTap: () {
                                  setState(() {
                                    _tab = _HostedMeetupsTab.past;
                                  });
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      ...visibleEvents.map(
                        (event) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: _HostedEventTile(
                            event: event,
                            selected: event.id == selectedEventId,
                            onTap: () {
                              setState(() {
                                _selectedEventId = event.id;
                              });
                            },
                          ),
                        ),
                      ),
                      if (_tab == _HostedMeetupsTab.past &&
                          visibleEvents.isEmpty) ...[
                        Container(
                          padding: const EdgeInsets.all(AppSpacing.lg),
                          decoration: BoxDecoration(
                            color: colors.card,
                            borderRadius: AppRadii.cardBorder,
                            border: Border.all(color: colors.border),
                          ),
                          child: Text(
                            'Пока нет завершённых встреч.',
                            style: AppTextStyles.bodySoft.copyWith(
                              color: colors.inkSoft,
                            ),
                          ),
                        ),
                      ],
                      if (_tab == _HostedMeetupsTab.upcoming &&
                          selectedEventAsync != null) ...[
                        const SizedBox(height: AppSpacing.lg),
                        AsyncValueView<HostEventData>(
                          value: selectedEventAsync,
                          data: (hostEvent) => _SelectedEventPanel(
                            hostEvent: hostEvent,
                            onStartLive: () async {
                              await ref
                                  .read(backendRepositoryProvider)
                                  .startLiveMeetup(hostEvent.event.id);
                              _invalidateHostData(hostEvent.event.id);
                            },
                            onFinishLive: () async {
                              await ref
                                  .read(backendRepositoryProvider)
                                  .finishLiveMeetup(hostEvent.event.id);
                              _invalidateHostData(hostEvent.event.id);
                            },
                            onManualCheckIn: (userId) async {
                              await ref
                                  .read(backendRepositoryProvider)
                                  .manualCheckIn(
                                    hostEvent.event.id,
                                    userId: userId,
                                  );
                              _invalidateHostData(hostEvent.event.id);
                            },
                            onOpenLive: () => context.pushRoute(
                              AppRoute.liveMeetup,
                              pathParameters: {'eventId': hostEvent.event.id},
                            ),
                            onOpenEvent: () => context.pushRoute(
                              AppRoute.eventDetail,
                              pathParameters: {'eventId': hostEvent.event.id},
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  void _invalidateHostData(String eventId) {
    ref.invalidate(hostDashboardProvider);
    ref.invalidate(hostEventProvider(eventId));
    ref.invalidate(eventDetailProvider(eventId));
    ref.invalidate(liveMeetupProvider(eventId));
  }
}

enum _HostedMeetupsTab { upcoming, past }

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: colors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 16, color: colors.inkMute),
            const SizedBox(height: 10),
            Text(value, style: AppTextStyles.cardTitle),
            const SizedBox(height: 4),
            Text(label, style: AppTextStyles.caption),
          ],
        ),
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({
    required this.request,
    required this.busy,
    required this.onApprove,
    required this.onReject,
  });

  final HostJoinRequest request;
  final bool busy;
  final Future<void> Function() onApprove;
  final Future<void> Function() onReject;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: AppRadii.cardBorder,
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              BbAvatar(name: request.userName, imageUrl: request.avatarUrl),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(request.userName, style: AppTextStyles.itemTitle),
                    const SizedBox(height: 2),
                    Text(
                      request.eventTitle,
                      style: AppTextStyles.caption.copyWith(
                        color: colors.inkMute,
                      ),
                    ),
                    Text(
                      '${request.compatibilityScore}% совпадение',
                      style: AppTextStyles.meta.copyWith(
                        color: colors.inkSoft,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if ((request.note ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(request.note!, style: AppTextStyles.bodySoft),
          ],
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: busy ? null : onReject,
                  child: Text(busy ? '...' : 'Отклонить'),
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: FilledButton(
                  onPressed: busy ? null : onApprove,
                  style: FilledButton.styleFrom(
                    backgroundColor: colors.foreground,
                  ),
                  child: Text(busy ? '...' : 'Принять'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MeetupsTabButton extends StatelessWidget {
  const _MeetupsTabButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 36,
        decoration: BoxDecoration(
          color: selected ? colors.background : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTextStyles.meta.copyWith(
            color: selected ? colors.foreground : colors.inkMute,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _HostedEventTile extends StatelessWidget {
  const _HostedEventTile({
    required this.event,
    required this.selected,
    required this.onTap,
  });

  final Event event;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: selected ? colors.primarySoft : colors.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? colors.primary : colors.border,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: colors.warmStart,
                borderRadius: BorderRadius.circular(16),
              ),
              alignment: Alignment.center,
              child: Text(event.emoji, style: const TextStyle(fontSize: 24)),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(event.title, style: AppTextStyles.itemTitle),
                  const SizedBox(height: 2),
                  Text(event.time, style: AppTextStyles.meta),
                ],
              ),
            ),
            Text(
              '${event.going}/${event.capacity}',
              style: AppTextStyles.meta.copyWith(color: colors.inkSoft),
            ),
          ],
        ),
      ),
    );
  }
}

class _SelectedEventPanel extends StatelessWidget {
  const _SelectedEventPanel({
    required this.hostEvent,
    required this.onStartLive,
    required this.onFinishLive,
    required this.onManualCheckIn,
    required this.onOpenLive,
    required this.onOpenEvent,
  });

  final HostEventData hostEvent;
  final Future<void> Function() onStartLive;
  final Future<void> Function() onFinishLive;
  final Future<void> Function(String userId) onManualCheckIn;
  final VoidCallback onOpenLive;
  final VoidCallback onOpenEvent;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: AppRadii.cardBorder,
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child:
                    Text(hostEvent.event.title, style: AppTextStyles.cardTitle),
              ),
              TextButton(
                onPressed: onOpenEvent,
                child: const Text('Карточка'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: hostEvent.liveStatus == EventLiveStatus.live
                      ? onFinishLive
                      : onStartLive,
                  style: FilledButton.styleFrom(
                    backgroundColor: colors.foreground,
                  ),
                  child: Text(
                    hostEvent.liveStatus == EventLiveStatus.live
                        ? 'Завершить live'
                        : 'Запустить live',
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              OutlinedButton(
                onPressed: onOpenLive,
                child: const Text('Открыть live'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Участники',
            style: AppTextStyles.caption.copyWith(
              color: colors.inkMute,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          ...hostEvent.attendees.map(
            (attendee) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: BbAvatar(
                name: attendee.displayName,
                imageUrl: attendee.avatarUrl,
              ),
              title: Text(
                attendee.displayName,
                style: AppTextStyles.itemTitle,
              ),
              subtitle: Text(
                attendee.attendanceStatus == EventAttendanceStatus.checkedIn
                    ? 'на месте'
                    : 'ещё не отметился',
                style: AppTextStyles.meta,
              ),
              trailing:
                  attendee.attendanceStatus == EventAttendanceStatus.checkedIn
                      ? Icon(
                          LucideIcons.badge_check,
                          color: colors.secondary,
                        )
                      : TextButton(
                          onPressed: () => onManualCheckIn(attendee.userId),
                          child: const Text('Check-in'),
                        ),
            ),
          ),
        ],
      ),
    );
  }
}

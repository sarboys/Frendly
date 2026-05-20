import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

class HostDashboardScreen extends ConsumerStatefulWidget {
  const HostDashboardScreen({super.key});

  @override
  ConsumerState<HostDashboardScreen> createState() =>
      _HostDashboardScreenState();
}

class _HostDashboardScreenState extends ConsumerState<HostDashboardScreen> {
  var _tab = _HostEventTab.all;
  final Set<String> _busyRequests = {};
  final Set<String> _busyBoosts = {};

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(hostDashboardProvider);
    final dashboard = state.valueOrNull;
    final events = _filteredEvents(dashboard?.events ?? const []);

    return DateasyPhoneFrame(
      child: RefreshIndicator(
        onRefresh: () async => ref.invalidate(hostDashboardProvider),
        color: DateasyColors.lime,
        backgroundColor: DateasyColors.surface,
        child: ListView(
          padding: EdgeInsets.fromLTRB(
            20,
            MediaQuery.paddingOf(context).top + 18,
            20,
            44,
          ),
          children: [
            _Header(onBack: () => context.go('/profile')),
            const SizedBox(height: 18),
            if (state.isLoading && dashboard == null)
              const _StatusCard(text: 'Загружаю дашборд')
            else if (state.hasError && dashboard == null)
              const _StatusCard(text: 'Host dashboard недоступен')
            else ...[
              _KpiGrid(stats: dashboard!.stats),
              const SizedBox(height: 18),
              _RequestsBlock(
                requests: dashboard.requests,
                busyRequests: _busyRequests,
                onApprove: (request) => _reviewRequest(request, true),
                onReject: (request) => _reviewRequest(request, false),
              ),
              const SizedBox(height: 20),
              _EventsTabs(
                tab: _tab,
                onChanged: (tab) => setState(() => _tab = tab),
              ),
              const SizedBox(height: 12),
              if (events.isEmpty)
                const _StatusCard(text: 'Встреч пока нет')
              else
                for (final event in events) ...[
                  _HostEventCard(
                    event: event,
                    boosting: _busyBoosts.contains(event.id),
                    onOpen: () => context.go('/meetings/${event.id}'),
                    onEdit: () =>
                        context.go('/meetings/new?editEventId=${event.id}'),
                    onChat: () => _openChat(event),
                    onBoost: () => _boost(event),
                  ),
                  const SizedBox(height: 12),
                ],
              const SizedBox(height: 10),
              _Insights(stats: dashboard.stats),
            ],
          ],
        ),
      ),
    );
  }

  List<BackendCardItem> _filteredEvents(List<BackendCardItem> events) {
    return switch (_tab) {
      _HostEventTab.all => events,
      _HostEventTab.active => events.where(_isActiveEvent).toList(),
      _HostEventTab.drafts => events.where(_isDraftEvent).toList(),
    };
  }

  Future<void> _reviewRequest(
    HostJoinRequestData request,
    bool approve,
  ) async {
    if (_busyRequests.contains(request.id)) {
      return;
    }
    setState(() => _busyRequests.add(request.id));
    try {
      final controller = ref.read(hostDashboardActionsProvider);
      if (approve) {
        await controller.approveRequest(request.id);
      } else {
        await controller.rejectRequest(request.id);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(approve ? 'Заявка одобрена' : 'Заявка отклонена'),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не удалось обработать заявку')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _busyRequests.remove(request.id));
      }
    }
  }

  Future<void> _boost(BackendCardItem event) async {
    if (_busyBoosts.contains(event.id)) {
      return;
    }
    setState(() => _busyBoosts.add(event.id));
    try {
      await ref.read(hostDashboardActionsProvider).boostEvent(event.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Буст включен на 24 часа')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не удалось включить буст')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _busyBoosts.remove(event.id));
      }
    }
  }

  void _openChat(BackendCardItem event) {
    final chatId = _stringOrNull(event.raw['chatId']) ??
        _stringOrNull((event.raw['chat'] as Map?)?['id']);
    if (chatId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Чат еще не создан')),
      );
      return;
    }
    context.go('/chats/$chatId');
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _CircleButton(icon: LucideIcons.chevronLeft, onTap: onBack),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            'Host dashboard',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontFamily: 'Sora',
                  fontWeight: FontWeight.w900,
                ),
          ),
        ),
        GestureDetector(
          onTap: () => context.go('/meetings/new'),
          child: Container(
            height: 42,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: DateasyColors.lime,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Center(
              child: Text(
                'Создать',
                style: TextStyle(
                  color: DateasyColors.backgroundDeep,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _KpiGrid extends StatelessWidget {
  const _KpiGrid({required this.stats});

  final HostDashboardStats stats;

  @override
  Widget build(BuildContext context) {
    final items = [
      _Kpi('Встречи', '${stats.meetupsCount}', LucideIcons.calendarCheck),
      _Kpi('Рейтинг', stats.rating.toStringAsFixed(1), LucideIcons.star),
      _Kpi('Гости', '${stats.guestsCount}', LucideIcons.users),
      _Kpi('Заполнено', '${stats.fillRate}%', LucideIcons.trendingUp),
    ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.75,
      ),
      itemCount: items.length,
      itemBuilder: (_, index) => _KpiTile(item: items[index]),
    );
  }
}

class _RequestsBlock extends StatelessWidget {
  const _RequestsBlock({
    required this.requests,
    required this.busyRequests,
    required this.onApprove,
    required this.onReject,
  });

  final List<HostJoinRequestData> requests;
  final Set<String> busyRequests;
  final ValueChanged<HostJoinRequestData> onApprove;
  final ValueChanged<HostJoinRequestData> onReject;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Заявки',
      child: requests.isEmpty
          ? const _MutedText('Новых заявок нет')
          : Column(
              children: [
                for (final request in requests) ...[
                  _RequestTile(
                    request: request,
                    busy: busyRequests.contains(request.id),
                    onApprove: () => onApprove(request),
                    onReject: () => onReject(request),
                  ),
                  if (request != requests.last) const SizedBox(height: 10),
                ],
              ],
            ),
    );
  }
}

class _RequestTile extends StatelessWidget {
  const _RequestTile({
    required this.request,
    required this.busy,
    required this.onApprove,
    required this.onReject,
  });

  final HostJoinRequestData request;
  final bool busy;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: _cardDecoration(),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: SizedBox(
              width: 48,
              height: 48,
              child: DateasyRemoteImage(
                imageUrl: request.avatarUrl,
                usage: DateasyImageUsage.avatar,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 5,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      request.userName,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    if (request.verified)
                      const Icon(
                        LucideIcons.badgeCheck,
                        color: DateasyColors.lime,
                        size: 16,
                      ),
                    if (request.frendlyPlus)
                      const Icon(
                        LucideIcons.crown,
                        color: DateasyColors.pink,
                        size: 16,
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  request.eventTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                      ),
                ),
              ],
            ),
          ),
          _CircleButton(
            icon: LucideIcons.x,
            busy: busy,
            onTap: busy ? null : onReject,
          ),
          const SizedBox(width: 8),
          _CircleButton(
            icon: LucideIcons.check,
            color: DateasyColors.lime,
            busy: busy,
            onTap: busy ? null : onApprove,
          ),
        ],
      ),
    );
  }
}

class _EventsTabs extends StatelessWidget {
  const _EventsTabs({required this.tab, required this.onChanged});

  final _HostEventTab tab;
  final ValueChanged<_HostEventTab> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final item in _HostEventTab.values) ...[
          Expanded(
            child: GestureDetector(
              onTap: () => onChanged(item),
              child: Container(
                height: 42,
                decoration: BoxDecoration(
                  color: tab == item ? DateasyColors.lime : DateasyColors.glass,
                  borderRadius: BorderRadius.circular(15),
                  border: Border.all(color: DateasyColors.border),
                ),
                child: Center(
                  child: Text(
                    item.label,
                    style: TextStyle(
                      color: tab == item
                          ? DateasyColors.backgroundDeep
                          : DateasyColors.foreground,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (item != _HostEventTab.values.last) const SizedBox(width: 8),
        ],
      ],
    );
  }
}

class _HostEventCard extends StatelessWidget {
  const _HostEventCard({
    required this.event,
    required this.boosting,
    required this.onOpen,
    required this.onEdit,
    required this.onChat,
    required this.onBoost,
  });

  final BackendCardItem event;
  final bool boosting;
  final VoidCallback onOpen;
  final VoidCallback onEdit;
  final VoidCallback onChat;
  final VoidCallback onBoost;

  @override
  Widget build(BuildContext context) {
    final going = _intOrNull(event.raw['going']) ??
        _intOrNull(event.raw['participantCount']) ??
        0;
    final capacity = _intOrNull(event.raw['capacity']) ??
        _intOrNull(event.raw['maxGuests']) ??
        0;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(event.raw['emoji']?.toString() ?? '✨',
                  style: const TextStyle(fontSize: 28)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      event.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      [
                        if (event.subtitle != null) event.subtitle,
                        if (capacity > 0) '$going/$capacity гостей',
                      ].whereType<String>().join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.muted,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _SmallAction(
                  label: 'Открыть', icon: LucideIcons.eye, onTap: onOpen),
              _SmallAction(
                  label: 'Изменить', icon: LucideIcons.pen, onTap: onEdit),
              _SmallAction(
                  label: 'Чат', icon: LucideIcons.messageCircle, onTap: onChat),
              _SmallAction(
                label: boosting ? 'Буст...' : 'Буст',
                icon: LucideIcons.zap,
                onTap: boosting ? null : onBoost,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Insights extends StatelessWidget {
  const _Insights({required this.stats});

  final HostDashboardStats stats;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Инсайты недели',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _MutedText('Средняя заполненность: ${stats.fillRate}%'),
          const SizedBox(height: 8),
          _MutedText('Гостей на всех встречах: ${stats.guestsCount}'),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _KpiTile extends StatelessWidget {
  const _KpiTile({required this.item});

  final _Kpi item;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(item.icon, color: DateasyColors.lime, size: 20),
          Text(
            item.value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
          ),
          Text(
            item.label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                ),
          ),
        ],
      ),
    );
  }
}

class _SmallAction extends StatelessWidget {
  const _SmallAction({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: DateasyColors.glass,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: DateasyColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: DateasyColors.foreground),
            const SizedBox(width: 6),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({
    required this.icon,
    this.onTap,
    this.color,
    this.busy = false,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final Color? color;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: color ?? DateasyColors.glass,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: DateasyColors.border),
        ),
        child: busy
            ? const Center(
                child: SizedBox(
                  width: 17,
                  height: 17,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            : Icon(
                icon,
                size: 20,
                color: color == null
                    ? DateasyColors.foreground
                    : DateasyColors.backgroundDeep,
              ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration(),
      child: _MutedText(text),
    );
  }
}

class _MutedText extends StatelessWidget {
  const _MutedText(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: DateasyColors.muted,
          ),
    );
  }
}

class _Kpi {
  const _Kpi(this.label, this.value, this.icon);

  final String label;
  final String value;
  final IconData icon;
}

enum _HostEventTab {
  all('Все'),
  active('Активные'),
  drafts('Черновики');

  const _HostEventTab(this.label);

  final String label;
}

BoxDecoration _cardDecoration() {
  return BoxDecoration(
    color: DateasyColors.surface.withValues(alpha: 0.82),
    borderRadius: BorderRadius.circular(22),
    border: Border.all(color: DateasyColors.border),
  );
}

bool _isDraftEvent(BackendCardItem event) {
  final status = event.raw['status']?.toString().toLowerCase();
  final visibility = event.raw['visibilityMode']?.toString().toLowerCase();
  return status == 'draft' || visibility == 'draft';
}

bool _isActiveEvent(BackendCardItem event) {
  if (_isDraftEvent(event)) {
    return false;
  }
  final startsAt = event.startsAt;
  if (startsAt == null) {
    return true;
  }
  return startsAt.isAfter(DateTime.now().subtract(const Duration(hours: 3)));
}

String? _stringOrNull(Object? value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

int? _intOrNull(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value?.toString() ?? '');
}

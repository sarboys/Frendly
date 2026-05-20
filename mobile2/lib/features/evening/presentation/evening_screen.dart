import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_bottom_nav.dart';
import 'package:mobile2/shared/widgets/dateasy_highlight_text.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

const _quickCategories = [
  _QuickCategory(
    title: 'Кофе',
    icon: LucideIcons.coffee,
    route: '/perks',
    tone: _CategoryTone.lime,
  ),
  _QuickCategory(
    title: 'Афиша',
    icon: LucideIcons.ticket,
    route: '/posters',
    tone: _CategoryTone.pink,
  ),
  _QuickCategory(
    title: 'Винил',
    icon: LucideIcons.music2,
    route: '/communities',
    tone: _CategoryTone.lilac,
  ),
  _QuickCategory(
    title: 'Жара',
    icon: LucideIcons.flame,
    route: '/after-dark',
    tone: _CategoryTone.pink,
  ),
];

class EveningScreen extends ConsumerWidget {
  const EveningScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsState = ref.watch(homeEventsProvider);
    return DateasyPhoneFrame(
      child: Stack(
        children: [
          ListView(
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 16,
              bottom: 148,
            ),
            children: [
              const _EveningHeader(),
              const _AiRouteCard(),
              const _QuickCategoryGrid(),
              _TimeSlots(state: eventsState),
              const _WeatherMood(),
              const _CreateMeetupCard(),
            ],
          ),
          const _BottomNav(),
        ],
      ),
    );
  }
}

class _EveningHeader extends StatelessWidget {
  const _EveningHeader();

  @override
  Widget build(BuildContext context) {
    final headline = Theme.of(context).textTheme.headlineMedium?.copyWith(
          fontSize: 24,
          height: 1.08,
          fontWeight: FontWeight.w600,
        );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _todayLabel(DateTime.now()),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 12,
                      ),
                ),
                const SizedBox(height: 4),
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    Text('Сегодня', style: headline),
                    DateasyHeadlineHighlight(
                      text: 'вечером',
                      style: headline,
                    ),
                  ],
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => context.go('/after-dark'),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: dateasyPinkGradient,
                borderRadius: BorderRadius.circular(16),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x55FF639F),
                    blurRadius: 26,
                    spreadRadius: -12,
                    offset: Offset(0, 12),
                  ),
                ],
              ),
              child: const Icon(
                LucideIcons.moon,
                size: 20,
                color: DateasyColors.foreground,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AiRouteCard extends StatelessWidget {
  const _AiRouteCard();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: GestureDetector(
        onTap: () => context.go('/ai-builder'),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: dateasyLimeGradient,
            borderRadius: BorderRadius.circular(24),
            boxShadow: const [
              BoxShadow(
                color: Color(0x66BEFF67),
                blurRadius: 32,
                spreadRadius: -12,
                offset: Offset(0, 16),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    LucideIcons.sparkles,
                    size: 16,
                    color: DateasyColors.backgroundDeep,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'AI соберёт маршрут',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.backgroundDeep,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.1,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Опиши вайб одним сообщением',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: DateasyColors.backgroundDeep,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                'Backend подберёт места и шаги',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color:
                          DateasyColors.backgroundDeep.withValues(alpha: 0.72),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Text(
                    'Открыть',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.backgroundDeep,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(
                    LucideIcons.chevronRight,
                    size: 14,
                    color: DateasyColors.backgroundDeep,
                  ),
                  const Spacer(),
                  const Icon(
                    LucideIcons.sparkles,
                    size: 20,
                    color: DateasyColors.backgroundDeep,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickCategoryGrid extends StatelessWidget {
  const _QuickCategoryGrid();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Row(
        children: [
          for (var index = 0; index < _quickCategories.length; index++) ...[
            Expanded(
                child: _QuickCategoryCard(category: _quickCategories[index])),
            if (index != _quickCategories.length - 1) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _QuickCategoryCard extends StatelessWidget {
  const _QuickCategoryCard({required this.category});

  final _QuickCategory category;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go(category.route),
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            _CategoryIcon(category: category),
            const SizedBox(height: 6),
            Text(
              category.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontSize: 11,
                    color: DateasyColors.foreground,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryIcon extends StatelessWidget {
  const _CategoryIcon({required this.category});

  final _QuickCategory category;

  @override
  Widget build(BuildContext context) {
    final gradient = switch (category.tone) {
      _CategoryTone.lime => dateasyLimeGradient,
      _CategoryTone.pink => dateasyPinkGradient,
      _CategoryTone.lilac => const LinearGradient(
          colors: [DateasyColors.lilac, Color(0xFFBFA6FF)],
        ),
    };

    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Icon(
        category.icon,
        size: 16,
        color: switch (category.tone) {
          _CategoryTone.pink => DateasyColors.foreground,
          _ => DateasyColors.backgroundDeep,
        },
      ),
    );
  }
}

class _TimeSlots extends StatelessWidget {
  const _TimeSlots({required this.state});

  final AsyncValue<CardPage> state;

  @override
  Widget build(BuildContext context) {
    final events = state.valueOrNull?.items ?? const <BackendCardItem>[];
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionLabel('По часам'),
          const SizedBox(height: 8),
          if (state.isLoading && events.isEmpty)
            const _EveningStatus(message: 'Загружаем встречи'),
          if (state.hasError && events.isEmpty)
            const _EveningStatus(message: 'Не удалось загрузить встречи'),
          if (!state.isLoading && !state.hasError && events.isEmpty)
            const _EveningStatus(message: 'Вечерних встреч пока нет'),
          for (var index = 0; index < events.length && index < 6; index++) ...[
            _TimeSlotCard(event: events[index]),
            if (index != events.length - 1 && index < 5)
              const SizedBox(height: 8),
          ],
          if (state.hasError && events.isNotEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: _EveningStatus(message: 'Обновить список не удалось'),
            ),
        ],
      ),
    );
  }
}

class _TimeSlotCard extends StatelessWidget {
  const _TimeSlotCard({required this.event});

  final BackendCardItem event;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/meetings/${event.id}'),
      child: _GlassPanel(
        borderRadius: 16,
        padding: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        child: Row(
          children: [
            Container(
              width: 56,
              height: 80,
              decoration: const BoxDecoration(gradient: dateasyLimeGradient),
              alignment: Alignment.center,
              child: Text(
                _timeLabel(event.startsAt),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.backgroundDeep,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
            SizedBox(
              width: 80,
              height: 80,
              child: DateasyRemoteImage(
                imageUrl: event.imageUrl,
                usage: DateasyImageUsage.card,
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      event.title.isEmpty ? 'Встреча' : event.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(
                          LucideIcons.mapPin,
                          size: 12,
                          color: DateasyColors.muted,
                        ),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            event.subtitle ?? event.city ?? 'Место уточняется',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: DateasyColors.muted,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                    ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EveningStatus extends StatelessWidget {
  const _EveningStatus({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 16,
      padding: const EdgeInsets.all(16),
      child: Text(
        message,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.muted,
              fontSize: 12,
            ),
      ),
    );
  }
}

class _WeatherMood extends ConsumerWidget {
  const _WeatherMood();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final routes = ref.watch(routeTemplatesProvider);
    final route = routes.valueOrNull?.items.firstOrNull;
    final title = route?.title ?? 'Маршруты вечера';
    final subtitle = route == null
        ? routes.hasError
            ? 'Не удалось загрузить backend routes'
            : routes.isLoading
                ? 'Загружаем из backend'
                : 'Маршрутов пока нет'
        : _routeSubtitle(route);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: GestureDetector(
        onTap: route == null
            ? () => context.go('/routes')
            : () => context.go('/routes/${route.id}'),
        child: _GlassPanel(
          borderRadius: 24,
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(
                LucideIcons.route,
                size: 28,
                color: DateasyColors.lime,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.muted,
                            fontSize: 11,
                          ),
                    ),
                  ],
                ),
              ),
              const Icon(
                LucideIcons.chevronRight,
                size: 16,
                color: DateasyColors.lime,
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _routeSubtitle(BackendCardItem route) {
    final area = route.raw['area']?.toString();
    final duration = route.raw['durationLabel']?.toString();
    final vibe = route.raw['vibe']?.toString();
    final parts = [
      if (area != null && area.isNotEmpty) area,
      if (duration != null && duration.isNotEmpty) duration,
      if (vibe != null && vibe.isNotEmpty) vibe,
    ];
    if (parts.isEmpty) {
      return route.subtitle ?? 'Backend route template';
    }
    return parts.join(' · ');
  }
}

class _CreateMeetupCard extends StatelessWidget {
  const _CreateMeetupCard();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: GestureDetector(
        onTap: () => context.go('/meetings/new'),
        child: _GlassPanel(
          borderRadius: 24,
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(
                LucideIcons.calendar,
                size: 20,
                color: DateasyColors.lime,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Не нашёл вайб? Собери свою встречу',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontSize: 14,
                        color: DateasyColors.foreground,
                      ),
                ),
              ),
              const Icon(
                LucideIcons.chevronRight,
                size: 16,
                color: DateasyColors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav();

  @override
  Widget build(BuildContext context) {
    return const DateasyBottomNav();
  }
}

class _GlassPanel extends StatelessWidget {
  const _GlassPanel({
    required this.child,
    required this.borderRadius,
    this.padding = EdgeInsets.zero,
    this.clipBehavior = Clip.none,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;
  final Clip clipBehavior;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: clipBehavior,
      padding: padding,
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: DateasyColors.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 24,
            spreadRadius: -14,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: DateasyColors.muted,
            fontSize: 12,
            fontWeight: FontWeight.w400,
            letterSpacing: 1.1,
          ),
    );
  }
}

String _todayLabel(DateTime now) {
  const weekdays = [
    'Понедельник',
    'Вторник',
    'Среда',
    'Четверг',
    'Пятница',
    'Суббота',
    'Воскресенье',
  ];
  const months = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ];
  return '${weekdays[now.weekday - 1]} · ${now.day} ${months[now.month - 1]}';
}

String _timeLabel(DateTime? value) {
  if (value == null) {
    return '—';
  }
  final local = value.toLocal();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$hour:$minute';
}

class _QuickCategory {
  const _QuickCategory({
    required this.title,
    required this.icon,
    required this.route,
    required this.tone,
  });

  final String title;
  final IconData icon;
  final String route;
  final _CategoryTone tone;
}

enum _CategoryTone { lime, pink, lilac }

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

class DateasyRouteDetailScreen extends StatefulWidget {
  const DateasyRouteDetailScreen({
    super.key,
    required this.routeId,
  });

  final String routeId;

  @override
  State<DateasyRouteDetailScreen> createState() =>
      _DateasyRouteDetailScreenState();
}

class _DateasyRouteDetailScreenState extends State<DateasyRouteDetailScreen> {
  var _saved = false;
  var _creating = false;
  String? _createError;

  Future<void> _createSession(WidgetRef ref, BackendCardItem route) async {
    if (_creating) {
      return;
    }
    setState(() {
      _creating = true;
      _createError = null;
    });
    try {
      final session =
          await ref.read(routeActionsProvider).createTemplateSession(
                templateId: route.id,
                startsAt: DateTime.now().add(const Duration(hours: 2)),
                privacy: 'open',
                capacity: _routeCapacity(route),
              );
      if (!mounted) {
        return;
      }
      context.go('/meetings/${session.chatId}/chat');
    } on BackendActionException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _createError = error.message;
      });
    } catch (_) {
      if (mounted) {
        setState(() => _createError = 'Не удалось создать route session');
      }
    } finally {
      if (mounted) {
        setState(() => _creating = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Consumer(
        builder: (context, ref, _) {
          final state = ref.watch(routeDetailProvider(widget.routeId));
          final route = state.valueOrNull;

          if (state.isLoading && route == null) {
            return const _RouteStatus(message: 'Загружаем маршрут');
          }
          if (route == null) {
            return _RouteStatus(
              message: state.hasError
                  ? 'Не удалось загрузить маршрут'
                  : 'Маршрут не найден',
            );
          }

          return Stack(
            children: [
              ListView(
                padding: const EdgeInsets.only(bottom: 112),
                children: [
                  _RouteHero(
                    route: route,
                    saved: _saved,
                    onSaved: () => setState(() => _saved = !_saved),
                  ),
                  _RouteMeta(route: route),
                  _RouteDescription(route: route),
                  _RouteTimeline(steps: _RouteStep.fromRoute(route)),
                  if (_createError != null)
                    _RouteGapNotice(text: _createError!),
                ],
              ),
              _StickyCreateButton(
                creating: _creating,
                onTap: () => _createSession(ref, route),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _RouteHero extends StatelessWidget {
  const _RouteHero({
    required this.route,
    required this.saved,
    required this.onSaved,
  });

  final BackendCardItem route;
  final bool saved;
  final VoidCallback onSaved;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 256,
      child: Stack(
        fit: StackFit.expand,
        children: [
          DateasyRemoteImage(
            imageUrl: route.imageUrl,
            usage: DateasyImageUsage.hero,
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x661F0C3F),
                  Color(0x221F0C3F),
                  DateasyColors.background,
                ],
                stops: [0, 0.45, 1],
              ),
            ),
          ),
          Positioned(
            left: 16,
            right: 16,
            top: MediaQuery.paddingOf(context).top + 16,
            child: Row(
              children: [
                GestureDetector(
                  onTap: () => context.go('/routes'),
                  child: const _GlassSquare(
                    child: Icon(
                      LucideIcons.chevronLeft,
                      size: 20,
                      color: DateasyColors.foreground,
                    ),
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: onSaved,
                  child: _GlassSquare(
                    child: Icon(
                      saved ? Icons.bookmark : LucideIcons.bookmark,
                      size: 20,
                      color:
                          saved ? DateasyColors.lime : DateasyColors.foreground,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => context.go(
                    '/share?targetType=route_template&targetId=${Uri.encodeComponent(route.id)}',
                  ),
                  child: const _GlassSquare(
                    child: Icon(
                      LucideIcons.share2,
                      size: 20,
                      color: DateasyColors.foreground,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 18,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _LimeBadge(label: route.city ?? 'Маршрут'),
                const SizedBox(height: 8),
                Text(
                  route.title.isEmpty ? 'Маршрут' : route.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                        fontSize: 30,
                        height: 1.08,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RouteMeta extends StatelessWidget {
  const _RouteMeta({required this.route});

  final BackendCardItem route;

  @override
  Widget build(BuildContext context) {
    final duration = _stringOrNull(route.raw['durationLabel']) ??
        _stringOrNull(route.raw['duration']) ??
        'Время не указано';
    final distance = _stringOrNull(route.raw['distanceLabel']) ??
        _stringOrNull(route.raw['distance']) ??
        'Дистанция не указана';
    final budget = _stringOrNull(route.raw['budgetLabel']) ??
        _stringOrNull(route.raw['priceLabel']) ??
        _stringOrNull(route.raw['budget']) ??
        'Бюджет не указан';

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Row(
        children: [
          Expanded(child: _Pill(icon: LucideIcons.clock, label: duration)),
          const SizedBox(width: 10),
          Expanded(child: _Pill(icon: LucideIcons.mapPin, label: distance)),
          const SizedBox(width: 10),
          Expanded(child: _Pill(icon: LucideIcons.wallet, label: budget)),
        ],
      ),
    );
  }
}

class _RouteDescription extends StatelessWidget {
  const _RouteDescription({required this.route});

  final BackendCardItem route;

  @override
  Widget build(BuildContext context) {
    final text = route.subtitle ?? _stringOrNull(route.raw['description']);
    if (text == null || text.isEmpty) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: _GlassPanel(
        borderRadius: 18,
        padding: const EdgeInsets.all(16),
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.muted,
                height: 1.45,
              ),
        ),
      ),
    );
  }
}

class _RouteTimeline extends StatelessWidget {
  const _RouteTimeline({required this.steps});

  final List<_RouteStep> steps;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Маршрут',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 12),
          if (steps.isEmpty)
            const _InlineNotice(
              text: 'Backend не отдает steps для этого route template',
            )
          else
            Column(
              children: [
                for (var index = 0; index < steps.length; index++) ...[
                  _StopCard(step: steps[index], index: index + 1),
                  if (index != steps.length - 1) const SizedBox(height: 12),
                ],
              ],
            ),
        ],
      ),
    );
  }
}

class _StopCard extends StatelessWidget {
  const _StopCard({
    required this.step,
    required this.index,
  });

  final _RouteStep step;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: dateasyLimeGradient,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            '$index',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.backgroundDeep,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _GlassPanel(
            borderRadius: 16,
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (step.imageUrl != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: SizedBox(
                      height: 112,
                      width: double.infinity,
                      child: DateasyRemoteImage(
                        imageUrl: step.imageUrl,
                        usage: DateasyImageUsage.card,
                      ),
                    ),
                  ),
                if (step.imageUrl != null) const SizedBox(height: 10),
                Text(
                  step.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                if (step.subtitle != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    step.subtitle!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 11,
                        ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _RouteGapNotice extends StatelessWidget {
  const _RouteGapNotice({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: _InlineNotice(text: text),
    );
  }
}

class _StickyCreateButton extends StatelessWidget {
  const _StickyCreateButton({
    required this.creating,
    required this.onTap,
  });

  final bool creating;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 20,
      right: 20,
      bottom: 24,
      child: SafeArea(
        top: false,
        child: GestureDetector(
          onTap: creating ? null : onTap,
          child: Container(
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: dateasyLimeGradient,
              borderRadius: BorderRadius.circular(18),
              boxShadow: [
                BoxShadow(
                  color: DateasyColors.lime.withValues(alpha: 0.26),
                  blurRadius: 28,
                  offset: const Offset(0, 14),
                ),
              ],
            ),
            child: Text(
              creating ? 'Создаём встречу' : 'Запустить маршрут',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.backgroundDeep,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RouteStatus extends StatelessWidget {
  const _RouteStatus({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.muted,
              ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 16,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 14, color: DateasyColors.foreground),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontSize: 12,
                    fontWeight: FontWeight.w400,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GlassSquare extends StatelessWidget {
  const _GlassSquare({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 16,
      padding: EdgeInsets.zero,
      child: SizedBox(width: 44, height: 44, child: child),
    );
  }
}

class _GlassPanel extends StatelessWidget {
  const _GlassPanel({
    required this.child,
    required this.borderRadius,
    required this.padding,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: DateasyColors.border),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class _LimeBadge extends StatelessWidget {
  const _LimeBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        gradient: dateasyLimeGradient,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.backgroundDeep,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _InlineNotice extends StatelessWidget {
  const _InlineNotice({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 16,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          const Icon(LucideIcons.info, size: 18, color: DateasyColors.lime),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RouteStep {
  const _RouteStep({
    required this.title,
    this.subtitle,
    this.imageUrl,
  });

  final String title;
  final String? subtitle;
  final String? imageUrl;

  static List<_RouteStep> fromRoute(BackendCardItem route) {
    final rawSteps = route.raw['steps'] ?? route.raw['stops'];
    if (rawSteps is! List) {
      return const [];
    }
    return rawSteps
        .whereType<Map>()
        .map((item) => item.map((key, value) => MapEntry('$key', value)))
        .map(_RouteStep.fromJson)
        .where((step) => step.title.isNotEmpty)
        .toList(growable: false);
  }

  factory _RouteStep.fromJson(Map<String, Object?> json) {
    final place = _map(json['place']);
    return _RouteStep(
      title: _string(
        json['title'] ?? json['name'] ?? place['title'] ?? place['name'],
      ),
      subtitle: _stringOrNull(
        json['subtitle'] ?? json['description'] ?? place['address'],
      ),
      imageUrl: _stringOrNull(
        json['imageUrl'] ?? json['coverUrl'] ?? place['imageUrl'],
      ),
    );
  }
}

Map<String, Object?> _map(Object? value) {
  if (value is Map) {
    return value.map((key, value) => MapEntry('$key', value));
  }
  return const {};
}

String _string(Object? value) => value?.toString() ?? '';

int? _routeCapacity(BackendCardItem route) {
  final raw = route.raw;
  final metadata = _map(raw['metadata']);
  return _intOrNull(
    raw['capacity'] ??
        raw['maxGuests'] ??
        raw['defaultCapacity'] ??
        metadata['capacity'] ??
        metadata['maxGuests'],
  );
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

String? _stringOrNull(Object? value) {
  final result = value?.toString();
  if (result == null || result.isEmpty) {
    return null;
  }
  return result;
}

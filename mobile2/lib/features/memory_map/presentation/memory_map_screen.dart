import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_highlight_text.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

class MemoryMapScreen extends StatelessWidget {
  const MemoryMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Consumer(
        builder: (context, ref, _) {
          final peopleState = ref.watch(memoryPeopleProvider);
          final memories = peopleState.valueOrNull?.items
                  .map(_MemoryItem.fromBackend)
                  .where((item) => item.id.isNotEmpty)
                  .toList(growable: false) ??
              const <_MemoryItem>[];
          final pins = memories
              .where((item) => item.latitude != null && item.longitude != null)
              .map(_MemoryPin.fromMemory)
              .toList(growable: false);

          return ListView(
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 16,
              bottom: 48,
            ),
            children: [
              const _MemoryHeader(),
              _TitleBlock(count: memories.length),
              _MapCard(pins: pins),
              _StatsGrid(peopleCount: memories.length),
              if (peopleState.isLoading && memories.isEmpty)
                const _MemoryStatus(message: 'Загружаем воспоминания')
              else if (memories.isEmpty)
                _MemoryStatus(
                  message: peopleState.hasError
                      ? 'Не удалось загрузить воспоминания'
                      : 'Воспоминаний пока нет',
                )
              else
                _MemoriesList(memories: memories),
            ],
          );
        },
      ),
    );
  }
}

class _MemoryHeader extends StatelessWidget {
  const _MemoryHeader();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.go('/profile'),
            child: const _GlassSquare(
              child: Icon(
                LucideIcons.chevronLeft,
                size: 20,
                color: DateasyColors.foreground,
              ),
            ),
          ),
          Expanded(
            child: Center(
              child: Text(
                'Memory Map',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: 'Sora',
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ),
          GestureDetector(
            onTap: () => context.go(
              '/share?targetType=memory_map&targetId=me',
            ),
            child: _GlassSquare(
              child: Text(
                'Шер',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.lime,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TitleBlock extends StatelessWidget {
  const _TitleBlock({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final titleStyle = Theme.of(context).textTheme.headlineMedium?.copyWith(
          fontSize: 24,
          height: 1.08,
          fontWeight: FontWeight.w600,
        );

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 6,
            children: [
              Text('Твой', style: titleStyle),
              DateasyHeadlineHighlight(
                text: 'город встреч',
                style: titleStyle,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            count == 0
                ? 'Данные появятся после встреч'
                : '$count людей из истории Frendly',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 14,
                ),
          ),
        ],
      ),
    );
  }
}

class _MapCard extends StatelessWidget {
  const _MapCard({required this.pins});

  final List<_MemoryPin> pins;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Container(
          height: 340,
          decoration: BoxDecoration(
            border: Border.all(color: DateasyColors.border),
            gradient: const RadialGradient(
              center: Alignment(-0.4, -0.6),
              radius: 1.2,
              colors: [
                Color(0xFF593279),
                Color(0xFF2F174E),
                Color(0xFF1F0C3F),
              ],
              stops: [0, 0.52, 1],
            ),
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              return Stack(
                children: [
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _MemoryRoutePainter(),
                    ),
                  ),
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          center: const Alignment(0.75, 0.7),
                          radius: 0.9,
                          colors: [
                            DateasyColors.pink.withValues(alpha: 0.26),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (pins.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Text(
                          'Backend не вернул координаты для memory map',
                          textAlign: TextAlign.center,
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: DateasyColors.muted,
                                  ),
                        ),
                      ),
                    )
                  else
                    for (final pin in pins)
                      Positioned(
                        left: constraints.maxWidth * pin.x - 42,
                        top: constraints.maxHeight * pin.y - 26,
                        width: 84,
                        child: _MapPinButton(pin: pin),
                      ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _MapPinButton extends StatelessWidget {
  const _MapPinButton({required this.pin});

  final _MemoryPin pin;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${pin.title} · ${pin.date}'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: DateasyColors.surface2,
          ),
        );
      },
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: dateasyLimeGradient,
              boxShadow: [
                BoxShadow(
                  color: Color(0x66000000),
                  blurRadius: 20,
                  spreadRadius: -10,
                  offset: Offset(0, 10),
                ),
              ],
            ),
            child: const Icon(
              LucideIcons.mapPin,
              size: 16,
              color: DateasyColors.backgroundDeep,
            ),
          ),
          const SizedBox(height: 4),
          _PinLabel(pin.title),
        ],
      ),
    );
  }
}

class _PinLabel extends StatelessWidget {
  const _PinLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: DateasyColors.border),
      ),
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.foreground,
              fontSize: 9,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

class _MemoryRoutePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = DateasyColors.lime.withValues(alpha: 0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final path = Path()
      ..moveTo(size.width * 0.25, size.height * 0.30)
      ..quadraticBezierTo(
        size.width * 0.40,
        size.height * 0.20,
        size.width * 0.60,
        size.height * 0.25,
      )
      ..quadraticBezierTo(
        size.width * 0.80,
        size.height * 0.34,
        size.width * 0.75,
        size.height * 0.65,
      )
      ..quadraticBezierTo(
        size.width * 0.50,
        size.height * 0.70,
        size.width * 0.45,
        size.height * 0.55,
      )
      ..quadraticBezierTo(
        size.width * 0.32,
        size.height * 0.42,
        size.width * 0.25,
        size.height * 0.30,
      );

    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final end = (distance + 4).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(distance, end), paint);
        distance += 8;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _MemoryRoutePainter oldDelegate) => false;
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.peopleCount});

  final int peopleCount;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Row(
        children: [
          Expanded(
            child: _StatCard(
              number: '$peopleCount',
              label: 'Людей',
              color: DateasyColors.pink,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.number,
    required this.label,
    required this.color,
  });

  final String number;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final foreground = color == DateasyColors.pink
        ? DateasyColors.foreground
        : DateasyColors.backgroundDeep;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            number,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: foreground,
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                ),
          ),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: foreground.withValues(alpha: 0.78),
                  fontSize: 11,
                  fontWeight: FontWeight.w400,
                ),
          ),
        ],
      ),
    );
  }
}

class _MemoriesList extends StatelessWidget {
  const _MemoriesList({required this.memories});

  final List<_MemoryItem> memories;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionLabel('Воспоминания'),
          const SizedBox(height: 8),
          for (var index = 0; index < memories.length; index++) ...[
            _MemoryRow(memory: memories[index]),
            if (index != memories.length - 1) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _MemoryRow extends StatelessWidget {
  const _MemoryRow({required this.memory});

  final _MemoryItem memory;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${memory.title} · ${memory.when}'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: DateasyColors.surface2,
          ),
        );
      },
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                width: 44,
                height: 44,
                child: DateasyRemoteImage(
                  imageUrl: memory.imageUrl,
                  usage: DateasyImageUsage.avatar,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    memory.title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      const Icon(
                        LucideIcons.calendar,
                        size: 12,
                        color: DateasyColors.muted,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        memory.when,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.muted,
                              fontSize: 11,
                            ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(
              LucideIcons.users,
              size: 16,
              color: DateasyColors.muted,
            ),
          ],
        ),
      ),
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

class _GlassSquare extends StatelessWidget {
  const _GlassSquare({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: DateasyColors.border),
      ),
      child: child,
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
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: DateasyColors.border),
      ),
      child: child,
    );
  }
}

class _MemoryPin {
  const _MemoryPin({
    required this.x,
    required this.y,
    required this.title,
    required this.date,
  });

  final double x;
  final double y;
  final String title;
  final String date;

  factory _MemoryPin.fromMemory(_MemoryItem item) {
    final longitude = item.longitude ?? 0;
    final latitude = item.latitude ?? 0;
    return _MemoryPin(
      x: ((longitude + 180) / 360).clamp(0.08, 0.92),
      y: ((90 - latitude) / 180).clamp(0.08, 0.92),
      title: item.title,
      date: item.when,
    );
  }
}

class _MemoryItem {
  const _MemoryItem({
    required this.id,
    required this.title,
    required this.when,
    this.imageUrl,
    this.latitude,
    this.longitude,
  });

  final String id;
  final String title;
  final String when;
  final String? imageUrl;
  final double? latitude;
  final double? longitude;

  factory _MemoryItem.fromBackend(BackendCardItem item) {
    return _MemoryItem(
      id: item.id,
      title: item.title.isEmpty ? 'Профиль' : item.title,
      when: item.subtitle ?? item.city ?? _formatDate(item.startsAt) ?? '',
      imageUrl: item.imageUrl,
      latitude: item.latitude,
      longitude: item.longitude,
    );
  }
}

class _MemoryStatus extends StatelessWidget {
  const _MemoryStatus({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(18),
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

String? _formatDate(DateTime? value) {
  if (value == null) {
    return null;
  }
  return '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year}';
}

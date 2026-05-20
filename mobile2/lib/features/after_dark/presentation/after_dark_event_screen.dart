import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

const _deep = Color(0xFF08030F);
const _glass = Color(0x661D0C2E);
const _border = Color(0x1AFFFFFF);
const _pink = Color(0xFFFF5AA8);
const _muted = Color(0xFFB9A7C7);

const _pinkGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFFFF8AC5), _pink],
);

class AfterDarkEventScreen extends ConsumerStatefulWidget {
  const AfterDarkEventScreen({
    super.key,
    required this.eventId,
  });

  final String eventId;

  @override
  ConsumerState<AfterDarkEventScreen> createState() =>
      _AfterDarkEventScreenState();
}

class _AfterDarkEventScreenState extends ConsumerState<AfterDarkEventScreen> {
  BackendCardItem? _overrideEvent;
  bool _joining = false;
  String? _error;

  Future<void> _join(BackendCardItem event) async {
    if (_joining) {
      return;
    }
    setState(() {
      _joining = true;
      _error = null;
    });
    try {
      final next = await ref.read(afterDarkActionsProvider).joinEvent(event.id);
      if (!mounted) {
        return;
      }
      setState(() => _overrideEvent = next);
      final chatId = next.raw['chatId']?.toString();
      if (chatId != null && chatId.isNotEmpty && mounted) {
        context.go('/meetings/$chatId/chat');
      }
    } on BackendActionException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.code == 'after_dark_rules_required'
            ? 'Нужно принять правила события'
            : error.code == 'after_dark_verification_required'
                ? 'Для этого события нужна верификация'
                : 'Не удалось вступить';
      });
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Не удалось вступить');
      }
    } finally {
      if (mounted) {
        setState(() => _joining = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(afterDarkEventProvider(widget.eventId));
    final event = _overrideEvent ?? state.valueOrNull;
    return Scaffold(
      backgroundColor: _deep,
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: DecoratedBox(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF10051D), _deep],
              ),
            ),
            child: Stack(
              children: [
                const _Glow(),
                SafeArea(
                  bottom: false,
                  child: event == null
                      ? _Status(
                          message: state.isLoading
                              ? 'Загружаем событие'
                              : 'Не удалось загрузить событие',
                        )
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(20, 16, 20, 112),
                          children: [
                            const _Header(),
                            _Hero(event: event),
                            _Meta(event: event),
                            if (_error != null) ...[
                              const SizedBox(height: 12),
                              _Notice(text: _error!),
                            ],
                            _Rules(event: event),
                          ],
                        ),
                ),
                if (event != null)
                  _JoinBar(
                    event: event,
                    joining: _joining,
                    onJoin: () => _join(event),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        GestureDetector(
          onTap: () => context.go('/after-dark'),
          child: const _GlassSquare(
            child: Icon(
              LucideIcons.chevronLeft,
              size: 20,
              color: DateasyColors.foreground,
            ),
          ),
        ),
        const Spacer(),
        const _AgeBadge(),
      ],
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.event});

  final BackendCardItem event;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            event.title.isEmpty ? 'After Dark' : event.title,
            style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  fontSize: 34,
                  height: 1.06,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 10),
          Text(
            event.subtitle ?? 'Закрытое событие',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: _muted,
                  fontSize: 14,
                  height: 1.45,
                ),
          ),
        ],
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.event});

  final BackendCardItem event;

  @override
  Widget build(BuildContext context) {
    final raw = event.raw;
    final host = _map(raw['host']);
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _InfoRow(icon: LucideIcons.clock, value: raw['time']?.toString()),
            _InfoRow(
              icon: LucideIcons.mapPin,
              value: raw['district']?.toString(),
            ),
            _InfoRow(
              icon: LucideIcons.users,
              value: '${raw['going'] ?? 0}/${raw['capacity'] ?? 0} участников',
            ),
            _InfoRow(
              icon: LucideIcons.sparkles,
              value: raw['vibe']?.toString(),
            ),
            _InfoRow(
              icon: LucideIcons.userRound,
              value: host['displayName']?.toString(),
            ),
          ],
        ),
      ),
    );
  }
}

class _Rules extends StatelessWidget {
  const _Rules({required this.event});

  final BackendCardItem event;

  @override
  Widget build(BuildContext context) {
    final rules = _stringList(event.raw['rules']);
    if (rules.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(top: 12),
        child: _Notice(text: 'Правила не заданы backend'),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Правила',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 10),
            for (final rule in rules) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(LucideIcons.check, size: 14, color: _pink),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      rule,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: _muted,
                            height: 1.35,
                          ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
            ],
          ],
        ),
      ),
    );
  }
}

class _JoinBar extends StatelessWidget {
  const _JoinBar({
    required this.event,
    required this.joining,
    required this.onJoin,
  });

  final BackendCardItem event;
  final bool joining;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context) {
    final joined = event.raw['joined'] as bool? ?? false;
    final chatId = event.raw['chatId']?.toString();
    return Positioned(
      left: 20,
      right: 20,
      bottom: 24,
      child: SafeArea(
        top: false,
        child: GestureDetector(
          onTap: joining
              ? null
              : joined && chatId != null && chatId.isNotEmpty
                  ? () => context.go('/meetings/$chatId/chat')
                  : onJoin,
          child: Container(
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: joined ? null : _pinkGradient,
              color: joined ? _glass : null,
              borderRadius: BorderRadius.circular(18),
              border: joined ? Border.all(color: _border) : null,
              boxShadow: const [
                BoxShadow(
                  color: Color(0x55FF5AA8),
                  blurRadius: 30,
                  spreadRadius: -12,
                  offset: Offset(0, 16),
                ),
              ],
            ),
            child: Text(
              joining
                  ? 'Отправляем'
                  : joined
                      ? 'Открыть чат'
                      : 'Вступить',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: joined ? DateasyColors.foreground : _deep,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.value,
  });

  final IconData icon;
  final String? value;

  @override
  Widget build(BuildContext context) {
    final text = value;
    if (text == null || text.isEmpty) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 16, color: _pink),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: _muted,
                    fontSize: 12,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 18,
      padding: const EdgeInsets.all(14),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: _muted,
              fontSize: 12,
            ),
      ),
    );
  }
}

class _Status extends StatelessWidget {
  const _Status({required this.message});

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
                color: _muted,
              ),
        ),
      ),
    );
  }
}

class _AgeBadge extends StatelessWidget {
  const _AgeBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        gradient: _pinkGradient,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '18+',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: _deep,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
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
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: _glass,
            borderRadius: BorderRadius.circular(borderRadius),
            border: Border.all(color: _border),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  const _Glow();

  @override
  Widget build(BuildContext context) {
    return const Positioned.fill(
      child: IgnorePointer(
        child: Align(
          alignment: Alignment(1.2, -1.05),
          child: _GlowBlob(),
        ),
      ),
    );
  }
}

class _GlowBlob extends StatelessWidget {
  const _GlowBlob();

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: 0.34,
      child: ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 48, sigmaY: 48),
        child: Container(
          width: 280,
          height: 280,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(colors: [Color(0xFFFF8AC5), _pink]),
          ),
        ),
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

List<String> _stringList(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value.map((item) => item.toString()).toList(growable: false);
}

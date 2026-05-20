import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

const _afterDarkPink = Color(0xFFFF5AA8);
const _afterDarkPink2 = Color(0xFFFF8AC5);
const _afterDarkDeep = Color(0xFF10051D);
const _afterDarkDeep2 = Color(0xFF08030F);
const _afterDarkMuted = Color(0xFFB9A7C7);
const _afterDarkGlass = Color(0x661D0C2E);
const _afterDarkBorder = Color(0x1AFFFFFF);

const _afterDarkBackground = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [_afterDarkDeep, _afterDarkDeep2],
);

const _afterDarkPinkGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [_afterDarkPink2, _afterDarkPink],
);

const _afterDarkFeatures = [
  _AfterDarkFeature(
    icon: LucideIcons.eye,
    title: 'Закрытая лента After Dark',
    description: 'Найтлайф, свидания, wellness и Inner Circle',
  ),
  _AfterDarkFeature(
    icon: LucideIcons.shieldCheck,
    title: 'Только верифицированные',
    description: 'Все участники прошли проверку возраста и фото',
  ),
  _AfterDarkFeature(
    icon: LucideIcons.lock,
    title: 'Скрытые локации',
    description: 'Адрес открывается за 4 часа до старта',
  ),
  _AfterDarkFeature(
    icon: LucideIcons.keyRound,
    title: 'NDA · кодекс молчания',
    description: 'Что было ночью — остаётся в круге',
  ),
  _AfterDarkFeature(
    icon: LucideIcons.heart,
    title: 'Безопасность 360°',
    description: 'SOS, сопровождение, доверенные лица — всегда под рукой',
  ),
];

class AfterDarkScreen extends ConsumerStatefulWidget {
  const AfterDarkScreen({super.key});

  @override
  ConsumerState<AfterDarkScreen> createState() => _AfterDarkScreenState();
}

class _AfterDarkScreenState extends ConsumerState<AfterDarkScreen> {
  bool _notify = false;
  bool _ageConfirmed = false;
  bool _codeAccepted = false;
  bool _unlocking = false;
  String _plan = 'month';
  String? _unlockError;

  Future<void> _unlock() async {
    if (_unlocking) {
      return;
    }
    if (!_ageConfirmed || !_codeAccepted) {
      setState(() => _unlockError = 'Подтверди возраст и правила доступа');
      return;
    }
    setState(() {
      _unlocking = true;
      _unlockError = null;
    });
    try {
      await ref.read(afterDarkActionsProvider).unlock(
            plan: _plan,
            ageConfirmed: _ageConfirmed,
            codeAccepted: _codeAccepted,
          );
      if (!mounted) {
        return;
      }
    } on BackendActionException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _unlockError = error.code == 'after_dark_consent_required'
            ? 'Backend требует подтверждение возраста и правил'
            : error.code == 'invalid_subscription_plan'
                ? 'Backend не принял выбранный план'
                : 'Не удалось открыть After Dark';
      });
    } catch (_) {
      if (mounted) {
        setState(() => _unlockError = 'Не удалось открыть After Dark');
      }
    } finally {
      if (mounted) {
        setState(() => _unlocking = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final accessState = ref.watch(afterDarkAccessProvider);
    final access = accessState.valueOrNull;
    final eventsState = access?.unlocked == true
        ? ref.watch(afterDarkEventsProvider)
        : const AsyncValue<BackendPage<BackendCardItem>>.data(
            BackendPage(items: []),
          );
    return Scaffold(
      backgroundColor: _afterDarkDeep2,
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: DecoratedBox(
            decoration: const BoxDecoration(gradient: _afterDarkBackground),
            child: Stack(
              children: [
                const _AfterDarkGlowLayer(),
                SafeArea(
                  bottom: false,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
                    children: [
                      const _AfterDarkHeader(),
                      const _HeroCopy(),
                      if (accessState.isLoading && access == null)
                        const _AfterDarkStatus(message: 'Проверяем доступ'),
                      if (accessState.hasError && access == null)
                        const _AfterDarkStatus(
                          message: 'Не удалось проверить доступ',
                        ),
                      if (access != null && !access.unlocked)
                        _LockedHeroCard(access: access),
                      if (access?.unlocked == true)
                        _UnlockedEvents(state: eventsState),
                      const _FeatureList(),
                      if (access?.unlocked != true)
                        _UnlockPanel(
                          plan: _plan,
                          ageConfirmed: _ageConfirmed,
                          codeAccepted: _codeAccepted,
                          unlocking: _unlocking,
                          error: _unlockError,
                          notified: _notify,
                          onPlanChanged: (value) {
                            setState(() => _plan = value);
                          },
                          onAgeChanged: (value) {
                            setState(() => _ageConfirmed = value);
                          },
                          onCodeChanged: (value) {
                            setState(() => _codeAccepted = value);
                          },
                          onUnlock: _unlock,
                          onNotify: _handleNotify,
                        ),
                      const _AccessNote(),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _handleNotify() {
    if (_notify) {
      return;
    }

    setState(() => _notify = true);
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Подписан на открытие'),
            SizedBox(height: 2),
            Text(
              'Backend endpoint для waitlist не найден, сохранили локально',
              style: TextStyle(fontSize: 12),
            ),
          ],
        ),
        behavior: SnackBarBehavior.floating,
        backgroundColor: Color(0xFF2A123D),
      ),
    );
  }
}

class _AfterDarkGlowLayer extends StatelessWidget {
  const _AfterDarkGlowLayer();

  @override
  Widget build(BuildContext context) {
    return const Positioned.fill(
      child: IgnorePointer(
        child: Stack(
          children: [
            _GlowBlob(
              alignment: Alignment(1.25, -1.12),
              colorA: _afterDarkPink2,
              colorB: _afterDarkPink,
              opacity: 0.4,
            ),
            _GlowBlob(
              alignment: Alignment(-1.22, 1.08),
              colorA: Color(0xFF8F5BFF),
              colorB: Color(0x005C1E90),
              opacity: 0.3,
            ),
          ],
        ),
      ),
    );
  }
}

class _GlowBlob extends StatelessWidget {
  const _GlowBlob({
    required this.alignment,
    required this.colorA,
    required this.colorB,
    required this.opacity,
  });

  final Alignment alignment;
  final Color colorA;
  final Color colorB;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Align(
        alignment: alignment,
        child: Opacity(
          opacity: opacity,
          child: ImageFiltered(
            imageFilter: ImageFilter.blur(sigmaX: 48, sigmaY: 48),
            child: Container(
              width: 288,
              height: 288,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [colorA, colorB]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AfterDarkHeader extends StatelessWidget {
  const _AfterDarkHeader();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        GestureDetector(
          onTap: () => context.go('/'),
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
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  LucideIcons.moon,
                  size: 16,
                  color: DateasyColors.foreground,
                ),
                const SizedBox(width: 8),
                Text(
                  'After Dark',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontFamily: 'Sora',
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
          decoration: BoxDecoration(
            gradient: _afterDarkPinkGradient,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            '18+',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: _afterDarkDeep2,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      ],
    );
  }
}

class _HeroCopy extends StatelessWidget {
  const _HeroCopy();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 32),
      child: Column(
        children: [
          Text(
            'Ночной круг для тех,\nкто живёт интенсивнее.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  fontFamily: 'Sora',
                  fontSize: 34,
                  height: 1.05,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 320),
            child: Text(
              'Свидания, найтлайф, wellness и closed play — в защищённом, верифицированном кругу.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: _afterDarkMuted,
                    fontSize: 14,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LockedHeroCard extends StatelessWidget {
  const _LockedHeroCard({required this.access});

  final AfterDarkAccessData access;

  String get _lockedMessage {
    final hasSubscription = access.subscriptionStatus == 'trial' ||
        access.subscriptionStatus == 'active';
    if (!hasSubscription) {
      return 'Нужен активный план';
    }
    if (!access.ageConfirmed || !access.codeAccepted) {
      return 'Подтверди возраст и правила доступа';
    }
    return 'Доступ закрыт backend';
  }

  @override
  Widget build(BuildContext context) {
    final previewCount = access.previewCount;
    return Padding(
      padding: const EdgeInsets.only(top: 28),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const _LightCloud(),
            const SizedBox(height: 24),
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: _afterDarkPink.withValues(alpha: 0.15),
                shape: BoxShape.circle,
                border: Border.all(
                  color: _afterDarkPink.withValues(alpha: 0.4),
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x55FF5AA8),
                    blurRadius: 28,
                    spreadRadius: -10,
                    offset: Offset(0, 12),
                  ),
                ],
              ),
              child: const Icon(
                LucideIcons.lock,
                size: 28,
                color: _afterDarkPink,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              previewCount > 0
                  ? '$previewCount событий сегодня ночью'
                  : 'События появятся после открытия',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              _lockedMessage,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: _afterDarkMuted,
                    fontSize: 12,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LightCloud extends StatelessWidget {
  const _LightCloud();

  @override
  Widget build(BuildContext context) {
    return const Opacity(
      opacity: 0.6,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _SoftLight(color: _afterDarkPink),
          SizedBox(width: 16),
          _SoftLight(color: Color(0xFFFFB84D)),
          SizedBox(width: 16),
          _SoftLight(color: Color(0xFF8F5BFF)),
        ],
      ),
    );
  }
}

class _SoftLight extends StatelessWidget {
  const _SoftLight({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return ImageFiltered(
      imageFilter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
        ),
      ),
    );
  }
}

class _UnlockedEvents extends StatelessWidget {
  const _UnlockedEvents({required this.state});

  final AsyncValue<BackendPage<BackendCardItem>> state;

  @override
  Widget build(BuildContext context) {
    final events = state.valueOrNull?.items ?? const <BackendCardItem>[];
    return Padding(
      padding: const EdgeInsets.only(top: 28),
      child: Column(
        children: [
          if (state.isLoading && events.isEmpty)
            const _AfterDarkStatus(message: 'Загружаем события'),
          if (state.hasError && events.isEmpty)
            const _AfterDarkStatus(message: 'Не удалось загрузить события'),
          if (!state.isLoading && !state.hasError && events.isEmpty)
            const _AfterDarkStatus(message: 'Событий After Dark пока нет'),
          for (var index = 0; index < events.length && index < 8; index++) ...[
            _AfterDarkEventCard(event: events[index]),
            if (index != events.length - 1 && index < 7)
              const SizedBox(height: 8),
          ],
          if (state.hasError && events.isNotEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: _AfterDarkStatus(message: 'Обновить события не удалось'),
            ),
        ],
      ),
    );
  }
}

class _AfterDarkEventCard extends StatelessWidget {
  const _AfterDarkEventCard({required this.event});

  final BackendCardItem event;

  @override
  Widget build(BuildContext context) {
    final raw = event.raw;
    final time = raw['time']?.toString();
    final going = raw['going']?.toString();
    return GestureDetector(
      onTap: () => context.go('/after-dark/${event.id}'),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: _afterDarkPinkGradient,
              ),
              child: const Icon(
                LucideIcons.moon,
                size: 20,
                color: _afterDarkDeep2,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.title.isEmpty ? 'After Dark' : event.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [
                      time,
                      event.subtitle,
                      if (going != null) '$going идут',
                    ].whereType<String>().join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: _afterDarkMuted,
                          fontSize: 11,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            const Icon(
              LucideIcons.chevronRight,
              size: 16,
              color: _afterDarkPink,
            ),
          ],
        ),
      ),
    );
  }
}

class _AfterDarkStatus extends StatelessWidget {
  const _AfterDarkStatus({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 24,
      padding: const EdgeInsets.all(16),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: _afterDarkMuted,
              fontSize: 12,
            ),
      ),
    );
  }
}

class _FeatureList extends StatelessWidget {
  const _FeatureList();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        children: [
          for (var index = 0; index < _afterDarkFeatures.length; index++) ...[
            _FeatureRow(feature: _afterDarkFeatures[index]),
            if (index != _afterDarkFeatures.length - 1)
              const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.feature});

  final _AfterDarkFeature feature;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 24,
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFF4F1E55).withValues(alpha: 0.55),
                  const Color(0xFF261236).withValues(alpha: 0.58),
                ],
              ),
            ),
            child: Icon(feature.icon, size: 20, color: _afterDarkPink),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  feature.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  feature.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: _afterDarkMuted,
                        fontSize: 11,
                        height: 1.25,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Icon(
            LucideIcons.sparkles,
            size: 16,
            color: _afterDarkPink.withValues(alpha: 0.6),
          ),
        ],
      ),
    );
  }
}

class _NotifyButton extends StatelessWidget {
  const _NotifyButton({
    required this.notified,
    required this.onTap,
  });

  final bool notified;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 28),
      child: GestureDetector(
        onTap: notified ? null : onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            gradient: notified ? null : _afterDarkPinkGradient,
            color: notified ? _afterDarkGlass : null,
            borderRadius: BorderRadius.circular(16),
            border: notified
                ? Border.all(color: _afterDarkPink.withValues(alpha: 0.4))
                : null,
            boxShadow: const [
              BoxShadow(
                color: Color(0x55FF5AA8),
                blurRadius: 30,
                spreadRadius: -12,
                offset: Offset(0, 16),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                LucideIcons.bellRing,
                size: 20,
                color: notified ? _afterDarkPink : _afterDarkDeep2,
              ),
              const SizedBox(width: 8),
              Text(
                notified ? 'Сохранено локально' : 'Waitlist endpoint не найден',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: notified ? _afterDarkPink : _afterDarkDeep2,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UnlockPanel extends StatelessWidget {
  const _UnlockPanel({
    required this.plan,
    required this.ageConfirmed,
    required this.codeAccepted,
    required this.unlocking,
    required this.error,
    required this.notified,
    required this.onPlanChanged,
    required this.onAgeChanged,
    required this.onCodeChanged,
    required this.onUnlock,
    required this.onNotify,
  });

  final String plan;
  final bool ageConfirmed;
  final bool codeAccepted;
  final bool unlocking;
  final String? error;
  final bool notified;
  final ValueChanged<String> onPlanChanged;
  final ValueChanged<bool> onAgeChanged;
  final ValueChanged<bool> onCodeChanged;
  final VoidCallback onUnlock;
  final VoidCallback onNotify;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 28),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Открыть доступ',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _PlanChip(
                    label: 'Месяц',
                    active: plan == 'month',
                    onTap: () => onPlanChanged('month'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _PlanChip(
                    label: 'Год',
                    active: plan == 'year',
                    onTap: () => onPlanChanged('year'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _ConsentRow(
              value: ageConfirmed,
              text: 'Мне есть 18 лет',
              onChanged: onAgeChanged,
            ),
            const SizedBox(height: 8),
            _ConsentRow(
              value: codeAccepted,
              text: 'Принимаю кодекс доступа',
              onChanged: onCodeChanged,
            ),
            if (error != null) ...[
              const SizedBox(height: 10),
              Text(
                error!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: _afterDarkPink,
                      fontSize: 12,
                    ),
              ),
            ],
            const SizedBox(height: 14),
            GestureDetector(
              onTap: unlocking ? null : onUnlock,
              child: Container(
                height: 52,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: _afterDarkPinkGradient,
                  borderRadius: BorderRadius.circular(16),
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
                  unlocking ? 'Открываем' : 'Открыть After Dark',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: _afterDarkDeep2,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            _NotifyButton(notified: notified, onTap: onNotify),
          ],
        ),
      ),
    );
  }
}

class _PlanChip extends StatelessWidget {
  const _PlanChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? _afterDarkPink : _afterDarkGlass,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: active ? _afterDarkPink : _afterDarkBorder,
          ),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: active ? _afterDarkDeep2 : DateasyColors.foreground,
                fontWeight: FontWeight.w700,
              ),
        ),
      ),
    );
  }
}

class _ConsentRow extends StatelessWidget {
  const _ConsentRow({
    required this.value,
    required this.text,
    required this.onChanged,
  });

  final bool value;
  final String text;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: Row(
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: value ? _afterDarkPink : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: value ? _afterDarkPink : _afterDarkBorder,
              ),
            ),
            child: value
                ? const Icon(
                    LucideIcons.check,
                    size: 14,
                    color: _afterDarkDeep2,
                  )
                : null,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: _afterDarkMuted,
                    fontSize: 12,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AccessNote extends StatelessWidget {
  const _AccessNote();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 280),
          child: Text(
            'Доступ — только по приглашению и после полной верификации.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: _afterDarkMuted,
                  fontSize: 11,
                ),
          ),
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
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: _afterDarkGlass,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _afterDarkBorder),
      ),
      alignment: Alignment.center,
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
        color: _afterDarkGlass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: _afterDarkBorder),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 30,
            spreadRadius: -16,
            offset: Offset(0, 16),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _AfterDarkFeature {
  const _AfterDarkFeature({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';

class DatingFilterScreen extends ConsumerStatefulWidget {
  const DatingFilterScreen({super.key});

  @override
  ConsumerState<DatingFilterScreen> createState() => _DatingFilterScreenState();
}

class _DatingFilterScreenState extends ConsumerState<DatingFilterScreen> {
  RangeValues _age = const RangeValues(18, 99);
  double _distance = 500;
  String _gender = 'Все';
  String _goal = 'Свидание';
  final Set<String> _vibes = {};
  bool _verifiedOnly = false;
  bool _frendlyPlusOnly = false;
  bool _onlineOnly = false;
  bool _newThisWeekOnly = false;
  bool _hydrated = false;

  void _reset() {
    setState(() {
      _age = const RangeValues(18, 99);
      _distance = 500;
      _gender = _oppositeGenderLabel(ref.read(currentUserProvider)?.gender);
      _goal = 'Свидание';
      _vibes.clear();
      _verifiedOnly = false;
      _frendlyPlusOnly = false;
      _onlineOnly = false;
      _newThisWeekOnly = false;
    });
  }

  void _hydrate(DatingDiscoverFilters filters, String? viewerGender) {
    _age = RangeValues(
      filters.ageMin.toDouble(),
      filters.ageMax.toDouble(),
    );
    _distance = filters.radiusKm.toDouble();
    _vibes
      ..clear()
      ..addAll(filters.interests);
    _gender = _genderLabelFromApi(filters.gender, viewerGender);
    _verifiedOnly = filters.verifiedOnly;
    _frendlyPlusOnly = filters.frendlyPlusOnly;
    _onlineOnly = filters.onlineOnly;
    _newThisWeekOnly = filters.newThisWeekOnly;
    _hydrated = true;
  }

  void _apply() {
    ref.read(datingDiscoverFiltersProvider.notifier).state =
        DatingDiscoverFilters(
      gender: _genderApiValue(_gender),
      ageMin: _age.start.round(),
      ageMax: _age.end.round(),
      radiusKm: _distance.round(),
      interests: _vibes.toList(growable: false),
      verifiedOnly: _verifiedOnly,
      frendlyPlusOnly: _frendlyPlusOnly,
      onlineOnly: _onlineOnly,
      newThisWeekOnly: _newThisWeekOnly,
    );
    ref.invalidate(datingDiscoverProvider);
    context.go('/dating');
  }

  @override
  Widget build(BuildContext context) {
    final savedFilters = ref.watch(datingDiscoverFiltersProvider);
    final viewerGender = ref.watch(currentUserProvider)?.gender;
    if (!_hydrated) {
      _hydrate(savedFilters, viewerGender);
    }
    return DateasyPhoneFrame(
      child: Stack(
        children: [
          ListView(
            padding: EdgeInsets.fromLTRB(
              20,
              MediaQuery.paddingOf(context).top + 16,
              20,
              132,
            ),
            children: [
              _Header(onReset: _reset),
              const SizedBox(height: 28),
              _GenderSection(
                active: _gender,
                onChanged: (value) => setState(() => _gender = value),
              ),
              const SizedBox(height: 26),
              _AgeSection(
                value: _age,
                onChanged: (value) => setState(() => _age = value),
              ),
              const SizedBox(height: 26),
              _DistanceSection(
                value: _distance,
                onChanged: (value) => setState(() => _distance = value),
              ),
              const SizedBox(height: 26),
              _ChipSection(
                title: 'Цель',
                items: _goals,
                active: {_goal},
                activeGradient: dateasyLimeGradient,
                activeTextColor: DateasyColors.backgroundDeep,
                onTap: (value) => setState(() => _goal = value),
              ),
              const SizedBox(height: 26),
              _ChipSection(
                title: 'Вайбы',
                items: _vibesList,
                active: _vibes,
                activeColor: DateasyColors.lilac,
                activeTextColor: DateasyColors.backgroundDeep,
                onTap: (value) {
                  setState(() {
                    if (_vibes.contains(value)) {
                      _vibes.remove(value);
                    } else {
                      _vibes.add(value);
                    }
                  });
                },
              ),
              const SizedBox(height: 26),
              _FilterToggles(
                verifiedOnly: _verifiedOnly,
                frendlyPlusOnly: _frendlyPlusOnly,
                onlineOnly: _onlineOnly,
                newThisWeekOnly: _newThisWeekOnly,
                onVerified: () =>
                    setState(() => _verifiedOnly = !_verifiedOnly),
                onFrendlyPlus: () =>
                    setState(() => _frendlyPlusOnly = !_frendlyPlusOnly),
                onOnline: () => setState(() => _onlineOnly = !_onlineOnly),
                onNewThisWeek: () =>
                    setState(() => _newThisWeekOnly = !_newThisWeekOnly),
              ),
            ],
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _StickyAction(
              bottomPadding: MediaQuery.paddingOf(context).bottom,
              onApply: _apply,
            ),
          ),
        ],
      ),
    );
  }
}

String _genderLabelFromApi(String? gender, String? viewerGender) {
  return switch (gender) {
    'female' => 'Девушки',
    'male' => 'Парни',
    _ => _oppositeGenderLabel(viewerGender),
  };
}

String? _genderApiValue(String gender) {
  return switch (gender) {
    'Девушки' => 'female',
    'Парни' => 'male',
    _ => null,
  };
}

String _oppositeGenderLabel(String? viewerGender) {
  return switch (viewerGender) {
    'male' => 'Девушки',
    'female' => 'Парни',
    _ => 'Все',
  };
}

class _Header extends StatelessWidget {
  const _Header({required this.onReset});

  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _GlassIconButton(
          icon: LucideIcons.chevronLeft,
          onTap: () => context.go('/dating'),
        ),
        const Spacer(),
        Text(
          'Фильтры',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontFamily: 'Sora',
                fontSize: 18,
              ),
        ),
        const Spacer(),
        _GlassIconButton(
          icon: LucideIcons.rotateCcw,
          onTap: onReset,
        ),
      ],
    );
  }
}

class _GenderSection extends StatelessWidget {
  const _GenderSection({
    required this.active,
    required this.onChanged,
  });

  final String active;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Кого показывать',
      child: Row(
        children: _genders.map((gender) {
          return Expanded(
            child: Padding(
              padding: EdgeInsets.only(
                right: gender == _genders.last ? 0 : 8,
              ),
              child: _SegmentButton(
                label: gender,
                active: gender == active,
                onTap: () => onChanged(gender),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _AgeSection extends StatelessWidget {
  const _AgeSection({
    required this.value,
    required this.onChanged,
  });

  final RangeValues value;
  final ValueChanged<RangeValues> onChanged;

  @override
  Widget build(BuildContext context) {
    final start = value.start.round();
    final end = value.end.round();

    return Column(
      children: [
        _ValueHeader(label: 'Возраст', value: '$start–$end'),
        const SizedBox(height: 8),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            activeTrackColor: DateasyColors.lime,
            inactiveTrackColor: Colors.white.withValues(alpha: 0.1),
            thumbColor: DateasyColors.lime,
            overlayColor: DateasyColors.lime.withValues(alpha: 0.16),
            rangeThumbShape: const RoundRangeSliderThumbShape(
              enabledThumbRadius: 8,
            ),
            rangeTrackShape: const RoundedRectRangeSliderTrackShape(),
          ),
          child: RangeSlider(
            min: 18,
            max: 99,
            values: value,
            onChanged: (next) {
              if (next.end - next.start < 1) return;
              onChanged(next);
            },
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _ValueBox(value: '$start')),
            const SizedBox(width: 8),
            Expanded(child: _ValueBox(value: '$end')),
          ],
        ),
      ],
    );
  }
}

class _DistanceSection extends StatelessWidget {
  const _DistanceSection({
    required this.value,
    required this.onChanged,
  });

  final double value;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _ValueHeader(label: 'Расстояние', value: '${value.round()} км'),
        const SizedBox(height: 8),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            activeTrackColor: DateasyColors.lime,
            inactiveTrackColor: Colors.white.withValues(alpha: 0.12),
            thumbColor: DateasyColors.lime,
            overlayColor: DateasyColors.lime.withValues(alpha: 0.16),
            trackHeight: 3,
          ),
          child: Slider(
            min: 1,
            max: 500,
            value: value,
            onChanged: onChanged,
          ),
        ),
      ],
    );
  }
}

class _ChipSection extends StatelessWidget {
  const _ChipSection({
    required this.title,
    required this.items,
    required this.active,
    required this.onTap,
    required this.activeTextColor,
    this.activeGradient,
    this.activeColor,
  });

  final String title;
  final List<String> items;
  final Set<String> active;
  final ValueChanged<String> onTap;
  final Color activeTextColor;
  final Gradient? activeGradient;
  final Color? activeColor;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: title,
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: items.map((item) {
          final selected = active.contains(item);
          return GestureDetector(
            onTap: () => onTap(item),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                gradient: selected ? activeGradient : null,
                color: selected
                    ? activeColor
                    : DateasyColors.glass.withValues(alpha: 0.9),
                border:
                    selected ? null : Border.all(color: DateasyColors.border),
              ),
              child: Text(
                item,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color:
                          selected ? activeTextColor : DateasyColors.foreground,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                    ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _FilterToggles extends StatelessWidget {
  const _FilterToggles({
    required this.verifiedOnly,
    required this.frendlyPlusOnly,
    required this.onlineOnly,
    required this.newThisWeekOnly,
    required this.onVerified,
    required this.onFrendlyPlus,
    required this.onOnline,
    required this.onNewThisWeek,
  });

  final bool verifiedOnly;
  final bool frendlyPlusOnly;
  final bool onlineOnly;
  final bool newThisWeekOnly;
  final VoidCallback onVerified;
  final VoidCallback onFrendlyPlus;
  final VoidCallback onOnline;
  final VoidCallback onNewThisWeek;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: DateasyColors.glass,
        border: Border.all(color: DateasyColors.border),
      ),
      child: Column(
        children: [
          _ToggleRow(
            label: 'Только верифицированные',
            subtitle: 'Профили с галочкой Frendly',
            value: verifiedOnly,
            onTap: onVerified,
          ),
          const _ToggleDivider(),
          _ToggleRow(
            label: 'Только Frendly+',
            subtitle: 'Подписчики премиум',
            value: frendlyPlusOnly,
            onTap: onFrendlyPlus,
          ),
          const _ToggleDivider(),
          _ToggleRow(
            label: 'Онлайн сейчас',
            subtitle: 'Активны последние 15 минут',
            value: onlineOnly,
            onTap: onOnline,
          ),
          const _ToggleDivider(),
          _ToggleRow(
            label: 'Новые на этой неделе',
            subtitle: 'Анкеты, появившиеся за 7 дней',
            value: newThisWeekOnly,
            onTap: onNewThisWeek,
          ),
        ],
      ),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.label,
    required this.subtitle,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String subtitle;
  final bool value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 11,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            _Switch(value: value),
          ],
        ),
      ),
    );
  }
}

class _Switch extends StatelessWidget {
  const _Switch({required this.value});

  final bool value;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 80),
      curve: Curves.easeOutCubic,
      width: 48,
      height: 28,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        gradient: value ? dateasyLimeGradient : null,
        color: value ? null : DateasyColors.surface2,
        border: value ? null : Border.all(color: DateasyColors.border),
      ),
      child: AnimatedAlign(
        duration: const Duration(milliseconds: 80),
        curve: Curves.easeOutCubic,
        alignment: value ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          width: 20,
          height: 20,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: DateasyColors.background,
          ),
        ),
      ),
    );
  }
}

class _ToggleDivider extends StatelessWidget {
  const _ToggleDivider();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 1,
      color: Colors.white.withValues(alpha: 0.1),
    );
  }
}

class _StickyAction extends StatelessWidget {
  const _StickyAction({
    required this.bottomPadding,
    required this.onApply,
  });

  final double bottomPadding;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.transparent,
            DateasyColors.background,
            DateasyColors.background,
          ],
        ),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 28, 20, bottomPadding + 18),
        child: GestureDetector(
          onTap: onApply,
          child: Container(
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: dateasyLimeGradient,
              boxShadow: const [
                BoxShadow(
                  color: Color(0x55BEFF67),
                  blurRadius: 26,
                  offset: Offset(0, 12),
                ),
              ],
            ),
            child: Text(
              'Применить фильтры',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: DateasyColors.backgroundDeep,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
        ),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.muted,
                fontWeight: FontWeight.w500,
              ),
        ),
        const SizedBox(height: 10),
        child,
      ],
    );
  }
}

class _ValueHeader extends StatelessWidget {
  const _ValueHeader({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.muted,
              ),
        ),
        const Spacer(),
        Text(
          value,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
      ],
    );
  }
}

class _ValueBox extends StatelessWidget {
  const _ValueBox({required this.value});

  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 42,
      alignment: Alignment.centerLeft,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: DateasyColors.glass,
        border: Border.all(color: DateasyColors.border),
      ),
      child: Text(
        value,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _SegmentButton extends StatelessWidget {
  const _SegmentButton({
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
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: active ? dateasyLimeGradient : null,
          color: active ? null : DateasyColors.glass,
          border: active ? null : Border.all(color: DateasyColors.border),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: DateasyColors.lime.withValues(alpha: 0.18),
                    blurRadius: 22,
                    offset: const Offset(0, 10),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: active
                    ? DateasyColors.backgroundDeep
                    : DateasyColors.foreground,
                fontWeight: FontWeight.w600,
              ),
        ),
      ),
    );
  }
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: DateasyColors.glass,
          border: Border.all(color: DateasyColors.border),
        ),
        child: Icon(icon, size: 20, color: DateasyColors.foreground),
      ),
    );
  }
}

const _genders = ['Девушки', 'Парни', 'Все'];
const _goals = ['Дружба', 'Свидание', 'Серьёзно', 'Networking', 'Тусовки'];
const _vibesList = [
  'Спокойный',
  'Творческий',
  'Активный',
  'Тусовщик',
  'Интеллект',
];

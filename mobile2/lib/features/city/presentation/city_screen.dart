import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';

const _popularCities = [
  'Москва',
  'Санкт-Петербург',
  'Дубай',
  'Тбилиси',
  'Алматы',
  'Берлин',
  'Ереван',
  'Лиссабон',
];

const _allCities = [
  'Москва',
  'Санкт-Петербург',
  'Сочи',
  'Казань',
  'Екатеринбург',
  'Новосибирск',
  'Дубай',
  'Стамбул',
  'Тбилиси',
  'Ереван',
  'Бишкек',
  'Алматы',
  'Ташкент',
  'Белград',
  'Берлин',
  'Лиссабон',
  'Барселона',
  'Париж',
  'Лондон',
  'Нью-Йорк',
];

class CityScreen extends ConsumerStatefulWidget {
  const CityScreen({super.key});

  @override
  ConsumerState<CityScreen> createState() => _CityScreenState();
}

class _CityScreenState extends ConsumerState<CityScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _query = '';
  String _selectedCity = 'Москва';
  bool _hydrated = false;
  bool _saving = false;
  String? _error;

  List<String> get _filteredCities {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) {
      return _allCities;
    }

    return _allCities
        .where((city) => city.toLowerCase().contains(query))
        .toList();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(ownProfileProvider).valueOrNull;
    final currentUser = ref.watch(currentUserProvider);
    final currentCity = profile?.city ?? currentUser?.city;
    if (!_hydrated && currentCity != null && currentCity.isNotEmpty) {
      _selectedCity = currentCity;
      _hydrated = true;
    }
    final filteredCities = _filteredCities;

    return DateasyPhoneFrame(
      child: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _CityHeader(
                saving: _saving,
                onClose: () => context.go('/'),
                onDone: _saveCity,
              ),
              const SizedBox(height: 16),
              _SearchField(
                controller: _searchController,
                onChanged: (value) => setState(() => _query = value),
              ),
              const SizedBox(height: 12),
              _AutoDetectButton(
                onTap: () => setState(
                  () => _error = 'Выбери город из списка',
                ),
              ),
              if (_error != null) _InlineState(text: _error!),
              if (_query.isEmpty) ...[
                const SizedBox(height: 20),
                _PopularCities(
                  selectedCity: _selectedCity,
                  onSelect: _selectCity,
                ),
              ],
              const SizedBox(height: 20),
              _AllCities(
                cities: filteredCities,
                selectedCity: _selectedCity,
                onSelect: _selectCity,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _selectCity(String city) {
    setState(() {
      _selectedCity = city;
      _error = null;
    });
  }

  Future<void> _saveCity() async {
    if (_saving) {
      return;
    }
    if (_selectedCity.trim().isEmpty) {
      setState(() => _error = 'Выберите город');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(profileActionsProvider).updateCity(_selectedCity.trim());
      if (mounted) {
        context.go('/');
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = 'Не удалось сохранить город';
        });
      }
    }
  }
}

class _CityHeader extends StatelessWidget {
  const _CityHeader({
    required this.saving,
    required this.onClose,
    required this.onDone,
  });

  final bool saving;
  final VoidCallback onClose;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Row(
        children: [
          _GlassIconButton(
            icon: LucideIcons.chevronLeft,
            onTap: onClose,
          ),
          Expanded(
            child: Center(
              child: Text(
                'Город',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: 'Sora',
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: saving ? null : onDone,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(
                      'Готово',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: DateasyColors.lime,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
            ),
          ),
        ],
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
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: DateasyColors.glass,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: DateasyColors.border),
        ),
        child: Icon(icon, size: 20, color: DateasyColors.foreground),
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.onChanged,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: DateasyColors.glass,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: DateasyColors.border),
        ),
        child: Row(
          children: [
            const SizedBox(width: 16),
            const Icon(
              LucideIcons.search,
              size: 16,
              color: DateasyColors.muted,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: controller,
                onChanged: onChanged,
                cursorColor: DateasyColors.lime,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontSize: 14,
                      color: DateasyColors.foreground,
                    ),
                decoration: InputDecoration(
                  isDense: true,
                  border: InputBorder.none,
                  hintText: 'Найти город',
                  hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontSize: 14,
                        color: DateasyColors.muted,
                      ),
                ),
              ),
            ),
            const SizedBox(width: 16),
          ],
        ),
      ),
    );
  }
}

class _AutoDetectButton extends StatelessWidget {
  const _AutoDetectButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: DateasyColors.glass,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: DateasyColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: dateasyLimeGradient,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  LucideIcons.navigation,
                  size: 16,
                  color: DateasyColors.backgroundDeep,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Определить автоматически',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontSize: 14,
                        color: DateasyColors.foreground,
                      ),
                ),
              ),
              Text(
                'GPS',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontSize: 12,
                      color: DateasyColors.muted,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InlineState extends StatelessWidget {
  const _InlineState({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.muted,
            ),
      ),
    );
  }
}

class _PopularCities extends StatelessWidget {
  const _PopularCities({
    required this.selectedCity,
    required this.onSelect,
  });

  final String selectedCity;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionLabel('Популярные'),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final city in _popularCities)
                _CityChip(
                  city: city,
                  selected: selectedCity == city,
                  onTap: () => onSelect(city),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CityChip extends StatelessWidget {
  const _CityChip({
    required this.city,
    required this.selected,
    required this.onTap,
  });

  final String city;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? DateasyColors.lime : DateasyColors.glass,
          borderRadius: BorderRadius.circular(999),
          border: selected ? null : Border.all(color: DateasyColors.border),
        ),
        child: Text(
          city,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontSize: 14,
                color: selected
                    ? DateasyColors.backgroundDeep
                    : DateasyColors.foreground,
                fontWeight: selected ? FontWeight.w600 : null,
              ),
        ),
      ),
    );
  }
}

class _AllCities extends StatelessWidget {
  const _AllCities({
    required this.cities,
    required this.selectedCity,
    required this.onSelect,
  });

  final List<String> cities;
  final String selectedCity;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionLabel('Все города'),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: DateasyColors.glass,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: DateasyColors.border),
            ),
            clipBehavior: Clip.antiAlias,
            child: cities.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 24,
                    ),
                    child: Center(
                      child: Text(
                        'Ничего не найдено',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: DateasyColors.muted,
                              fontSize: 14,
                            ),
                      ),
                    ),
                  )
                : Column(
                    children: [
                      for (var index = 0; index < cities.length; index++) ...[
                        _CityRow(
                          city: cities[index],
                          selected: selectedCity == cities[index],
                          onTap: () => onSelect(cities[index]),
                        ),
                        if (index != cities.length - 1)
                          const Divider(
                            height: 1,
                            thickness: 1,
                            color: Color(0x0DFFFFFF),
                          ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _CityRow extends StatelessWidget {
  const _CityRow({
    required this.city,
    required this.selected,
    required this.onTap,
  });

  final String city;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            const Icon(
              LucideIcons.mapPin,
              size: 16,
              color: DateasyColors.muted,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                city,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontSize: 14,
                      color: DateasyColors.foreground,
                    ),
              ),
            ),
            if (selected)
              const Icon(
                LucideIcons.check,
                size: 16,
                color: DateasyColors.lime,
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
            letterSpacing: 1.1,
          ),
    );
  }
}

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
import 'package:url_launcher/url_launcher.dart';

class PerksScreen extends StatefulWidget {
  const PerksScreen({super.key});

  @override
  State<PerksScreen> createState() => _PerksScreenState();
}

class _PerksScreenState extends State<PerksScreen> {
  String? _category;

  void _selectCategory(_PerkCategory category) {
    setState(() {
      _category = _category == category.query ? null : category.query;
    });
  }

  Future<void> _claim(_PerkItem item) async {
    if (item.bookingUrl != null) {
      final opened = await launchUrl(
        Uri.parse(item.bookingUrl!),
        mode: LaunchMode.externalApplication,
      );
      if (opened) {
        return;
      }
    }
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(item.title),
            Text(
              item.bookingUrl == null
                  ? 'Backend не отдает claim endpoint для этого перка'
                  : 'Не удалось открыть ссылку',
              style: const TextStyle(fontSize: 12),
            ),
          ],
        ),
        behavior: SnackBarBehavior.floating,
        backgroundColor: DateasyColors.surface2,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Consumer(
        builder: (context, ref, _) {
          final perksState = ref.watch(perksByCategoryProvider(_category));
          final perks = perksState.valueOrNull?.items
                  .map(_PerkItem.fromBackend)
                  .where((item) => item.id.isNotEmpty)
                  .toList(growable: false) ??
              const <_PerkItem>[];
          final groups = _groupPerks(perks);
          final first = perks.isEmpty ? null : perks.first;
          return ListView(
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 16,
              bottom: 42,
            ),
            children: [
              const _Header(),
              const _HeroCopy(),
              const _SearchLink(),
              _CategoryRail(
                selected: _category,
                onSelected: _selectCategory,
              ),
              if (perksState.isLoading && perks.isEmpty)
                const _PerksStatus(message: 'Загружаем perks')
              else if (first == null)
                _PerksStatus(
                  message: perksState.hasError
                      ? 'Не удалось загрузить perks'
                      : 'Сейчас нет доступных perks',
                )
              else ...[
                _HeroPerk(item: first, onClaim: () => _claim(first)),
                for (final group in groups)
                  _PerkGroup(group: group, onClaim: _claim),
              ],
              const _PlusCard(),
            ],
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _GlassIconButton(
            icon: LucideIcons.chevronLeft,
            onTap: () => context.go('/'),
          ),
          Text(
            'Perks',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
          ),
          _GlassIconButton(
            icon: LucideIcons.percent,
            onTap: () => context.go('/wallet'),
          ),
        ],
      ),
    );
  }
}

class _HeroCopy extends StatelessWidget {
  const _HeroCopy();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                'Бонусы',
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                      fontSize: 30,
                      height: 1.08,
                      fontWeight: FontWeight.w600,
                    ),
              ),
              DateasyHeadlineHighlight(
                text: 'по городу',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontSize: 30,
                      height: 1.08,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Скидки и подарки для встреч Frendly',
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

class _SearchLink extends StatelessWidget {
  const _SearchLink();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: GestureDetector(
        onTap: () => context.go('/search'),
        child: const _GlassPanel(
          borderRadius: 16,
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Icon(LucideIcons.search, size: 16, color: DateasyColors.muted),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Найти место',
                  style: TextStyle(
                    color: DateasyColors.muted,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              Icon(LucideIcons.mapPin, size: 16, color: DateasyColors.lime),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryRail extends StatelessWidget {
  const _CategoryRail({
    required this.selected,
    required this.onSelected,
  });

  final String? selected;
  final ValueChanged<_PerkCategory> onSelected;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Row(
        children: [
          for (var index = 0; index < _categories.length; index++) ...[
            _CategoryChip(
              category: _categories[index],
              active: selected == _categories[index].query,
              onTap: () => onSelected(_categories[index]),
            ),
            if (index != _categories.length - 1) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.category,
    required this.active,
    required this.onTap,
  });

  final _PerkCategory category;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        borderColor:
            active ? DateasyColors.lime : Colors.white.withValues(alpha: 0.1),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                gradient: category.gradient,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                category.icon,
                size: 15,
                color: category.foreground,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              category.title,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontSize: 14,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroPerk extends StatelessWidget {
  const _HeroPerk({
    required this.item,
    required this.onClaim,
  });

  final _PerkItem item;
  final VoidCallback onClaim;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: SizedBox(
          height: 160,
          child: Stack(
            fit: StackFit.expand,
            children: [
              DateasyRemoteImage(
                imageUrl: item.imageUrl,
                usage: DateasyImageUsage.hero,
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      DateasyColors.background,
                      Color(0x33000000),
                      Color(0x00000000),
                    ],
                  ),
                ),
              ),
              Positioned(
                left: 12,
                right: 12,
                bottom: 12,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 9,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              gradient: dateasyPinkGradient,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              item.offer,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: DateasyColors.foreground,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            item.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                  color: DateasyColors.foreground,
                                  fontSize: 18,
                                  height: 1.12,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    _ClaimButton(onTap: onClaim),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PerkGroup extends StatelessWidget {
  const _PerkGroup({
    required this.group,
    required this.onClaim,
  });

  final _PerkGroupData group;
  final Future<void> Function(_PerkItem item) onClaim;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 2, bottom: 8),
            child: Text(
              group.title.toUpperCase(),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 12,
                    letterSpacing: 1.1,
                  ),
            ),
          ),
          for (var index = 0; index < group.items.length; index++) ...[
            _PerkRow(
              item: group.items[index],
              onClaim: () => onClaim(group.items[index]),
            ),
            if (index != group.items.length - 1) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _PerkRow extends StatelessWidget {
  const _PerkRow({
    required this.item,
    required this.onClaim,
  });

  final _PerkItem item;
  final VoidCallback onClaim;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 16,
      padding: EdgeInsets.zero,
      child: Row(
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.horizontal(
              left: Radius.circular(16),
            ),
            child: SizedBox(
              width: 80,
              height: 80,
              child: DateasyRemoteImage(
                imageUrl: item.imageUrl,
                usage: DateasyImageUsage.card,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 3),
                Text(
                  item.offer,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.lime,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  item.condition,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 11,
                      ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: _ClaimButton(onTap: onClaim),
          ),
        ],
      ),
    );
  }
}

class _ClaimButton extends StatelessWidget {
  const _ClaimButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          gradient: dateasyLimeGradient,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          'Забрать',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: DateasyColors.backgroundDeep,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
        ),
      ),
    );
  }
}

class _PlusCard extends StatelessWidget {
  const _PlusCard();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: GestureDetector(
        onTap: () => context.go('/paywall'),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: dateasyPinkGradient,
            borderRadius: BorderRadius.circular(24),
            boxShadow: const [
              BoxShadow(
                color: Color(0x55FF639F),
                blurRadius: 28,
                spreadRadius: -14,
                offset: Offset(0, 16),
              ),
            ],
          ),
          child: Row(
            children: [
              const Icon(
                LucideIcons.sparkles,
                color: DateasyColors.foreground,
                size: 22,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'С Plus — все perks без лимита',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.foreground,
                        fontSize: 14,
                      ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: DateasyColors.background.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'Открыть',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.foreground,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ],
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
      child: _GlassPanel(
        borderRadius: 16,
        padding: EdgeInsets.zero,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(icon, size: 20),
        ),
      ),
    );
  }
}

class _GlassPanel extends StatelessWidget {
  const _GlassPanel({
    required this.child,
    required this.borderRadius,
    required this.padding,
    this.borderColor,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(
          color: borderColor ?? Colors.white.withValues(alpha: 0.1),
        ),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class _PerkCategory {
  const _PerkCategory({
    required this.title,
    required this.query,
    required this.icon,
    required this.gradient,
    this.foreground = DateasyColors.backgroundDeep,
  });

  final String title;
  final String query;
  final IconData icon;
  final LinearGradient gradient;
  final Color foreground;
}

class _PerkGroupData {
  const _PerkGroupData({
    required this.title,
    required this.items,
  });

  final String title;
  final List<_PerkItem> items;
}

class _PerkItem {
  const _PerkItem({
    required this.id,
    required this.title,
    required this.offer,
    required this.condition,
    required this.group,
    this.imageUrl,
    this.bookingUrl,
  });

  final String id;
  final String title;
  final String offer;
  final String condition;
  final String group;
  final String? imageUrl;
  final String? bookingUrl;

  factory _PerkItem.fromBackend(BackendCardItem item) {
    final raw = item.raw;
    return _PerkItem(
      id: item.id,
      title: item.title.isEmpty ? 'Перк' : item.title,
      offer: item.subtitle ?? _stringOrNull(raw['description']) ?? 'Перк',
      condition: _stringOrNull(
            raw['validUntil'] ??
                raw['address'] ??
                raw['city'] ??
                raw['provider'],
          ) ??
          'Условия уточняются у партнера',
      group: _stringOrNull(raw['placeCategory'] ?? raw['placeKind']) ??
          item.city ??
          'Perks',
      imageUrl: item.imageUrl,
      bookingUrl: _stringOrNull(raw['bookingUrl']),
    );
  }

  bool matches(String category) {
    final needle = category.toLowerCase();
    return group.toLowerCase().contains(needle) ||
        title.toLowerCase().contains(needle) ||
        offer.toLowerCase().contains(needle);
  }
}

const _categories = [
  _PerkCategory(
    title: 'Кофе',
    query: 'cafe',
    icon: LucideIcons.coffee,
    gradient: dateasyLimeGradient,
  ),
  _PerkCategory(
    title: 'Бары',
    query: 'bar',
    icon: LucideIcons.wine,
    gradient: dateasyPinkGradient,
    foreground: DateasyColors.foreground,
  ),
  _PerkCategory(
    title: 'Кино',
    query: 'cinema',
    icon: LucideIcons.ticket,
    gradient: LinearGradient(colors: [DateasyColors.lilac, Color(0xFFE6B6FF)]),
  ),
  _PerkCategory(
    title: 'Еда',
    query: 'restaurant',
    icon: LucideIcons.pizza,
    gradient: dateasyLimeGradient,
  ),
  _PerkCategory(
    title: 'Музыка',
    query: 'music',
    icon: LucideIcons.music2,
    gradient: dateasyPinkGradient,
    foreground: DateasyColors.foreground,
  ),
];

List<_PerkGroupData> _groupPerks(List<_PerkItem> items) {
  final grouped = <String, List<_PerkItem>>{};
  for (final item in items) {
    grouped.putIfAbsent(item.group, () => []).add(item);
  }
  return grouped.entries
      .map((entry) => _PerkGroupData(title: entry.key, items: entry.value))
      .toList(growable: false);
}

class _PerksStatus extends StatelessWidget {
  const _PerksStatus({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
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

String? _stringOrNull(Object? value) {
  final result = value?.toString();
  if (result == null || result.isEmpty) {
    return null;
  }
  return result;
}

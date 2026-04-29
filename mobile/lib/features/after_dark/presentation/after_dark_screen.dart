import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_models.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_providers.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_style.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AfterDarkScreen extends ConsumerStatefulWidget {
  const AfterDarkScreen({super.key});

  @override
  ConsumerState<AfterDarkScreen> createState() => _AfterDarkScreenState();
}

class _AfterDarkScreenState extends ConsumerState<AfterDarkScreen> {
  String _category = 'all';
  String _query = '';

  static const _categoryOrder = ['nightlife', 'dating', 'wellness', 'kink'];

  static const _categoryMeta =
      <String, ({String label, String emoji, String blurb})>{
    'nightlife': (
      label: 'Найтлайф',
      emoji: '🌃',
      blurb: 'Бары, клубы, after-hours',
    ),
    'dating': (
      label: 'Свидания',
      emoji: '💋',
      blurb: 'Speed dating, blind dinner',
    ),
    'wellness': (
      label: 'Wellness 18+',
      emoji: '♨️',
      blurb: 'Сауны, термы, body-positive',
    ),
    'kink': (
      label: 'Inner Circle',
      emoji: '🖤',
      blurb: 'Closed play, kink-friendly',
    ),
  };

  @override
  Widget build(BuildContext context) {
    final eventsAsync = ref.watch(afterDarkEventsProvider);

    return Scaffold(
      backgroundColor: AppColors.adBg,
      body: Stack(
        children: [
          const _AfterDarkAmbientGlow(),
          SafeArea(
            bottom: false,
            child: Column(
              children: [
                const _AfterDarkTopBar(),
                Expanded(
                  child: eventsAsync.when(
                    data: (events) {
                      final filtered = _filterEvents(events);
                      return _AfterDarkContent(
                        filtered: filtered,
                        category: _category,
                        categoryOrder: _categoryOrder,
                        categoryMeta: _categoryMeta,
                        onQueryChanged: (value) {
                          setState(() => _query = value.trim().toLowerCase());
                        },
                        onCategoryChanged: (value) {
                          setState(() => _category = value);
                        },
                      );
                    },
                    loading: () => const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.adMagenta,
                      ),
                    ),
                    error: (_, __) => Center(
                      child: Text(
                        'Не получилось загрузить After Dark',
                        style: AppTextStyles.body.copyWith(
                          color: AppColors.adFgSoft,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<AfterDarkEvent> _filterEvents(List<AfterDarkEvent> events) {
    final query = _query.toLowerCase();
    return events.where((event) {
      if (_category != 'all' && event.category != _category) {
        return false;
      }
      if (query.isNotEmpty &&
          !event.title.toLowerCase().contains(query) &&
          !event.district.toLowerCase().contains(query)) {
        return false;
      }
      return true;
    }).toList(growable: false);
  }
}

class _AfterDarkAmbientGlow extends StatelessWidget {
  const _AfterDarkAmbientGlow();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        children: [
          Positioned(
            top: -80,
            right: -44,
            child: _GlowOrb(
              color: AppColors.adMagenta.withValues(alpha: 0.22),
              size: 240,
            ),
          ),
          Positioned(
            top: 320,
            left: -100,
            child: _GlowOrb(
              color: AppColors.adViolet.withValues(alpha: 0.18),
              size: 288,
            ),
          ),
        ],
      ),
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({
    required this.color,
    required this.size,
  });

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
        boxShadow: [
          BoxShadow(
            color: color,
            blurRadius: 88,
            spreadRadius: 18,
          ),
        ],
      ),
    );
  }
}

class _AfterDarkTopBar extends StatelessWidget {
  const _AfterDarkTopBar();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 3, 16, 12),
      child: SizedBox(
        height: 40,
        child: Row(
          children: [
            _IconHitTarget(
              onTap: () => Navigator.of(context).maybePop(),
              child: const Icon(
                LucideIcons.chevron_left,
                size: 24,
                color: AppColors.adFg,
              ),
            ),
            Expanded(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    LucideIcons.moon,
                    size: 16,
                    color: AppColors.adMagenta,
                  ),
                  const SizedBox(width: 6),
                  ShaderMask(
                    shaderCallback: (bounds) => const LinearGradient(
                      colors: [AppColors.neonStart, AppColors.neonEnd],
                    ).createShader(bounds),
                    blendMode: BlendMode.srcIn,
                    child: Text(
                      'AFTER DARK',
                      style: AppTextStyles.itemTitle.copyWith(
                        color: AppColors.adFg,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            _IconHitTarget(
              onTap: () => context.pushRoute(AppRoute.afterDarkVerify),
              child: const Icon(
                LucideIcons.shield_check,
                size: 22,
                color: AppColors.adCyan,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _IconHitTarget extends StatelessWidget {
  const _IconHitTarget({
    required this.child,
    this.onTap,
  });

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: SizedBox(
        width: 40,
        height: 40,
        child: Center(child: child),
      ),
    );
  }
}

class _AfterDarkContent extends StatelessWidget {
  const _AfterDarkContent({
    required this.filtered,
    required this.category,
    required this.categoryOrder,
    required this.categoryMeta,
    required this.onQueryChanged,
    required this.onCategoryChanged,
  });

  final List<AfterDarkEvent> filtered;
  final String category;
  final List<String> categoryOrder;
  final Map<String, ({String label, String emoji, String blurb})> categoryMeta;
  final ValueChanged<String> onQueryChanged;
  final ValueChanged<String> onCategoryChanged;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      LucideIcons.sparkles,
                      size: 12,
                      color: AppColors.adGold,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'СЕГОДНЯ НОЧЬЮ',
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.adFgMute,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        '${filtered.length} приватных события',
                        style: AppTextStyles.screenTitle.copyWith(
                          color: AppColors.adFg,
                          fontSize: 26,
                          fontWeight: FontWeight.w600,
                          height: 1.05,
                          letterSpacing: 0,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    _CreateAfterDarkButton(
                      onTap: () => context.pushRoute(
                        AppRoute.createMeetup,
                        queryParameters: const {'mode': 'afterdark'},
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: _AfterDarkSearchField(
              onChanged: onQueryChanged,
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 16, bottom: 20),
            child: _CategoryStrip(
              category: category,
              categoryOrder: categoryOrder,
              categoryMeta: categoryMeta,
              onCategoryChanged: onCategoryChanged,
            ),
          ),
        ),
        if (category != 'all')
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: _CategoryDescriptor(
                label: categoryMeta[category]?.label ?? category,
                blurb: categoryMeta[category]?.blurb ?? '',
              ),
            ),
          ),
        if (filtered.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(
              child: Text(
                'Ничего не нашлось, попробуй другую категорию',
                style: AppTextStyles.body.copyWith(
                  color: AppColors.adFgMute,
                  fontSize: 13,
                ),
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  if (index.isOdd) {
                    return const SizedBox(height: 14);
                  }
                  return _AfterDarkCard(event: filtered[index ~/ 2]);
                },
                childCount: filtered.length * 2 - 1,
              ),
            ),
          ),
        if (filtered.isNotEmpty)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(20, 32, 20, 40),
              child: _SafetyFooter(),
            ),
          ),
      ],
    );
  }
}

class _CreateAfterDarkButton extends StatelessWidget {
  const _CreateAfterDarkButton({
    required this.onTap,
  });

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: [AppColors.neonStart, AppColors.neonEnd],
          ),
          borderRadius: BorderRadius.circular(999),
          boxShadow: _neonShadow,
        ),
        child: Text(
          'Создать 18+',
          style: AppTextStyles.meta.copyWith(
            color: AppColors.adFg,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _AfterDarkSearchField extends StatelessWidget {
  const _AfterDarkSearchField({
    required this.onChanged,
  });

  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.adSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.adBorder),
      ),
      child: Row(
        children: [
          const Icon(
            LucideIcons.search,
            size: 18,
            color: AppColors.adFgMute,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              onChanged: onChanged,
              cursorColor: AppColors.adMagenta,
              style: AppTextStyles.bodySoft.copyWith(
                color: AppColors.adFg,
                fontSize: 14,
              ),
              decoration: InputDecoration.collapsed(
                hintText: 'Найти событие или место',
                hintStyle: AppTextStyles.bodySoft.copyWith(
                  color: AppColors.adFgMute,
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryStrip extends StatelessWidget {
  const _CategoryStrip({
    required this.category,
    required this.categoryOrder,
    required this.categoryMeta,
    required this.onCategoryChanged,
  });

  final String category;
  final List<String> categoryOrder;
  final Map<String, ({String label, String emoji, String blurb})> categoryMeta;
  final ValueChanged<String> onCategoryChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 37,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          if (index == 0) {
            return _CategoryChip(
              active: category == 'all',
              label: 'Все',
              onTap: () => onCategoryChanged('all'),
            );
          }

          final key = categoryOrder[index - 1];
          final meta = categoryMeta[key]!;
          return _CategoryChip(
            active: category == key,
            label: '${meta.emoji} ${meta.label}',
            onTap: () => onCategoryChanged(key),
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: categoryOrder.length + 1,
      ),
    );
  }
}

class _CategoryDescriptor extends StatelessWidget {
  const _CategoryDescriptor({
    required this.label,
    required this.blurb,
  });

  final String label;
  final String blurb;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.adVioletSoft.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.adViolet.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTextStyles.caption.copyWith(
              color: AppColors.adViolet,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            blurb,
            style: AppTextStyles.meta.copyWith(
              color: AppColors.adFgSoft,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class _AfterDarkCard extends StatelessWidget {
  const _AfterDarkCard({
    required this.event,
  });

  final AfterDarkEvent event;

  @override
  Widget build(BuildContext context) {
    final glowColor = afterDarkGlowColor(event.glow);
    final priceLabel = _priceLabel(event.priceFrom);

    return InkWell(
      onTap: () => context.pushRoute(
        AppRoute.afterDarkEvent,
        pathParameters: {'eventId': event.id},
      ),
      borderRadius: BorderRadius.circular(24),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: AppColors.adSurface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.adBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 128,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: AppColors.adSurface,
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: _glowGradient(event.glow),
                        ),
                      ),
                    ),
                  ),
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          center: const Alignment(0.4, -0.4),
                          radius: 0.85,
                          colors: [
                            AppColors.adMagenta.withValues(alpha: 0.25),
                            Colors.transparent,
                          ],
                          stops: const [0, 0.72],
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 20,
                    top: 16,
                    child: Text(
                      event.emoji,
                      style: TextStyle(
                        fontSize: 44,
                        height: 1,
                        shadows: [
                          Shadow(
                            color: AppColors.adMagenta.withValues(alpha: 0.6),
                            blurRadius: 18,
                          ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    right: 20,
                    top: 28,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const _CardPill(label: '18+', bold: true),
                        if (priceLabel != null) ...[
                          const SizedBox(height: 8),
                          _CardPill(label: priceLabel),
                        ],
                      ],
                    ),
                  ),
                  Positioned(
                    left: 20,
                    right: 20,
                    bottom: 14,
                    child: Row(
                      children: [
                        Icon(
                          LucideIcons.clock_3,
                          size: 14,
                          color: AppColors.adFg.withValues(alpha: 0.85),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          event.time,
                          style: AppTextStyles.meta.copyWith(
                            color: AppColors.adFg.withValues(alpha: 0.85),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          event.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.cardTitle.copyWith(
                            color: AppColors.adFg,
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            height: 1.2,
                            letterSpacing: 0,
                          ),
                        ),
                      ),
                      if (event.hostVerified) ...[
                        const SizedBox(width: 8),
                        Icon(
                          LucideIcons.shield_check,
                          size: 16,
                          color: glowColor,
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(
                        LucideIcons.map_pin,
                        size: 14,
                        color: AppColors.adFgSoft,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          _locationLabel(event),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.meta.copyWith(
                            color: AppColors.adFgSoft,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      _FactChip(
                        icon: LucideIcons.users,
                        label: '${event.going}/${event.capacity}',
                      ),
                      _FactChip(label: event.ageRange),
                      _FactChip(label: event.ratio),
                      if (event.consentRequired)
                        const _FactChip(
                          icon: LucideIcons.lock,
                          label: 'Apply',
                          backgroundColor: AppColors.adMagentaSoft,
                          foregroundColor: AppColors.adMagenta,
                          borderColor: AppColors.adMagenta,
                        ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Container(height: 1, color: AppColors.adBorder),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          event.dressCode.toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.meta.copyWith(
                            color: glowColor,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        'Подробнее',
                        style: AppTextStyles.meta.copyWith(
                          color: AppColors.adFg,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Icon(
                        LucideIcons.arrow_right,
                        size: 16,
                        color: AppColors.adFg,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CardPill extends StatelessWidget {
  const _CardPill({
    required this.label,
    this.bold = false,
  });

  final String label;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.adBg.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: AppTextStyles.caption.copyWith(
          color: AppColors.adFg,
          fontSize: bold ? 10 : 11,
          fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
          letterSpacing: bold ? 1 : 0,
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.active,
    required this.label,
    required this.onTap,
  });

  final bool active;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          gradient: active
              ? const LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [AppColors.neonStart, AppColors.neonEnd],
                )
              : null,
          color: active ? null : AppColors.adSurface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active ? Colors.transparent : AppColors.adBorder,
          ),
          boxShadow: active ? _neonShadow : null,
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTextStyles.meta.copyWith(
            color: active ? AppColors.adFg : AppColors.adFgSoft,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _FactChip extends StatelessWidget {
  const _FactChip({
    required this.label,
    this.icon,
    this.backgroundColor = AppColors.adSurfaceElev,
    this.foregroundColor = AppColors.adFgSoft,
    this.borderColor = AppColors.adBorder,
  });

  final String label;
  final IconData? icon;
  final Color backgroundColor;
  final Color foregroundColor;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    final iconData = icon;

    return Container(
      height: 28,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: borderColor.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (iconData != null) ...[
            Icon(iconData, size: 12, color: foregroundColor),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: foregroundColor,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _SafetyFooter extends StatelessWidget {
  const _SafetyFooter();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.adSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.adBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                LucideIcons.shield_check,
                size: 16,
                color: AppColors.adCyan,
              ),
              const SizedBox(width: 8),
              Text(
                'Кодекс After Dark',
                style: AppTextStyles.itemTitle.copyWith(
                  color: AppColors.adFg,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Consent first. Никакой съёмки. Один репорт равно немедленная блокировка. Awareness team дежурит на каждом ивенте.',
            style: AppTextStyles.meta.copyWith(
              color: AppColors.adFgSoft,
              fontSize: 12,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}

List<Color> _glowGradient(String glow) {
  switch (glow) {
    case 'violet':
      return [
        AppColors.adViolet.withValues(alpha: 0.45),
        AppColors.adMagenta.withValues(alpha: 0.15),
      ];
    case 'cyan':
      return [
        AppColors.adCyan.withValues(alpha: 0.3),
        AppColors.adViolet.withValues(alpha: 0.25),
      ];
    case 'gold':
      return [
        AppColors.adGold.withValues(alpha: 0.3),
        AppColors.adMagenta.withValues(alpha: 0.2),
      ];
    case 'magenta':
    default:
      return [
        AppColors.adMagenta.withValues(alpha: 0.4),
        AppColors.adViolet.withValues(alpha: 0.2),
      ];
  }
}

String? _priceLabel(int? priceFrom) {
  if (priceFrom == null) {
    return null;
  }
  if (priceFrom == 0) {
    return 'Free';
  }
  return 'от ${_formatGroupedNumber(priceFrom)} ₽';
}

String _formatGroupedNumber(int value) {
  final raw = value.toString();
  final buffer = StringBuffer();
  for (var i = 0; i < raw.length; i += 1) {
    final indexFromEnd = raw.length - i;
    buffer.write(raw[i]);
    if (indexFromEnd > 1 && indexFromEnd % 3 == 1) {
      buffer.write(' ');
    }
  }
  return buffer.toString();
}

String _locationLabel(AfterDarkEvent event) {
  final district =
      event.district == '—' ? 'Адрес за 4 ч до старта' : event.district;
  return '$district · ${event.distanceKm.toStringAsFixed(1)} км';
}

const _neonShadow = [
  BoxShadow(
    color: Color(0x73FF3EA5),
    blurRadius: 24,
    offset: Offset(0, 0),
    spreadRadius: -4,
  ),
  BoxShadow(
    color: Color(0x599962FF),
    blurRadius: 60,
    offset: Offset(0, 0),
    spreadRadius: -10,
  ),
];

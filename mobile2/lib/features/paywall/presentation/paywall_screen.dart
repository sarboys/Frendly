import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

class PaywallScreen extends ConsumerStatefulWidget {
  const PaywallScreen({super.key});

  @override
  ConsumerState<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends ConsumerState<PaywallScreen> {
  String? _selectedPlanId;
  bool _busy = false;
  String? _error;

  _Plan? _selectedPlan(List<_Plan> plans) {
    if (plans.isEmpty) {
      return null;
    }
    final defaultPlan = plans.length > 1 ? plans[1] : plans.first;
    final selectedId = _selectedPlanId;
    if (selectedId == null) {
      return defaultPlan;
    }
    return plans.firstWhere(
      (plan) => plan.id == selectedId,
      orElse: () => defaultPlan,
    );
  }

  @override
  Widget build(BuildContext context) {
    final wallet = ref.watch(tokenWalletProvider);
    final catalog = ref.watch(paymentsCatalogProvider);
    final planCatalog = ref.watch(subscriptionPlansProvider);
    final balance = wallet.valueOrNull?.balance ?? 0;
    final plans = planCatalog.valueOrNull
            ?.map(_Plan.fromBackend)
            .where((plan) => plan.ft > 0)
            .toList(growable: false) ??
        const <_Plan>[];
    final selectedPlan = _selectedPlan(plans);
    final catalogPerks = _perksFromCatalog(catalog.valueOrNull);
    final perks = selectedPlan?.perks.isNotEmpty == true
        ? selectedPlan!.perks
        : catalogPerks;
    final hasEnoughTokens = selectedPlan != null && balance >= selectedPlan.ft;

    return Scaffold(
      body: LayoutBuilder(
        builder: (context, constraints) {
          final width =
              constraints.maxWidth > 420 ? 420.0 : constraints.maxWidth;

          return Center(
            child: SizedBox(
              width: width,
              height: constraints.maxHeight,
              child: DecoratedBox(
                decoration: const BoxDecoration(gradient: dateasyHeroGradient),
                child: Stack(
                  children: [
                    const _GlowBlob(
                      alignment: Alignment(1.18, -1.12),
                      colorA: DateasyColors.lilac,
                      colorB: DateasyColors.pink,
                      opacity: 0.4,
                    ),
                    const _GlowBlob(
                      alignment: Alignment(-1.18, 1.2),
                      colorA: DateasyColors.lime,
                      colorB: DateasyColors.lime2,
                      opacity: 0.3,
                    ),
                    SafeArea(
                      child: CustomScrollView(
                        slivers: [
                          SliverPadding(
                            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                            sliver: SliverFillRemaining(
                              hasScrollBody: false,
                              child: Column(
                                children: [
                                  _TopBar(balance: balance),
                                  const _HeroBlock(),
                                  _PerkList(
                                    perks: perks,
                                    loading: catalog.isLoading,
                                    hasError: catalog.hasError,
                                  ),
                                  if (planCatalog.isLoading && plans.isEmpty)
                                    const _InlineState(
                                      text: 'Загружаем планы Plus',
                                    )
                                  else if (plans.isEmpty)
                                    _InlineState(
                                      text: planCatalog.hasError
                                          ? 'Не удалось загрузить планы Plus'
                                          : 'Backend пока не отдает планы Plus',
                                    )
                                  else
                                    _PlanList(
                                      plans: plans,
                                      selectedPlanId:
                                          selectedPlan?.id ?? plans.first.id,
                                      onSelect: (planId) => setState(
                                        () => _selectedPlanId = planId,
                                      ),
                                    ),
                                  const Spacer(),
                                  if (selectedPlan != null)
                                    _BottomCta(
                                      plan: selectedPlan,
                                      hasEnoughTokens: hasEnoughTokens,
                                      missingTokens: selectedPlan.ft - balance,
                                      busy: _busy,
                                      error: _error,
                                      onTap: () => _subscribe(
                                        selectedPlan,
                                        hasEnoughTokens,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _subscribe(_Plan plan, bool hasEnoughTokens) async {
    if (!hasEnoughTokens) {
      context.go('/wallet');
      return;
    }
    if (_busy) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(paymentActionsProvider).subscribeWithTokens(plan.id);
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Plus активирован'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: DateasyColors.surface2,
        ),
      );
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _busy = false;
        _error = 'Не удалось активировать Plus';
      });
    }
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.balance});

  final int balance;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        GestureDetector(
          onTap: () => context.go('/wallet'),
          child: _GlassPanel(
            borderRadius: 999,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  LucideIcons.coins,
                  size: 14,
                  color: DateasyColors.lime,
                ),
                const SizedBox(width: 6),
                Text(
                  '$balance FT',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ),
        ),
        const Spacer(),
        _GlassIconButton(
          icon: LucideIcons.x,
          onTap: () => context.go('/profile'),
        ),
      ],
    );
  }
}

class _HeroBlock extends StatelessWidget {
  const _HeroBlock();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              gradient: dateasyPinkGradient,
              borderRadius: BorderRadius.circular(24),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x55FF639F),
                  blurRadius: 30,
                  spreadRadius: -12,
                  offset: Offset(0, 16),
                ),
              ],
            ),
            child: const Icon(
              LucideIcons.crown,
              color: DateasyColors.foreground,
              size: 28,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 8,
            children: [
              Text(
                'Frendly',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontSize: 30,
                      fontWeight: FontWeight.w600,
                    ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  gradient: dateasyLimeGradient,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  'Plus',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        color: DateasyColors.backgroundDeep,
                        fontSize: 30,
                        fontWeight: FontWeight.w600,
                        height: 1.05,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: Text(
              'Больше встреч, лайков и приоритет в радаре',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 14,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PerkList extends StatelessWidget {
  const _PerkList({
    required this.perks,
    required this.loading,
    required this.hasError,
  });

  final List<_Perk> perks;
  final bool loading;
  final bool hasError;

  @override
  Widget build(BuildContext context) {
    if (perks.isEmpty) {
      return _InlineState(
        text: loading
            ? 'Загружаем преимущества Plus'
            : hasError
                ? 'Не удалось загрузить преимущества Plus'
                : 'Backend пока не отдает преимущества Plus',
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: _GlassPanel(
        borderRadius: 24,
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            for (var index = 0; index < perks.length; index++) ...[
              _PerkRow(perk: perks[index]),
              if (index != perks.length - 1) const SizedBox(height: 12),
            ],
          ],
        ),
      ),
    );
  }
}

class _PerkRow extends StatelessWidget {
  const _PerkRow({required this.perk});

  final _Perk perk;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            gradient: dateasyLimeGradient,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            perk.icon,
            color: DateasyColors.backgroundDeep,
            size: 17,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            perk.label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontSize: 14,
                ),
          ),
        ),
        const Icon(
          LucideIcons.check,
          color: DateasyColors.lime,
          size: 16,
        ),
      ],
    );
  }
}

class _PlanList extends StatelessWidget {
  const _PlanList({
    required this.plans,
    required this.selectedPlanId,
    required this.onSelect,
  });

  final List<_Plan> plans;
  final String selectedPlanId;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        children: [
          for (var index = 0; index < plans.length; index++) ...[
            _PlanCard(
              plan: plans[index],
              selected: plans[index].id == selectedPlanId,
              onTap: () => onSelect(plans[index].id),
            ),
            if (index != plans.length - 1) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.selected,
    required this.onTap,
  });

  final _Plan plan;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final borderColor =
        selected ? DateasyColors.lime : Colors.white.withValues(alpha: 0.1);

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected
              ? DateasyColors.lime.withValues(alpha: 0.1)
              : DateasyColors.glass,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: borderColor),
          boxShadow: selected
              ? const [
                  BoxShadow(
                    color: Color(0x33BEFF67),
                    blurRadius: 28,
                    spreadRadius: -16,
                    offset: Offset(0, 16),
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? DateasyColors.lime : Colors.transparent,
                border: Border.all(
                  color: selected
                      ? DateasyColors.lime
                      : Colors.white.withValues(alpha: 0.3),
                  width: 2,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      Text(
                        plan.title,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      if (plan.badge != null) _Badge(text: plan.badge!),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    plan.period,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 11,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${plan.ft}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(width: 4),
                Padding(
                  padding: const EdgeInsets.only(bottom: 1),
                  child: Text(
                    'FT',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 12,
                        ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _BottomCta extends StatelessWidget {
  const _BottomCta({
    required this.plan,
    required this.hasEnoughTokens,
    required this.missingTokens,
    required this.busy,
    required this.error,
    required this.onTap,
  });

  final _Plan plan;
  final bool hasEnoughTokens;
  final int missingTokens;
  final bool busy;
  final String? error;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = hasEnoughTokens
        ? 'Активировать за ${plan.ft} FT'
        : 'Не хватает $missingTokens FT · Пополнить';

    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        children: [
          GestureDetector(
            onTap: busy ? null : onTap,
            child: Container(
              width: double.infinity,
              height: 54,
              decoration: BoxDecoration(
                gradient:
                    hasEnoughTokens ? dateasyLimeGradient : dateasyPinkGradient,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: (hasEnoughTokens
                            ? DateasyColors.lime
                            : DateasyColors.pink)
                        .withValues(alpha: 0.35),
                    blurRadius: 30,
                    spreadRadius: -14,
                    offset: const Offset(0, 16),
                  ),
                ],
              ),
              child: Center(
                child: busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        label,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: DateasyColors.backgroundDeep,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            error ?? 'Списание токенов через backend',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color:
                      error == null ? DateasyColors.muted : DateasyColors.lime,
                  fontSize: 10,
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
      onTap: onTap,
      child: _GlassPanel(
        borderRadius: 16,
        padding: EdgeInsets.zero,
        child: SizedBox(
          width: 40,
          height: 40,
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
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class _InlineState extends StatelessWidget {
  const _InlineState({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: _GlassPanel(
        borderRadius: 20,
        padding: const EdgeInsets.all(16),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.muted,
              ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        gradient: dateasyPinkGradient,
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.foreground,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              height: 1,
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
      child: IgnorePointer(
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
                  gradient: LinearGradient(colors: [colorA, colorB]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Perk {
  const _Perk({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  factory _Perk.fromLabel(String label, int index) {
    final lower = label.toLowerCase();
    final icon = lower.contains('like') || lower.contains('лайк')
        ? LucideIcons.heart
        : lower.contains('ai') || lower.contains('маршрут')
            ? LucideIcons.sparkles
            : lower.contains('boost') || lower.contains('буст')
                ? LucideIcons.zap
                : lower.contains('view') || lower.contains('просмотр')
                    ? LucideIcons.eye
                    : [
                        LucideIcons.check,
                        LucideIcons.sparkles,
                        LucideIcons.zap,
                      ][index % 3];
    return _Perk(icon: icon, label: label);
  }
}

class _Plan {
  const _Plan({
    required this.id,
    required this.title,
    required this.ft,
    required this.period,
    required this.perks,
    this.badge,
  });

  final String id;
  final String title;
  final int ft;
  final String period;
  final List<_Perk> perks;
  final String? badge;

  factory _Plan.fromBackend(SubscriptionPlan plan) {
    final monthly = plan.tokenMonthlyCost > 0
        ? '${plan.tokenMonthlyCost} FT/мес'
        : '${plan.priceMonthlyRub} ₽/мес';
    return _Plan(
      id: plan.id,
      title: plan.label.isEmpty ? 'Plus' : plan.label,
      ft: plan.tokenCost,
      period: monthly,
      perks: _perksFromRaw(plan.raw),
      badge: plan.badge,
    );
  }
}

List<_Perk> _perksFromCatalog(PaymentsCatalog? catalog) {
  if (catalog == null) {
    return const [];
  }
  return _perksFromRaw(catalog.raw);
}

List<_Perk> _perksFromRaw(Map<String, Object?> raw) {
  final labels = <String>[
    ..._labelList(raw['perks']),
    ..._labelList(raw['benefits']),
    ..._labelList(raw['features']),
    ..._labelList(raw['plusPerks']),
    ..._labelList(raw['plusBenefits']),
  ];
  return labels
      .toSet()
      .toList(growable: false)
      .asMap()
      .entries
      .map((entry) => _Perk.fromLabel(entry.value, entry.key))
      .toList(growable: false);
}

List<String> _labelList(Object? value) {
  if (value is Iterable) {
    return value.map(_labelFrom).whereType<String>().toList(growable: false);
  }
  final single = _labelFrom(value);
  return single == null ? const [] : [single];
}

String? _labelFrom(Object? value) {
  if (value == null) {
    return null;
  }
  if (value is Map) {
    return _stringOrNull(
      value['label'] ?? value['title'] ?? value['text'] ?? value['name'],
    );
  }
  return _stringOrNull(value);
}

String? _stringOrNull(Object? value) {
  if (value == null) {
    return null;
  }
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
}

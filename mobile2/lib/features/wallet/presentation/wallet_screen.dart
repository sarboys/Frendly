import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:url_launcher/url_launcher.dart';

const walletPaymentLaunchMode = LaunchMode.inAppBrowserView;

class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  String? _busyPackId;

  void _showNotice(BuildContext context, String text) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text),
        behavior: SnackBarBehavior.floating,
        backgroundColor: DateasyColors.surface2,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Builder(
        builder: (context) {
          final wallet = ref.watch(tokenWalletProvider);
          final catalog = ref.watch(paymentsCatalogProvider);
          final planCatalog = ref.watch(subscriptionPlansProvider);
          final walletData = wallet.valueOrNull;
          final packs = catalog.valueOrNull?.tokenPacks
                  .map(_TokenPack.fromBackend)
                  .toList(growable: false) ??
              const <_TokenPack>[];
          final spendIdeas = _spendIdeasFromBackend(
            planCatalog.valueOrNull,
            catalog.valueOrNull,
            walletData,
          );
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(tokenWalletProvider);
              ref.invalidate(paymentsCatalogProvider);
              ref.invalidate(subscriptionPlansProvider);
            },
            child: ListView(
              padding: EdgeInsets.only(
                top: MediaQuery.paddingOf(context).top + 16,
                bottom: 56,
              ),
              children: [
                _Header(
                  onHelp: () => _showNotice(
                    context,
                    'История берётся из backend кошелька',
                  ),
                ),
                wallet.when(
                  data: (data) => _BalanceCard(balance: data.balance),
                  loading: () => const _BalanceCard(balance: 0),
                  error: (_, __) => const _BalanceCard(balance: 0),
                ),
                if (catalog.isLoading && packs.isEmpty)
                  const _InlineState(text: 'Загружаем пакеты')
                else if (packs.isEmpty)
                  _InlineState(
                    text: catalog.hasError
                        ? 'Не удалось загрузить пакеты'
                        : 'Backend пока не отдает пакеты',
                  )
                else
                  _PackGrid(
                    packs: packs,
                    busyPackId: _busyPackId,
                    onTopUp: _startPayment,
                  ),
                _SpendIdeas(
                  ideas: spendIdeas,
                  loading: catalog.isLoading || planCatalog.isLoading,
                  hasError: catalog.hasError && planCatalog.hasError,
                ),
                _QuickActions(
                  onPromo: () => _showNotice(
                    context,
                    'Промокоды пока не поддержаны backend',
                  ),
                ),
                wallet.when(
                  data: (data) => _HistorySection(
                    transactions:
                        data.history.map(_TokenTx.fromBackend).toList(),
                  ),
                  loading: () => const _HistorySection(transactions: []),
                  error: (_, __) => const _HistorySection(transactions: []),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _startPayment(_TokenPack pack) async {
    if (_busyPackId != null) {
      return;
    }
    setState(() => _busyPackId = pack.id);
    try {
      final order = await ref.read(paymentActionsProvider).initTokenPayment(
            pack.id,
          );
      final url = Uri.tryParse(order.paymentUrl ?? '');
      if (url == null) {
        if (mounted) {
          _showNotice(context, 'Backend не вернул ссылку оплаты');
        }
      } else {
        final opened = await launchUrl(
          url,
          mode: walletPaymentLaunchMode,
        );
        if (!opened && mounted) {
          _showNotice(context, 'Не удалось открыть оплату');
        }
      }
    } catch (_) {
      if (mounted) {
        _showNotice(context, 'Не удалось начать оплату');
      }
    } finally {
      if (mounted) {
        setState(() => _busyPackId = null);
      }
    }
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onHelp});

  final VoidCallback onHelp;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          _GlassIconButton(
            icon: LucideIcons.chevronLeft,
            onTap: () => context.go('/settings'),
          ),
          Expanded(
            child: Text(
              'Кошелёк',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          _GlassIconButton(
            icon: LucideIcons.circleQuestionMark,
            onTap: onHelp,
            iconSize: 18,
          ),
        ],
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.balance});

  final int balance;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Container(
        decoration: BoxDecoration(
          gradient: dateasyLimeGradient,
          borderRadius: BorderRadius.circular(24),
          boxShadow: const [
            BoxShadow(
              color: Color(0x66BEFF67),
              blurRadius: 30,
              spreadRadius: -14,
              offset: Offset(0, 18),
            ),
          ],
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  LucideIcons.coins,
                  size: 15,
                  color: DateasyColors.backgroundDeep,
                ),
                const SizedBox(width: 6),
                Text(
                  'Frendly Tokens',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color:
                            DateasyColors.backgroundDeep.withValues(alpha: 0.8),
                        fontSize: 12,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '$balance',
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                        color: DateasyColors.backgroundDeep,
                        fontSize: 40,
                        height: 1,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(bottom: 5),
                  child: Text(
                    'FT',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: DateasyColors.backgroundDeep
                              .withValues(alpha: 0.65),
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 7),
            Text(
              'Используй для подписки, бустов и super-like',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.backgroundDeep.withValues(alpha: 0.7),
                    fontSize: 12,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PackGrid extends StatelessWidget {
  const _PackGrid({
    required this.packs,
    required this.busyPackId,
    required this.onTopUp,
  });

  final List<_TokenPack> packs;
  final String? busyPackId;
  final void Function(_TokenPack pack) onTopUp;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'Пополнить',
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: packs.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          mainAxisExtent: 132,
        ),
        itemBuilder: (context, index) {
          final pack = packs[index];
          return _PackCard(
            pack: pack,
            busy: busyPackId == pack.id,
            onTap: () => onTopUp(pack),
          );
        },
      ),
    );
  }
}

class _PackCard extends StatelessWidget {
  const _PackCard({
    required this.pack,
    required this.busy,
    required this.onTap,
  });

  final _TokenPack pack;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    pack.label.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 10,
                          letterSpacing: 1,
                        ),
                  ),
                ),
                if (pack.badge != null) _Badge(text: pack.badge!),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${pack.ft}',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontSize: 24,
                        height: 1,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(width: 5),
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    'FT',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                ),
              ],
            ),
            const Spacer(),
            Container(
              height: 32,
              decoration: BoxDecoration(
                gradient: dateasyLimeGradient,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (busy)
                    const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  else ...[
                    const Icon(
                      LucideIcons.plus,
                      color: DateasyColors.backgroundDeep,
                      size: 14,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      '${pack.rub} ₽',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.backgroundDeep,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SpendIdeas extends StatelessWidget {
  const _SpendIdeas({
    required this.ideas,
    required this.loading,
    required this.hasError,
  });

  final List<_SpendIdea> ideas;
  final bool loading;
  final bool hasError;

  @override
  Widget build(BuildContext context) {
    if (ideas.isEmpty) {
      return _InlineState(
        text: loading
            ? 'Загружаем варианты трат'
            : hasError
                ? 'Не удалось загрузить варианты трат'
                : 'Backend пока не отдает варианты трат',
      );
    }

    return _Section(
      title: 'На что потратить',
      top: 24,
      child: Column(
        children: [
          for (var index = 0; index < ideas.length; index++) ...[
            _SpendIdeaRow(idea: ideas[index]),
            if (index != ideas.length - 1) const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _SpendIdeaRow extends StatelessWidget {
  const _SpendIdeaRow({required this.idea});

  final _SpendIdea idea;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go(idea.route),
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: dateasyLimeGradient,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                idea.icon,
                color: DateasyColors.backgroundDeep,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    idea.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    idea.subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                          fontSize: 11,
                        ),
                  ),
                ],
              ),
            ),
            const Icon(
              LucideIcons.arrowUpRight,
              color: DateasyColors.muted,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.onPromo});

  final VoidCallback onPromo;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Row(
        children: [
          Expanded(
            child: _MiniActionCard(
              icon: LucideIcons.crown,
              iconColor: DateasyColors.pink,
              title: 'Plus',
              subtitle: 'Подписка',
              onTap: () => context.go('/paywall'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _MiniActionCard(
              icon: LucideIcons.gift,
              iconColor: DateasyColors.lime,
              title: 'Промокод',
              subtitle: 'Активировать',
              onTap: onPromo,
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniActionCard extends StatelessWidget {
  const _MiniActionCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(icon, color: iconColor, size: 20),
            const SizedBox(width: 9),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  Text(
                    subtitle,
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
          ],
        ),
      ),
    );
  }
}

class _HistorySection extends StatelessWidget {
  const _HistorySection({required this.transactions});

  final List<_TokenTx> transactions;

  @override
  Widget build(BuildContext context) {
    return _Section(
      title: 'История',
      top: 24,
      child: _GlassPanel(
        borderRadius: 16,
        padding: EdgeInsets.zero,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Column(
            children: [
              if (transactions.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    'История появится после пополнений и трат',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: DateasyColors.muted,
                        ),
                  ),
                )
              else
                for (var index = 0; index < transactions.length; index++) ...[
                  _HistoryRow(transaction: transactions[index]),
                  if (index != transactions.length - 1)
                    Divider(
                      height: 1,
                      color: Colors.white.withValues(alpha: 0.05),
                    ),
                ],
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
    return _Section(
      title: 'Пополнить',
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(16),
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.muted,
              ),
        ),
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.transaction});

  final _TokenTx transaction;

  @override
  Widget build(BuildContext context) {
    final isPositive = transaction.amount > 0;
    final tint = isPositive ? DateasyColors.lime : DateasyColors.pink;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: tint.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isPositive ? LucideIcons.arrowDownLeft : LucideIcons.arrowUpRight,
              color: tint,
              size: 16,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  transaction.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  transaction.when,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 11,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            '${isPositive ? '+' : ''}${transaction.amount} FT',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: isPositive ? DateasyColors.lime : null,
              fontWeight: FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.child,
    this.top = 24,
  });

  final String title;
  final Widget child;
  final double top;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, top, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              title.toUpperCase(),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 12,
                    letterSpacing: 1,
                  ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    required this.icon,
    required this.onTap,
    this.iconSize = 22,
  });

  final IconData icon;
  final VoidCallback onTap;
  final double iconSize;

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
          child: Icon(icon, size: iconSize),
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
              fontSize: 9,
              fontWeight: FontWeight.w700,
              height: 1,
            ),
      ),
    );
  }
}

class _TokenPack {
  const _TokenPack({
    required this.id,
    required this.ft,
    required this.rub,
    required this.label,
    this.badge,
  });

  final String id;
  final int ft;
  final int rub;
  final String label;
  final String? badge;

  factory _TokenPack.fromBackend(TokenPackProduct product) {
    return _TokenPack(
      id: product.id,
      ft: product.tokens,
      rub: product.priceRub,
      label: product.label,
      badge: product.best
          ? 'Хит'
          : product.bonus > 0
              ? '+${product.bonus}'
              : null,
    );
  }
}

class _SpendIdea {
  const _SpendIdea({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.route,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String route;

  factory _SpendIdea.fromPlan(SubscriptionPlan plan) {
    final monthlyCost = plan.tokenMonthlyCost > 0
        ? plan.tokenMonthlyCost
        : plan.tokenCost > 0
            ? plan.tokenCost
            : 0;
    return _SpendIdea(
      icon: LucideIcons.crown,
      title: 'Plus подписка',
      subtitle: monthlyCost > 0 ? 'от $monthlyCost FT / мес' : 'Подписка',
      route: '/paywall',
    );
  }

  factory _SpendIdea.fromPromo(
    BackendCardItem item, {
    String fallbackTitle = 'Буст встречи',
  }) {
    final cost = _intFrom(item.raw['cost'] ?? item.raw['tokenCost']);
    final hours = _intFrom(item.raw['durationHours']);
    final subtitle = [
      if (cost > 0) '$cost FT',
      if (hours > 0) '$hoursч',
    ].join(' / ');
    return _SpendIdea(
      icon: LucideIcons.zap,
      title: fallbackTitle,
      subtitle: subtitle.isEmpty
          ? item.subtitle ?? 'Выбери внутри встречи'
          : subtitle,
      route: '/meetings',
    );
  }

  const _SpendIdea.superLike()
      : icon = LucideIcons.sparkles,
        title = 'Super-like',
        subtitle = '5 FT / шт',
        route = '/dating';
}

class _TokenTx {
  const _TokenTx({
    required this.id,
    required this.title,
    required this.amount,
    required this.when,
  });

  final String id;
  final String title;
  final int amount;
  final String when;

  factory _TokenTx.fromBackend(BackendCardItem item) {
    final raw = item.raw;
    final rawAmount = _intFrom(raw['amount'] ?? raw['delta']);
    final type =
        (raw['type'] ?? raw['kind'] ?? raw['reason'])?.toString().toLowerCase();
    final signedAmount = type == 'spend' ||
            type == 'debit' ||
            type == 'promotion_spend' ||
            type == 'subscription_spend'
        ? -rawAmount.abs()
        : rawAmount;
    final title = item.title.isNotEmpty
        ? item.title
        : raw['note']?.toString().isNotEmpty == true
            ? raw['note'].toString()
            : 'Операция';
    return _TokenTx(
      id: item.id,
      title: title,
      amount: signedAmount,
      when: item.subtitle ??
          _formatWalletDate(
            item.startsAt ?? _dateFrom(raw['timestamp'] ?? raw['createdAt']),
          ) ??
          '',
    );
  }
}

List<_SpendIdea> _spendIdeasFromBackend(
  List<SubscriptionPlan>? plans,
  PaymentsCatalog? catalog,
  TokenWalletData? wallet,
) {
  final sortedPlans = [...?plans]..sort((left, right) {
      final leftCost =
          left.tokenMonthlyCost > 0 ? left.tokenMonthlyCost : left.tokenCost;
      final rightCost =
          right.tokenMonthlyCost > 0 ? right.tokenMonthlyCost : right.tokenCost;
      return leftCost.compareTo(rightCost);
    });
  final promoItems = catalog?.promoOptions.isNotEmpty == true
      ? catalog!.promoOptions
      : _promoOptionsFromWallet(wallet);
  final primaryPromo = promoItems.isNotEmpty ? promoItems.first : null;
  final ideas = <_SpendIdea>[
    if (sortedPlans.isNotEmpty)
      _SpendIdea.fromPlan(sortedPlans.first)
    else
      const _SpendIdea(
        icon: LucideIcons.crown,
        title: 'Plus подписка',
        subtitle: 'от 250 FT / мес',
        route: '/paywall',
      ),
    if (primaryPromo != null)
      _SpendIdea.fromPromo(primaryPromo)
    else
      const _SpendIdea(
        icon: LucideIcons.zap,
        title: 'Буст встречи',
        subtitle: '50 FT / 24ч',
        route: '/meetings',
      ),
    const _SpendIdea.superLike(),
  ];
  return ideas;
}

List<BackendCardItem> _promoOptionsFromWallet(TokenWalletData? wallet) {
  final value = wallet?.raw['promoOptions'];
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map>()
      .map((item) => BackendCardItem.fromJson(Map<String, Object?>.from(item)))
      .toList(growable: false);
}

int _intFrom(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

DateTime? _dateFrom(Object? value) {
  if (value is DateTime) {
    return value;
  }
  return DateTime.tryParse(value?.toString() ?? '');
}

String? _formatWalletDate(DateTime? value) {
  if (value == null) {
    return null;
  }
  final now = DateTime.now();
  final local = value.toLocal();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(local.year, local.month, local.day);
  if (day == today) {
    return 'Сегодня';
  }
  if (day == today.subtract(const Duration(days: 1))) {
    return 'Вчера';
  }
  const months = [
    'янв',
    'фев',
    'мар',
    'апр',
    'мая',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек',
  ];
  return '${local.day} ${months[local.month - 1]}';
}

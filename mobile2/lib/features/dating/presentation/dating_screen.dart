import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_bottom_nav.dart';
import 'package:mobile2/shared/widgets/dateasy_highlight_text.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';
import 'package:mobile2/shared/widgets/dateasy_top_bar.dart';

class DatingScreen extends StatefulWidget {
  const DatingScreen({super.key});

  @override
  State<DatingScreen> createState() => _DatingScreenState();
}

class _DatingScreenState extends State<DatingScreen> {
  int _index = 0;

  void _next() {
    setState(() => _index += 1);
  }

  void _sendAction(
    WidgetRef ref,
    BuildContext context,
    _DatingProfile card,
    String action,
  ) {
    _next();
    unawaited(
      ref
          .read(datingActionsProvider)
          .recordAction(targetUserId: card.id, action: action)
          .then((result) {
        if (!mounted || !context.mounted) {
          return;
        }
        if (result['matched'] == true) {
          context.go('/match');
        }
      }).catchError((_) {
        if (!mounted || !context.mounted) {
          return;
        }
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Не удалось сохранить действие'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: DateasyColors.surface2,
          ),
        );
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Consumer(
        builder: (context, ref, _) {
          final cardsState = ref.watch(datingDiscoverProvider);
          final profiles = cardsState.valueOrNull?.items
                  .map(_DatingProfile.fromBackend)
                  .where((item) => item.id.isNotEmpty)
                  .toList(growable: false) ??
              const <_DatingProfile>[];
          final currentIndex = profiles.isEmpty ? 0 : _index % profiles.length;
          final current = profiles.isEmpty ? null : profiles[currentIndex];
          final prewarmUrls = datingPrewarmImageUrls(
            cardsState.valueOrNull?.items ?? const <BackendCardItem>[],
            currentIndex: currentIndex,
          );
          if (prewarmUrls.isNotEmpty) {
            unawaited(
              ref.read(appMediaPrewarmServiceProvider).warmRemoteImages(
                    prewarmUrls,
                    usage: DateasyImageUsage.fullscreen,
                    limit: 3,
                    concurrency: 2,
                  ),
            );
          }
          final nextProfiles = profiles
              .asMap()
              .entries
              .where((entry) => entry.key != currentIndex)
              .map((entry) => entry.value)
              .take(3)
              .toList(growable: false);
          final isFirstLoading = cardsState.isLoading && profiles.isEmpty;

          return Stack(
            children: [
              ListView(
                padding: EdgeInsets.only(
                  top: MediaQuery.paddingOf(context).top + 16,
                  bottom: 146,
                ),
                children: [
                  const DateasyTopBar(),
                  const SizedBox(height: 24),
                  _Headline(count: profiles.length),
                  const SizedBox(height: 24),
                  if (isFirstLoading)
                    const _DatingStatusCard(message: 'Загружаем подборку')
                  else if (current == null)
                    _DatingStatusCard(
                      message: cardsState.hasError
                          ? 'Не удалось загрузить подборку'
                          : 'Пока нет анкет',
                    )
                  else ...[
                    _CardStack(
                      card: current,
                      onJoinMeeting: () {},
                    ),
                    const SizedBox(height: 22),
                    _Actions(
                      onPass: () => _sendAction(
                        ref,
                        context,
                        current,
                        'pass',
                      ),
                      onSuper: () => _sendAction(
                        ref,
                        context,
                        current,
                        'super_like',
                      ),
                      onLike: () => _sendAction(
                        ref,
                        context,
                        current,
                        'like',
                      ),
                    ),
                    const SizedBox(height: 8),
                    const _BalanceLine(),
                    const SizedBox(height: 30),
                    _NextDeck(cards: nextProfiles),
                  ],
                ],
              ),
              const _BottomNav(),
            ],
          );
        },
      ),
    );
  }
}

Iterable<String> datingPrewarmImageUrls(
  List<BackendCardItem> cards, {
  required int currentIndex,
}) sync* {
  var emitted = 0;
  for (var index = 0; index < cards.length && emitted < 3; index += 1) {
    if (index == currentIndex) {
      continue;
    }
    final url = cards[index].imageUrl?.trim();
    if (url == null || url.isEmpty) {
      continue;
    }
    emitted += 1;
    yield url;
  }
}

class _Headline extends StatelessWidget {
  const _Headline({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final headline = Theme.of(context).textTheme.headlineLarge?.copyWith(
          fontSize: 34,
          height: 1.05,
          fontWeight: FontWeight.w600,
          letterSpacing: 0,
        );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  count == 0
                      ? 'Подборка обновляется'
                      : '$count рядом в подборке',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.muted,
                      ),
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Свайпай', style: headline),
                        const SizedBox(width: 8),
                        DateasyHeadlineHighlight(
                          text: 'с умом',
                          style: headline,
                          padding: const EdgeInsets.fromLTRB(12, 0, 12, 4),
                          textHeight: 1.1,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          const _FilterButton(),
        ],
      ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Фильтры',
      button: true,
      child: GestureDetector(
        onTap: () => context.go('/dating/filter'),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: dateasyLimeGradient,
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x55BEFF67),
                    blurRadius: 24,
                    offset: Offset(0, 10),
                  ),
                ],
              ),
              child: const Icon(
                LucideIcons.slidersHorizontal,
                color: DateasyColors.backgroundDeep,
                size: 20,
              ),
            ),
            Positioned(
              top: -2,
              right: -2,
              child: Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: DateasyColors.pink,
                  shape: BoxShape.circle,
                  border: Border.all(color: DateasyColors.background, width: 2),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CardStack extends StatelessWidget {
  const _CardStack({
    required this.card,
    required this.onJoinMeeting,
  });

  final _DatingProfile card;
  final VoidCallback onJoinMeeting;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: SizedBox(
        height: 520,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              left: 20,
              right: 20,
              top: 16,
              height: 480,
              child: Transform.scale(
                scale: 0.96,
                child: const _StackBackCard(color: DateasyColors.surface2),
              ),
            ),
            Positioned(
              left: 38,
              right: 38,
              top: 32,
              height: 480,
              child: Transform.scale(
                scale: 0.92,
                child: const _StackBackCard(color: DateasyColors.surface),
              ),
            ),
            Positioned.fill(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(32),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    border: Border.all(color: DateasyColors.border),
                    borderRadius: BorderRadius.circular(32),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.34),
                        blurRadius: 30,
                        offset: const Offset(0, 18),
                      ),
                    ],
                  ),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      DateasyRemoteImage(
                        imageUrl: card.imageUrl,
                        usage: DateasyImageUsage.fullscreen,
                      ),
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              Color(0x661F0C3F),
                              DateasyColors.background,
                            ],
                            stops: [0.22, 0.58, 1],
                          ),
                        ),
                      ),
                      Positioned(
                        top: 16,
                        left: 16,
                        right: 16,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            if (card.online) const _OnlineBadge(),
                            if (card.matchPercent != null)
                              _MatchBadge(value: card.matchPercent!),
                          ],
                        ),
                      ),
                      Positioned(
                        left: 16,
                        right: 16,
                        bottom: 16,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        card.age == null
                                            ? card.name
                                            : '${card.name}, ${card.age}',
                                        style: Theme.of(context)
                                            .textTheme
                                            .headlineMedium
                                            ?.copyWith(
                                              fontFamily: 'Sora',
                                              fontSize: 30,
                                              height: 1.08,
                                              fontWeight: FontWeight.w600,
                                            ),
                                      ),
                                      const SizedBox(height: 7),
                                      Row(
                                        children: [
                                          const Icon(
                                            LucideIcons.mapPin,
                                            size: 13,
                                            color: DateasyColors.muted,
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            card.distanceLabel,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodySmall
                                                ?.copyWith(
                                                  color: DateasyColors.muted,
                                                  fontSize: 11,
                                                ),
                                          ),
                                          const SizedBox(width: 12),
                                          const Icon(
                                            LucideIcons.briefcaseBusiness,
                                            size: 13,
                                            color: DateasyColors.muted,
                                          ),
                                          const SizedBox(width: 4),
                                          Expanded(
                                            child: Text(
                                              card.job,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .bodySmall
                                                  ?.copyWith(
                                                    color: DateasyColors.muted,
                                                    fontSize: 11,
                                                  ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                GestureDetector(
                                  onTap: () => context.go('/u/${card.id}'),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 13,
                                      vertical: 10,
                                    ),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(16),
                                      color: DateasyColors.foreground,
                                    ),
                                    child: Text(
                                      'Профиль',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            color: DateasyColors.backgroundDeep,
                                            fontWeight: FontWeight.w600,
                                            fontSize: 11,
                                          ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            if (card.interests.isNotEmpty) ...[
                              _Interests(items: card.interests),
                              const SizedBox(height: 12),
                            ],
                            if (card.meetingTitle != null)
                              _MeetingInvite(
                                title: card.meetingTitle!,
                                onJoinMeeting: onJoinMeeting,
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StackBackCard extends StatelessWidget {
  const _StackBackCard({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(32),
        color: color.withValues(alpha: 0.6),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
    );
  }
}

class _OnlineBadge extends StatelessWidget {
  const _OnlineBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: DateasyColors.glass,
        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
      ),
      child: Row(
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: DateasyColors.lime,
            ),
          ),
          const SizedBox(width: 7),
          Text(
            'онлайн',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _MatchBadge extends StatelessWidget {
  const _MatchBadge({required this.value});

  final int value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        gradient: dateasyLimeGradient,
      ),
      child: Text(
        '$value% мэтч',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.backgroundDeep,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _Interests extends StatelessWidget {
  const _Interests({required this.items});

  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: items.map((item) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            color: DateasyColors.glass,
            border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                LucideIcons.sparkles,
                size: 14,
                color: DateasyColors.lime,
              ),
              const SizedBox(width: 6),
              Text(
                item,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _MeetingInvite extends StatefulWidget {
  const _MeetingInvite({
    required this.title,
    required this.onJoinMeeting,
  });

  final String title;
  final VoidCallback onJoinMeeting;

  @override
  State<_MeetingInvite> createState() => _MeetingInviteState();
}

class _MeetingInviteState extends State<_MeetingInvite> {
  bool _joined = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: DateasyColors.glass,
        border: Border.all(color: DateasyColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              gradient: dateasyPinkGradient,
            ),
            child: const Text('☕', style: TextStyle(fontSize: 20)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Идёт на встречу',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 11,
                      ),
                ),
                Text(
                  widget.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: () {
              widget.onJoinMeeting();
              setState(() => _joined = !_joined);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                gradient: dateasyLimeGradient,
              ),
              child: Text(
                _joined ? 'Я иду' : '+Я',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.backgroundDeep,
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

class _Actions extends StatelessWidget {
  const _Actions({
    required this.onPass,
    required this.onSuper,
    required this.onLike,
  });

  final VoidCallback onPass;
  final VoidCallback onSuper;
  final VoidCallback onLike;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _RoundAction(
          icon: LucideIcons.x,
          size: 56,
          onTap: onPass,
          semanticLabel: 'Пропустить',
        ),
        const SizedBox(width: 16),
        _RoundAction(
          icon: LucideIcons.star,
          size: 48,
          color: DateasyColors.lilac,
          iconColor: DateasyColors.backgroundDeep,
          badge: '5',
          onTap: onSuper,
          semanticLabel: 'Super-like',
        ),
        const SizedBox(width: 16),
        _RoundAction(
          icon: Icons.favorite,
          size: 64,
          gradient: dateasyLimeGradient,
          iconColor: DateasyColors.backgroundDeep,
          onTap: onLike,
          semanticLabel: 'Лайк',
        ),
        const SizedBox(width: 16),
        _RoundAction(
          icon: LucideIcons.sparkles,
          size: 56,
          iconColor: DateasyColors.lime,
          onTap: () => context.go('/ai-builder'),
          semanticLabel: 'AI',
        ),
      ],
    );
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({
    required this.icon,
    required this.size,
    required this.onTap,
    required this.semanticLabel,
    this.color,
    this.gradient,
    this.iconColor,
    this.badge,
  });

  final IconData icon;
  final double size;
  final VoidCallback onTap;
  final String semanticLabel;
  final Color? color;
  final Gradient? gradient;
  final Color? iconColor;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: semanticLabel,
      button: true,
      child: GestureDetector(
        onTap: onTap,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color ?? DateasyColors.glass,
                gradient: gradient,
                border: gradient == null && color == null
                    ? Border.all(color: DateasyColors.border)
                    : null,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.18),
                    blurRadius: 22,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Icon(
                icon,
                size: size >= 60 ? 28 : 22,
                color: iconColor ?? DateasyColors.muted,
              ),
            ),
            if (badge != null)
              Positioned(
                top: -3,
                right: -6,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    color: DateasyColors.foreground,
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        LucideIcons.coins,
                        size: 10,
                        color: DateasyColors.backgroundDeep,
                      ),
                      const SizedBox(width: 2),
                      Text(
                        badge!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.backgroundDeep,
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _BalanceLine extends ConsumerWidget {
  const _BalanceLine();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(tokenWalletProvider).valueOrNull;
    return Text.rich(
      TextSpan(
        children: [
          const TextSpan(text: 'Баланс: '),
          TextSpan(
            text: '${wallet?.balance ?? 0} FT',
            style: const TextStyle(
              color: DateasyColors.foreground,
              fontWeight: FontWeight.w600,
            ),
          ),
          const TextSpan(text: ' · '),
          const TextSpan(
            text: 'пополнить',
            style: TextStyle(color: DateasyColors.lime),
          ),
        ],
      ),
      textAlign: TextAlign.center,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: DateasyColors.muted,
            fontSize: 11,
          ),
    );
  }
}

class _NextDeck extends StatelessWidget {
  const _NextDeck({required this.cards});

  final List<_DatingProfile> cards;

  @override
  Widget build(BuildContext context) {
    if (cards.isEmpty) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Следующие в подборке',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontFamily: 'Sora',
                            fontSize: 20,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Появятся после текущей карточки',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.muted,
                          ),
                    ),
                  ],
                ),
              ),
              Text(
                'Обновить',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.muted,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: cards.map((item) {
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: _MiniProfile(card: item),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _MiniProfile extends StatelessWidget {
  const _MiniProfile({required this.card});

  final _DatingProfile card;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/u/${card.id}'),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: SizedBox(
          height: 132,
          child: Stack(
            fit: StackFit.expand,
            children: [
              DateasyRemoteImage(
                imageUrl: card.imageUrl,
                usage: DateasyImageUsage.card,
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Color(0xDD1F0C3F)],
                  ),
                ),
              ),
              Positioned(
                left: 8,
                right: 8,
                bottom: 8,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      card.age == null
                          ? card.name
                          : '${card.name}, ${card.age}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    Text(
                      card.matchPercent == null
                          ? 'Анкета'
                          : '${card.matchPercent}% мэтч',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.muted,
                            fontSize: 10,
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
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav();

  @override
  Widget build(BuildContext context) {
    return const DateasyBottomNav();
  }
}

class _GlassBox extends StatelessWidget {
  const _GlassBox({required this.child, this.height});

  final Widget child;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: DateasyColors.glass,
        border: Border.all(color: DateasyColors.border),
      ),
      child: child,
    );
  }
}

class _DatingProfile {
  const _DatingProfile({
    required this.id,
    required this.name,
    required this.job,
    required this.distanceLabel,
    this.age,
    this.imageUrl,
    this.matchPercent,
    this.interests = const [],
    this.meetingTitle,
    this.online = false,
  });

  final String id;
  final String name;
  final String job;
  final String distanceLabel;
  final int? age;
  final String? imageUrl;
  final int? matchPercent;
  final List<String> interests;
  final String? meetingTitle;
  final bool online;

  factory _DatingProfile.fromBackend(BackendCardItem item) {
    final raw = item.raw;
    final profile = _map(raw['profile']);
    final meeting = _map(raw['meeting']);
    final event = _map(raw['event']);
    return _DatingProfile(
      id: item.id,
      name: item.title.isEmpty ? 'Профиль' : item.title,
      age: _intOrNull(raw['age'] ?? profile['age']),
      imageUrl: item.imageUrl,
      matchPercent: _intOrNull(
        raw['match'] ??
            raw['matchScore'] ??
            raw['compatibility'] ??
            raw['compatibilityPercent'],
      ),
      job: _stringOrNull(
            raw['job'] ??
                raw['profession'] ??
                raw['occupation'] ??
                raw['vibe'] ??
                profile['vibe'],
          ) ??
          item.city ??
          'Готов к встрече',
      distanceLabel: _stringOrNull(raw['distance'] ?? raw['distanceLabel']) ??
          item.city ??
          '',
      interests: _stringList(
        raw['tags'] ?? raw['interests'] ?? profile['interests'],
      ),
      meetingTitle: _stringOrNull(
        raw['meetingTitle'] ?? meeting['title'] ?? event['title'],
      ),
      online: raw['online'] == true,
    );
  }
}

class _DatingStatusCard extends StatelessWidget {
  const _DatingStatusCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: _GlassBox(
        height: 320,
        child: Center(
          child: Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.muted,
                ),
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

String? _stringOrNull(Object? value) {
  final result = value?.toString();
  if (result == null || result.isEmpty) {
    return null;
  }
  return result;
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

List<String> _stringList(Object? value) {
  if (value is List) {
    return value
        .map((item) => item.toString())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }
  return const [];
}

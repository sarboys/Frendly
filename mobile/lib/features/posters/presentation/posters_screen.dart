import 'dart:async';

import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/posters/presentation/widgets/poster_card.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/poster.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class PostersScreen extends ConsumerStatefulWidget {
  const PostersScreen({super.key});

  @override
  ConsumerState<PostersScreen> createState() => _PostersScreenState();
}

class _PostersScreenState extends ConsumerState<PostersScreen> {
  final _queryController = TextEditingController();
  Timer? _queryDebounce;
  PosterCategory? _category;
  String _debouncedQuery = '';

  @override
  void dispose() {
    _queryDebounce?.cancel();
    _queryController.dispose();
    super.dispose();
  }

  void _handleQueryChanged(String value) {
    _queryDebounce?.cancel();
    setState(() {});
    _queryDebounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) {
        return;
      }
      setState(() {
        _debouncedQuery = value.trim();
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final query = _debouncedQuery;
    final featuredAsync = ref.watch(featuredPostersProvider);
    final filteredAsync = ref.watch(
      posterFeedProvider(
        PostersQuery(
          query: query,
          category: _category,
          featuredOnly: false,
        ),
      ),
    );
    final featured = featuredAsync.valueOrNull ?? const <Poster>[];
    final filtered = filteredAsync.valueOrNull ?? const <Poster>[];

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: const Icon(Icons.chevron_left_rounded, size: 28),
                  ),
                  Expanded(
                    child: Text(
                      'Афиша города',
                      textAlign: TextAlign.center,
                      style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
                    ),
                  ),
                  const SizedBox(width: 48),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: colors.border),
                ),
                child: Row(
                  children: [
                    Icon(Icons.search_rounded, size: 18, color: colors.inkMute),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: TextField(
                        controller: _queryController,
                        onChanged: _handleQueryChanged,
                        decoration: InputDecoration(
                          border: InputBorder.none,
                          hintText: 'Концерт, артист, площадка',
                          hintStyle: AppTextStyles.bodySoft.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                        style: AppTextStyles.body,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(
              height: 42,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                children: [
                  _PostersCategoryChip(
                    label: 'Все',
                    emoji: '✨',
                    active: _category == null,
                    onTap: () => setState(() => _category = null),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  ...PosterCategory.values.map((category) => Padding(
                        padding: const EdgeInsets.only(right: AppSpacing.xs),
                        child: _PostersCategoryChip(
                          label: category.label,
                          emoji: category.emoji,
                          active: _category == category,
                          onTap: () => setState(() => _category = category),
                        ),
                      )),
                ],
              ),
            ),
            Expanded(
              child: featuredAsync.isLoading || filteredAsync.isLoading
                  ? Center(
                      child: CircularProgressIndicator(color: colors.primary),
                    )
                  : featuredAsync.hasError || filteredAsync.hasError
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              'Не получилось загрузить афишу',
                              style: AppTextStyles.body,
                              textAlign: TextAlign.center,
                            ),
                          ),
                        )
                      : _PostersFeedList(
                          category: _category,
                          query: query,
                          featured: featured,
                          filtered: filtered,
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PostersFeedList extends StatelessWidget {
  const _PostersFeedList({
    required this.category,
    required this.query,
    required this.featured,
    required this.filtered,
  });

  final PosterCategory? category;
  final String query;
  final List<Poster> featured;
  final List<Poster> filtered;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final showFeatured =
        category == null && query.isEmpty && featured.isNotEmpty;
    final itemCount =
        (showFeatured ? 1 : 0) + 1 + (filtered.isEmpty ? 1 : filtered.length);

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      itemCount: itemCount,
      itemBuilder: (context, index) {
        var contentIndex = index;

        if (showFeatured) {
          if (contentIndex == 0) {
            return _FeaturedPostersStrip(posters: featured);
          }
          contentIndex -= 1;
        }

        if (contentIndex == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    category?.label ?? 'Все события',
                    style: AppTextStyles.sectionTitle,
                  ),
                ),
                Text(
                  '${filtered.length}',
                  style: AppTextStyles.meta.copyWith(color: colors.inkMute),
                ),
              ],
            ),
          );
        }

        if (filtered.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Text(
              'Ничего не нашли. Попробуй другой запрос.',
              style: AppTextStyles.meta.copyWith(color: colors.inkMute),
              textAlign: TextAlign.center,
            ),
          );
        }

        final poster = filtered[contentIndex - 1];
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.md),
          child: PosterCard(
            poster: poster,
            onTap: () => context.pushRoute(
              AppRoute.poster,
              pathParameters: {'posterId': poster.id},
            ),
          ),
        );
      },
    );
  }
}

class _FeaturedPostersStrip extends StatelessWidget {
  const _FeaturedPostersStrip({
    required this.posters,
  });

  final List<Poster> posters;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        children: [
          Row(
            children: [
              Text(
                'Хиты недели',
                style: AppTextStyles.caption.copyWith(
                  color: colors.inkMute,
                  letterSpacing: 1,
                ),
              ),
              const Spacer(),
              Text(
                'топ-5',
                style: AppTextStyles.meta.copyWith(color: colors.inkMute),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 220,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemBuilder: (context, index) {
                final poster = posters[index];
                return PosterCard(
                  poster: poster,
                  variant: PosterCardVariant.compact,
                  onTap: () => context.pushRoute(
                    AppRoute.poster,
                    pathParameters: {'posterId': poster.id},
                  ),
                );
              },
              separatorBuilder: (context, index) =>
                  const SizedBox(width: AppSpacing.sm),
              itemCount: posters.length > 5 ? 5 : posters.length,
            ),
          ),
        ],
      ),
    );
  }
}

class _PostersCategoryChip extends StatelessWidget {
  const _PostersCategoryChip({
    required this.label,
    required this.emoji,
    required this.active,
    required this.onTap,
  });

  final String label;
  final String emoji;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: active ? colors.foreground : colors.card,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active ? colors.foreground : colors.border,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          '$emoji $label',
          style: AppTextStyles.meta.copyWith(
            color: active ? colors.primaryForeground : colors.inkSoft,
          ),
        ),
      ),
    );
  }
}

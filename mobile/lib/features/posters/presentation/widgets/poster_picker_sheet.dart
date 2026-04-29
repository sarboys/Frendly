import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/poster.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

Future<Poster?> showPosterPickerSheet(
  BuildContext context, {
  Poster? initialValue,
}) {
  final container = ProviderScope.containerOf(context, listen: false);
  return showModalBottomSheet<Poster>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => UncontrolledProviderScope(
      container: container,
      child: _PosterPickerSheet(initialValue: initialValue),
    ),
  );
}

class _PosterPickerSheet extends ConsumerStatefulWidget {
  const _PosterPickerSheet({
    this.initialValue,
  });

  final Poster? initialValue;

  @override
  ConsumerState<_PosterPickerSheet> createState() => _PosterPickerSheetState();
}

class _PosterPickerSheetState extends ConsumerState<_PosterPickerSheet> {
  final _queryController = TextEditingController();
  PosterCategory? _category;

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final query = _queryController.text.trim();
    final filtered = ref
            .watch(
              posterFeedProvider(
                PostersQuery(
                  query: query,
                  category: _category,
                  featuredOnly: false,
                ),
              ),
            )
            .valueOrNull ??
        const <Poster>[];

    return SafeArea(
      top: false,
      bottom: false,
      child: Container(
        height: MediaQuery.of(context).size.height * 0.92,
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
              child: Row(
                children: [
                  const SizedBox(width: 40),
                  Expanded(
                    child: Text(
                      'Выбрать из афиши',
                      textAlign: TextAlign.center,
                      style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, size: 20),
                  ),
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
                        onChanged: (_) => setState(() {}),
                        decoration: InputDecoration(
                          border: InputBorder.none,
                          hintText: 'Концерт, спектакль, матч',
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
                  _CategoryChip(
                    label: 'Все',
                    emoji: '✨',
                    active: _category == null,
                    onTap: () => setState(() => _category = null),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  ...PosterCategory.values.map((category) => Padding(
                        padding: const EdgeInsets.only(right: AppSpacing.xs),
                        child: _CategoryChip(
                          label: category.label,
                          emoji: category.emoji,
                          active: _category == category,
                          onTap: () => setState(() => _category = category),
                        ),
                      )),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Text(
                        'Ничего не нашли. Попробуй другой запрос.',
                        style:
                            AppTextStyles.meta.copyWith(color: colors.inkMute),
                        textAlign: TextAlign.center,
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final poster = filtered[index];
                        final selected = widget.initialValue?.id == poster.id;
                        return Material(
                          color: selected ? colors.muted : Colors.transparent,
                          borderRadius: BorderRadius.circular(16),
                          child: InkWell(
                            onTap: () => Navigator.of(context).pop(poster),
                            borderRadius: BorderRadius.circular(16),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Row(
                                children: [
                                  Container(
                                    width: 48,
                                    height: 48,
                                    decoration: BoxDecoration(
                                      color: colors.primarySoft,
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      poster.emoji,
                                      style: const TextStyle(fontSize: 24),
                                    ),
                                  ),
                                  const SizedBox(width: AppSpacing.sm),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          poster.title,
                                          style: AppTextStyles.body.copyWith(
                                            fontWeight: FontWeight.w600,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '${poster.dateLabel} · ${poster.timeLabel}',
                                          style: AppTextStyles.meta.copyWith(
                                            color: colors.inkMute,
                                          ),
                                        ),
                                        Text(
                                          poster.venue,
                                          style: AppTextStyles.meta.copyWith(
                                            color: colors.inkMute,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: AppSpacing.sm),
                                  Text(
                                    poster.priceLabel,
                                    style: AppTextStyles.meta.copyWith(
                                      color: colors.primary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
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

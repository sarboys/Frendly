import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/after_party_state.dart';
import 'package:big_break_mobile/shared/widgets/async_value_view.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class AfterPartyScreen extends ConsumerStatefulWidget {
  const AfterPartyScreen({
    required this.eventId,
    super.key,
  });

  final String eventId;

  @override
  ConsumerState<AfterPartyScreen> createState() => _AfterPartyScreenState();
}

class _AfterPartyScreenState extends ConsumerState<AfterPartyScreen> {
  String _vibe = 'cozy';
  int _stars = 5;
  String _note = '';
  final Set<String> _favorites = {};
  bool _initialized = false;
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final afterPartyAsync = ref.watch(afterPartyProvider(widget.eventId));

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: AsyncValueView<AfterPartyData>(
          value: afterPartyAsync,
          data: (state) {
            if (!_initialized) {
              _initialized = true;
              _vibe = state.vibe ?? 'cozy';
              _stars = state.hostRating ?? 5;
              _note = state.note ?? '';
              _favorites
                ..clear()
                ..addAll(state.favoriteUserIds);
            }

            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => context.pop(),
                        icon: const Icon(Icons.chevron_left_rounded, size: 28),
                      ),
                      const Spacer(),
                      TextButton(
                        onPressed: () => context.pop(),
                        child: Text(
                          'Пропустить',
                          style: AppTextStyles.meta.copyWith(
                            color: colors.inkSoft,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                    children: [
                      Center(
                        child: Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [colors.warmStart, colors.warmEnd],
                            ),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            state.emoji,
                            style: const TextStyle(fontSize: 30),
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        'Как прошёл вечер?',
                        textAlign: TextAlign.center,
                        style: AppTextStyles.sectionTitle,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        state.title,
                        textAlign: TextAlign.center,
                        style: AppTextStyles.meta,
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Text(
                        'Вайб встречи',
                        style: AppTextStyles.caption.copyWith(
                          color: colors.inkMute,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Row(
                        children: [
                          for (final option in const [
                            ('magic', '✨', 'Магия'),
                            ('cozy', '🤍', 'Уютно'),
                            ('ok', '🙂', 'Норм'),
                            ('meh', '😐', 'Не то'),
                          ])
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: GestureDetector(
                                  onTap: () =>
                                      setState(() => _vibe = option.$1),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 14,
                                    ),
                                    decoration: BoxDecoration(
                                      color: colors.card,
                                      borderRadius: BorderRadius.circular(18),
                                      border: Border.all(
                                        color: _vibe == option.$1
                                            ? colors.foreground
                                            : colors.border,
                                        width: _vibe == option.$1 ? 2 : 1,
                                      ),
                                    ),
                                    child: Column(
                                      children: [
                                        Text(option.$2,
                                            style:
                                                const TextStyle(fontSize: 24)),
                                        const SizedBox(height: 6),
                                        Text(
                                          option.$3,
                                          style: AppTextStyles.meta.copyWith(
                                            color: colors.inkSoft,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        'Оценка хосту',
                        style: AppTextStyles.caption.copyWith(
                          color: colors.inkMute,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          vertical: AppSpacing.lg,
                        ),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: AppRadii.cardBorder,
                          border: Border.all(color: colors.border),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(
                            5,
                            (index) => IconButton(
                              onPressed: () =>
                                  setState(() => _stars = index + 1),
                              icon: Icon(
                                LucideIcons.star,
                                color: index < _stars
                                    ? colors.primary
                                    : colors.border,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        'С кем ещё встретился бы',
                        style: AppTextStyles.caption.copyWith(
                          color: colors.inkMute,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Container(
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: AppRadii.cardBorder,
                          border: Border.all(color: colors.border),
                        ),
                        child: Column(
                          children: state.attendees
                              .map(
                                (attendee) => Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: AppSpacing.md,
                                    vertical: 14,
                                  ),
                                  decoration: BoxDecoration(
                                    border: Border(
                                      bottom: BorderSide(
                                        color: attendee == state.attendees.last
                                            ? Colors.transparent
                                            : colors.border,
                                      ),
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      BbAvatar(
                                        name: attendee.displayName,
                                        imageUrl: attendee.avatarUrl,
                                      ),
                                      const SizedBox(width: AppSpacing.sm),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              attendee.displayName,
                                              style: AppTextStyles.itemTitle,
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              _favorites
                                                      .contains(attendee.userId)
                                                  ? 'В избранном'
                                                  : 'Тапни сердце',
                                              style:
                                                  AppTextStyles.meta.copyWith(
                                                color: colors.inkMute,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      IconButton(
                                        onPressed: () {
                                          setState(() {
                                            if (_favorites
                                                .contains(attendee.userId)) {
                                              _favorites
                                                  .remove(attendee.userId);
                                            } else {
                                              _favorites.add(attendee.userId);
                                            }
                                          });
                                        },
                                        icon: Icon(
                                          LucideIcons.heart,
                                          color: _favorites
                                                  .contains(attendee.userId)
                                              ? colors.primary
                                              : colors.inkMute,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              )
                              .toList(growable: false),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Они увидят это, только если тоже отметят тебя.',
                        style: AppTextStyles.meta.copyWith(
                          color: colors.inkMute,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        'Заметка для себя',
                        style: AppTextStyles.caption.copyWith(
                          color: colors.inkMute,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: AppRadii.cardBorder,
                          border: Border.all(color: colors.border),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Icon(
                                LucideIcons.sparkles,
                                size: 16,
                                color: colors.primary,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: TextFormField(
                                initialValue: _note,
                                minLines: 2,
                                maxLines: 4,
                                onChanged: (value) => _note = value,
                                decoration: InputDecoration(
                                  hintText:
                                      'Что запомнилось? Только ты увидишь.',
                                  hintStyle: AppTextStyles.bodySoft
                                      .copyWith(color: colors.inkMute),
                                  border: InputBorder.none,
                                  contentPadding: EdgeInsets.zero,
                                ),
                                style: AppTextStyles.bodySoft,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                SafeArea(
                  top: false,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: colors.background.withValues(alpha: 0.92),
                      border: Border(
                        top: BorderSide(
                          color: colors.border.withValues(alpha: 0.6),
                        ),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                      child: SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: colors.foreground,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(18),
                            ),
                          ),
                          onPressed: _saving
                              ? null
                              : () async {
                                  setState(() {
                                    _saving = true;
                                  });
                                  try {
                                    await ref
                                        .read(backendRepositoryProvider)
                                        .saveAfterParty(
                                          widget.eventId,
                                          vibe: _vibe,
                                          hostRating: _stars,
                                          favoriteUserIds: _favorites.toList(),
                                          note: _note,
                                        );
                                    ref.invalidate(
                                        afterPartyProvider(widget.eventId));
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(
                                        context,
                                      ).showSnackBar(
                                        const SnackBar(
                                          content: Text('Фидбек сохранён'),
                                        ),
                                      );
                                      context.pop();
                                    }
                                  } catch (_) {
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(
                                        const SnackBar(
                                          content: Text(
                                            'Не получилось сохранить фидбек',
                                          ),
                                        ),
                                      );
                                    }
                                  } finally {
                                    if (mounted) {
                                      setState(() {
                                        _saving = false;
                                      });
                                    }
                                  }
                                },
                          child: Text(
                            'Сохранить',
                            style: AppTextStyles.button.copyWith(
                              color: colors.primaryForeground,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

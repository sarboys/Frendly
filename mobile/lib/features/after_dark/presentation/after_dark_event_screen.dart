import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_models.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class AfterDarkEventScreen extends ConsumerStatefulWidget {
  const AfterDarkEventScreen({
    required this.eventId,
    super.key,
  });

  final String eventId;

  @override
  ConsumerState<AfterDarkEventScreen> createState() =>
      _AfterDarkEventScreenState();
}

class _AfterDarkEventScreenState extends ConsumerState<AfterDarkEventScreen> {
  bool _agreed = false;
  bool _submitting = false;
  bool _requestSubmitted = false;

  @override
  Widget build(BuildContext context) {
    final accessAsync = ref.watch(afterDarkAccessProvider);
    final preview = ref
        .watch(afterDarkEventsProvider)
        .valueOrNull
        ?.where((item) => item.id == widget.eventId)
        .firstOrNull;
    final detailAsync = ref.watch(afterDarkEventDetailProvider(widget.eventId));

    return Scaffold(
      backgroundColor: AppColors.adBg,
      body: SafeArea(
        bottom: false,
        child: detailAsync.when(
          data: (event) {
            final access =
                accessAsync.valueOrNull ?? const AfterDarkAccessData.fallback();
            final needsVerification =
                event.category == 'kink' && !access.kinkVerified;
            final canApply = !event.consentRequired || _agreed;
            final isPending = _requestSubmitted || event.isPending;
            final ctaLabel = needsVerification
                ? 'Пройти верификацию'
                : isPending
                    ? 'Заявка отправлена'
                    : event.joined && event.chatId != null
                        ? 'Открыть чат'
                        : event.consentRequired
                            ? canApply
                                ? 'Подать заявку'
                                : 'Прими правила выше'
                            : 'Зарезервировать место';

            return Stack(
              children: [
                ListView(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 200),
                  children: [
                    Row(
                      children: [
                        IconButton(
                          onPressed: () => context.pop(),
                          icon: const Icon(
                            Icons.chevron_left_rounded,
                            size: 28,
                            color: AppColors.adFg,
                          ),
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.adSurface,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: AppColors.adBorder),
                          ),
                          child: Text(
                            '18+',
                            style: AppTextStyles.caption.copyWith(
                              color: AppColors.adFg,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    Container(
                      margin: const EdgeInsets.only(top: AppSpacing.md),
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            AppColors.afterDarkGradientStart,
                            AppColors.afterDarkGradientMid,
                            AppColors.afterDarkGradientEnd,
                          ],
                        ),
                        borderRadius: BorderRadius.circular(28),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(event.emoji,
                              style: const TextStyle(fontSize: 64)),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            event.title,
                            style: AppTextStyles.screenTitle.copyWith(
                              color: AppColors.adFg,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            event.vibe,
                            style: AppTextStyles.bodySoft.copyWith(
                              color: AppColors.adFgSoft,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: [
                        _InfoTile(
                          tileKey: const ValueKey('after-dark-info-Когда'),
                          label: 'Когда',
                          value: event.time,
                        ),
                        _InfoTile(
                          tileKey: const ValueKey('after-dark-info-Где'),
                          label: 'Где',
                          value: event.district,
                        ),
                        _InfoTile(
                          tileKey: const ValueKey('after-dark-info-Состав'),
                          label: 'Состав',
                          value: '${event.going}/${event.capacity}',
                          subtitle: event.ratio,
                        ),
                        _InfoTile(
                          tileKey: const ValueKey('after-dark-info-Возраст'),
                          label: 'Возраст',
                          value: event.ageRange,
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      'О событии',
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.adFgMute,
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      event.description,
                      style: AppTextStyles.body.copyWith(
                        color: AppColors.adFgSoft,
                      ),
                    ),
                    if (event.hostNote != null) ...[
                      const SizedBox(height: AppSpacing.lg),
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: AppColors.adSurface,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.adBorder),
                        ),
                        child: Text(
                          '«${event.hostNote}»',
                          style: AppTextStyles.bodySoft.copyWith(
                            color: AppColors.adFg,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      'Правила вечера',
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.adFgMute,
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    ...event.rules.map(
                      (rule) => Container(
                        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: AppColors.adSurface,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: AppColors.adBorder),
                        ),
                        child: Text(
                          rule,
                          style: AppTextStyles.bodySoft.copyWith(
                            color: AppColors.adFgSoft,
                          ),
                        ),
                      ),
                    ),
                    if (event.consentRequired) ...[
                      const SizedBox(height: AppSpacing.sm),
                      InkWell(
                        key: const ValueKey('after-dark-event-consent'),
                        onTap: () => setState(() {
                          _agreed = !_agreed;
                        }),
                        borderRadius: BorderRadius.circular(18),
                        child: Container(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          decoration: BoxDecoration(
                            color: AppColors.adMagentaSoft,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: AppColors.adBorder),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 22,
                                height: 22,
                                margin: const EdgeInsets.only(top: 2),
                                decoration: BoxDecoration(
                                  color: _agreed
                                      ? AppColors.adMagenta
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                    color: _agreed
                                        ? AppColors.adMagenta
                                        : AppColors.adBorder,
                                    width: 2,
                                  ),
                                ),
                                child: _agreed
                                    ? const Icon(
                                        Icons.check_rounded,
                                        size: 16,
                                        color: AppColors.adFg,
                                      )
                                    : null,
                              ),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: Text(
                                  'Прочитал(-а) и принимаю все правила вечера. Понимаю, что нарушение ведёт к немедленной блокировке.',
                                  style: AppTextStyles.bodySoft.copyWith(
                                    color: AppColors.adFg,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                    decoration: BoxDecoration(
                      color: AppColors.adBg.withValues(alpha: 0.96),
                      border: const Border(
                        top: BorderSide(color: AppColors.adBorder),
                      ),
                    ),
                    child: SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: needsVerification
                              ? AppColors.adViolet
                              : AppColors.adMagenta,
                          foregroundColor: AppColors.adFg,
                          disabledBackgroundColor: AppColors.adSurface,
                          disabledForegroundColor: AppColors.adFgMute,
                          shape: const RoundedRectangleBorder(
                            borderRadius: AppRadii.cardBorder,
                          ),
                          elevation: 0,
                          shadowColor: Colors.transparent,
                        ),
                        onPressed: (isPending ||
                                _submitting ||
                                (event.consentRequired && !canApply))
                            ? null
                            : () => _handlePrimaryAction(
                                  context,
                                  event,
                                  needsVerification: needsVerification,
                                  acceptedRules:
                                      !event.consentRequired || _agreed,
                                ),
                        child: Text(
                          ctaLabel,
                          style: AppTextStyles.button.copyWith(
                            color: AppColors.adFg,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
          loading: () => preview == null
              ? const Center(
                  child: CircularProgressIndicator(color: AppColors.adMagenta),
                )
              : _AfterDarkPreview(event: preview),
          error: (_, __) => Center(
            child: Text(
              'Не получилось загрузить событие',
              style: AppTextStyles.body.copyWith(color: AppColors.adFgSoft),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _handlePrimaryAction(
    BuildContext context,
    AfterDarkEventDetail event, {
    required bool needsVerification,
    required bool acceptedRules,
  }) async {
    if (needsVerification) {
      await context.pushRoute(AppRoute.afterDarkVerify);
      return;
    }

    if (event.chatId != null) {
      await context.pushRoute(
        AppRoute.meetupChat,
        pathParameters: {'chatId': event.chatId!},
        queryParameters: {
          'theme': 'after-dark',
          'glow': event.glow,
        },
      );
      return;
    }

    setState(() {
      _submitting = true;
    });
    try {
      final response =
          await ref.read(backendRepositoryProvider).joinAfterDarkEvent(
                event.id,
                acceptedRules: acceptedRules,
              );
      if ((response['status'] as String?) == 'pending') {
        setState(() {
          _requestSubmitted = true;
        });
      }
      ref.invalidate(afterDarkEventDetailProvider(event.id));
    } catch (_) {
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не получилось отправить действие.')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.label,
    required this.value,
    this.subtitle,
    this.tileKey,
  });

  final String label;
  final String value;
  final String? subtitle;
  final Key? tileKey;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: tileKey,
      height: 116,
      constraints: const BoxConstraints(minWidth: 140),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.adSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.adBorder),
        boxShadow: AppShadows.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: AppColors.adFgMute,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            value,
            style: AppTextStyles.body.copyWith(
              color: AppColors.adFg,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          Text(
            subtitle ?? ' ',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.meta.copyWith(
              color: subtitle == null ? Colors.transparent : AppColors.adFgSoft,
            ),
          ),
        ],
      ),
    );
  }
}

class _AfterDarkPreview extends StatelessWidget {
  const _AfterDarkPreview({
    required this.event,
  });

  final AfterDarkEvent event;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: [
        Row(
          children: [
            IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(
                Icons.chevron_left_rounded,
                size: 28,
                color: AppColors.adFg,
              ),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.adSurface,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.adBorder),
              ),
              child: Text(
                '18+',
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.adFg,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        Container(
          margin: const EdgeInsets.only(top: AppSpacing.md),
          padding: const EdgeInsets.all(AppSpacing.xl),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.afterDarkGradientStart,
                AppColors.afterDarkGradientMid,
                AppColors.afterDarkGradientEnd,
              ],
            ),
            borderRadius: BorderRadius.circular(28),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(event.emoji, style: const TextStyle(fontSize: 64)),
              const SizedBox(height: AppSpacing.sm),
              Text(
                event.title,
                style: AppTextStyles.screenTitle.copyWith(
                  color: AppColors.adFg,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                event.vibe,
                style: AppTextStyles.bodySoft.copyWith(
                  color: AppColors.adFgSoft,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            _InfoTile(label: 'Когда', value: event.time),
            _InfoTile(label: 'Где', value: event.district),
            _InfoTile(
              label: 'Состав',
              value: '${event.going}/${event.capacity}',
              subtitle: event.ratio,
            ),
            _InfoTile(label: 'Возраст', value: event.ageRange),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          'Подгружаем детали события',
          style: AppTextStyles.bodySoft.copyWith(
            color: AppColors.adFgSoft,
          ),
        ),
      ],
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

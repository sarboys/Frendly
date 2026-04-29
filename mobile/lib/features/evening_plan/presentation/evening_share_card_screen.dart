import 'dart:async';
import 'dart:ui' as ui;

import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:big_break_mobile/app/core/device/social_share_service.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/public_share.dart';
import 'package:big_break_mobile/shared/widgets/async_value_view.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:big_break_mobile/shared/widgets/bb_brand_icon.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class EveningShareCardScreen extends ConsumerStatefulWidget {
  const EveningShareCardScreen({
    required this.sessionId,
    super.key,
  });

  final String sessionId;

  @override
  ConsumerState<EveningShareCardScreen> createState() =>
      _EveningShareCardScreenState();
}

class _EveningShareCardScreenState
    extends ConsumerState<EveningShareCardScreen> {
  final _storyKey = GlobalKey();
  final _shareService = const SocialShareService();
  late final Future<PublicShareLink> _shareFuture;
  bool _copied = false;
  bool _sharingStory = false;
  Timer? _copiedTimer;

  @override
  void initState() {
    super.initState();
    _shareFuture = ref.read(backendRepositoryProvider).createPublicShare(
          targetType: 'evening_session',
          targetId: widget.sessionId,
        );
  }

  @override
  void dispose() {
    _copiedTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final sessionAsync = ref.watch(eveningSessionProvider(widget.sessionId));

    return Scaffold(
      backgroundColor: colors.foreground,
      body: SafeArea(
        child: AsyncValueView<EveningSessionDetail>(
          value: sessionAsync,
          data: (session) {
            return FutureBuilder<PublicShareLink>(
              future: _shareFuture,
              builder: (context, shareSnapshot) {
                final share = shareSnapshot.data;
                final link = share?.url ?? 'Готовим ссылку...';
                final shareReady = share != null;

                return ListView(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                  children: [
                    Row(
                      children: [
                        IconButton(
                          onPressed: () => context.pop(),
                          icon: Icon(
                            Icons.chevron_left_rounded,
                            size: 28,
                            color: colors.primaryForeground,
                          ),
                        ),
                        Text(
                          'Поделиться вечером',
                          style: AppTextStyles.itemTitle.copyWith(
                            color: colors.primaryForeground,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    RepaintBoundary(
                      key: _storyKey,
                      child: _EveningStoryCard(
                        session: session,
                        link: link,
                      ),
                    ),
                    if (shareSnapshot.hasError) ...[
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        'Не удалось создать публичную ссылку',
                        style: AppTextStyles.meta.copyWith(
                          color:
                              colors.primaryForeground.withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.xl),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _ShareAction(
                          label: 'Telegram',
                          background: const Color(0xFF2BA7E3),
                          enabled: shareReady,
                          onTap: () => _shareTelegram(session, share),
                        ),
                        const SizedBox(width: AppSpacing.xl),
                        _ShareAction(
                          label: 'Stories',
                          gradient: const [
                            Color(0xFF9B45D9),
                            Color(0xFFE26A52),
                          ],
                          enabled: shareReady && !_sharingStory,
                          busy: _sharingStory,
                          onTap: () => _shareInstagramStory(share),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    OutlinedButton(
                      onPressed: shareReady ? () => _copyLink(share.url) : null,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        side: BorderSide(
                          color:
                              colors.primaryForeground.withValues(alpha: 0.15),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _copied ? Icons.check_rounded : Icons.copy_rounded,
                            color: _copied
                                ? colors.secondary
                                : colors.primaryForeground,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              link,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.meta.copyWith(
                                color: colors.primaryForeground,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          Text(
                            _copied ? 'Скопировано' : 'Копировать',
                            style: AppTextStyles.meta.copyWith(
                              color: colors.primaryForeground
                                  .withValues(alpha: 0.75),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }

  Future<void> _shareTelegram(
    EveningSessionDetail session,
    PublicShareLink? share,
  ) async {
    if (share == null) {
      return;
    }

    final opened = await _shareService.shareToTelegram(
      url: share.url,
      text: 'Иду на ${session.title} в Frendly',
    );
    if (!opened) {
      await _copyLink(share.url);
      _showSnack('Telegram не открылся. Ссылка скопирована.');
    }
  }

  Future<void> _shareInstagramStory(PublicShareLink? share) async {
    if (share == null || _sharingStory) {
      return;
    }

    setState(() {
      _sharingStory = true;
    });

    try {
      final imageBytes = await _captureStoryCard();
      final opened = await _shareService.shareToInstagramStories(
        backgroundImageBytes: imageBytes,
        contentUrl: share.url,
        facebookAppId: BackendConfig.facebookAppId,
      );
      if (!opened) {
        await _copyLink(share.url);
        _showSnack('Instagram не открылся. Ссылка скопирована.');
      }
    } catch (_) {
      await _copyLink(share.url);
      _showSnack('Не удалось подготовить сторис. Ссылка скопирована.');
    } finally {
      if (mounted) {
        setState(() {
          _sharingStory = false;
        });
      }
    }
  }

  Future<Uint8List> _captureStoryCard() async {
    final context = _storyKey.currentContext;
    final boundary = context?.findRenderObject() as RenderRepaintBoundary?;
    if (boundary == null) {
      throw StateError('Share card is not ready');
    }

    final image = await boundary.toImage(pixelRatio: 3);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    final bytes = byteData?.buffer.asUint8List();
    if (bytes == null) {
      throw StateError('Could not render share card');
    }

    return bytes;
  }

  Future<void> _copyLink(String link) async {
    await Clipboard.setData(ClipboardData(text: link));
    if (!mounted) {
      return;
    }

    _copiedTimer?.cancel();
    setState(() {
      _copied = true;
    });
    _copiedTimer = Timer(const Duration(milliseconds: 1800), () {
      if (mounted) {
        setState(() {
          _copied = false;
        });
      }
    });
  }

  void _showSnack(String message) {
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}

class _EveningStoryCard extends StatelessWidget {
  const _EveningStoryCard({
    required this.session,
    required this.link,
  });

  final EveningSessionDetail session;
  final String link;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final participantNames = session.participants
        .map((item) => item.name.trim())
        .where((name) => name.isNotEmpty)
        .toList(growable: false);
    final visibleSteps = session.steps.take(3).toList(growable: false);

    return Container(
      height: 520,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            colors.primary,
            colors.primary.withValues(alpha: 0.82),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const BbBrandIcon(size: 32, radius: 12),
          const Spacer(),
          Text(session.emoji, style: const TextStyle(fontSize: 64)),
          const SizedBox(height: AppSpacing.md),
          Text(
            _sessionTimeLabel(session),
            style: AppTextStyles.caption.copyWith(
              color: colors.primaryForeground.withValues(alpha: 0.85),
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            session.title,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.screenTitle.copyWith(
              color: colors.primaryForeground,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            session.vibe,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodySoft.copyWith(
              color: colors.primaryForeground.withValues(alpha: 0.9),
            ),
          ),
          if (visibleSteps.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            for (var index = 0; index < visibleSteps.length; index++) ...[
              _StoryStep(
                index: index,
                step: visibleSteps[index],
              ),
              if (index != visibleSteps.length - 1)
                const SizedBox(height: AppSpacing.xs),
            ],
          ],
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              if (participantNames.isNotEmpty) ...[
                BbAvatarStack(
                  names: participantNames,
                  size: BbAvatarSize.xs,
                  max: 4,
                ),
                const SizedBox(width: AppSpacing.sm),
              ],
              Expanded(
                child: Text(
                  _participantsLabel(session),
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.meta.copyWith(
                    color: colors.primaryForeground.withValues(alpha: 0.85),
                  ),
                ),
              ),
            ],
          ),
          const Spacer(),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Присоединяйся',
                      style: AppTextStyles.caption.copyWith(
                        color: colors.primaryForeground.withValues(alpha: 0.72),
                        letterSpacing: 1,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      link,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.itemTitle.copyWith(
                        color: colors.primaryForeground,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Container(
                width: 48,
                height: 48,
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: colors.primaryForeground,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.link_rounded,
                  color: colors.foreground,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StoryStep extends StatelessWidget {
  const _StoryStep({
    required this.index,
    required this.step,
  });

  final int index;
  final EveningSessionStep step;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Row(
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: colors.primaryForeground.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(8),
          ),
          alignment: Alignment.center,
          child: Text(
            '${index + 1}',
            style: AppTextStyles.caption.copyWith(
              color: colors.primaryForeground,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(
            '${step.time} · ${step.venue}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.caption.copyWith(
              color: colors.primaryForeground.withValues(alpha: 0.82),
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

class _ShareAction extends StatelessWidget {
  const _ShareAction({
    required this.label,
    required this.onTap,
    this.background,
    this.gradient,
    this.enabled = true,
    this.busy = false,
  });

  final String label;
  final Future<void> Function() onTap;
  final Color? background;
  final List<Color>? gradient;
  final bool enabled;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return SizedBox(
      width: 88,
      child: InkWell(
        onTap: enabled ? () => onTap() : null,
        borderRadius: BorderRadius.circular(16),
        child: Opacity(
          opacity: enabled ? 1 : 0.45,
          child: Column(
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: background,
                  gradient: gradient == null
                      ? null
                      : LinearGradient(
                          colors: gradient!,
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                  borderRadius: BorderRadius.circular(16),
                ),
                alignment: Alignment.center,
                child: busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(
                        Icons.send_rounded,
                        color: Colors.white,
                      ),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: AppTextStyles.caption.copyWith(
                  color: colors.primaryForeground,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _sessionTimeLabel(EveningSessionDetail session) {
  if (session.steps.isEmpty) {
    return _stepsCountLabel(session.totalSteps ?? 0);
  }

  final start = session.steps.first.time.trim();
  var end = '';
  for (final step in session.steps.reversed) {
    final candidate = (step.endTime == null || step.endTime!.trim().isEmpty)
        ? step.time.trim()
        : step.endTime!.trim();
    if (candidate.isNotEmpty) {
      end = candidate;
      break;
    }
  }

  if (start.isEmpty) {
    return end.isEmpty ? _stepsCountLabel(session.steps.length) : end;
  }
  if (end.isEmpty || end == start) {
    return start;
  }
  return '$start - $end';
}

String _participantsLabel(EveningSessionDetail session) {
  final joined = session.joinedCount ?? session.participants.length;
  final total = session.maxGuests;
  final place = session.area?.trim();
  final count = total == null ? '$joined идут' : '$joined из $total';
  if (place == null || place.isEmpty) {
    return '$count · ${_stepsCountLabel(session.totalSteps ?? session.steps.length)}';
  }
  return '$count · $place';
}

String _stepsCountLabel(int count) {
  final mod10 = count % 10;
  final mod100 = count % 100;
  final word = mod10 == 1 && mod100 != 11
      ? 'шаг'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? 'шага'
          : 'шагов';
  return '$count $word';
}

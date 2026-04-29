import 'dart:async';
import 'dart:ui' as ui;

import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:big_break_mobile/app/core/device/social_share_service.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/event_detail.dart';
import 'package:big_break_mobile/shared/models/public_share.dart';
import 'package:big_break_mobile/shared/widgets/async_value_view.dart';
import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:big_break_mobile/shared/widgets/bb_brand_icon.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ShareCardScreen extends ConsumerStatefulWidget {
  const ShareCardScreen({
    required this.eventId,
    super.key,
  });

  final String eventId;

  @override
  ConsumerState<ShareCardScreen> createState() => _ShareCardScreenState();
}

class _ShareCardScreenState extends ConsumerState<ShareCardScreen> {
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
          targetType: 'event',
          targetId: widget.eventId,
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
    final eventAsync = ref.watch(eventDetailProvider(widget.eventId));

    return Scaffold(
      backgroundColor: colors.foreground,
      body: SafeArea(
        child: AsyncValueView<EventDetail>(
          value: eventAsync,
          data: (event) {
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
                          'Поделиться',
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
                      child: _StoryCard(event: event, link: link),
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
                          onTap: () => _shareTelegram(event, share),
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
    EventDetail event,
    PublicShareLink? share,
  ) async {
    if (share == null) {
      return;
    }

    final opened = await _shareService.shareToTelegram(
      url: share.url,
      text: 'Иду на ${event.title} в Frendly',
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

class _StoryCard extends StatelessWidget {
  const _StoryCard({
    required this.event,
    required this.link,
  });

  final EventDetail event;
  final String link;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      height: 480,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            colors.primary,
            colors.primary.withValues(alpha: 0.8),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              BbBrandIcon(size: 32, radius: 12),
            ],
          ),
          const Spacer(),
          Text(event.emoji, style: const TextStyle(fontSize: 72)),
          const SizedBox(height: AppSpacing.md),
          Text(
            event.time,
            style: AppTextStyles.caption.copyWith(
              color: colors.primaryForeground.withValues(alpha: 0.85),
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            event.title,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.screenTitle.copyWith(
              color: colors.primaryForeground,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            event.place,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodySoft.copyWith(
              color: colors.primaryForeground.withValues(alpha: 0.9),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              BbAvatarStack(
                names: event.attendees
                    .map((item) => item.displayName)
                    .toList(growable: false),
                size: BbAvatarSize.xs,
                max: 4,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  '${event.going} из ${event.capacity} · ${event.vibe}',
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

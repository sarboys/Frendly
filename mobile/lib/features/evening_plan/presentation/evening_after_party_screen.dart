import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_plan_data.dart';
import 'package:big_break_mobile/app/core/device/app_media_picker_service.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class EveningAfterPartyScreen extends ConsumerStatefulWidget {
  const EveningAfterPartyScreen({
    required this.routeId,
    this.sessionId,
    super.key,
  });

  final String routeId;
  final String? sessionId;

  @override
  ConsumerState<EveningAfterPartyScreen> createState() =>
      _EveningAfterPartyScreenState();
}

class _EveningAfterPartyScreenState
    extends ConsumerState<EveningAfterPartyScreen> {
  String _reaction = 'top';
  bool _saved = false;
  bool _photoUploading = false;
  _AfterPartySnapshot? _snapshot;

  @override
  void initState() {
    super.initState();
    _loadAfterPartySnapshot();
  }

  Future<void> _loadAfterPartySnapshot() async {
    final sessionId = widget.sessionId;
    if (sessionId == null || sessionId.isEmpty) {
      return;
    }
    try {
      final json =
          await ref.read(backendRepositoryProvider).fetchEveningAfterParty(
                sessionId,
              );
      if (!mounted) {
        return;
      }
      final snapshot = _AfterPartySnapshot.fromJson(json);
      setState(() {
        _snapshot = snapshot;
        if (snapshot.myReaction != null && snapshot.myReaction!.isNotEmpty) {
          _reaction = snapshot.myReaction!;
        }
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final route = findEveningRoute(widget.routeId);
    final snapshot = _snapshot;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.goRoute(AppRoute.tonight),
                    icon: const Icon(LucideIcons.x),
                  ),
                  const Spacer(),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                children: [
                  Center(
                    child: Container(
                      width: 66,
                      height: 66,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [colors.warmStart, colors.warmEnd],
                        ),
                        borderRadius: BorderRadius.circular(22),
                      ),
                      alignment: Alignment.center,
                      child: const Text('🎉', style: TextStyle(fontSize: 32)),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    'Вечер удался!',
                    textAlign: TextAlign.center,
                    style: AppTextStyles.screenTitle.copyWith(fontSize: 24),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    route.title,
                    textAlign: TextAlign.center,
                    style: AppTextStyles.meta.copyWith(color: colors.inkMute),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    children: [
                      _StatCard(
                          label: 'Длительность', value: route.durationLabel),
                      const SizedBox(width: AppSpacing.sm),
                      _StatCard(
                        label: snapshot == null ? 'Места' : 'Участники',
                        value: snapshot == null
                            ? '${route.steps.length} из ${route.steps.length}'
                            : '${snapshot.participantsCount}',
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      _StatCard(
                        label: snapshot == null ? 'Перки' : 'Оценка',
                        value: snapshot == null
                            ? '${route.totalSavings} ₽'
                            : snapshot.ratingLabel,
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  OutlinedButton.icon(
                    onPressed: _photoUploading ? null : _addPhoto,
                    icon: Icon(
                      _photoUploading
                          ? LucideIcons.loader_circle
                          : LucideIcons.camera,
                      size: 18,
                    ),
                    label: Text(
                      _photoUploading ? 'Добавляем' : 'Добавить фото',
                    ),
                  ),
                  if (snapshot != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Фото вечера: ${snapshot.photoCount}',
                      textAlign: TextAlign.center,
                      style: AppTextStyles.caption.copyWith(
                        color: colors.inkMute,
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'Оценка участников',
                    style: AppTextStyles.caption.copyWith(
                      color: colors.inkMute,
                      letterSpacing: 1,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      _ReactionCard(
                        id: 'top',
                        active: _reaction == 'top',
                        emoji: '👍',
                        label: 'Топ компания',
                        onTap: _setReaction,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      _ReactionCard(
                        id: 'fire',
                        active: _reaction == 'fire',
                        emoji: '🔥',
                        label: 'Огонь вечер',
                        onTap: _setReaction,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      _ReactionCard(
                        id: 'repeat',
                        active: _reaction == 'repeat',
                        emoji: '💫',
                        label: 'Хочу повторить',
                        onTap: _setReaction,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed:
                            _saved ? null : () => setState(() => _saved = true),
                        icon: Icon(
                          _saved
                              ? LucideIcons.circle_check
                              : LucideIcons.bookmark,
                          size: 16,
                        ),
                        label: Text(_saved ? 'Сохранено' : 'Сохранить шаблон'),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: FilledButton(
                        onPressed: () => context.goRoute(AppRoute.tonight),
                        child: const Text('Закрыть'),
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

  Future<void> _setReaction(String value) async {
    final previousReaction = _reaction;
    setState(() {
      _reaction = value;
    });
    final saved = await _saveFeedback(value);
    if (!saved && mounted) {
      setState(() => _reaction = previousReaction);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не получилось сохранить оценку')),
      );
    }
  }

  Future<bool> _saveFeedback(String reaction) async {
    final sessionId = widget.sessionId;
    if (sessionId == null || sessionId.isEmpty) {
      return true;
    }
    try {
      await ref.read(backendRepositoryProvider).saveEveningAfterPartyFeedback(
            sessionId,
            rating: 5,
            reaction: reaction,
          );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _addPhoto() async {
    final sessionId = widget.sessionId;
    if (sessionId == null || sessionId.isEmpty) {
      return;
    }
    setState(() => _photoUploading = true);
    try {
      final file =
          await ref.read(appMediaPickerServiceProvider).pickFromGallery();
      if (file == null) {
        return;
      }
      final repository = ref.read(backendRepositoryProvider);
      final session = await repository.fetchEveningSession(sessionId);
      final assetId = await repository.uploadChatAttachment(
        file,
        chatId: session.chatId,
      );
      await repository.addEveningAfterPartyPhoto(sessionId, assetId: assetId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Фото добавлено')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не получилось добавить фото')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _photoUploading = false);
      }
    }
  }
}

class _AfterPartySnapshot {
  const _AfterPartySnapshot({
    required this.participantsCount,
    required this.ratingAverage,
    required this.photoCount,
    required this.myReaction,
  });

  final int participantsCount;
  final double? ratingAverage;
  final int photoCount;
  final String? myReaction;

  String get ratingLabel {
    final rating = ratingAverage;
    if (rating == null) {
      return 'нет';
    }
    final value = rating % 1 == 0 ? rating.toInt().toString() : '$rating';
    return '$value/5';
  }

  factory _AfterPartySnapshot.fromJson(Map<String, dynamic> json) {
    final photos = (json['photos'] as List?) ?? const [];
    final myFeedback = json['myFeedback'] is Map
        ? Map<String, dynamic>.from(json['myFeedback'] as Map)
        : null;
    return _AfterPartySnapshot(
      participantsCount: (json['participantsCount'] as num?)?.toInt() ?? 0,
      ratingAverage: (json['ratingAverage'] as num?)?.toDouble(),
      photoCount: photos.length,
      myReaction: myFeedback?['reaction'] as String?,
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: colors.border),
        ),
        child: Column(
          children: [
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.itemTitle.copyWith(fontSize: 14),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption.copyWith(color: colors.inkMute),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReactionCard extends StatelessWidget {
  const _ReactionCard({
    required this.id,
    required this.active,
    required this.emoji,
    required this.label,
    required this.onTap,
  });

  final String id;
  final bool active;
  final String emoji;
  final String label;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Expanded(
      child: InkWell(
        onTap: () => onTap(id),
        borderRadius: AppRadii.cardBorder,
        child: Container(
          key: Key(
            active
                ? 'after-party-reaction-$id-active'
                : 'after-party-reaction-$id-inactive',
          ),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: AppRadii.cardBorder,
            border: Border.all(
              color: active ? colors.foreground : colors.border,
              width: active ? 2 : 1,
            ),
          ),
          child: Column(
            children: [
              Text(emoji, style: const TextStyle(fontSize: 24)),
              const SizedBox(height: 6),
              Text(
                label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: AppTextStyles.meta.copyWith(
                  color: colors.foreground,
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

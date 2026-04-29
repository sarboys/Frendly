import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/communities/domain/community.dart';
import 'package:big_break_mobile/features/communities/presentation/community_providers.dart';
import 'package:big_break_mobile/features/communities/presentation/community_widgets.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

const _avatars = ['🌿', '🍸', '🪩', '🎨', '🎧', '🥐', '♨️', '📚'];
const _purposes = [
  'Городской клуб',
  'Private dining',
  'Wellness',
  'Afters / nightlife',
  'Книжный клуб',
  'Спорт и рутины',
];

class CreateCommunityScreen extends ConsumerStatefulWidget {
  const CreateCommunityScreen({super.key});

  @override
  ConsumerState<CreateCommunityScreen> createState() =>
      _CreateCommunityScreenState();
}

class _CreateCommunityScreenState extends ConsumerState<CreateCommunityScreen> {
  final _nameController = TextEditingController(text: 'Sage Circle');
  final _descriptionController = TextEditingController(
    text:
        'Камерное сообщество для ужинов, прогулок и полезных городских ритуалов. Внутри — чат, новости и свой архив медиа.',
  );
  final _telegramController = TextEditingController();
  final _instagramController = TextEditingController();
  final _tiktokController = TextEditingController();

  var _avatar = _avatars.first;
  var _privacy = CommunityPrivacy.public;
  var _purpose = _purposes.first;
  var _publishing = false;
  String? _createIdempotencyKey;

  @override
  void initState() {
    super.initState();
    _nameController.addListener(_resetCreateIdempotencyKey);
    _descriptionController.addListener(_resetCreateIdempotencyKey);
    _telegramController.addListener(_resetCreateIdempotencyKey);
    _instagramController.addListener(_resetCreateIdempotencyKey);
    _tiktokController.addListener(_resetCreateIdempotencyKey);
  }

  @override
  void dispose() {
    _nameController.removeListener(_resetCreateIdempotencyKey);
    _descriptionController.removeListener(_resetCreateIdempotencyKey);
    _telegramController.removeListener(_resetCreateIdempotencyKey);
    _instagramController.removeListener(_resetCreateIdempotencyKey);
    _tiktokController.removeListener(_resetCreateIdempotencyKey);
    _nameController.dispose();
    _descriptionController.dispose();
    _telegramController.dispose();
    _instagramController.dispose();
    _tiktokController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final subscription = ref.watch(subscriptionStateProvider).valueOrNull;
    final canCreate = hasFrendlyPlusAccess(subscription);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _CreateCommunityHeader(
              onPublish: canCreate && !_publishing ? _publish : null,
            ),
            Expanded(
              child: canCreate
                  ? _CreateCommunityForm(
                      avatar: _avatar,
                      privacy: _privacy,
                      purpose: _purpose,
                      nameController: _nameController,
                      descriptionController: _descriptionController,
                      telegramController: _telegramController,
                      instagramController: _instagramController,
                      tiktokController: _tiktokController,
                      onAvatarChanged: (value) {
                        setState(() {
                          _avatar = value;
                          _resetCreateIdempotencyKey();
                        });
                      },
                      onPrivacyChanged: (value) {
                        setState(() {
                          _privacy = value;
                          _resetCreateIdempotencyKey();
                        });
                      },
                      onPurposeChanged: (value) {
                        setState(() {
                          _purpose = value;
                          _resetCreateIdempotencyKey();
                        });
                      },
                    )
                  : const _CreateCommunityLocked(),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _publish() async {
    if (_publishing) {
      return;
    }

    setState(() {
      _publishing = true;
    });

    try {
      _createIdempotencyKey ??=
          'community-${DateTime.now().microsecondsSinceEpoch}';
      final created = await ref.read(backendRepositoryProvider).createCommunity(
        name: _nameController.text,
        avatar: _avatar,
        description: _descriptionController.text,
        privacy: _privacy,
        purpose: _purpose,
        idempotencyKey: _createIdempotencyKey,
        socialLinks: [
          CommunitySocialLink(
            id: 'telegram',
            label: 'Telegram',
            handle: _telegramController.text.trim(),
          ),
          CommunitySocialLink(
            id: 'instagram',
            label: 'Instagram',
            handle: _instagramController.text.trim(),
          ),
          CommunitySocialLink(
            id: 'tiktok',
            label: 'TikTok',
            handle: _tiktokController.text.trim(),
          ),
        ],
      );

      ref.invalidate(communitiesFeedProvider);
      ref.invalidate(communitiesProvider);
      ref.invalidate(communityProvider(created.id));

      if (!mounted) {
        return;
      }

      context.pushReplacementNamed(
        AppRoute.communityDetail.name,
        pathParameters: {'communityId': created.id},
      );
    } catch (_) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не получилось создать сообщество')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _publishing = false;
        });
      }
    }
  }

  void _resetCreateIdempotencyKey() {
    _createIdempotencyKey = null;
  }
}

class _CreateCommunityHeader extends StatelessWidget {
  const _CreateCommunityHeader({
    required this.onPublish,
  });

  final VoidCallback? onPublish;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: colors.border.withValues(alpha: 0.6)),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(4, 3, 16, 12),
        child: Row(
          children: [
            IconButton(
              onPressed: () => context.pop(),
              icon: Icon(
                LucideIcons.chevron_left,
                size: 28,
                color: colors.foreground,
              ),
            ),
            Expanded(
              child: Text(
                'Новое сообщество',
                textAlign: TextAlign.center,
                style: AppTextStyles.itemTitle.copyWith(
                  color: colors.foreground,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            TextButton(
              onPressed: onPublish,
              child: Text(
                'Создать',
                style: AppTextStyles.meta.copyWith(
                  color: onPublish == null ? colors.inkMute : colors.primary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CreateCommunityForm extends StatelessWidget {
  const _CreateCommunityForm({
    required this.avatar,
    required this.privacy,
    required this.purpose,
    required this.nameController,
    required this.descriptionController,
    required this.telegramController,
    required this.instagramController,
    required this.tiktokController,
    required this.onAvatarChanged,
    required this.onPrivacyChanged,
    required this.onPurposeChanged,
  });

  final String avatar;
  final CommunityPrivacy privacy;
  final String purpose;
  final TextEditingController nameController;
  final TextEditingController descriptionController;
  final TextEditingController telegramController;
  final TextEditingController instagramController;
  final TextEditingController tiktokController;
  final ValueChanged<String> onAvatarChanged;
  final ValueChanged<CommunityPrivacy> onPrivacyChanged;
  final ValueChanged<String> onPurposeChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      children: [
        CommunityInfoCard(
          children: [
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: colors.secondarySoft,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    LucideIcons.crown,
                    size: 20,
                    color: colors.secondary,
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Только Frendly+'.toUpperCase(),
                      style: AppTextStyles.caption.copyWith(
                        color: colors.inkMute,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Новое сообщество',
                      style: AppTextStyles.itemTitle.copyWith(
                        color: colors.foreground,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 24),
        SizedBox(
          height: 56,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _avatars.length,
            separatorBuilder: (_, __) => const SizedBox(width: 6),
            itemBuilder: (context, index) {
              final item = _avatars[index];
              final active = item == avatar;
              return _AvatarChoice(
                value: item,
                active: active,
                onTap: () => onAvatarChanged(item),
              );
            },
          ),
        ),
        const SizedBox(height: 20),
        _TextFieldCard(
          label: 'Название сообщества',
          child: TextField(
            controller: nameController,
            decoration: const InputDecoration(
              isCollapsed: true,
              border: InputBorder.none,
              hintText: 'Например, Sage Circle',
            ),
            style: AppTextStyles.sectionTitle.copyWith(
              color: colors.foreground,
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const SizedBox(height: 16),
        _TextFieldCard(
          label: 'Описание',
          child: TextField(
            controller: descriptionController,
            maxLines: 4,
            decoration: const InputDecoration(
              isCollapsed: true,
              border: InputBorder.none,
              hintText:
                  'Что это за клуб, для кого он и как внутри всё устроено',
            ),
            style: AppTextStyles.bodySoft.copyWith(
              color: colors.foreground,
              fontSize: 14,
              height: 1.45,
            ),
          ),
        ),
        const SizedBox(height: 16),
        _AccessTypeCard(
          privacy: privacy,
          onChanged: onPrivacyChanged,
        ),
        const SizedBox(height: 16),
        _PurposeCard(
          purpose: purpose,
          onChanged: onPurposeChanged,
        ),
        const SizedBox(height: 16),
        const Row(
          children: [
            Expanded(
              child: _MiniFeatureCard(
                icon: LucideIcons.images,
                title: 'Медиа storage',
                text: 'Общий архив материалов сообщества',
              ),
            ),
            SizedBox(width: 12),
            Expanded(
              child: _MiniFeatureCard(
                icon: LucideIcons.megaphone,
                title: 'Новости',
                text: 'Посты, апдейты и напоминания',
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _SocialsCard(
          telegramController: telegramController,
          instagramController: instagramController,
          tiktokController: tiktokController,
        ),
      ],
    );
  }
}

class _CreateCommunityLocked extends StatelessWidget {
  const _CreateCommunityLocked();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      children: [
        CommunityInfoCard(
          children: [
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: colors.secondarySoft,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    LucideIcons.crown,
                    color: colors.secondary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Только Frendly+'.toUpperCase(),
                        style: AppTextStyles.caption.copyWith(
                          color: colors.inkMute,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Создание сообществ доступно по подписке',
                        style: AppTextStyles.itemTitle.copyWith(
                          color: colors.foreground,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Смотреть клубы, открывать карточки и видеть формат входа могут все. Создавать новые сообщества могут пользователи Frendly+.',
              style: AppTextStyles.meta.copyWith(
                color: colors.inkMute,
                fontSize: 12,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 44,
              child: FilledButton(
                onPressed: () => context.pushRoute(AppRoute.paywall),
                style: FilledButton.styleFrom(
                  backgroundColor: colors.foreground,
                  foregroundColor: colors.background,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                ),
                child: const Text('Открыть Frendly+'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _AvatarChoice extends StatelessWidget {
  const _AvatarChoice({
    required this.value,
    required this.active,
    required this.onTap,
  });

  final String value;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: active ? colors.foreground : colors.card,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          width: 56,
          height: 56,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border.all(
              color: active ? colors.foreground : colors.border,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(value, style: const TextStyle(fontSize: 28, height: 1)),
        ),
      ),
    );
  }
}

class _TextFieldCard extends StatelessWidget {
  const _TextFieldCard({
    required this.label,
    required this.child,
  });

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        border: Border.all(color: colors.border),
        borderRadius: AppRadii.cardBorder,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AppTextStyles.meta.copyWith(
              color: colors.inkMute,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _AccessTypeCard extends StatelessWidget {
  const _AccessTypeCard({
    required this.privacy,
    required this.onChanged,
  });

  final CommunityPrivacy privacy;
  final ValueChanged<CommunityPrivacy> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return CommunityInfoCard(
      shadow: false,
      children: [
        Row(
          children: [
            Icon(LucideIcons.shield_check, size: 16, color: colors.inkSoft),
            const SizedBox(width: 8),
            Text(
              'Тип доступа',
              style: AppTextStyles.bodySoft.copyWith(
                color: colors.foreground,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _AccessOption(
                active: privacy == CommunityPrivacy.public,
                icon: LucideIcons.globe,
                label: 'Общественное',
                desc: 'Видно всем, вступление сразу',
                onTap: () => onChanged(CommunityPrivacy.public),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _AccessOption(
                active: privacy == CommunityPrivacy.private,
                icon: LucideIcons.lock,
                label: 'Закрытое',
                desc: 'Вступление по заявке, контент для участников',
                onTap: () => onChanged(CommunityPrivacy.private),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _AccessOption extends StatelessWidget {
  const _AccessOption({
    required this.active,
    required this.icon,
    required this.label,
    required this.desc,
    required this.onTap,
  });

  final bool active;
  final IconData icon;
  final String label;
  final String desc;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: active ? colors.primarySoft : colors.background,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(12),
          constraints: const BoxConstraints(minHeight: 126),
          decoration: BoxDecoration(
            border: Border.all(color: active ? colors.primary : colors.border),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 16, color: colors.inkSoft),
              const SizedBox(height: 10),
              Text(
                label,
                style: AppTextStyles.meta.copyWith(
                  color: colors.foreground,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                desc,
                style: AppTextStyles.caption.copyWith(
                  color: colors.inkMute,
                  fontSize: 11,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PurposeCard extends StatelessWidget {
  const _PurposeCard({
    required this.purpose,
    required this.onChanged,
  });

  final String purpose;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return CommunityInfoCard(
      shadow: false,
      children: [
        Row(
          children: [
            Icon(LucideIcons.users, size: 16, color: colors.inkSoft),
            const SizedBox(width: 8),
            Text(
              'Фокус сообщества',
              style: AppTextStyles.bodySoft.copyWith(
                color: colors.foreground,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final item in _purposes)
              _PurposeChip(
                label: item,
                active: purpose == item,
                onTap: () => onChanged(item),
              ),
          ],
        ),
      ],
    );
  }
}

class _PurposeChip extends StatelessWidget {
  const _PurposeChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: active ? colors.foreground : colors.background,
      borderRadius: AppRadii.pillBorder,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.pillBorder,
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: AppRadii.pillBorder,
            border: Border.all(
              color: active ? colors.foreground : colors.border,
            ),
          ),
          child: Text(
            label,
            style: AppTextStyles.meta.copyWith(
              color: active ? colors.background : colors.inkSoft,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

class _MiniFeatureCard extends StatelessWidget {
  const _MiniFeatureCard({
    required this.icon,
    required this.title,
    required this.text,
  });

  final IconData icon;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      constraints: const BoxConstraints(minHeight: 118),
      decoration: BoxDecoration(
        color: colors.card,
        border: Border.all(color: colors.border),
        borderRadius: AppRadii.cardBorder,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: colors.inkSoft),
          const SizedBox(height: 12),
          Text(
            title,
            style: AppTextStyles.meta.copyWith(
              color: colors.foreground,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            text,
            style: AppTextStyles.caption.copyWith(
              color: colors.inkMute,
              fontSize: 11,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

class _SocialsCard extends StatelessWidget {
  const _SocialsCard({
    required this.telegramController,
    required this.instagramController,
    required this.tiktokController,
  });

  final TextEditingController telegramController;
  final TextEditingController instagramController;
  final TextEditingController tiktokController;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return CommunityInfoCard(
      shadow: false,
      children: [
        Row(
          children: [
            Icon(LucideIcons.send, size: 16, color: colors.inkSoft),
            const SizedBox(width: 8),
            Text(
              'Соцсети сообщества',
              style: AppTextStyles.bodySoft.copyWith(
                color: colors.foreground,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _SocialField(
                icon: LucideIcons.send,
                hint: '@telegram',
                controller: telegramController,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _SocialField(
                icon: LucideIcons.camera,
                hint: '@instagram',
                controller: instagramController,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _SocialField(
                icon: LucideIcons.music_2,
                hint: '@tiktok',
                controller: tiktokController,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _SocialField extends StatelessWidget {
  const _SocialField({
    required this.icon,
    required this.hint,
    required this.controller,
  });

  final IconData icon;
  final String hint;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: colors.background,
        border: Border.all(color: colors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: colors.inkSoft),
          const SizedBox(height: 12),
          TextField(
            controller: controller,
            decoration: InputDecoration(
              isCollapsed: true,
              border: InputBorder.none,
              hintText: hint,
            ),
            style: AppTextStyles.meta.copyWith(
              color: colors.foreground,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

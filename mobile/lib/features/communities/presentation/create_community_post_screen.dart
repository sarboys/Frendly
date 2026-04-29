import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_shadows.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/features/communities/domain/community.dart';
import 'package:big_break_mobile/features/communities/presentation/community_providers.dart';
import 'package:big_break_mobile/features/communities/presentation/community_widgets.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

enum _PostCategory {
  news('Новость', '📣'),
  event('Анонс', '🗓️'),
  rules('Правила', '📌'),
  media('Медиа', '🖼️');

  const _PostCategory(this.label, this.emoji);

  final String label;
  final String emoji;
}

enum _PostAudience {
  all('Все участники', 'Получат пуш'),
  core('Активное ядро', 'Только ходившие на встречи'),
  hosts('Хосты', 'Только модераторы');

  const _PostAudience(this.label, this.hint);

  final String label;
  final String hint;
}

class CreateCommunityPostScreen extends ConsumerStatefulWidget {
  const CreateCommunityPostScreen({
    required this.communityId,
    super.key,
  });

  final String communityId;

  @override
  ConsumerState<CreateCommunityPostScreen> createState() =>
      _CreateCommunityPostScreenState();
}

class _CreateCommunityPostScreenState
    extends ConsumerState<CreateCommunityPostScreen> {
  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();

  var _category = _PostCategory.news;
  var _audience = _PostAudience.all;
  var _pin = true;
  var _push = true;
  var _attachCover = false;
  var _publishing = false;

  bool get _canPublish => !_publishing;

  @override
  void initState() {
    super.initState();
    _titleController.addListener(_onTextChanged);
    _bodyController.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _titleController.removeListener(_onTextChanged);
    _bodyController.removeListener(_onTextChanged);
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final communityAsync = ref.watch(communityProvider(widget.communityId));

    return communityAsync.when(
      loading: () => Scaffold(
        backgroundColor: colors.background,
        body: Center(
          child: CircularProgressIndicator(color: colors.primary),
        ),
      ),
      error: (_, __) => const CommunityMissingState(),
      data: (community) {
        if (community == null) {
          return const CommunityMissingState();
        }

        return Scaffold(
          backgroundColor: colors.background,
          body: SafeArea(
            bottom: false,
            child: Column(
              children: [
                _CreatePostHeader(
                  communityName: community.name,
                  canPublish: _canPublish,
                  onPublish: _publish,
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                    children: [
                      _AuthorCard(community: community),
                      const SizedBox(height: 20),
                      const _SectionLabel(label: 'Тип'),
                      const SizedBox(height: 8),
                      _CategoryPicker(
                        selected: _category,
                        onChanged: (value) {
                          setState(() {
                            _category = value;
                          });
                        },
                      ),
                      const SizedBox(height: 20),
                      _PostTextCard(
                        titleController: _titleController,
                        bodyController: _bodyController,
                        attachCover: _attachCover,
                        onToggleCover: () {
                          setState(() {
                            _attachCover = !_attachCover;
                          });
                        },
                      ),
                      const SizedBox(height: 20),
                      const _SectionLabel(label: 'Кому показать'),
                      const SizedBox(height: 8),
                      _AudienceCard(
                        selected: _audience,
                        onChanged: (value) {
                          setState(() {
                            _audience = value;
                          });
                        },
                      ),
                      const SizedBox(height: 20),
                      const _SectionLabel(label: 'Опции'),
                      const SizedBox(height: 8),
                      _OptionsCard(
                        pin: _pin,
                        push: _push,
                        onTogglePin: () {
                          setState(() {
                            _pin = !_pin;
                          });
                        },
                        onTogglePush: () {
                          setState(() {
                            _push = !_push;
                          });
                        },
                      ),
                      const SizedBox(height: 20),
                      _PreviewCard(
                        title: _titleController.text.trim(),
                        body: _bodyController.text.trim(),
                        pin: _pin,
                        push: _push,
                      ),
                    ],
                  ),
                ),
                _BottomPublishBar(
                  canPublish: _canPublish,
                  onPublish: _publish,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _onTextChanged() {
    setState(() {});
  }

  Future<void> _publish() async {
    if (!_canPublish) {
      return;
    }

    setState(() {
      _publishing = true;
    });

    try {
      await ref.read(backendRepositoryProvider).createCommunityNews(
            communityId: widget.communityId,
            title: _titleController.text.trim(),
            body: _bodyController.text.trim(),
            category: _category.name,
            audience: _audience.name,
            pin: _pin,
            push: _push,
          );

      ref.invalidate(communityProvider(widget.communityId));
      ref.invalidate(communitiesFeedProvider);
      ref.invalidate(communitiesProvider);

      if (!mounted) {
        return;
      }

      if (context.canPop()) {
        context.pop();
        return;
      }

      context.goRoute(
        AppRoute.communityDetail,
        pathParameters: {'communityId': widget.communityId},
      );
    } catch (_) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не получилось опубликовать новость')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _publishing = false;
        });
      }
    }
  }
}

class _CreatePostHeader extends StatelessWidget {
  const _CreatePostHeader({
    required this.communityName,
    required this.canPublish,
    required this.onPublish,
  });

  final String communityName;
  final bool canPublish;
  final VoidCallback onPublish;

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
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    communityName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.meta.copyWith(
                      color: colors.inkMute,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Новая публикация',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.itemTitle.copyWith(
                      color: colors.foreground,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            _HeaderPublishButton(
              enabled: canPublish,
              onTap: onPublish,
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderPublishButton extends StatelessWidget {
  const _HeaderPublishButton({
    required this.enabled,
    required this.onTap,
  });

  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final background = enabled ? colors.foreground : colors.muted;
    final foreground = enabled ? colors.background : colors.inkMute;
    return Material(
      color: background,
      borderRadius: AppRadii.pillBorder,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: AppRadii.pillBorder,
        child: Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          alignment: Alignment.center,
          child: Text(
            'Опубликовать',
            style: AppTextStyles.itemTitle.copyWith(
              color: foreground,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _AuthorCard extends StatelessWidget {
  const _AuthorCard({
    required this.community,
  });

  final Community community;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        border: Border.all(color: colors.border),
        borderRadius: AppRadii.cardBorder,
        boxShadow: AppShadows.soft,
      ),
      child: Row(
        children: [
          CommunityAvatarBox(
            emoji: community.avatar,
            size: 48,
            radius: 16,
            fontSize: 24,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  community.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.itemTitle.copyWith(
                    color: colors.foreground,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      LucideIcons.megaphone,
                      size: 14,
                      color: colors.inkMute,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Публикация от имени сообщества',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.meta.copyWith(
                          color: colors.inkMute,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({
    required this.label,
    this.icon,
  });

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Row(
      children: [
        if (icon != null) ...[
          Icon(icon, size: 14, color: colors.inkMute),
          const SizedBox(width: 6),
        ],
        Text(
          label.toUpperCase(),
          style: AppTextStyles.caption.copyWith(
            color: colors.inkMute,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
          ),
        ),
      ],
    );
  }
}

class _CategoryPicker extends StatelessWidget {
  const _CategoryPicker({
    required this.selected,
    required this.onChanged,
  });

  final _PostCategory selected;
  final ValueChanged<_PostCategory> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        clipBehavior: Clip.none,
        scrollDirection: Axis.horizontal,
        itemCount: _PostCategory.values.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final item = _PostCategory.values[index];
          return _CategoryButton(
            category: item,
            active: selected == item,
            onTap: () => onChanged(item),
          );
        },
      ),
    );
  }
}

class _CategoryButton extends StatelessWidget {
  const _CategoryButton({
    required this.category,
    required this.active,
    required this.onTap,
  });

  final _PostCategory category;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: active ? colors.foreground : colors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: active ? colors.foreground : colors.border,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                category.emoji,
                style: const TextStyle(fontSize: 14, height: 1),
              ),
              const SizedBox(width: 6),
              Text(
                category.label,
                style: AppTextStyles.itemTitle.copyWith(
                  color: active ? colors.background : colors.foreground,
                  fontSize: 13,
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

class _PostTextCard extends StatelessWidget {
  const _PostTextCard({
    required this.titleController,
    required this.bodyController,
    required this.attachCover,
    required this.onToggleCover,
  });

  final TextEditingController titleController;
  final TextEditingController bodyController;
  final bool attachCover;
  final VoidCallback onToggleCover;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        border: Border.all(color: colors.border),
        borderRadius: AppRadii.cardBorder,
        boxShadow: AppShadows.soft,
      ),
      child: Column(
        children: [
          TextField(
            controller: titleController,
            textInputAction: TextInputAction.next,
            style: AppTextStyles.cardTitle.copyWith(
              color: colors.foreground,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
            decoration: InputDecoration(
              border: InputBorder.none,
              isCollapsed: true,
              hintText: 'Заголовок новости',
              hintStyle: AppTextStyles.cardTitle.copyWith(
                color: colors.inkMute.withValues(alpha: 0.7),
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 14),
          Divider(
            height: 1,
            thickness: 1,
            color: colors.border.withValues(alpha: 0.7),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: bodyController,
            minLines: 6,
            maxLines: 6,
            keyboardType: TextInputType.multiline,
            style: AppTextStyles.bodySoft.copyWith(
              color: colors.foreground,
              fontSize: 14,
              height: 1.45,
            ),
            decoration: InputDecoration(
              border: InputBorder.none,
              isCollapsed: true,
              hintText:
                  'Расскажите участникам, что произошло, или что вы планируете...',
              hintStyle: AppTextStyles.bodySoft.copyWith(
                color: colors.inkMute.withValues(alpha: 0.7),
                fontSize: 14,
                height: 1.45,
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _CoverButton(
                active: attachCover,
                onTap: onToggleCover,
              ),
              const Spacer(),
              Text(
                '${bodyController.text.length}',
                style: AppTextStyles.caption.copyWith(
                  color: colors.inkMute,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CoverButton extends StatelessWidget {
  const _CoverButton({
    required this.active,
    required this.onTap,
  });

  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final background = active ? colors.secondarySoft : colors.background;
    final foreground = active ? colors.secondary : colors.inkSoft;
    final borderColor =
        active ? colors.secondary.withValues(alpha: 0.3) : colors.border;
    return Material(
      color: background,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadii.pillBorder,
        side: BorderSide(color: borderColor),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.pillBorder,
        child: Container(
          height: 30,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                LucideIcons.image,
                size: 14,
                color: foreground,
              ),
              const SizedBox(width: 6),
              Text(
                active ? 'Обложка добавлена' : 'Добавить обложку',
                style: AppTextStyles.caption.copyWith(
                  color: foreground,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AudienceCard extends StatelessWidget {
  const _AudienceCard({
    required this.selected,
    required this.onChanged,
  });

  final _PostAudience selected;
  final ValueChanged<_PostAudience> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return ClipRRect(
      borderRadius: AppRadii.cardBorder,
      child: Container(
        decoration: BoxDecoration(
          color: colors.card,
          border: Border.all(color: colors.border),
          borderRadius: AppRadii.cardBorder,
        ),
        child: Column(
          children: [
            for (var i = 0; i < _PostAudience.values.length; i++) ...[
              if (i != 0)
                Divider(
                  height: 1,
                  thickness: 1,
                  color: colors.border.withValues(alpha: 0.6),
                ),
              _AudienceRow(
                audience: _PostAudience.values[i],
                active: selected == _PostAudience.values[i],
                onTap: () => onChanged(_PostAudience.values[i]),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AudienceRow extends StatelessWidget {
  const _AudienceRow({
    required this.audience,
    required this.active,
    required this.onTap,
  });

  final _PostAudience audience;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              _LeadingIconBox(
                icon: LucideIcons.users,
                active: active,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      audience.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.itemTitle.copyWith(
                        color: colors.foreground,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      audience.hint,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.meta.copyWith(
                        color: colors.inkMute,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              _RadioDot(active: active),
            ],
          ),
        ),
      ),
    );
  }
}

class _OptionsCard extends StatelessWidget {
  const _OptionsCard({
    required this.pin,
    required this.push,
    required this.onTogglePin,
    required this.onTogglePush,
  });

  final bool pin;
  final bool push;
  final VoidCallback onTogglePin;
  final VoidCallback onTogglePush;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return ClipRRect(
      borderRadius: AppRadii.cardBorder,
      child: Container(
        decoration: BoxDecoration(
          color: colors.card,
          border: Border.all(color: colors.border),
          borderRadius: AppRadii.cardBorder,
        ),
        child: Column(
          children: [
            _ToggleRow(
              icon: LucideIcons.pin,
              title: 'Закрепить в новостях',
              hint: 'Будет первой в ленте сообщества',
              active: pin,
              onTap: onTogglePin,
            ),
            Divider(
              height: 1,
              thickness: 1,
              color: colors.border.withValues(alpha: 0.6),
            ),
            _ToggleRow(
              icon: LucideIcons.bell,
              title: 'Отправить пуш-уведомление',
              hint: 'Все из выбранной аудитории получат сигнал',
              active: push,
              onTap: onTogglePush,
            ),
          ],
        ),
      ),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.icon,
    required this.title,
    required this.hint,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String hint;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              _LeadingIconBox(icon: icon, active: active),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.itemTitle.copyWith(
                        color: colors.foreground,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      hint,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.meta.copyWith(
                        color: colors.inkMute,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              _ToggleSwitch(active: active),
            ],
          ),
        ),
      ),
    );
  }
}

class _LeadingIconBox extends StatelessWidget {
  const _LeadingIconBox({
    required this.icon,
    required this.active,
  });

  final IconData icon;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: 36,
      height: 36,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: active ? colors.foreground : colors.muted,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Icon(
        icon,
        size: 16,
        color: active ? colors.background : colors.inkSoft,
      ),
    );
  }
}

class _RadioDot extends StatelessWidget {
  const _RadioDot({
    required this.active,
  });

  final bool active;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: 20,
      height: 20,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: active ? colors.foreground : colors.border,
          width: 2,
        ),
      ),
      child: active
          ? Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: colors.foreground,
                shape: BoxShape.circle,
              ),
            )
          : null,
    );
  }
}

class _ToggleSwitch extends StatelessWidget {
  const _ToggleSwitch({
    required this.active,
  });

  final bool active;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 44,
      height: 24,
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: active ? colors.foreground : colors.muted,
        borderRadius: AppRadii.pillBorder,
      ),
      child: AnimatedAlign(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOutCubic,
        alignment: active ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            color: colors.background,
            shape: BoxShape.circle,
            boxShadow: AppShadows.soft,
          ),
        ),
      ),
    );
  }
}

class _PreviewCard extends StatelessWidget {
  const _PreviewCard({
    required this.title,
    required this.body,
    required this.pin,
    required this.push,
  });

  final String title;
  final String body;
  final bool pin;
  final bool push;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionLabel(
          label: 'Превью',
          icon: LucideIcons.sparkles,
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colors.card,
            border: Border.all(color: colors.border),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title.isEmpty ? 'Заголовок новости' : title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodySoft.copyWith(
                        color: colors.foreground,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'сейчас',
                    style: AppTextStyles.caption.copyWith(
                      color: colors.inkMute,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                body.isEmpty
                    ? 'Здесь будет текст вашей публикации. Минимум 10 символов, чтобы можно было опубликовать.'
                    : body,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.meta.copyWith(
                  color: colors.inkMute,
                  fontSize: 12,
                  height: 1.45,
                ),
              ),
              if (pin || push) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    if (pin)
                      _PreviewBadge(
                        icon: LucideIcons.pin,
                        label: 'Закреплено',
                        background: colors.muted,
                        foreground: colors.inkSoft,
                      ),
                    if (push)
                      _PreviewBadge(
                        icon: LucideIcons.bell,
                        label: 'Push',
                        background: colors.secondarySoft,
                        foreground: colors.secondary,
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _PreviewBadge extends StatelessWidget {
  const _PreviewBadge({
    required this.icon,
    required this.label,
    required this.background,
    required this.foreground,
  });

  final IconData icon;
  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadii.pillBorder,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: foreground),
          const SizedBox(width: 4),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: foreground,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              height: 1,
            ),
          ),
        ],
      ),
    );
  }
}

class _BottomPublishBar extends StatelessWidget {
  const _BottomPublishBar({
    required this.canPublish,
    required this.onPublish,
  });

  final bool canPublish;
  final VoidCallback onPublish;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final background = canPublish ? colors.foreground : colors.muted;
    final foreground = canPublish ? colors.background : colors.inkMute;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.background,
        border: Border(
          top: BorderSide(color: colors.border.withValues(alpha: 0.6)),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
          child: Material(
            color: background,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              onTap: canPublish ? onPublish : null,
              borderRadius: BorderRadius.circular(16),
              child: Container(
                height: 48,
                alignment: Alignment.center,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      LucideIcons.send,
                      size: 16,
                      color: foreground,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Text(
                      'Опубликовать в сообществе',
                      style: AppTextStyles.bodySoft.copyWith(
                        color: foreground,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

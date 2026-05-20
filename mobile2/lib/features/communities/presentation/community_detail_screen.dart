import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

class CommunityDetailScreen extends ConsumerStatefulWidget {
  const CommunityDetailScreen({
    super.key,
    required this.communityId,
  });

  final String communityId;

  @override
  ConsumerState<CommunityDetailScreen> createState() =>
      _CommunityDetailScreenState();
}

class _CommunityDetailScreenState extends ConsumerState<CommunityDetailScreen> {
  final _newsTitleController = TextEditingController();
  final _newsBodyController = TextEditingController();
  BackendCardItem? _overrideCommunity;
  bool _busy = false;
  bool _newsBusy = false;
  bool _showNewsComposer = false;
  String? _actionError;
  String? _newsError;

  @override
  void dispose() {
    _newsTitleController.dispose();
    _newsBodyController.dispose();
    super.dispose();
  }

  Future<void> _toggleJoin(BackendCardItem community) async {
    if (_busy) {
      return;
    }
    final joined = community.raw['joined'] as bool? ?? false;
    setState(() {
      _busy = true;
      _actionError = null;
    });
    try {
      final next = await ref.read(communityActionsProvider).setJoined(
            communityId: community.id,
            joined: !joined,
          );
      if (!mounted) {
        return;
      }
      setState(() => _overrideCommunity = next);
    } on BackendActionException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _actionError = error.code == 'community_join_request_required'
            ? 'Для закрытого сообщества нужна заявка. Endpoint заявки в mobile contract не найден'
            : error.code == 'community_owner_cannot_leave'
                ? 'Владелец не может выйти из своего сообщества'
                : 'Действие не удалось';
      });
    } catch (_) {
      if (mounted) {
        setState(() => _actionError = 'Действие не удалось');
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _createNews(BackendCardItem community) async {
    if (_newsBusy) {
      return;
    }
    final title = _newsTitleController.text.trim();
    final body = _newsBodyController.text.trim();
    if (title.isEmpty || body.isEmpty) {
      setState(() => _newsError = 'Добавь заголовок и текст');
      return;
    }
    setState(() {
      _newsBusy = true;
      _newsError = null;
    });
    try {
      final next = await ref.read(communityActionsProvider).createNews(
            communityId: community.id,
            title: title,
            body: body,
          );
      if (!mounted) {
        return;
      }
      _newsTitleController.clear();
      _newsBodyController.clear();
      setState(() {
        _overrideCommunity = next;
        _showNewsComposer = false;
      });
    } on BackendActionException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _newsError = error.code == 'community_owner_required'
            ? 'Новости может публиковать только владелец'
            : 'Не удалось опубликовать новость';
      });
    } catch (_) {
      if (mounted) {
        setState(() => _newsError = 'Не удалось опубликовать новость');
      }
    } finally {
      if (mounted) {
        setState(() => _newsBusy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Builder(
        builder: (context) {
          final state = ref.watch(communityDetailProvider(widget.communityId));
          final community = _overrideCommunity ?? state.valueOrNull;

          if (state.isLoading && community == null) {
            return const _CommunityStatus(message: 'Загружаем сообщество');
          }
          if (community == null) {
            return _CommunityStatus(
              message: state.hasError
                  ? 'Не удалось загрузить сообщество'
                  : 'Сообщество не найдено',
            );
          }

          return ListView(
            padding: const EdgeInsets.only(bottom: 56),
            children: [
              _HeroCover(
                community: community,
                onReportGap: () {
                  setState(() {
                    _actionError =
                        'Community report endpoint не найден. /reports принимает только targetUserId';
                  });
                },
              ),
              Transform.translate(
                offset: const Offset(0, -40),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _CommunityHeader(community: community),
                    _JoinAction(
                      community: community,
                      busy: _busy,
                      error: _actionError,
                      onTap: () => _toggleJoin(community),
                    ),
                    _CommunityTabs(
                      community: community,
                      showNewsComposer: _showNewsComposer,
                      newsBusy: _newsBusy,
                      newsError: _newsError,
                      titleController: _newsTitleController,
                      bodyController: _newsBodyController,
                      onToggleNewsComposer: () {
                        setState(
                          () => _showNewsComposer = !_showNewsComposer,
                        );
                      },
                      onCreateNews: () => _createNews(community),
                    ),
                    const SizedBox(height: 56),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _HeroCover extends StatelessWidget {
  const _HeroCover({
    required this.community,
    required this.onReportGap,
  });

  final BackendCardItem community;
  final VoidCallback onReportGap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 224,
      child: Stack(
        fit: StackFit.expand,
        children: [
          DateasyRemoteImage(
            imageUrl: community.imageUrl,
            usage: DateasyImageUsage.hero,
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x4D1F0C3F),
                  DateasyColors.background,
                ],
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 12,
            left: 16,
            right: 16,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                GestureDetector(
                  onTap: () => context.go('/communities'),
                  child: const _GlassSquare(
                    child: Icon(
                      LucideIcons.chevronLeft,
                      size: 21,
                      color: DateasyColors.foreground,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: onReportGap,
                  child: const _GlassSquare(
                    child: Icon(
                      LucideIcons.flag,
                      size: 20,
                      color: DateasyColors.foreground,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CommunityHeader extends StatelessWidget {
  const _CommunityHeader({required this.community});

  final BackendCardItem community;

  @override
  Widget build(BuildContext context) {
    final privacy = _stringOrNull(community.raw['privacy']) ??
        _stringOrNull(community.raw['visibility']) ??
        'Доступ не указан';
    final members = _stringOrNull(community.raw['membersCount']) ??
        _stringOrNull(community.raw['memberCount']);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 80,
            height: 80,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: DateasyColors.surface,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: DateasyColors.background,
                width: 4,
              ),
              boxShadow: [
                BoxShadow(
                  color: DateasyColors.lime.withValues(alpha: 0.22),
                  blurRadius: 28,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: DateasyRemoteImage(
              imageUrl: community.imageUrl,
              usage: DateasyImageUsage.avatar,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            community.title.isEmpty ? 'Сообщество' : community.title,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontSize: 24,
                  height: 1.12,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 6),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 6,
            runSpacing: 2,
            children: [
              const Icon(
                LucideIcons.lock,
                size: 14,
                color: DateasyColors.muted,
              ),
              Text(
                privacy,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.muted,
                      fontSize: 14,
                    ),
              ),
              if (members != null) ...[
                Text(
                  ',',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                      ),
                ),
                const Icon(
                  LucideIcons.users,
                  size: 14,
                  color: DateasyColors.muted,
                ),
                Text(
                  '$members участников',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.muted,
                        fontSize: 14,
                      ),
                ),
              ],
            ],
          ),
          if (community.subtitle != null) ...[
            const SizedBox(height: 12),
            Text(
              community.subtitle!,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 14,
                    height: 1.45,
                  ),
            ),
          ],
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _JoinAction extends StatelessWidget {
  const _JoinAction({
    required this.community,
    required this.busy,
    required this.error,
    required this.onTap,
  });

  final BackendCardItem community;
  final bool busy;
  final String? error;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final joined = community.raw['joined'] as bool? ?? false;
    final isOwner = community.raw['isOwner'] as bool? ?? false;
    final label = isOwner
        ? 'Ты владелец'
        : joined
            ? 'Выйти из сообщества'
            : 'Вступить';
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Column(
        children: [
          GestureDetector(
            onTap: isOwner || busy ? null : onTap,
            child: Container(
              height: 52,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                gradient: joined || isOwner ? null : dateasyLimeGradient,
                color: joined || isOwner ? DateasyColors.glass : null,
                borderRadius: BorderRadius.circular(16),
                border: joined || isOwner
                    ? Border.all(color: DateasyColors.border)
                    : null,
              ),
              child: Text(
                busy ? 'Синхронизируем' : label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: joined || isOwner
                          ? DateasyColors.foreground
                          : DateasyColors.backgroundDeep,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: joined || isOwner
                ? () => context.go('/communities/${community.id}/chat')
                : null,
            child: Container(
              height: 52,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: DateasyColors.surface2,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: DateasyColors.border),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    LucideIcons.messageCircle,
                    size: 18,
                    color: joined || isOwner
                        ? DateasyColors.lime
                        : DateasyColors.muted,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Открыть чат',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: joined || isOwner
                              ? DateasyColors.foreground
                              : DateasyColors.muted,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ],
              ),
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 10),
            _InlineNotice(text: error!),
          ],
        ],
      ),
    );
  }
}

class _CommunityTabs extends StatelessWidget {
  const _CommunityTabs({
    required this.community,
    required this.showNewsComposer,
    required this.newsBusy,
    required this.newsError,
    required this.titleController,
    required this.bodyController,
    required this.onToggleNewsComposer,
    required this.onCreateNews,
  });

  final BackendCardItem community;
  final bool showNewsComposer;
  final bool newsBusy;
  final String? newsError;
  final TextEditingController titleController;
  final TextEditingController bodyController;
  final VoidCallback onToggleNewsComposer;
  final VoidCallback onCreateNews;

  @override
  Widget build(BuildContext context) {
    final news = _list(community.raw['news']);
    final meetups = _list(community.raw['meetups']);
    final chatPreview = _list(community.raw['chatPreview']);
    final isOwner = community.raw['isOwner'] as bool? ?? false;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isOwner) ...[
            _NewsComposer(
              visible: showNewsComposer,
              busy: newsBusy,
              error: newsError,
              titleController: titleController,
              bodyController: bodyController,
              onToggle: onToggleNewsComposer,
              onSubmit: onCreateNews,
            ),
            const SizedBox(height: 12),
          ],
          _BackendListSection(
            title: 'Новости',
            items: news,
            empty: 'Новостей пока нет',
          ),
          const SizedBox(height: 12),
          _BackendListSection(
            title: 'Встречи',
            items: meetups,
            empty: 'Встреч пока нет',
          ),
          const SizedBox(height: 12),
          _CommunityMediaSection(communityId: community.id),
          const SizedBox(height: 12),
          _BackendListSection(
            title: 'Чат превью',
            items: chatPreview,
            empty: 'Превью чата пока нет',
          ),
        ],
      ),
    );
  }
}

class _NewsComposer extends StatelessWidget {
  const _NewsComposer({
    required this.visible,
    required this.busy,
    required this.error,
    required this.titleController,
    required this.bodyController,
    required this.onToggle,
    required this.onSubmit,
  });

  final bool visible;
  final bool busy;
  final String? error;
  final TextEditingController titleController;
  final TextEditingController bodyController;
  final VoidCallback onToggle;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 16,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: onToggle,
            child: Row(
              children: [
                const Icon(
                  LucideIcons.megaphone,
                  size: 16,
                  color: DateasyColors.lime,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Новость сообщества',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
                Icon(
                  visible ? LucideIcons.chevronUp : LucideIcons.chevronDown,
                  size: 16,
                  color: DateasyColors.muted,
                ),
              ],
            ),
          ),
          if (visible) ...[
            const SizedBox(height: 12),
            _ComposerField(
              controller: titleController,
              hint: 'Заголовок',
              maxLines: 1,
            ),
            const SizedBox(height: 10),
            _ComposerField(
              controller: bodyController,
              hint: 'Текст новости',
              maxLines: 3,
            ),
            if (error != null) ...[
              const SizedBox(height: 10),
              Text(
                error!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.pink,
                      fontSize: 12,
                    ),
              ),
            ],
            const SizedBox(height: 12),
            GestureDetector(
              onTap: busy ? null : onSubmit,
              child: Container(
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: dateasyLimeGradient,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  busy ? 'Публикуем' : 'Опубликовать',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DateasyColors.backgroundDeep,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ComposerField extends StatelessWidget {
  const _ComposerField({
    required this.controller,
    required this.hint,
    required this.maxLines,
  });

  final TextEditingController controller;
  final String hint;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      cursorColor: DateasyColors.lime,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: DateasyColors.foreground,
            fontSize: 14,
          ),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.muted,
            ),
        filled: true,
        fillColor: DateasyColors.background.withValues(alpha: 0.44),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.all(12),
      ),
    );
  }
}

class _CommunityMediaSection extends ConsumerWidget {
  const _CommunityMediaSection({required this.communityId});

  final String communityId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(communityMediaProvider(communityId));
    final firstPage = state.valueOrNull;
    final pagination = ref.watch(communityMediaPaginationProvider(communityId));
    if (firstPage != null) {
      Future<void>.microtask(() {
        ref
            .read(communityMediaPaginationProvider(communityId).notifier)
            .primeNextCursor(firstPage.nextCursor);
      });
    }
    final items = [
      ...firstPage?.items ?? const <BackendCardItem>[],
      ...pagination.items,
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionLabel(text: 'Медиа'),
        const SizedBox(height: 8),
        if (state.isLoading && items.isEmpty)
          const _InlineNotice(text: 'Загружаем медиа'),
        if (state.hasError && items.isEmpty)
          const _InlineNotice(text: 'Не удалось загрузить медиа'),
        if (!state.isLoading && !state.hasError && items.isEmpty)
          const _InlineNotice(text: 'Медиа пока нет'),
        for (final item in items) ...[
          _InfoRow(
            icon: LucideIcons.image,
            label: item.raw['kind']?.toString() ?? 'media',
            value: item.title.isEmpty ? item.id : item.title,
          ),
          const SizedBox(height: 10),
        ],
        if (pagination.error) ...[
          const _InlineNotice(text: 'Не удалось загрузить еще медиа'),
          const SizedBox(height: 10),
        ],
        if (pagination.hasNextPage || pagination.loading)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: pagination.loading
                  ? null
                  : () => ref
                      .read(
                        communityMediaPaginationProvider(communityId).notifier,
                      )
                      .loadNextPage(),
              child: Text(
                pagination.loading ? 'Загружаем' : 'Показать еще',
              ),
            ),
          ),
      ],
    );
  }
}

class _BackendListSection extends StatelessWidget {
  const _BackendListSection({
    required this.title,
    required this.items,
    required this.empty,
  });

  final String title;
  final List<Map<String, Object?>> items;
  final String empty;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionLabel(text: title),
        const SizedBox(height: 8),
        if (items.isEmpty)
          _InlineNotice(text: empty)
        else
          _GlassPanel(
            borderRadius: 16,
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                for (var index = 0; index < items.length && index < 5; index++)
                  Padding(
                    padding: EdgeInsets.only(
                      bottom: index == items.length - 1 || index == 4 ? 0 : 10,
                    ),
                    child: _InfoRow(
                      icon: LucideIcons.circleDot,
                      label: _stringOrNull(items[index]['time']) ??
                          _stringOrNull(items[index]['place']) ??
                          'backend',
                      value: _stringOrNull(items[index]['title']) ??
                          _stringOrNull(items[index]['text']) ??
                          _stringOrNull(items[index]['blurb']) ??
                          items[index]['id']?.toString() ??
                          '',
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: DateasyColors.lime),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DateasyColors.muted,
                      fontSize: 11,
                    ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.foreground,
                      fontSize: 14,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _InlineNotice extends StatelessWidget {
  const _InlineNotice({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 16,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          const Icon(LucideIcons.info, size: 18, color: DateasyColors.lime),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CommunityStatus extends StatelessWidget {
  const _CommunityStatus({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.muted,
              ),
        ),
      ),
    );
  }
}

class _GlassSquare extends StatelessWidget {
  const _GlassSquare({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return _GlassPanel(
      borderRadius: 16,
      padding: EdgeInsets.zero,
      child: SizedBox(width: 44, height: 44, child: child),
    );
  }
}

class _GlassPanel extends StatelessWidget {
  const _GlassPanel({
    required this.child,
    required this.borderRadius,
    required this.padding,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: DateasyColors.border),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: DateasyColors.muted,
            fontSize: 12,
            fontWeight: FontWeight.w400,
            letterSpacing: 1.1,
          ),
    );
  }
}

String? _stringOrNull(Object? value) {
  final result = value?.toString();
  if (result == null || result.isEmpty) {
    return null;
  }
  return result;
}

List<Map<String, Object?>> _list(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map>()
      .map((item) => item.map((key, value) => MapEntry('$key', value)))
      .toList(growable: false);
}

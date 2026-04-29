import 'dart:io';
import 'dart:typed_data';

import 'package:big_break_mobile/app/core/device/app_media_picker_service.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

const _maxProfilePhotos = 5;

class _PhotoPreview {
  const _PhotoPreview({
    this.bytes,
    this.path,
  });

  final Uint8List? bytes;
  final String? path;

  bool get hasBytes => bytes != null && bytes!.isNotEmpty;
  bool get hasPath => path != null && path!.isNotEmpty;
}

class AddPhotoScreen extends ConsumerStatefulWidget {
  const AddPhotoScreen({super.key});

  @override
  ConsumerState<AddPhotoScreen> createState() => _AddPhotoScreenState();
}

class _AddPhotoScreenState extends ConsumerState<AddPhotoScreen> {
  bool _uploading = false;
  final _previewPhotos = <_PhotoPreview>[];
  int _selectedPhotoIndex = 0;
  final _nameController = TextEditingController();
  bool _didHydrateName = false;

  bool get _hasPhoto => _previewPhotos.isNotEmpty;
  int get _remainingPhotoSlots => _maxProfilePhotos - _previewPhotos.length;
  bool get _canAddPhoto => _remainingPhotoSlots > 0;

  bool get _canContinue =>
      !_uploading && _nameController.text.trim().isNotEmpty && _hasPhoto;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final profile = ref.watch(profileProvider).valueOrNull;
    if (!_didHydrateName && profile != null) {
      _didHydrateName = true;
      _nameController.text = profile.displayName;
    }
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      child: Scaffold(
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
                    const Spacer(),
                    TextButton(
                      onPressed: _skip,
                      child: Text(
                        'Позже',
                        style:
                            AppTextStyles.meta.copyWith(color: colors.inkSoft),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 120),
                  children: [
                    Text('Добавь фото',
                        style:
                            AppTextStyles.sectionTitle.copyWith(fontSize: 28)),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Можно загрузить до 5 фото. Профили с фото получают в 4 раза больше встреч.',
                      style: AppTextStyles.bodySoft
                          .copyWith(color: colors.inkMute),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Container(
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: colors.border),
                      ),
                      child: TextField(
                        key: const Key('add-photo-name-field'),
                        controller: _nameController,
                        textCapitalization: TextCapitalization.words,
                        textInputAction: TextInputAction.done,
                        onChanged: (_) => setState(() {}),
                        onTapOutside: (_) =>
                            FocusManager.instance.primaryFocus?.unfocus(),
                        decoration: const InputDecoration(
                          labelText: 'Как тебя зовут',
                          hintText: 'Введи имя',
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: 18,
                            vertical: 16,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                    Center(
                      child: GestureDetector(
                        onTap: _uploading ? null : _pickImageFromCamera,
                        child: _buildPhotoPreview(colors),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    if (_hasPhoto) ...[
                      SizedBox(
                        height: 64,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _previewPhotos.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (context, index) {
                            return GestureDetector(
                              onTap: () => setState(() {
                                _selectedPhotoIndex = index;
                              }),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 180),
                                width: 56,
                                height: 56,
                                padding: const EdgeInsets.all(2),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: index == _selectedPhotoIndex
                                        ? colors.primary
                                        : colors.border,
                                    width: index == _selectedPhotoIndex ? 2 : 1,
                                  ),
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: _buildPreviewImage(
                                    _previewPhotos[index],
                                    colors: colors,
                                    cacheWidth: 112,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],
                    Row(
                      children: [
                        Expanded(
                          child: _ActionCard(
                            buttonKey: const Key('add-photo-camera-action'),
                            icon: Icons.photo_camera_outlined,
                            title: 'Сделать фото',
                            subtitle: 'Прямо сейчас',
                            onTap: _uploading ? null : _pickImageFromCamera,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: _ActionCard(
                            buttonKey: const Key('add-photo-gallery-action'),
                            icon: Icons.image_outlined,
                            title: 'Из галереи',
                            subtitle: 'Выбрать до 5 фото',
                            onTap: _uploading ? null : _pickImageFromGallery,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: colors.secondarySoft,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.verified_user_outlined,
                            size: 20,
                            color: colors.secondary,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Лицо должно быть видно',
                                  style: AppTextStyles.itemTitle.copyWith(
                                    fontSize: 14,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Это часть проверки безопасности. Без масок, очков и фильтров.',
                                  style: AppTextStyles.meta.copyWith(
                                    color: colors.inkSoft,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _ActionCard(
                      icon: Icons.auto_awesome_rounded,
                      title: 'Пройти верификацию',
                      subtitle: 'Селфи + документ. Получишь синюю галочку.',
                      onTap: () => context.pushRoute(AppRoute.verification),
                      accentColor: colors.primary,
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
                    padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
                    child: SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor:
                              _canContinue ? colors.foreground : colors.muted,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        onPressed: _canContinue ? _continue : null,
                        child: Text(
                          'Готово',
                          style: AppTextStyles.button.copyWith(
                            color: _canContinue
                                ? colors.primaryForeground
                                : colors.inkMute,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickImageFromCamera() async {
    if (!_canAddPhoto) {
      _showPhotoLimitMessage();
      return;
    }
    final file = await ref.read(appMediaPickerServiceProvider).pickFromCamera();
    await _handlePickedFile(file);
  }

  Future<void> _pickImageFromGallery() async {
    if (!_canAddPhoto) {
      _showPhotoLimitMessage();
      return;
    }
    final files = await ref
        .read(appMediaPickerServiceProvider)
        .pickMultipleFromGallery(limit: _remainingPhotoSlots);
    await _handlePickedFiles(files);
  }

  Future<void> _handlePickedFile(PlatformFile? file) async {
    if (file == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не удалось открыть источник фото.')),
        );
      }
      return;
    }

    await _handlePickedFiles([file]);
  }

  Future<void> _handlePickedFiles(List<PlatformFile> files) async {
    final pickedFiles =
        files.take(_remainingPhotoSlots).toList(growable: false);
    if (pickedFiles.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не удалось открыть источник фото.')),
        );
      }
      return;
    }

    setState(() {
      _uploading = true;
    });

    try {
      final repository = ref.read(backendRepositoryProvider);
      final uploadedPhotos = <ProfilePhoto>[];
      final previewBytesByPhotoId = <String, Uint8List>{};
      final pickedPreviews = <_PhotoPreview>[];

      for (final file in pickedFiles) {
        final uploadedPhoto = await repository.uploadProfilePhotoFile(file);
        uploadedPhotos.add(uploadedPhoto);

        final bytes = file.bytes;
        if (bytes != null && bytes.isNotEmpty) {
          previewBytesByPhotoId[uploadedPhoto.id] = bytes;
          pickedPreviews.add(_PhotoPreview(bytes: bytes));
        } else {
          pickedPreviews.add(_PhotoPreview(path: file.path));
        }
      }

      final currentDraftPhotos = ref.read(profilePhotoDraftProvider);
      ref.read(profilePhotoDraftProvider.notifier).state = [
        ...currentDraftPhotos.where(
          (photo) => uploadedPhotos.every((item) => item.id != photo.id),
        ),
        ...uploadedPhotos,
      ]..sort((left, right) => left.order.compareTo(right.order));
      if (previewBytesByPhotoId.isNotEmpty) {
        final currentPreviews = ref.read(profilePhotoPreviewProvider);
        ref.read(profilePhotoPreviewProvider.notifier).state = {
          ...currentPreviews,
          ...previewBytesByPhotoId,
        };
      }
      if (mounted) {
        setState(() {
          _previewPhotos.addAll(pickedPreviews);
          _selectedPhotoIndex = _previewPhotos.length - 1;
        });
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не удалось загрузить фото.')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _uploading = false;
        });
      }
    }
  }

  void _showPhotoLimitMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Можно загрузить не больше 5 фото.')),
    );
  }

  Widget _buildPhotoPreview(BigBreakThemeColors colors) {
    return Stack(
      children: [
        Container(
          width: 176,
          height: 176,
          decoration: BoxDecoration(
            color: _hasPhoto ? colors.primarySoft : colors.muted,
            borderRadius: BorderRadius.circular(72),
          ),
          alignment: Alignment.center,
          child: _uploading
              ? CircularProgressIndicator(color: colors.primary)
              : _hasPhoto
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(72),
                      child: SizedBox(
                        width: 176,
                        height: 176,
                        child: _buildPreviewImage(
                          _previewPhotos[_selectedPhotoIndex],
                          colors: colors,
                          cacheWidth: 352,
                        ),
                      ),
                    )
                  : Icon(
                      Icons.photo_camera_outlined,
                      size: 40,
                      color: colors.inkMute,
                    ),
        ),
        if (!_hasPhoto)
          Positioned.fill(
            child: IgnorePointer(
              child: CustomPaint(
                painter: _DashedOutlinePainter(
                  color: colors.border,
                ),
              ),
            ),
          ),
        if (_hasPhoto)
          Positioned(
            top: 12,
            right: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: colors.foreground.withValues(alpha: 0.88),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '${_selectedPhotoIndex + 1}/${_previewPhotos.length}',
                style: AppTextStyles.meta.copyWith(
                  color: colors.primaryForeground,
                ),
              ),
            ),
          ),
        Positioned(
          right: 4,
          bottom: 4,
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: colors.foreground,
              shape: BoxShape.circle,
              border: Border.all(
                color: colors.background,
                width: 4,
              ),
            ),
            child: Icon(
              _hasPhoto ? Icons.add_rounded : Icons.photo_camera_outlined,
              size: 16,
              color: colors.primaryForeground,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPreviewImage(
    _PhotoPreview photo, {
    required BigBreakThemeColors colors,
    required int cacheWidth,
  }) {
    Widget errorBuilder(
      BuildContext context,
      Object error,
      StackTrace? stackTrace,
    ) {
      return _buildPreviewFallback(colors);
    }

    if (photo.hasBytes) {
      return Image.memory(
        photo.bytes!,
        fit: BoxFit.cover,
        cacheWidth: cacheWidth,
        errorBuilder: errorBuilder,
      );
    }

    if (photo.hasPath) {
      return Image.file(
        File(photo.path!),
        fit: BoxFit.cover,
        cacheWidth: cacheWidth,
        errorBuilder: errorBuilder,
      );
    }

    return _buildPreviewFallback(colors);
  }

  Widget _buildPreviewFallback(BigBreakThemeColors colors) {
    return ColoredBox(
      color: colors.muted,
      child: Center(
        child: Icon(
          Icons.image_outlined,
          size: 24,
          color: colors.inkMute,
        ),
      ),
    );
  }

  Future<void> _continue() async {
    final displayName = _nameController.text.trim();
    if (displayName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Нужно ввести имя')),
      );
      return;
    }

    await ref.read(backendRepositoryProvider).updateProfile({
      'displayName': displayName,
    });
    ref.invalidate(profileProvider);
    if (mounted) {
      context.goRoute(AppRoute.onboarding);
    }
  }

  Future<void> _skip() async {
    final displayName = _nameController.text.trim();
    if (displayName.isNotEmpty) {
      await ref.read(backendRepositoryProvider).updateProfile({
        'displayName': displayName,
      });
      ref.invalidate(profileProvider);
    }
    if (mounted) {
      context.goRoute(AppRoute.onboarding);
    }
  }
}

class _DashedOutlinePainter extends CustomPainter {
  const _DashedOutlinePainter({
    required this.color,
  });

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(72),
    );
    final path = Path()..addRRect(rect);
    final metrics = path.computeMetrics().toList(growable: false);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    for (final metric in metrics) {
      var distance = 0.0;
      const dash = 8.0;
      const gap = 6.0;
      while (distance < metric.length) {
        final next = distance + dash;
        canvas.drawPath(
          metric.extractPath(distance, next.clamp(0, metric.length)),
          paint,
        );
        distance += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedOutlinePainter oldDelegate) {
    return oldDelegate.color != color;
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.buttonKey,
    this.accentColor,
  });

  final Key? buttonKey;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return OutlinedButton(
      key: buttonKey,
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.all(AppSpacing.lg),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        side: BorderSide(color: colors.border),
        backgroundColor: colors.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            size: 20,
            color: accentColor ?? colors.inkSoft,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(title, style: AppTextStyles.itemTitle.copyWith(fontSize: 14)),
          const SizedBox(height: 4),
          Text(subtitle,
              style: AppTextStyles.meta.copyWith(color: colors.inkMute)),
        ],
      ),
    );
  }
}

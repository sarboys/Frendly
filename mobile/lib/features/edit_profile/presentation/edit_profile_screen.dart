import 'dart:typed_data';

import 'package:big_break_mobile/app/core/device/app_media_picker_service.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/onboarding_data.dart';
import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:big_break_mobile/shared/widgets/bb_profile_photo_gallery.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

const _allInterests = [
  'Кофе',
  'Бары',
  'Настолки',
  'Кино',
  'Книги',
  'Велик',
  'Йога',
  'Бег',
  'Театр',
  'Готовка',
  'Музыка',
  'Выставки',
  'Походы',
  'Фото',
];

const _editVibes = ['Спокойно', 'Шумно', 'Активно', 'Уютно'];
const _editProfileMaxContentWidth = 390.0;

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _nameController = TextEditingController();
  final _ageController = TextEditingController();
  final _bioController = TextEditingController();
  final _interests = <String>{};
  final _intent = <String>{};
  String vibe = 'Спокойно';
  bool _initialized = false;
  int _selectedPhotoIndex = 0;
  bool _photoBusy = false;
  bool _saving = false;

  @override
  void dispose() {
    _nameController.dispose();
    _ageController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _addPhoto() async {
    final file =
        await ref.read(appMediaPickerServiceProvider).pickFromGallery();
    if (file == null) {
      return;
    }

    setState(() {
      _photoBusy = true;
    });
    try {
      final uploadedPhoto = await ref
          .read(backendRepositoryProvider)
          .uploadProfilePhotoFile(file);
      final currentDraftPhotos = ref.read(profilePhotoDraftProvider);
      ref.read(profilePhotoDraftProvider.notifier).state = [
        ...currentDraftPhotos.where((photo) => photo.id != uploadedPhoto.id),
        uploadedPhoto,
      ]..sort((left, right) => left.order.compareTo(right.order));
      final bytes = file.bytes;
      if (bytes != null && bytes.isNotEmpty) {
        final currentPreviews = ref.read(profilePhotoPreviewProvider);
        ref.read(profilePhotoPreviewProvider.notifier).state = {
          ...currentPreviews,
          uploadedPhoto.id: bytes,
        };
      }
      final mergedPhotos = ref.read(profilePhotoDraftProvider);
      final newIndex = mergedPhotos.indexWhere(
        (photo) => photo.id == uploadedPhoto.id,
      );
      if (mounted && newIndex >= 0) {
        setState(() {
          _selectedPhotoIndex = newIndex;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _photoBusy = false;
        });
      }
    }
  }

  Future<void> _makeSelectedPrimary(ProfileData profile) async {
    if (profile.photos.isEmpty) {
      return;
    }

    setState(() {
      _photoBusy = true;
    });
    try {
      final updatedProfile = await ref
          .read(backendRepositoryProvider)
          .makePrimaryProfilePhoto(profile.photos[_selectedPhotoIndex].id);
      ref.read(profilePhotoDraftProvider.notifier).state =
          updatedProfile.photos;
      if (mounted) {
        setState(() {
          _selectedPhotoIndex = 0;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _photoBusy = false;
        });
      }
    }
  }

  Future<void> _deleteSelectedPhoto(ProfileData profile) async {
    if (profile.photos.isEmpty) {
      return;
    }

    setState(() {
      _photoBusy = true;
    });
    try {
      final updatedProfile = await ref
          .read(backendRepositoryProvider)
          .deleteProfilePhoto(profile.photos[_selectedPhotoIndex].id);
      final deletedPhotoId = profile.photos[_selectedPhotoIndex].id;
      ref.read(profilePhotoDraftProvider.notifier).state =
          updatedProfile.photos;
      final currentPreviews = ref.read(profilePhotoPreviewProvider);
      if (currentPreviews.containsKey(deletedPhotoId)) {
        final nextPreviews = Map<String, Uint8List>.from(currentPreviews)
          ..remove(deletedPhotoId);
        ref.read(profilePhotoPreviewProvider.notifier).state = nextPreviews;
      }
      if (mounted) {
        setState(() {
          _selectedPhotoIndex =
              _selectedPhotoIndex > 0 ? _selectedPhotoIndex - 1 : 0;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _photoBusy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final profile = ref.watch(profileProvider).valueOrNull;
    final photos = profile?.photos ?? const <ProfilePhoto>[];
    final photoPreviews = ref.watch(profilePhotoPreviewProvider);
    if (_selectedPhotoIndex >= photos.length && photos.isNotEmpty) {
      _selectedPhotoIndex = photos.length - 1;
    }
    if (photos.isEmpty) {
      _selectedPhotoIndex = 0;
    }

    if (profile != null && !_initialized) {
      _initialized = true;
      _nameController.text = profile.displayName;
      _ageController.text = '${profile.age ?? ''}';
      _bioController.text = profile.bio ?? '';
      _interests
        ..clear()
        ..addAll(profile.interests);
      _intent
        ..clear()
        ..addAll(profile.intent);
      vibe = profile.vibe ?? vibe;
    }

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final contentWidth =
                constraints.maxWidth > _editProfileMaxContentWidth
                    ? _editProfileMaxContentWidth
                    : constraints.maxWidth;

            return Align(
              alignment: Alignment.topCenter,
              child: SizedBox(
                width: contentWidth,
                height: constraints.maxHeight,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  children: [
                    Row(
                      children: [
                        IconButton(
                          onPressed: () => context.pop(),
                          icon:
                              const Icon(Icons.chevron_left_rounded, size: 28),
                        ),
                        Expanded(
                          child: Text(
                            'Редактировать',
                            style:
                                AppTextStyles.itemTitle.copyWith(fontSize: 16),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        TextButton(
                          onPressed: _photoBusy || _saving
                              ? null
                              : () => _saveProfile(profile),
                          child: Text('Готово',
                              style: AppTextStyles.meta.copyWith(
                                  color: colors.primary, fontSize: 14)),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Column(
                      children: [
                        Stack(
                          children: [
                            BbProfilePhotoGallery(
                              displayName: _nameController.text.isEmpty
                                  ? 'Никита'
                                  : _nameController.text,
                              photos: photos,
                              height: 320,
                              initialPage: _selectedPhotoIndex,
                              photoPreviews: photoPreviews,
                              onPageChanged: (index) {
                                setState(() {
                                  _selectedPhotoIndex = index;
                                });
                              },
                            ),
                            Positioned(
                              right: 12,
                              bottom: 12,
                              child: InkWell(
                                onTap: _photoBusy ? null : _addPhoto,
                                borderRadius: BorderRadius.circular(999),
                                child: Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: colors.foreground,
                                    shape: BoxShape.circle,
                                  ),
                                  child: _photoBusy
                                      ? Padding(
                                          padding: const EdgeInsets.all(10),
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: colors.primaryForeground,
                                          ),
                                        )
                                      : Icon(
                                          Icons.add_rounded,
                                          size: 18,
                                          color: colors.primaryForeground,
                                        ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        SizedBox(
                          height: 64,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: photos.length + 1,
                            separatorBuilder: (_, __) =>
                                const SizedBox(width: 8),
                            itemBuilder: (context, index) {
                              if (index == photos.length) {
                                return _PhotoAddTile(
                                  onTap: _photoBusy ? null : _addPhoto,
                                );
                              }
                              final photo = photos[index];
                              return _PhotoThumbTile(
                                photo: photo,
                                previewBytes: photoPreviews[photo.id],
                                selected: index == _selectedPhotoIndex,
                                onTap: () => setState(() {
                                  _selectedPhotoIndex = index;
                                }),
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: _photoBusy ||
                                        photos.isEmpty ||
                                        _selectedPhotoIndex == 0
                                    ? null
                                    : () => _makeSelectedPrimary(profile!),
                                icon: const Icon(Icons.star_outline_rounded,
                                    size: 18),
                                label: const Text('Сделать первым'),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: _photoBusy || photos.isEmpty
                                    ? null
                                    : () => _deleteSelectedPhoto(profile!),
                                icon: const Icon(Icons.delete_outline_rounded,
                                    size: 18),
                                label: const Text('Удалить'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Container(
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: colors.border),
                      ),
                      child: Column(
                        children: [
                          _EditRow(
                            label: 'Имя',
                            child: TextField(
                              key: const Key('edit-profile-name-field'),
                              controller: _nameController,
                              onChanged: (_) => setState(() {}),
                              textAlign: TextAlign.right,
                              decoration: const InputDecoration(
                                  border: InputBorder.none, isCollapsed: true),
                              style: AppTextStyles.body
                                  .copyWith(fontWeight: FontWeight.w500),
                            ),
                          ),
                          Divider(
                              height: 1, thickness: 1, color: colors.border),
                          _EditRow(
                            label: 'Возраст',
                            child: TextField(
                              key: const Key('edit-profile-age-field'),
                              controller: _ageController,
                              onChanged: (value) {
                                final digitsOnly =
                                    value.replaceAll(RegExp(r'\D'), '');
                                final sanitized = digitsOnly.length > 2
                                    ? digitsOnly.substring(0, 2)
                                    : digitsOnly;
                                if (_ageController.text != sanitized) {
                                  _ageController.value = TextEditingValue(
                                    text: sanitized,
                                    selection: TextSelection.collapsed(
                                      offset: sanitized.length,
                                    ),
                                  );
                                }
                                setState(() {});
                              },
                              textAlign: TextAlign.right,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                  border: InputBorder.none, isCollapsed: true),
                              style: AppTextStyles.body
                                  .copyWith(fontWeight: FontWeight.w500),
                            ),
                          ),
                          Divider(
                              height: 1, thickness: 1, color: colors.border),
                          _EditRow(
                            label: 'Район',
                            child: Text(
                              profile?.area ?? 'Чистые пруды',
                              textAlign: TextAlign.right,
                              style: AppTextStyles.body
                                  .copyWith(fontWeight: FontWeight.w500),
                            ),
                          ),
                        ],
                      ),
                    ),
                    _EditSection(
                      title: 'О себе',
                      child: Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: colors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            TextField(
                              key: const Key('edit-profile-bio-field'),
                              controller: _bioController,
                              onChanged: (_) => setState(() {}),
                              maxLines: 4,
                              maxLength: 300,
                              decoration: const InputDecoration(
                                  border: InputBorder.none, counterText: ''),
                              style: AppTextStyles.bodySoft,
                            ),
                            Text('${_bioController.text.length}/300',
                                style: AppTextStyles.caption),
                          ],
                        ),
                      ),
                    ),
                    _EditSection(
                      title: 'Настроение',
                      child: Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        children: _editVibes
                            .map((item) => _togglePill(item, vibe == item,
                                () => setState(() => vibe = item)))
                            .toList(growable: false),
                      ),
                    ),
                    _EditSection(
                      title: 'Зачем здесь',
                      child: Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        children: ['Друзья', 'Свидания']
                            .map(
                              (item) => _togglePill(
                                item,
                                _intent.contains(item),
                                () => setState(() {
                                  if (_intent.contains(item)) {
                                    _intent.remove(item);
                                  } else {
                                    _intent.add(item);
                                  }
                                }),
                                selectedBackground: colors.primarySoft,
                                selectedForeground: colors.foreground,
                              ),
                            )
                            .toList(growable: false),
                      ),
                    ),
                    _EditSection(
                      title: 'Интересы · ${_interests.length}',
                      child: Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        children: _allInterests
                            .map(
                              (item) => _togglePill(
                                item,
                                _interests.contains(item),
                                () => setState(() {
                                  if (_interests.contains(item)) {
                                    _interests.remove(item);
                                  } else {
                                    _interests.add(item);
                                  }
                                }),
                              ),
                            )
                            .toList(growable: false),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _togglePill(
    String label,
    bool selected,
    VoidCallback onTap, {
    Color? selectedBackground,
    Color? selectedForeground,
  }) {
    final colors = AppColors.of(context);
    final resolvedSelectedBackground = selectedBackground ?? colors.foreground;
    final resolvedSelectedForeground =
        selectedForeground ?? colors.primaryForeground;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: selected ? resolvedSelectedBackground : colors.card,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? resolvedSelectedBackground : colors.border,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTextStyles.meta.copyWith(
            color: selected ? resolvedSelectedForeground : colors.inkSoft,
            fontSize: 13,
            fontWeight: FontWeight.w400,
          ),
        ),
      ),
    );
  }

  Future<void> _saveProfile(ProfileData? profile) async {
    setState(() {
      _saving = true;
    });
    try {
      final repository = ref.read(backendRepositoryProvider);
      await repository.updateProfile({
        'displayName': _nameController.text.trim(),
        'age': int.tryParse(_ageController.text.trim()),
        'city': profile?.city ?? 'Москва',
        'area': profile?.area ?? 'Чистые пруды',
        'bio': _bioController.text.trim(),
        'vibe': vibe,
      });
      await repository.saveOnboarding(
        OnboardingData(
          intent: _intent.contains('Свидания') && _intent.contains('Друзья')
              ? 'both'
              : _intent.contains('Свидания')
                  ? 'dating'
                  : 'friendship',
          gender: profile?.gender,
          city: profile?.city ?? 'Москва',
          area: profile?.area ?? 'Чистые пруды',
          interests: _interests.toList(growable: false),
          vibe: vibe,
        ),
      );
      ref.invalidate(profileProvider);
      ref.invalidate(onboardingProvider);
      if (!mounted) return;
      final navigator = Navigator.of(context);
      if (navigator.canPop()) {
        navigator.pop();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не получилось сохранить профиль')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }
}

class _EditSection extends StatelessWidget {
  const _EditSection({
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTextStyles.caption.copyWith(letterSpacing: 1)),
          const SizedBox(height: AppSpacing.sm),
          child,
        ],
      ),
    );
  }
}

class _EditRow extends StatelessWidget {
  const _EditRow({
    required this.label,
    required this.child,
  });

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          SizedBox(
            width: 96,
            child: Text(label, style: AppTextStyles.bodySoft),
          ),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _PhotoThumbTile extends StatelessWidget {
  const _PhotoThumbTile({
    required this.photo,
    required this.previewBytes,
    required this.selected,
    required this.onTap,
  });

  final ProfilePhoto photo;
  final Uint8List? previewBytes;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: 56,
          height: 56,
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected ? colors.primary : colors.border,
              width: selected ? 2 : 1,
            ),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: previewBytes != null
                ? Image.memory(
                    previewBytes!,
                    fit: BoxFit.cover,
                    gaplessPlayback: true,
                  )
                : Image.network(
                    photo.url,
                    fit: BoxFit.cover,
                  ),
          ),
        ),
      ),
    );
  }
}

class _PhotoAddTile extends StatelessWidget {
  const _PhotoAddTile({
    required this.onTap,
  });

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: colors.card,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colors.border),
          ),
          child: Icon(Icons.add_rounded, color: colors.primary),
        ),
      ),
    );
  }
}

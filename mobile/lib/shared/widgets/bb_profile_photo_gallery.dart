import 'dart:typed_data';

import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

class BbProfilePhotoGallery extends StatefulWidget {
  const BbProfilePhotoGallery({
    required this.displayName,
    required this.photos,
    super.key,
    this.height = 320,
    this.initialPage = 0,
    this.photoPreviews = const {},
    this.onPageChanged,
  });

  final String displayName;
  final List<ProfilePhoto> photos;
  final double height;
  final int initialPage;
  final Map<String, Uint8List> photoPreviews;
  final ValueChanged<int>? onPageChanged;

  @override
  State<BbProfilePhotoGallery> createState() => _BbProfilePhotoGalleryState();
}

class _BbProfilePhotoGalleryState extends State<BbProfilePhotoGallery> {
  late final PageController _pageController;
  late int _currentPage;

  @override
  void initState() {
    super.initState();
    _currentPage = widget.initialPage.clamp(
      0,
      widget.photos.isEmpty ? 0 : widget.photos.length - 1,
    );
    _pageController = PageController(initialPage: _currentPage);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant BbProfilePhotoGallery oldWidget) {
    super.didUpdateWidget(oldWidget);
    final maxPage = widget.photos.isEmpty ? 0 : widget.photos.length - 1;
    final nextPage = widget.initialPage.clamp(0, maxPage);
    final lengthChanged = oldWidget.photos.length != widget.photos.length;
    final pageChanged = oldWidget.initialPage != widget.initialPage;

    if (pageChanged || lengthChanged) {
      _currentPage = nextPage;
      if (_pageController.hasClients) {
        _pageController.jumpToPage(nextPage);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return ClipRRect(
      borderRadius: AppRadii.cardBorder,
      child: SizedBox(
        height: widget.height,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (widget.photos.isEmpty)
              _EmptyPhotoSurface(displayName: widget.displayName)
            else
              PageView.builder(
                key: const ValueKey('profile-photo-gallery-pageview'),
                controller: _pageController,
                itemCount: widget.photos.length,
                onPageChanged: (index) {
                  setState(() {
                    _currentPage = index;
                  });
                  widget.onPageChanged?.call(index);
                },
                itemBuilder: (context, index) {
                  final photo = widget.photos[index];
                  final previewBytes = widget.photoPreviews[photo.id];
                  return DecoratedBox(
                    decoration: BoxDecoration(color: colors.muted),
                    child: previewBytes != null
                        ? Image.memory(
                            previewBytes,
                            fit: BoxFit.cover,
                            gaplessPlayback: true,
                          )
                        : CachedNetworkImage(
                            imageUrl: photo.url,
                            fit: BoxFit.cover,
                            placeholder: (context, _) => _EmptyPhotoSurface(
                                displayName: widget.displayName),
                            errorWidget: (context, _, __) => _EmptyPhotoSurface(
                                displayName: widget.displayName),
                          ),
                  );
                },
              ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0),
                      Colors.black.withValues(alpha: 0.5),
                    ],
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 28, 16, 16),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          widget.displayName,
                          style: AppTextStyles.sectionTitle.copyWith(
                            color: Colors.white,
                            fontSize: 22,
                          ),
                        ),
                      ),
                      if (widget.photos.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.32),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${_currentPage + 1}/${widget.photos.length}',
                            style: AppTextStyles.meta.copyWith(
                              color: Colors.white,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            if (widget.photos.length > 1)
              Positioned(
                left: 16,
                right: 16,
                top: 12,
                child: Row(
                  children: [
                    for (var index = 0;
                        index < widget.photos.length;
                        index++) ...[
                      Expanded(
                        child: Container(
                          height: 4,
                          decoration: BoxDecoration(
                            color: index == _currentPage
                                ? Colors.white
                                : Colors.white.withValues(alpha: 0.35),
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                      if (index != widget.photos.length - 1)
                        const SizedBox(width: AppSpacing.xs),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _EmptyPhotoSurface extends StatelessWidget {
  const _EmptyPhotoSurface({
    required this.displayName,
  });

  final String displayName;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colors.primarySoft,
            colors.background,
            colors.secondarySoft,
          ],
        ),
      ),
      child: Center(
        child: Text(
          _initials(displayName),
          style: AppTextStyles.screenTitle.copyWith(
            color: colors.inkSoft,
            fontSize: 40,
          ),
        ),
      ),
    );
  }

  String _initials(String value) {
    return value
        .split(' ')
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part.substring(0, 1))
        .join()
        .toUpperCase();
  }
}

import 'dart:math' as math;

import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

enum BbAvatarSize {
  xs(24, 10, 6),
  sm(36, 12, 8),
  md(44, 14, 10),
  lg(56, 16, 12),
  xl(96, 28, 16);

  const BbAvatarSize(this.dimension, this.fontSize, this.onlineDot);

  final double dimension;
  final double fontSize;
  final double onlineDot;
}

class BbAvatar extends StatelessWidget {
  const BbAvatar({
    required this.name,
    super.key,
    this.size = BbAvatarSize.md,
    this.online = false,
    this.imageUrl,
  });

  final String name;
  final BbAvatarSize size;
  final bool online;
  final String? imageUrl;

  static const _palette = <({Color bg, Color fg})>[
    (bg: Color(0xFFF0C7BD), fg: Color(0xFF874432)),
    (bg: Color(0xFFD5E7D9), fg: Color(0xFF355A3F)),
    (bg: Color(0xFFF1DFC0), fg: Color(0xFF785C2D)),
    (bg: Color(0xFFDCE3F2), fg: Color(0xFF425170)),
    (bg: Color(0xFFE5DCEF), fg: Color(0xFF5F4870)),
    (bg: Color(0xFFD8EBEA), fg: Color(0xFF376665)),
  ];

  @override
  Widget build(BuildContext context) {
    final palette = AppColors.of(context);
    final colors = _colorFor(name);

    return SizedBox(
      width: size.dimension,
      height: size.dimension,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: colors.bg,
                shape: BoxShape.circle,
              ),
              child: ClipOval(
                child: imageUrl == null || imageUrl!.isEmpty
                    ? Center(
                        child: Text(
                          _initials(name),
                          style: AppTextStyles.itemTitle.copyWith(
                            fontSize: size.fontSize,
                            color: colors.fg,
                          ),
                        ),
                      )
                    : CachedNetworkImage(
                        imageUrl: imageUrl!,
                        width: size.dimension,
                        height: size.dimension,
                        fit: BoxFit.cover,
                        errorWidget: (context, _, __) {
                          return Center(
                            child: Text(
                              _initials(name),
                              style: AppTextStyles.itemTitle.copyWith(
                                fontSize: size.fontSize,
                                color: colors.fg,
                              ),
                            ),
                          );
                        },
                        placeholder: (context, _) => ColoredBox(
                          color: colors.bg,
                        ),
                      ),
              ),
            ),
          ),
          if (online)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: size.onlineDot,
                height: size.onlineDot,
                decoration: BoxDecoration(
                  color: palette.online,
                  shape: BoxShape.circle,
                  border: Border.fromBorderSide(
                    BorderSide(color: palette.background, width: 2),
                  ),
                ),
              ),
            ),
        ],
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

  ({Color bg, Color fg}) _colorFor(String value) {
    var hash = 0;
    for (final codeUnit in value.codeUnits) {
      hash = (hash * 31 + codeUnit) & 0x7fffffff;
    }

    return _palette[hash % _palette.length];
  }
}

class BbAvatarStack extends StatelessWidget {
  const BbAvatarStack({
    required this.names,
    super.key,
    this.size = BbAvatarSize.sm,
    this.max = 3,
  });

  final List<String> names;
  final BbAvatarSize size;
  final int max;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final visible = names.take(max).toList(growable: false);
    final rest = math.max(0, names.length - visible.length);
    const overlap = 8.0;
    final itemCount = visible.length + (rest > 0 ? 1 : 0);
    final totalWidth = itemCount == 0
        ? 0.0
        : size.dimension + ((itemCount - 1) * (size.dimension - overlap));

    return SizedBox(
      width: totalWidth,
      height: size.dimension,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          for (var i = 0; i < visible.length; i++)
            Positioned(
              left: i * (size.dimension - overlap),
              top: 0,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colors.background,
                ),
                child: Padding(
                  padding: const EdgeInsets.all(2),
                  child: BbAvatar(
                    name: visible[i],
                    size: size,
                  ),
                ),
              ),
            ),
          if (rest > 0)
            Positioned(
              left: visible.length * (size.dimension - overlap),
              top: 0,
              child: Container(
                width: size.dimension,
                height: size.dimension,
                decoration: BoxDecoration(
                  color: colors.muted,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  '+$rest',
                  style: AppTextStyles.itemTitle.copyWith(
                    fontSize: size.fontSize,
                    color: colors.inkSoft,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

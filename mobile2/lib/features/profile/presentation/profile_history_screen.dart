import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

class ProfileHistoryScreen extends StatelessWidget {
  const ProfileHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: Consumer(
        builder: (context, ref, _) {
          final historyState = ref.watch(profileHistoryProvider);
          final history = historyState.valueOrNull?.items
                  .map(_HistoryItem.fromBackend)
                  .where((item) => item.id.isNotEmpty)
                  .toList(growable: false) ??
              const <_HistoryItem>[];
          final completed = history
              .where((item) => item.status == _HistoryStatus.completed)
              .toList(growable: false);
          final rated = completed
              .where((item) => item.rating != null)
              .toList(growable: false);
          final avgRating = rated.isEmpty
              ? 0
              : rated.fold<double>(0, (sum, item) => sum + item.rating!) /
                  rated.length;

          return ListView(
            padding: EdgeInsets.fromLTRB(
              20,
              MediaQuery.paddingOf(context).top + 16,
              20,
              96,
            ),
            children: [
              const _Header(),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      value: '${completed.length}',
                      label: 'Встреч завершено',
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _StatCard(
                      value: rated.isEmpty ? '0' : avgRating.toStringAsFixed(1),
                      label: 'Средний рейтинг',
                      icon: Icons.star,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              if (historyState.isLoading && history.isEmpty)
                const _HistoryStatusCard(message: 'Загружаем историю')
              else if (history.isEmpty)
                _HistoryStatusCard(
                  message: historyState.hasError
                      ? 'Не удалось загрузить историю'
                      : 'История пока пустая',
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: history.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    return _HistoryTile(item: history[index]);
                  },
                ),
            ],
          );
        },
      ),
    );
  }
}

class _HistoryStatusCard extends StatelessWidget {
  const _HistoryStatusCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: DateasyColors.glass,
        border: Border.all(color: DateasyColors.border),
      ),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: DateasyColors.muted,
            ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _GlassIconButton(
          icon: LucideIcons.chevronLeft,
          onTap: () => context.go('/profile'),
        ),
        const Spacer(),
        Text(
          'История',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontFamily: 'Sora',
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
        ),
        const Spacer(),
        const SizedBox(width: 44, height: 44),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.value,
    required this.label,
    this.icon,
  });

  final String value;
  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: DateasyColors.glass,
        border: Border.all(color: DateasyColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: DateasyColors.lilac),
                const SizedBox(width: 5),
              ],
              Text(
                value,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontFamily: 'Sora',
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 11,
                ),
          ),
        ],
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.item});

  final _HistoryItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: DateasyColors.glass,
        border: Border.all(color: DateasyColors.border),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 56,
              height: 56,
              child: DateasyRemoteImage(
                imageUrl: item.coverUrl,
                usage: DateasyImageUsage.card,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    _RoleBadge(role: item.role),
                    if (item.status == _HistoryStatus.cancelled)
                      const _StatusBadge(),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    const Icon(
                      LucideIcons.calendar,
                      size: 12,
                      color: DateasyColors.muted,
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        item.date,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.muted,
                              fontSize: 11,
                            ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(
                      LucideIcons.mapPin,
                      size: 12,
                      color: DateasyColors.muted,
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        item.place,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.muted,
                              fontSize: 11,
                            ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (item.rating != null) ...[
            const SizedBox(width: 10),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.star,
                  size: 14,
                  color: DateasyColors.lilac,
                ),
                const SizedBox(width: 4),
                Text(
                  _formatRating(item.rating!),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _RoleBadge extends StatelessWidget {
  const _RoleBadge({required this.role});

  final _HistoryRole role;

  @override
  Widget build(BuildContext context) {
    final isHost = role == _HistoryRole.host;
    final color = isHost ? DateasyColors.lime : DateasyColors.pink;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: color.withValues(alpha: 0.18),
      ),
      child: Text(
        isHost ? 'Хост' : 'Гость',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: color,
              fontSize: 10,
            ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: Colors.white.withValues(alpha: 0.1),
      ),
      child: Text(
        'Отменена',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DateasyColors.muted,
              fontSize: 10,
            ),
      ),
    );
  }
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: DateasyColors.glass,
          border: Border.all(color: DateasyColors.border),
        ),
        child: Icon(icon, size: 20, color: DateasyColors.foreground),
      ),
    );
  }
}

String _formatRating(double value) {
  return value == value.roundToDouble()
      ? value.toStringAsFixed(0)
      : value.toStringAsFixed(1);
}

enum _HistoryRole { host, guest }

enum _HistoryStatus { completed, cancelled }

class _HistoryItem {
  const _HistoryItem({
    required this.id,
    required this.title,
    required this.date,
    required this.place,
    required this.role,
    required this.coverUrl,
    required this.status,
    this.rating,
  });

  final String id;
  final String title;
  final String date;
  final String place;
  final _HistoryRole role;
  final String? coverUrl;
  final _HistoryStatus status;
  final double? rating;

  factory _HistoryItem.fromBackend(BackendCardItem item) {
    final raw = item.raw;
    final status = _string(raw['status']).toLowerCase();
    final role = _string(raw['role']).toLowerCase();
    return _HistoryItem(
      id: item.id,
      title: item.title.isEmpty ? 'Встреча' : item.title,
      date: _stringOrNull(raw['dateLabel']) ??
          _formatDate(item.startsAt) ??
          _stringOrNull(raw['date']) ??
          '',
      place: item.subtitle ?? item.city ?? _stringOrNull(raw['place']) ?? '',
      role: role == 'host' ? _HistoryRole.host : _HistoryRole.guest,
      rating: _doubleOrNull(raw['rating']),
      coverUrl: item.imageUrl,
      status: status == 'cancelled' || status == 'canceled'
          ? _HistoryStatus.cancelled
          : _HistoryStatus.completed,
    );
  }
}

String _string(Object? value) => value?.toString() ?? '';

String? _stringOrNull(Object? value) {
  final result = value?.toString();
  if (result == null || result.isEmpty) {
    return null;
  }
  return result;
}

double? _doubleOrNull(Object? value) {
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse(value?.toString() ?? '');
}

String? _formatDate(DateTime? value) {
  if (value == null) {
    return null;
  }
  final months = [
    'янв',
    'фев',
    'мар',
    'апр',
    'мая',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек',
  ];
  final month = months[value.month - 1];
  final hour = value.hour.toString().padLeft(2, '0');
  final minute = value.minute.toString().padLeft(2, '0');
  return '${value.day} $month · $hour:$minute';
}

import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:flutter/material.dart';

enum BbMessageActionType {
  reply,
  copy,
  edit,
  delete,
}

Future<BbMessageActionType?> showBbMessageActionsSheet(
  BuildContext context, {
  required Message message,
}) {
  return showModalBottomSheet<BbMessageActionType>(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (context) => _BbMessageActionsSheet(
      message: message,
    ),
  );
}

class _BbMessageActionsSheet extends StatelessWidget {
  const _BbMessageActionsSheet({
    required this.message,
  });

  final Message message;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final canCopy = message.text.trim().isNotEmpty;
    final canChangeOwnMessage =
        message.mine && !message.isPending && !message.id.startsWith('local-');
    final canEdit = canChangeOwnMessage && canCopy;
    final previewText = _buildPreviewText(message);

    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: colors.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                decoration: BoxDecoration(
                  color: colors.muted.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      message.author,
                      style: AppTextStyles.caption.copyWith(
                        color: colors.inkSoft,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      previewText.isEmpty ? 'Сообщение' : previewText,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.body.copyWith(
                        color: colors.foreground,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            _ActionTile(
              icon: Icons.reply_rounded,
              label: 'Ответить',
              onTap: () => Navigator.of(context).pop(BbMessageActionType.reply),
            ),
            if (canCopy)
              _ActionTile(
                icon: Icons.copy_rounded,
                label: 'Скопировать',
                onTap: () =>
                    Navigator.of(context).pop(BbMessageActionType.copy),
              ),
            if (canEdit)
              _ActionTile(
                icon: Icons.edit_rounded,
                label: 'Редактировать',
                onTap: () =>
                    Navigator.of(context).pop(BbMessageActionType.edit),
              ),
            if (canChangeOwnMessage)
              _ActionTile(
                icon: Icons.delete_outline_rounded,
                label: 'Удалить',
                destructive: true,
                onTap: () =>
                    Navigator.of(context).pop(BbMessageActionType.delete),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  String _buildPreviewText(Message message) {
    if (message.attachments.any((attachment) => attachment.isVoice)) {
      return 'Голосовое сообщение';
    }
    if (message.attachments.any((attachment) => attachment.isLocation)) {
      return 'Локация';
    }
    if (message.text.trim().isNotEmpty) {
      return message.text.trim();
    }
    if (message.attachments.isNotEmpty) {
      return 'Вложение';
    }
    return 'Сообщение';
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final foreground = destructive ? colors.destructive : colors.foreground;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Row(
            children: [
              Icon(
                icon,
                size: 18,
                color: foreground,
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                label,
                style: AppTextStyles.body.copyWith(
                  color: foreground,
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

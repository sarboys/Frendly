import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/session/app_session_controller.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/auth_flow.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

class TelegramAuthScreen extends ConsumerStatefulWidget {
  const TelegramAuthScreen({
    super.key,
    this.openTelegramUrl,
    this.startTokenFactory,
  });

  final Future<bool> Function(Uri uri)? openTelegramUrl;
  final String Function()? startTokenFactory;

  @override
  ConsumerState<TelegramAuthScreen> createState() => _TelegramAuthScreenState();
}

class _TelegramAuthScreenState extends ConsumerState<TelegramAuthScreen> {
  final _codeController = TextEditingController();
  final _codeFocusNode = FocusNode();
  TelegramAuthStart? _start;
  String? _startToken;
  String? _startError;
  bool _manualCodeEntry = false;
  bool _starting = false;
  bool _verifying = false;

  @override
  void dispose() {
    _codeController.dispose();
    _codeFocusNode.dispose();
    super.dispose();
  }

  Future<bool> _openTelegram(Uri uri) {
    final handler = widget.openTelegramUrl;
    if (handler != null) {
      return handler(uri);
    }

    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  String _generateStartToken() {
    final factory = widget.startTokenFactory;
    if (factory != null) {
      return factory();
    }

    final timestamp = DateTime.now().microsecondsSinceEpoch.toRadixString(16);
    final randomPart = Object.hash(
            DateTime.now().millisecondsSinceEpoch, identityHashCode(this))
        .abs()
        .toRadixString(16);
    return '$timestamp$randomPart';
  }

  void _handleCodeChanged(String value) {
    final maxLength = _start?.codeLength ?? 4;
    final digitsOnly = value.replaceAll(RegExp(r'\D'), '');
    final sanitized = digitsOnly.length > maxLength
        ? digitsOnly.substring(0, maxLength)
        : digitsOnly;

    if (_codeController.text != sanitized) {
      _codeController.value = TextEditingValue(
        text: sanitized,
        selection: TextSelection.collapsed(offset: sanitized.length),
      );
    }

    setState(() {});

    if (!_verifying && sanitized.length == maxLength) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _submitCode();
        }
      });
    }
  }

  Future<void> _startTelegramFlow({bool reopenTelegram = true}) async {
    if (_starting || _verifying) {
      return;
    }

    final startToken = _startToken ?? _generateStartToken();
    final startUri = BackendConfig.telegramAuthUri(startToken);

    setState(() {
      _starting = true;
      _startToken = startToken;
      _startError = null;
      _manualCodeEntry = true;
    });

    try {
      final startRequest = Future<Object>.sync(() async {
        try {
          return await ref
              .read(backendRepositoryProvider)
              .startTelegramAuth(startToken: startToken);
        } catch (error) {
          return error;
        }
      });

      if (reopenTelegram) {
        final opened = await _openTelegram(startUri);
        if (!mounted) {
          return;
        }

        if (!opened) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Не получилось открыть Telegram')),
          );
        }
      }

      final startResult = await startRequest;
      if (!mounted) {
        return;
      }

      if (startResult is! TelegramAuthStart) {
        setState(() {
          _startError = _startErrorMessage(startResult);
        });
        return;
      }

      final start = startResult;
      setState(() {
        _start = start;
        _startError = null;
      });

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _codeFocusNode.requestFocus();
        }
      });

      if (_codeController.text.length == start.codeLength) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            _submitCode();
          }
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _starting = false;
        });
      }
    }
  }

  Future<void> _submitCode() async {
    if (_starting || _verifying) {
      return;
    }

    final code = _codeController.text.trim();
    final codeLength = _start?.codeLength ?? 4;
    if (code.length != codeLength) {
      return;
    }

    final start = _start;
    if (start == null) {
      await _startTelegramFlow();
      return;
    }

    setState(() {
      _verifying = true;
    });

    try {
      final session =
          await ref.read(backendRepositoryProvider).verifyTelegramAuth(
                loginSessionId: start.loginSessionId,
                code: code,
              );
      if (!mounted) {
        return;
      }

      await ref.read(appSessionControllerProvider).replaceAuthenticatedSession(
            tokens: session.tokens,
            userId: session.userId,
          );
      if (!mounted) {
        return;
      }
      context
          .goRoute(session.isNewUser ? AppRoute.permissions : AppRoute.tonight);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Код не подошел или устарел')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _verifying = false;
        });
      }
    }
  }

  void _showManualCodeEntry() {
    setState(() {
      _manualCodeEntry = true;
      _startError = null;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _codeFocusNode.requestFocus();
      }
    });
  }

  String _startErrorMessage(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map<String, dynamic>) {
        final code = data['code'] as String?;
        if (code == 'telegram_auth_unavailable') {
          return 'Telegram вход пока не настроен на сервере';
        }
      }
    }

    return 'Не удалось связать вход с сервером';
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final start = _start;
    final hasStartedFlow =
        _manualCodeEntry || _startToken != null || start != null;
    final codeLength = start?.codeLength ?? 4;
    final codeFilled = _codeController.text.length == codeLength;
    final manualOnly = _manualCodeEntry && _startToken == null && start == null;
    final waitingForStart =
        _startToken != null && start == null && _startError == null;
    final primaryLabel = !hasStartedFlow
        ? 'Открыть Telegram'
        : _startError != null
            ? 'Повторить'
            : manualOnly
                ? 'Открыть Telegram'
                : start == null
                    ? 'Ждем сервер'
                    : 'Войти';
    final primaryAction = (!hasStartedFlow)
        ? () => _startTelegramFlow()
        : _startError != null
            ? () => _startTelegramFlow(reopenTelegram: false)
            : manualOnly
                ? () => _startTelegramFlow()
                : start == null
                    ? null
                    : (codeFilled ? () => _submitCode() : null);
    final primaryDisabled = _starting || _verifying || primaryAction == null;

    return Scaffold(
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
                    onPressed: () {
                      if (hasStartedFlow) {
                        setState(() {
                          _start = null;
                          _startToken = null;
                          _startError = null;
                          _manualCodeEntry = false;
                          _codeController.clear();
                        });
                        return;
                      }
                      context.pop();
                    },
                    icon: const Icon(Icons.chevron_left_rounded, size: 28),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: !hasStartedFlow
                    ? _TelegramIntroStep(
                        onHasCodeTap: _showManualCodeEntry,
                      )
                    : _TelegramCodeStep(
                        codeLength: codeLength,
                        controller: _codeController,
                        focusNode: _codeFocusNode,
                        onChanged: _handleCodeChanged,
                        waitingForStart: waitingForStart,
                        startError: _startError,
                      ),
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
                        backgroundColor: colors.foreground,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                      ),
                      onPressed: primaryDisabled
                          ? null
                          : () async => primaryAction.call(),
                      child: Text(
                        primaryLabel,
                        style: AppTextStyles.button.copyWith(
                          color: colors.primaryForeground,
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
    );
  }
}

class _TelegramIntroStep extends StatelessWidget {
  const _TelegramIntroStep({
    required this.onHasCodeTap,
  });

  final VoidCallback onHasCodeTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: colors.secondarySoft,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(Icons.send_rounded, color: colors.secondary),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          'Войти через Telegram',
          style: AppTextStyles.sectionTitle.copyWith(fontSize: 28),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Откроем бота, там нажми старт, поделись номером и получи код для входа.',
          style: AppTextStyles.bodySoft.copyWith(color: colors.inkMute),
        ),
        const SizedBox(height: AppSpacing.xxl),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: colors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Как это работает',
                style: AppTextStyles.sectionTitle.copyWith(fontSize: 18),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                '1. Откроем Telegram.\n2. В боте нажми старт.\n3. Поделись контактом.\n4. Введи код здесь.',
                style: AppTextStyles.body.copyWith(
                  color: colors.inkSoft,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextButton(
                onPressed: onHasCodeTap,
                child: const Text('У меня уже есть код'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TelegramCodeStep extends StatelessWidget {
  const _TelegramCodeStep({
    required this.codeLength,
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.waitingForStart,
    required this.startError,
  });

  final int codeLength;
  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final bool waitingForStart;
  final String? startError;

  static const _cellWidth = 56.0;
  static const _cellHeight = 64.0;
  static const _cellGap = 12.0;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Введи код из бота',
          style: AppTextStyles.sectionTitle.copyWith(fontSize: 28),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          waitingForStart
              ? 'Telegram уже открыт. Ждем подтверждение от сервера.'
              : startError ??
                  'Код приходит сразу после того, как ты поделишься номером в Telegram.',
          style: AppTextStyles.bodySoft.copyWith(color: colors.inkMute),
        ),
        const SizedBox(height: AppSpacing.xxl),
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => focusNode.requestFocus(),
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 1,
                height: 1,
                child: TextField(
                  controller: controller,
                  focusNode: focusNode,
                  keyboardType: TextInputType.number,
                  autofocus: true,
                  showCursor: false,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(codeLength),
                  ],
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.zero,
                    isCollapsed: true,
                  ),
                  onChanged: onChanged,
                  style: const TextStyle(
                    color: Colors.transparent,
                    fontSize: 1,
                  ),
                  cursorColor: Colors.transparent,
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var index = 0; index < codeLength; index++) ...[
                    Builder(
                      builder: (context) {
                        final char = index < controller.text.length
                            ? controller.text[index]
                            : '';
                        final active = controller.text.length == index ||
                            (index == codeLength - 1 &&
                                controller.text.length == codeLength);
                        return Container(
                          key: ValueKey('telegram-code-cell-$index'),
                          width: _cellWidth,
                          height: _cellHeight,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: colors.card,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: active ? colors.foreground : colors.border,
                              width: 2,
                            ),
                          ),
                          child: Text(
                            char,
                            style: AppTextStyles.sectionTitle.copyWith(
                              color: colors.foreground,
                              fontSize: 28,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        );
                      },
                    ),
                    if (index != codeLength - 1)
                      const SizedBox(width: _cellGap),
                  ],
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

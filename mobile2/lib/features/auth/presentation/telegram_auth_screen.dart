import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile2/app/core/config/backend_config.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:url_launcher/url_launcher.dart';

class TelegramAuthScreen extends StatefulWidget {
  const TelegramAuthScreen({super.key});

  @override
  State<TelegramAuthScreen> createState() => _TelegramAuthScreenState();
}

class _TelegramAuthScreenState extends State<TelegramAuthScreen> {
  final TextEditingController _codeController = TextEditingController();
  bool _sent = false;
  bool _loading = false;
  String? _errorText;
  TelegramAuthStart? _session;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  int get _codeLength => _session?.codeLength ?? 4;
  bool get _canConfirm => _codeController.text.length >= _codeLength;

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isCompactHeight = constraints.maxHeight < 680;
            final verticalGap = isCompactHeight ? 20.0 : 32.0;
            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _BackButton(onTap: _handleBack),
                      Padding(
                        padding: EdgeInsets.symmetric(
                          vertical: isCompactHeight ? 28 : 64,
                        ),
                        child: Center(
                          child: _TelegramContent(
                            sent: _sent,
                            controller: _codeController,
                            canConfirm: _canConfirm,
                            codeLength: _codeLength,
                            loading: _loading,
                            errorText: _errorText,
                            verticalGap: verticalGap,
                            onSend: _startTelegramAuth,
                            onCodeChanged: (_) => setState(() {}),
                            onConfirm: _canConfirm ? _verifyTelegramAuth : null,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  void _handleBack() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/welcome');
    }
  }

  Future<void> _startTelegramAuth() async {
    setState(() {
      _loading = true;
      _errorText = null;
    });
    try {
      final session = await ProviderScope.containerOf(context, listen: false)
          .read(authActionsProvider)
          .startTelegramAuth();
      if (!mounted) {
        return;
      }
      setState(() {
        _session = session;
        _sent = true;
      });
      if (session.botUrl.isNotEmpty) {
        await launchUrl(
          Uri.parse(session.botUrl),
          mode: LaunchMode.externalApplication,
        );
      }
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _errorText = 'Не удалось начать вход через Telegram');
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _verifyTelegramAuth() async {
    final telegramSession = _session;
    if (telegramSession == null ||
        telegramSession.loginSessionId.isEmpty ||
        _loading) {
      return;
    }
    setState(() {
      _loading = true;
      _errorText = null;
    });
    try {
      final container = ProviderScope.containerOf(context, listen: false);
      final authSession =
          await container.read(authActionsProvider).verifyTelegramAuth(
                loginSessionId: telegramSession.loginSessionId,
                code: _codeController.text,
              );
      if (!mounted) {
        return;
      }
      context.go(authSession.isNewUser ? '/onboarding' : '/');
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _errorText = 'Неверный код Telegram');
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }
}

class _TelegramContent extends StatelessWidget {
  const _TelegramContent({
    required this.sent,
    required this.controller,
    required this.canConfirm,
    required this.codeLength,
    required this.loading,
    required this.errorText,
    required this.verticalGap,
    required this.onSend,
    required this.onCodeChanged,
    required this.onConfirm,
  });

  final bool sent;
  final TextEditingController controller;
  final bool canConfirm;
  final int codeLength;
  final bool loading;
  final String? errorText;
  final double verticalGap;
  final VoidCallback onSend;
  final ValueChanged<String> onCodeChanged;
  final VoidCallback? onConfirm;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const _TelegramBadge(),
        const SizedBox(height: 24),
        Text(
          'Вход через Telegram',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                fontSize: 30,
                height: 1.15,
                fontWeight: FontWeight.w600,
                letterSpacing: 0,
              ),
        ),
        const SizedBox(height: 12),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: Text(
            'Открой Telegram-бот @${BackendConfig.telegramBotUsername} и нажми «Войти». Затем введи код из бота.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: DateasyColors.muted,
                ),
          ),
        ),
        SizedBox(height: verticalGap),
        _PrimaryTelegramButton(
          label: loading && !sent ? 'Открываем' : 'Открыть Telegram',
          enabled: !loading,
          horizontalPadding: 32,
          onTap: onSend,
        ),
        if (sent) ...[
          SizedBox(height: verticalGap),
          _TelegramCodeForm(
            controller: controller,
            canConfirm: canConfirm,
            codeLength: codeLength,
            loading: loading,
            onChanged: onCodeChanged,
            onConfirm: onConfirm,
          ),
        ],
        if (errorText != null) ...[
          const SizedBox(height: 12),
          Text(
            errorText!,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.pink,
                ),
          ),
        ],
      ],
    );
  }
}

class _TelegramBadge extends StatelessWidget {
  const _TelegramBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 96,
      height: 96,
      decoration: BoxDecoration(
        color: const Color(0xFF229ED9),
        borderRadius: BorderRadius.circular(32),
        boxShadow: const [
          BoxShadow(
            color: Color(0x59229ED9),
            blurRadius: 60,
            spreadRadius: -20,
            offset: Offset(0, 20),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: const Icon(
        Icons.send_rounded,
        color: Colors.white,
        size: 48,
      ),
    );
  }
}

class _TelegramCodeForm extends StatelessWidget {
  const _TelegramCodeForm({
    required this.controller,
    required this.canConfirm,
    required this.codeLength,
    required this.loading,
    required this.onChanged,
    required this.onConfirm,
  });

  final TextEditingController controller;
  final bool canConfirm;
  final int codeLength;
  final bool loading;
  final ValueChanged<String> onChanged;
  final VoidCallback? onConfirm;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          'Введи $codeLength-значный код из бота',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: DateasyColors.muted,
              ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: controller,
          onChanged: onChanged,
          textAlign: TextAlign.center,
          keyboardType: TextInputType.number,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(codeLength),
          ],
          style: const TextStyle(
            color: DateasyColors.foreground,
            fontSize: 20,
            height: 1.2,
            letterSpacing: 8,
          ),
          decoration: InputDecoration(
            hintText: '• • • • • •',
            hintStyle: TextStyle(
              color: DateasyColors.muted.withValues(alpha: 0.7),
              letterSpacing: 8,
            ),
            filled: true,
            fillColor: DateasyColors.glass,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: DateasyColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: DateasyColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: DateasyColors.lime),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 16,
            ),
          ),
        ),
        const SizedBox(height: 16),
        _PrimaryTelegramButton(
          label: loading ? 'Проверяем' : 'Подтвердить',
          enabled: canConfirm && !loading,
          onTap: onConfirm,
        ),
      ],
    );
  }
}

class _BackButton extends StatelessWidget {
  const _BackButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: DateasyColors.glass,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          child: const Icon(
            Icons.chevron_left_rounded,
            size: 20,
            color: DateasyColors.foreground,
          ),
        ),
      ),
    );
  }
}

class _PrimaryTelegramButton extends StatelessWidget {
  const _PrimaryTelegramButton({
    required this.label,
    required this.enabled,
    required this.onTap,
    this.horizontalPadding = 0,
  });

  final String label;
  final bool enabled;
  final VoidCallback? onTap;
  final double horizontalPadding;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.4,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(16),
          child: Ink(
            width: horizontalPadding == 0 ? double.infinity : null,
            height: 56,
            padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: dateasyLimeGradient,
              boxShadow: enabled
                  ? const [
                      BoxShadow(
                        color: Color(0x59BEFF67),
                        blurRadius: 60,
                        spreadRadius: -20,
                        offset: Offset(0, 20),
                      ),
                    ]
                  : null,
            ),
            child: Center(
              child: Text(
                label,
                style: const TextStyle(
                  color: DateasyColors.backgroundDeep,
                  fontSize: 16,
                  height: 1.2,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile2/app/core/config/backend_config.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';

class PhoneNumberTextInputFormatter extends TextInputFormatter {
  static String digitsOnly(String value) {
    return value.replaceAll(RegExp(r'\D'), '');
  }

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = digitsOnly(newValue.text);
    final limited = digits.length > 10 ? digits.substring(0, 10) : digits;
    final formatted = _format(limited);
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }

  String _format(String digits) {
    if (digits.length <= 3) {
      return digits;
    }
    if (digits.length <= 6) {
      return '${digits.substring(0, 3)} ${digits.substring(3)}';
    }
    if (digits.length <= 8) {
      return '${digits.substring(0, 3)} ${digits.substring(3, 6)}-${digits.substring(6)}';
    }
    return '${digits.substring(0, 3)} ${digits.substring(3, 6)}-${digits.substring(6, 8)}-${digits.substring(8)}';
  }
}

class PhoneAuthScreen extends StatefulWidget {
  const PhoneAuthScreen({super.key});

  @override
  State<PhoneAuthScreen> createState() => _PhoneAuthScreenState();
}

class _PhoneAuthScreenState extends State<PhoneAuthScreen> {
  final TextEditingController _phoneController = TextEditingController();
  final List<TextEditingController> _codeControllers = List.generate(
    4,
    (_) => TextEditingController(),
  );
  final List<FocusNode> _codeFocusNodes = List.generate(4, (_) => FocusNode());

  _AuthStep _step = _AuthStep.phone;
  _Country _country = _countries.first;
  bool _pickerOpen = false;
  bool _loading = false;
  String? _errorText;
  PhoneAuthChallenge? _challenge;
  Timer? _completeTimer;

  @override
  void dispose() {
    _completeTimer?.cancel();
    _phoneController.dispose();
    for (final controller in _codeControllers) {
      controller.dispose();
    }
    for (final node in _codeFocusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  bool get _canRequestCode =>
      PhoneNumberTextInputFormatter.digitsOnly(_phoneController.text).length >=
      10;

  @override
  Widget build(BuildContext context) {
    final title =
        _step == _AuthStep.phone ? 'Введи номер телефона' : 'Код из SMS';
    final subtitle = _step == _AuthStep.phone
        ? 'Мы отправим SMS с кодом подтверждения'
        : 'Отправили на ${_challenge?.maskedPhone ?? '${_country.code} ${_phoneController.text}'}';

    return DateasyPhoneFrame(
      child: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
                  child: IntrinsicHeight(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _BackButton(onTap: _handleBack),
                        const SizedBox(height: 40),
                        Text(
                          title,
                          style: Theme.of(context)
                              .textTheme
                              .headlineLarge
                              ?.copyWith(
                                fontSize: 30,
                                height: 1.15,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0,
                              ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          subtitle,
                          style:
                              Theme.of(context).textTheme.bodyLarge?.copyWith(
                                    color: DateasyColors.muted,
                                  ),
                        ),
                        if (_step == _AuthStep.phone)
                          _PhoneStep(
                            phoneController: _phoneController,
                            country: _country,
                            pickerOpen: _pickerOpen,
                            canRequestCode: _canRequestCode,
                            onPhoneChanged: (_) => setState(() {}),
                            onTogglePicker: () {
                              setState(() => _pickerOpen = !_pickerOpen);
                            },
                            onCountrySelected: (country) {
                              setState(() {
                                _country = country;
                                _pickerOpen = false;
                              });
                            },
                            loading: _loading,
                            onRequestCode:
                                _canRequestCode ? _requestCode : null,
                          )
                        else
                          _CodeStep(
                            controllers: _codeControllers,
                            focusNodes: _codeFocusNodes,
                            onDigitChanged: _setCodeDigit,
                            onResend: _loading ? null : _requestCode,
                          ),
                        if (_errorText != null) ...[
                          const SizedBox(height: 12),
                          Text(
                            _errorText!,
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: DateasyColors.pink,
                                    ),
                          ),
                        ],
                        const Spacer(),
                        Center(
                          child: TextButton(
                            onPressed: () => context.go('/auth/telegram'),
                            child: Text(
                              'Войти через Telegram',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(
                                    color: DateasyColors.muted,
                                  ),
                            ),
                          ),
                        ),
                      ],
                    ),
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
    if (_step == _AuthStep.code) {
      setState(() => _step = _AuthStep.phone);
      return;
    }

    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/welcome');
    }
  }

  Future<void> _requestCode() async {
    setState(() {
      _loading = true;
      _errorText = null;
      _pickerOpen = false;
    });
    try {
      final digits =
          PhoneNumberTextInputFormatter.digitsOnly(_phoneController.text);
      final phone = '${_country.code}$digits';
      final authActions = ProviderScope.containerOf(context, listen: false)
          .read(authActionsProvider);
      final shouldTryTestPhoneShortcut =
          BackendConfig.enableTestPhoneShortcuts ||
              BackendConfig.isSeededTestPhoneShortcutNumber(phone);
      if (shouldTryTestPhoneShortcut) {
        try {
          final session = await authActions.loginWithTestPhoneShortcut(phone);
          if (!mounted) {
            return;
          }
          context.go(session.isNewUser ? '/onboarding' : '/');
          return;
        } on BackendActionException catch (error) {
          final canFallbackToSms =
              error.code == 'test_phone_shortcut_not_found' ||
                  error.code == 'test_phone_shortcut_disabled';
          if (!canFallbackToSms) {
            rethrow;
          }
        }
      }

      final challenge = await authActions.requestPhoneCode(phone);
      if (!mounted) {
        return;
      }
      setState(() {
        _challenge = challenge;
        _step = _AuthStep.code;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _codeFocusNodes.first.requestFocus();
        }
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _errorText = 'Не удалось отправить код');
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _setCodeDigit(int index, String value) {
    final digit = value.replaceAll(RegExp(r'\D'), '');
    if (_codeControllers[index].text != digit) {
      _codeControllers[index].text = digit;
      _codeControllers[index].selection = TextSelection.collapsed(
        offset: digit.length,
      );
    }

    if (digit.isNotEmpty && index < _codeFocusNodes.length - 1) {
      _codeFocusNodes[index + 1].requestFocus();
    }

    _completeTimer?.cancel();
    if (_codeControllers.every((controller) => controller.text.isNotEmpty)) {
      _completeTimer = Timer(const Duration(milliseconds: 600), () {
        if (mounted) {
          _verifyCode();
        }
      });
    }
  }

  Future<void> _verifyCode() async {
    final challenge = _challenge;
    if (challenge == null || challenge.challengeId.isEmpty || _loading) {
      return;
    }
    setState(() {
      _loading = true;
      _errorText = null;
    });
    try {
      final container = ProviderScope.containerOf(context, listen: false);
      final code = _codeControllers.map((controller) => controller.text).join();
      final session = await container.read(authActionsProvider).verifyPhone(
            challengeId: challenge.challengeId,
            code: code,
          );
      if (!mounted) {
        return;
      }
      context.go(session.isNewUser ? '/onboarding' : '/');
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _errorText = 'Неверный код или срок действия истек');
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }
}

class _PhoneStep extends StatelessWidget {
  const _PhoneStep({
    required this.phoneController,
    required this.country,
    required this.pickerOpen,
    required this.canRequestCode,
    required this.loading,
    required this.onPhoneChanged,
    required this.onTogglePicker,
    required this.onCountrySelected,
    required this.onRequestCode,
  });

  final TextEditingController phoneController;
  final _Country country;
  final bool pickerOpen;
  final bool canRequestCode;
  final bool loading;
  final ValueChanged<String> onPhoneChanged;
  final VoidCallback onTogglePicker;
  final ValueChanged<_Country> onCountrySelected;
  final VoidCallback? onRequestCode;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 32),
      child: Column(
        children: [
          _GlassField(
            child: Row(
              children: [
                InkWell(
                  onTap: onTogglePicker,
                  borderRadius: const BorderRadius.horizontal(
                    left: Radius.circular(16),
                  ),
                  child: Container(
                    height: 56,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: const BoxDecoration(
                      border: Border(
                        right: BorderSide(color: DateasyColors.border),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(country.flag,
                            style: const TextStyle(fontSize: 20)),
                        const SizedBox(width: 8),
                        Text(
                          country.code,
                          style: const TextStyle(
                            fontSize: 16,
                            height: 1.2,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Icon(
                          Icons.keyboard_arrow_down_rounded,
                          size: 18,
                          color: DateasyColors.muted,
                        ),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: TextField(
                    controller: phoneController,
                    onChanged: onPhoneChanged,
                    keyboardType: TextInputType.phone,
                    inputFormatters: [
                      PhoneNumberTextInputFormatter(),
                    ],
                    style: const TextStyle(
                      fontSize: 18,
                      height: 1.2,
                      color: DateasyColors.foreground,
                    ),
                    decoration: InputDecoration(
                      hintText: '999 123 45 67',
                      hintStyle: TextStyle(
                        color: DateasyColors.muted.withValues(alpha: 0.7),
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 16,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (pickerOpen) ...[
            const SizedBox(height: 16),
            _CountryPicker(
              selected: country,
              onSelected: onCountrySelected,
            ),
          ],
          const SizedBox(height: 16),
          _PrimaryAuthButton(
            label: loading ? 'Отправляем' : 'Получить код',
            enabled: canRequestCode,
            onTap: onRequestCode,
          ),
        ],
      ),
    );
  }
}

class _CodeStep extends StatelessWidget {
  const _CodeStep({
    required this.controllers,
    required this.focusNodes,
    required this.onDigitChanged,
    required this.onResend,
  });

  final List<TextEditingController> controllers;
  final List<FocusNode> focusNodes;
  final void Function(int index, String value) onDigitChanged;
  final VoidCallback? onResend;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 32),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              for (var index = 0; index < controllers.length; index++) ...[
                SizedBox(
                  width: 64,
                  child: _CodeInput(
                    controller: controllers[index],
                    focusNode: focusNodes[index],
                    onChanged: (value) => onDigitChanged(index, value),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 24),
          Center(
            child: TextButton(
              onPressed: onResend,
              child: Text(
                'Отправить код снова',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DateasyColors.muted,
                      decoration: TextDecoration.underline,
                    ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CodeInput extends StatelessWidget {
  const _CodeInput({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 64,
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        onChanged: onChanged,
        textAlign: TextAlign.center,
        keyboardType: TextInputType.number,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(1),
        ],
        style: const TextStyle(
          fontSize: 24,
          height: 1.2,
          color: DateasyColors.foreground,
          fontWeight: FontWeight.w600,
        ),
        decoration: InputDecoration(
          filled: true,
          fillColor: DateasyColors.glass,
          counterText: '',
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
        ),
      ),
    );
  }
}

class _CountryPicker extends StatelessWidget {
  const _CountryPicker({
    required this.selected,
    required this.onSelected,
  });

  final _Country selected;
  final ValueChanged<_Country> onSelected;

  @override
  Widget build(BuildContext context) {
    return _GlassField(
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            for (final country in _countries)
              InkWell(
                onTap: () => onSelected(country),
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  child: Row(
                    children: [
                      Text(country.flag, style: const TextStyle(fontSize: 20)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          country.name,
                          style: const TextStyle(
                            fontSize: 15,
                            height: 1.2,
                            color: DateasyColors.foreground,
                          ),
                        ),
                      ),
                      Text(
                        country.code,
                        style: TextStyle(
                          fontSize: 14,
                          height: 1.2,
                          color: country == selected
                              ? DateasyColors.lime
                              : DateasyColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
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

class _PrimaryAuthButton extends StatelessWidget {
  const _PrimaryAuthButton({
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool enabled;
  final VoidCallback? onTap;

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
            width: double.infinity,
            height: 56,
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

class _GlassField extends StatelessWidget {
  const _GlassField({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: child,
    );
  }
}

enum _AuthStep { phone, code }

class _Country {
  const _Country({
    required this.code,
    required this.flag,
    required this.name,
  });

  final String code;
  final String flag;
  final String name;
}

const _countries = [
  _Country(code: '+7', flag: '🇷🇺', name: 'Россия'),
  _Country(code: '+380', flag: '🇺🇦', name: 'Украина'),
  _Country(code: '+1', flag: '🇺🇸', name: 'США'),
  _Country(code: '+44', flag: '🇬🇧', name: 'UK'),
];

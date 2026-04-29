import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/session/app_session_controller.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/auth_flow.dart';
import 'package:big_break_mobile/shared/widgets/bb_phone_number_field.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class PhoneAuthScreen extends ConsumerStatefulWidget {
  const PhoneAuthScreen({super.key});

  @override
  ConsumerState<PhoneAuthScreen> createState() => _PhoneAuthScreenState();
}

class _PhoneAuthScreenState extends ConsumerState<PhoneAuthScreen> {
  static const _seededTestPhoneShortcutNumbers = <String>{
    '+71111111111',
    '+72222222222',
    '+73333333333',
    '+74444444444',
    '+75555555555',
    '+76666666666',
    '+77777777777',
  };

  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _otpFocusNode = FocusNode();
  late BbPhoneCountry _country = bbPhoneCountries.first;
  PhoneAuthChallenge? _challenge;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _phoneController.text = _country.formatDigits(_country.initialDigits);
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    _otpFocusNode.dispose();
    super.dispose();
  }

  void _handleOtpChanged(String value) {
    final digitsOnly = value.replaceAll(RegExp(r'\D'), '');
    final sanitized =
        digitsOnly.length > 4 ? digitsOnly.substring(0, 4) : digitsOnly;

    if (_otpController.text != sanitized) {
      _otpController.value = TextEditingValue(
        text: sanitized,
        selection: TextSelection.collapsed(offset: sanitized.length),
      );
    }

    setState(() {});

    if (sanitized.length == 4) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _submitOtp();
        }
      });
    }
  }

  void _handlePhoneChanged(String value) {
    final formatted = bbFormatPhoneInput(value, _country);

    if (_phoneController.text != formatted) {
      _phoneController.value = TextEditingValue(
        text: formatted,
        selection: TextSelection.collapsed(offset: formatted.length),
      );
    }

    setState(() {});
  }

  Future<void> _submitPhoneStep() async {
    if (_submitting) {
      return;
    }

    final phoneNumber = _fullPhoneNumber();
    if (phoneNumber.isEmpty) {
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      final shouldTryTestPhoneShortcut =
          BackendConfig.enableTestPhoneShortcuts ||
              _seededTestPhoneShortcutNumbers.contains(phoneNumber);
      if (shouldTryTestPhoneShortcut) {
        if (kDebugMode || kProfileMode) {
          debugPrint('Phone auth test shortcut enabled for this number');
        }
        try {
          final session = await ref
              .read(backendRepositoryProvider)
              .loginWithTestPhoneShortcut(phoneNumber);
          if (!mounted) {
            return;
          }
          await ref
              .read(appSessionControllerProvider)
              .replaceAuthenticatedSession(
                tokens: session.tokens,
                userId: session.userId,
              );
          if (!mounted) {
            return;
          }
          context.goRoute(
            session.isNewUser ? AppRoute.permissions : AppRoute.tonight,
          );
          return;
        } on DioException catch (error) {
          final responseCode = error.response?.data is Map<String, dynamic>
              ? (error.response!.data as Map<String, dynamic>)['code']
                  as String?
              : error.response?.data is Map
                  ? (Map<String, dynamic>.from(
                      error.response!.data as Map))['code'] as String?
                  : null;
          final isNotTestShortcut =
              responseCode == 'test_phone_shortcut_not_found' ||
                  responseCode == 'test_phone_shortcut_disabled' ||
                  error.response?.statusCode == 404;
          if (!isNotTestShortcut) {
            rethrow;
          }
        }
      } else if (kDebugMode || kProfileMode) {
        debugPrint('Phone auth test shortcut skipped for this build');
      }

      final challenge = await ref
          .read(backendRepositoryProvider)
          .requestPhoneCode(phoneNumber);
      if (!mounted) {
        return;
      }
      setState(() {
        _challenge = challenge;
        _otpController.clear();
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _otpFocusNode.requestFocus();
        }
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не получилось отправить код')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Future<void> _submitOtp() async {
    if (_submitting || _challenge == null) {
      return;
    }

    final code = _otpController.text.trim();
    if (code.length != 4) {
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      final session = await ref.read(backendRepositoryProvider).verifyPhoneCode(
            challengeId: _challenge!.challengeId,
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
      context.goRoute(
        session.isNewUser ? AppRoute.permissions : AppRoute.tonight,
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Код не подошел или устарел')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Future<void> _pickCountry() async {
    final next = await showBbPhoneCountryPicker(
      context: context,
      selected: _country,
    );

    if (next == null || !mounted || next == _country) {
      return;
    }

    final digitsOnly = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    final truncated = digitsOnly.length > next.localLength
        ? digitsOnly.substring(0, next.localLength)
        : digitsOnly;

    setState(() {
      _country = next;
      _phoneController.text = next.formatDigits(
        truncated.isEmpty ? next.initialDigits : truncated,
      );
    });
  }

  String _fullPhoneNumber() {
    return bbFullPhoneNumber(_phoneController.text, _country) ?? '';
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final isOtp = _challenge != null;
    final otpFilled = _otpController.text.length == 4;
    final phoneFilled =
        _phoneController.text.replaceAll(RegExp(r'\D'), '').length ==
            _country.localLength;

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
                      if (isOtp) {
                        setState(() {
                          _challenge = null;
                          _otpController.clear();
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
                child: isOtp
                    ? _OtpStep(
                        maskedPhone:
                            _challenge?.maskedPhone ?? _fullPhoneNumber(),
                        controller: _otpController,
                        focusNode: _otpFocusNode,
                        onChanged: _handleOtpChanged,
                      )
                    : _PhoneStep(
                        controller: _phoneController,
                        country: _country,
                        onCountryTap: _pickCountry,
                        onChanged: _handlePhoneChanged,
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
                      onPressed:
                          _submitting || (isOtp ? !otpFilled : !phoneFilled)
                              ? null
                              : () async {
                                  if (!isOtp) {
                                    await _submitPhoneStep();
                                  } else {
                                    await _submitOtp();
                                  }
                                },
                      child: Text(
                        isOtp ? 'Войти' : 'Получить код',
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

class _PhoneStep extends StatelessWidget {
  const _PhoneStep({
    required this.controller,
    required this.country,
    required this.onCountryTap,
    required this.onChanged,
  });

  final TextEditingController controller;
  final BbPhoneCountry country;
  final VoidCallback onCountryTap;
  final ValueChanged<String> onChanged;

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
            color: colors.primarySoft,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(Icons.phone_iphone_rounded, color: colors.primary),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          'Введи номер телефона',
          style: AppTextStyles.sectionTitle.copyWith(fontSize: 28),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Пришлём код для входа. Без спама, обещаем.',
          style: AppTextStyles.bodySoft.copyWith(color: colors.inkMute),
        ),
        const SizedBox(height: AppSpacing.xxl),
        BbPhoneNumberField(
          controller: controller,
          country: country,
          onCountryTap: onCountryTap,
          onChanged: onChanged,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Номер используем только для входа.',
          style: AppTextStyles.meta.copyWith(color: colors.inkMute),
        ),
      ],
    );
  }
}

class _OtpStep extends StatelessWidget {
  const _OtpStep({
    required this.maskedPhone,
    required this.controller,
    required this.focusNode,
    required this.onChanged,
  });

  final String maskedPhone;
  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Код из СМС',
          style: AppTextStyles.sectionTitle.copyWith(fontSize: 28),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Отправили на $maskedPhone. Введи 4 цифры.',
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
                  showCursor: false,
                  autofocus: true,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(4),
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
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(4, (index) {
                  final char = index < controller.text.length
                      ? controller.text[index]
                      : '';
                  final active = controller.text.length == index ||
                      (index == 3 && controller.text.length == 4);
                  return Container(
                    width: 64,
                    height: 72,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: active ? colors.foreground : colors.border,
                        width: active ? 2 : 1,
                      ),
                    ),
                    child: Text(
                      char,
                      style: AppTextStyles.sectionTitle.copyWith(fontSize: 28),
                    ),
                  );
                }),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        Center(
          child: TextButton(
            onPressed: () {},
            child: Text(
              'Отправить код снова · 0:42',
              style: AppTextStyles.meta.copyWith(
                color: colors.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

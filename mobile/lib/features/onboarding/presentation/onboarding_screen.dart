import 'dart:async';

import 'package:big_break_mobile/app/core/device/app_location_service.dart';
import 'package:big_break_mobile/app/core/maps/yandex_map_service.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_radii.dart';
import 'package:big_break_mobile/app/theme/app_spacing.dart';
import 'package:big_break_mobile/app/theme/app_text_styles.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/onboarding_data.dart';
import 'package:big_break_mobile/shared/utils/location_label.dart';
import 'package:big_break_mobile/shared/widgets/bb_phone_number_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yandex_mapkit/yandex_mapkit.dart' show Point;

enum _OnboardingStep {
  contact,
  profile,
  location,
  interests,
  vibe,
}

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  int step = 0;
  String? intent;
  String? gender;
  String? birthDate;
  String city = '';
  String? area;
  String? email;
  String? phoneNumber;
  final picked = <String>{};
  String? vibe;
  OnboardingContactRequirement? _requiredContact;
  late BbPhoneCountry _contactPhoneCountry = bbPhoneCountries.first;
  late final TextEditingController _emailController;
  late final TextEditingController _contactPhoneController;
  late final TextEditingController _locationController;
  late final TextEditingController _birthDateController;
  Timer? _searchDebounce;
  bool _initializedFromBackend = false;
  bool _didTouchForm = false;
  bool _saving = false;
  bool _resolvingLocation = false;
  bool _searchingLocationSuggestions = false;
  List<ResolvedAddress> _locationSuggestions = const [];

  static const interests = [
    'Кофе',
    'Бары',
    'Бег',
    'Кино',
    'Музыка',
    'Настолки',
    'Йога',
    'Книги',
    'Выставки',
    'Велик',
    'Театр',
    'Готовка',
    'Походы',
    'Фото',
  ];

  static const vibes = [
    ('calm', 'Спокойно', 'Камерные встречи, разговор'),
    ('active', 'Активно', 'Спорт, прогулки, движение'),
    ('social', 'Шумно', 'Бары, вечеринки, толпа'),
  ];

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController();
    _contactPhoneController = TextEditingController();
    _locationController = TextEditingController();
    _birthDateController = TextEditingController();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _emailController.dispose();
    _contactPhoneController.dispose();
    _locationController.dispose();
    _birthDateController.dispose();
    super.dispose();
  }

  List<_OnboardingStep> get _steps {
    final steps = <_OnboardingStep>[
      _OnboardingStep.profile,
      _OnboardingStep.location,
      _OnboardingStep.interests,
      _OnboardingStep.vibe,
    ];
    if (_requiredContact != null) {
      return [_OnboardingStep.contact, ...steps];
    }
    return steps;
  }

  _OnboardingStep get _currentStep {
    final steps = _steps;
    final index = step >= steps.length ? steps.length - 1 : step;
    return steps[index];
  }

  bool get canContinue {
    switch (_currentStep) {
      case _OnboardingStep.contact:
        return switch (_requiredContact) {
          OnboardingContactRequirement.email =>
            _normalizedEmail(_emailController.text) != null,
          OnboardingContactRequirement.phone => bbFullPhoneNumber(
                _contactPhoneController.text,
                _contactPhoneCountry,
              ) !=
              null,
          null => true,
        };
      case _OnboardingStep.profile:
        return intent != null &&
            gender != null &&
            _birthDateIsoFromInput(_birthDateController.text) != null;
      case _OnboardingStep.location:
        return _locationController.text.trim().isNotEmpty;
      case _OnboardingStep.interests:
        return picked.length >= 2;
      case _OnboardingStep.vibe:
        return vibe != null;
    }
  }

  void next() {
    if (_saving) {
      return;
    }
    if (step < _steps.length - 1) {
      setState(() {
        step += 1;
      });
      return;
    }

    _save();
  }

  Future<void> _save() async {
    final repository = ref.read(backendRepositoryProvider);
    final rawCity =
        city.trim().isNotEmpty ? city.trim() : _locationController.text.trim();
    final normalizedCity = normalizeCityLabel(rawCity);
    final normalizedArea = normalizeAreaLabel(area, city: normalizedCity);
    setState(() {
      _saving = true;
    });
    try {
      final saved = await repository.saveOnboarding(
        OnboardingData(
          intent: intent,
          gender: gender,
          birthDate: _birthDateIsoFromInput(_birthDateController.text),
          city: normalizedCity.isNotEmpty ? normalizedCity : rawCity,
          area: normalizedArea,
          interests: picked.toList(growable: false),
          vibe: vibe,
          email: _normalizedEmail(_emailController.text) ?? email,
          phoneNumber: bbFullPhoneNumber(
                  _contactPhoneController.text, _contactPhoneCountry) ??
              phoneNumber,
        ),
      );
      ref.read(onboardingLocalStateProvider.notifier).state = saved;
      ref.invalidate(profileProvider);
      if (mounted) {
        context.goRoute(AppRoute.tonight);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не получилось сохранить onboarding')),
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

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final onboarding = ref.watch(onboardingProvider).valueOrNull;
    if (onboarding != null && !_initializedFromBackend && !_didTouchForm) {
      _initializedFromBackend = true;
      intent = onboarding.intent;
      gender = onboarding.gender;
      birthDate = onboarding.birthDate;
      city = onboarding.city ?? '';
      area = onboarding.area;
      email = onboarding.email;
      phoneNumber = onboarding.phoneNumber;
      _requiredContact = onboarding.requiredContact;
      _emailController.text = onboarding.email ?? '';
      _contactPhoneCountry = bbCountryForPhoneNumber(onboarding.phoneNumber);
      _contactPhoneController.text = _contactPhoneCountry.formatDigits(
        bbLocalDigitsForPhoneNumber(
          onboarding.phoneNumber,
          _contactPhoneCountry,
        ),
      );
      _birthDateController.text =
          _formatBirthDateForInput(onboarding.birthDate);
      _locationController.text =
          _composeLocation(onboarding.city, onboarding.area);
      picked
        ..clear()
        ..addAll(onboarding.interests);
      vibe = onboarding.vibe;
    }

    final steps = _steps;

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
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
                child: Row(
                  children: List.generate(
                    steps.length,
                    (index) => Expanded(
                      child: Container(
                        height: 4,
                        margin: EdgeInsets.only(
                          right: index == steps.length - 1 ? 0 : 6,
                        ),
                        decoration: BoxDecoration(
                          color:
                              index <= step ? colors.foreground : colors.muted,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: _buildStep(context),
                ),
              ),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.background.withValues(alpha: 0.8),
                  border: Border(
                    top:
                        BorderSide(color: colors.border.withValues(alpha: 0.6)),
                  ),
                ),
                child: SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
                    child: SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: canContinue && !_saving
                              ? colors.foreground
                              : colors.muted,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        onPressed: canContinue && !_saving ? next : null,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _saving
                                  ? 'Сохраняем'
                                  : step < steps.length - 1
                                      ? 'Дальше'
                                      : 'Готово',
                              style: AppTextStyles.button.copyWith(
                                color: canContinue && !_saving
                                    ? colors.primaryForeground
                                    : colors.inkMute,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Icon(
                              _saving
                                  ? Icons.hourglass_top_rounded
                                  : Icons.arrow_forward_rounded,
                              color: canContinue && !_saving
                                  ? colors.primaryForeground
                                  : colors.inkMute,
                            ),
                          ],
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

  Widget _buildStep(BuildContext context) {
    final colors = AppColors.of(context);
    switch (_currentStep) {
      case _OnboardingStep.contact:
        return _buildContactStep(context);
      case _OnboardingStep.profile:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _BirthDateSection(
              value: _birthDateController.text,
              onTap: _showBirthDatePicker,
            ),
            const SizedBox(height: 28),
            Text('Зачем ты здесь?', style: AppTextStyles.screenTitle),
            const SizedBox(height: 8),
            Text(
              'Выбери, что тебе ближе сейчас. Это можно поменять позже.',
              style: AppTextStyles.bodySoft,
            ),
            const SizedBox(height: 28),
            _ChoiceCard(
              active: intent == 'dating',
              icon: Icons.favorite_border_rounded,
              title: 'Свидания',
              subtitle: 'Знакомства один на один',
              onTap: () => setState(() {
                _didTouchForm = true;
                intent = 'dating';
              }),
            ),
            const SizedBox(height: 12),
            _ChoiceCard(
              active: intent == 'friendship',
              icon: Icons.groups_rounded,
              title: 'Друзья',
              subtitle: 'Новые люди и компании',
              onTap: () => setState(() {
                _didTouchForm = true;
                intent = 'friendship';
              }),
            ),
            const SizedBox(height: 12),
            _ChoiceCard(
              active: intent == 'both',
              icon: Icons.auto_awesome_outlined,
              title: 'И то и другое',
              subtitle: 'Открыт ко всему',
              onTap: () => setState(() {
                _didTouchForm = true;
                intent = 'both';
              }),
            ),
            const SizedBox(height: 28),
            Text('Твой пол',
                style: AppTextStyles.itemTitle.copyWith(fontSize: 16)),
            const SizedBox(height: 8),
            Text(
              'Это нужно, чтобы не ломать фильтры и сценарии знакомств.',
              style: AppTextStyles.bodySoft,
            ),
            const SizedBox(height: 12),
            _ChoiceCard(
              active: gender == 'male',
              icon: Icons.male_rounded,
              title: 'Мужчина',
              subtitle: 'Показывать мужской профиль',
              onTap: () => setState(() {
                _didTouchForm = true;
                gender = 'male';
              }),
            ),
            const SizedBox(height: 12),
            _ChoiceCard(
              active: gender == 'female',
              icon: Icons.female_rounded,
              title: 'Женщина',
              subtitle: 'Показывать женский профиль',
              onTap: () => setState(() {
                _didTouchForm = true;
                gender = 'female';
              }),
            ),
          ],
        );
      case _OnboardingStep.location:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Где ты?', style: AppTextStyles.screenTitle),
            const SizedBox(height: 8),
            Text(
              'Можно ввести адрес или город. Либо определить по гео.',
              style: AppTextStyles.bodySoft,
            ),
            const SizedBox(height: 28),
            Text(
              'Адрес или город',
              style: AppTextStyles.meta.copyWith(color: colors.inkSoft),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _locationController,
              textInputAction: TextInputAction.done,
              onTapOutside: (_) =>
                  FocusManager.instance.primaryFocus?.unfocus(),
              onChanged: _handleLocationChanged,
              decoration: InputDecoration(
                hintText: 'Например, Покровка 17 или Москва',
                filled: true,
                fillColor: colors.card,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 16,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: BorderSide(color: colors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: BorderSide(color: colors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: BorderSide(color: colors.foreground),
                ),
              ),
            ),
            if (_searchingLocationSuggestions ||
                _locationSuggestions.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: colors.border),
                ),
                child: Column(
                  children: [
                    if (_searchingLocationSuggestions &&
                        _locationSuggestions.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: colors.primary,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Ищем адрес в Яндекс Картах',
                                style: AppTextStyles.meta.copyWith(
                                  color: colors.inkMute,
                                ),
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      ..._locationSuggestions.map(
                        (item) => InkWell(
                          onTap: () => _applyLocationSuggestion(item),
                          borderRadius: BorderRadius.circular(18),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 14,
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: colors.primarySoft,
                                    shape: BoxShape.circle,
                                  ),
                                  alignment: Alignment.center,
                                  child: Icon(
                                    Icons.place_outlined,
                                    size: 18,
                                    color: colors.primary,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.name,
                                        style: AppTextStyles.body.copyWith(
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        item.address,
                                        style: AppTextStyles.meta.copyWith(
                                          color: colors.inkMute,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _resolvingLocation ? null : _resolveLocation,
                icon: _resolvingLocation
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: colors.foreground,
                        ),
                      )
                    : const Icon(Icons.my_location_rounded),
                label: Text(
                  _resolvingLocation
                      ? 'Определяем локацию'
                      : 'Определить по гео',
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: colors.foreground,
                  side: BorderSide(color: colors.border),
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                ),
              ),
            ),
            if (area != null && area!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Определили: $area',
                style: AppTextStyles.meta.copyWith(color: colors.inkMute),
              ),
            ],
            if (_locationController.text.trim().isEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Ничего не выбрано, пока ты сам не укажешь место.',
                style: AppTextStyles.meta.copyWith(color: colors.inkMute),
              ),
            ],
          ],
        );
      case _OnboardingStep.interests:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Что тебе нравится?', style: AppTextStyles.screenTitle),
            const SizedBox(height: 8),
            Text(
              'Выбери от двух интересов. Без них сложнее найти своих.',
              style: AppTextStyles.bodySoft,
            ),
            const SizedBox(height: 28),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: interests
                  .map(
                    (item) => _PillButton(
                      active: picked.contains(item),
                      label: item,
                      activeBackground: colors.primarySoft,
                      activeForeground: colors.primary,
                      activeBorder: colors.primary,
                      onTap: () {
                        setState(() {
                          _didTouchForm = true;
                          if (picked.contains(item)) {
                            picked.remove(item);
                          } else {
                            picked.add(item);
                          }
                        });
                      },
                    ),
                  )
                  .toList(growable: false),
            ),
          ],
        );
      case _OnboardingStep.vibe:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Какой вечер тебе ближе?', style: AppTextStyles.screenTitle),
            const SizedBox(height: 8),
            Text(
              'Подберём встречи под твоё настроение.',
              style: AppTextStyles.bodySoft,
            ),
            const SizedBox(height: 28),
            for (final item in vibes) ...[
              _ChoiceCard(
                active: vibe == item.$1,
                icon: null,
                title: item.$2,
                subtitle: item.$3,
                onTap: () => setState(() {
                  _didTouchForm = true;
                  vibe = item.$1;
                }),
              ),
              if (item != vibes.last) const SizedBox(height: 12),
            ],
          ],
        );
    }
  }

  Widget _buildContactStep(BuildContext context) {
    final colors = AppColors.of(context);
    final requirement = _requiredContact;
    if (requirement == OnboardingContactRequirement.phone) {
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
          Text('Укажи телефон', style: AppTextStyles.screenTitle),
          const SizedBox(height: 8),
          Text(
            'Он нужен для входа и восстановления доступа.',
            style: AppTextStyles.bodySoft,
          ),
          const SizedBox(height: 28),
          BbPhoneNumberField(
            fieldKey: const Key('onboarding-phone-field'),
            controller: _contactPhoneController,
            country: _contactPhoneCountry,
            onCountryTap: _pickContactCountry,
            onChanged: _handleContactPhoneChanged,
          ),
          const SizedBox(height: 12),
          Text(
            'Номер не показываем другим людям.',
            style: AppTextStyles.meta.copyWith(color: colors.inkMute),
          ),
        ],
      );
    }

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
          child: Icon(Icons.alternate_email_rounded, color: colors.secondary),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text('Укажи email', style: AppTextStyles.screenTitle),
        const SizedBox(height: 8),
        Text(
          'Он нужен для входа и важных сообщений по аккаунту.',
          style: AppTextStyles.bodySoft,
        ),
        const SizedBox(height: 28),
        TextField(
          key: const Key('onboarding-email-field'),
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          autocorrect: false,
          onChanged: (value) {
            setState(() {
              _didTouchForm = true;
              email = value.trim();
            });
          },
          decoration: InputDecoration(
            hintText: 'name@example.com',
            filled: true,
            fillColor: colors.card,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 16,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(18),
              borderSide: BorderSide(color: colors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(18),
              borderSide: BorderSide(color: colors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(18),
              borderSide: BorderSide(color: colors.foreground),
            ),
          ),
          style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 12),
        Text(
          'Почту не показываем другим людям.',
          style: AppTextStyles.meta.copyWith(color: colors.inkMute),
        ),
      ],
    );
  }

  void _handleContactPhoneChanged(String value) {
    final formatted = bbFormatPhoneInput(value, _contactPhoneCountry);

    if (_contactPhoneController.text != formatted) {
      _contactPhoneController.value = TextEditingValue(
        text: formatted,
        selection: TextSelection.collapsed(offset: formatted.length),
      );
    }

    setState(() {
      _didTouchForm = true;
      phoneNumber = bbFullPhoneNumber(
        _contactPhoneController.text,
        _contactPhoneCountry,
      );
    });
  }

  Future<void> _pickContactCountry() async {
    final next = await showBbPhoneCountryPicker(
      context: context,
      selected: _contactPhoneCountry,
    );

    if (next == null || !mounted || next == _contactPhoneCountry) {
      return;
    }

    final digitsOnly = bbPhoneDigits(_contactPhoneController.text);
    final truncated = digitsOnly.length > next.localLength
        ? digitsOnly.substring(0, next.localLength)
        : digitsOnly;

    setState(() {
      _didTouchForm = true;
      _contactPhoneCountry = next;
      _contactPhoneController.text = next.formatDigits(truncated);
      phoneNumber = bbFullPhoneNumber(_contactPhoneController.text, next);
    });
  }

  String? _normalizedEmail(String value) {
    final normalized = value.trim().toLowerCase();
    if (normalized.isEmpty) {
      return null;
    }
    final emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    return emailPattern.hasMatch(normalized) ? normalized : null;
  }

  Future<void> _resolveLocation() async {
    setState(() {
      _resolvingLocation = true;
    });

    try {
      final position =
          await ref.read(appLocationServiceProvider).getCurrentPosition();
      if (position == null) {
        _showHint('Не получилось определить гео');
        return;
      }

      final resolved = await ref.read(yandexMapServiceProvider).reverseGeocode(
            Point(
              latitude: position.latitude,
              longitude: position.longitude,
            ),
          );
      final location = resolved?.address ??
          '${position.latitude.toStringAsFixed(5)}, ${position.longitude.toStringAsFixed(5)}';
      final normalizedCity = normalizeCityLabel(location);
      if (!mounted) {
        return;
      }
      setState(() {
        _didTouchForm = true;
        city = normalizedCity.isNotEmpty ? normalizedCity : location;
        area = normalizeAreaLabel(
          resolved?.name,
          city: normalizedCity,
        );
        _locationController.text = location;
        _locationSuggestions = const [];
        _searchingLocationSuggestions = false;
      });
    } finally {
      if (mounted) {
        setState(() {
          _resolvingLocation = false;
        });
      }
    }
  }

  String _composeLocation(String? nextCity, String? nextArea) {
    final parts = [nextCity, nextArea]
        .whereType<String>()
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
    return parts.join(', ');
  }

  void _handleLocationChanged(String value) {
    setState(() {
      _didTouchForm = true;
      city = value.trim();
      area = null;
    });
    _queueLocationSearch(value);
  }

  Future<void> _showBirthDatePicker() async {
    FocusManager.instance.primaryFocus?.unfocus();
    final selected = await showBirthDateSheet(
      context,
      initialValue: _birthDateFromIso(birthDate) ?? _defaultBirthDate(),
      firstDate: _birthDateYearsAgo(100),
      lastDate: _birthDateYearsAgo(18),
    );
    if (selected == null || !mounted) {
      return;
    }

    final iso = _birthDateIsoFromDate(selected);
    setState(() {
      _didTouchForm = true;
      birthDate = iso;
      _birthDateController.text = _formatBirthDateForInput(iso);
    });
  }

  String _formatBirthDateForInput(String? value) {
    if (value == null || value.isEmpty) {
      return '';
    }
    final parts = value.split('-');
    if (parts.length != 3) {
      return value;
    }
    return '${parts[2]}.${parts[1]}.${parts[0]}';
  }

  DateTime? _birthDateFromIso(String? value) {
    if (value == null || value.isEmpty) {
      return null;
    }
    final parts = value.split('-');
    if (parts.length != 3) {
      return null;
    }

    final year = int.tryParse(parts[0]);
    final month = int.tryParse(parts[1]);
    final day = int.tryParse(parts[2]);
    if (year == null || month == null || day == null) {
      return null;
    }

    final date = DateTime(year, month, day);
    if (date.year != year || date.month != month || date.day != day) {
      return null;
    }
    return date;
  }

  DateTime _defaultBirthDate() {
    return _birthDateYearsAgo(25);
  }

  DateTime _birthDateYearsAgo(int years) {
    final now = DateTime.now();
    final year = now.year - years;
    final lastDayOfMonth = DateTime(year, now.month + 1, 0).day;
    final day = now.day > lastDayOfMonth ? lastDayOfMonth : now.day;
    return DateTime(year, now.month, day);
  }

  String _birthDateIsoFromDate(DateTime date) {
    final monthText = date.month.toString().padLeft(2, '0');
    final dayText = date.day.toString().padLeft(2, '0');
    return '${date.year}-$monthText-$dayText';
  }

  String? _birthDateIsoFromInput(String value) {
    final parts = value.trim().split('.');
    if (parts.length != 3) {
      return null;
    }

    final day = int.tryParse(parts[0]);
    final month = int.tryParse(parts[1]);
    final year = int.tryParse(parts[2]);
    if (day == null || month == null || year == null) {
      return null;
    }

    final date = DateTime.utc(year, month, day);
    if (date.year != year || date.month != month || date.day != day) {
      return null;
    }

    final now = DateTime.now().toUtc();
    var age = now.year - year;
    if (now.month < month || (now.month == month && now.day < day)) {
      age -= 1;
    }
    if (age < 18 || age > 100) {
      return null;
    }

    final monthText = month.toString().padLeft(2, '0');
    final dayText = day.toString().padLeft(2, '0');
    return '$year-$monthText-$dayText';
  }

  void _queueLocationSearch(String value) {
    final trimmed = value.trim();
    _searchDebounce?.cancel();

    if (trimmed.length < 3) {
      if (!mounted) {
        return;
      }
      setState(() {
        _searchingLocationSuggestions = false;
        _locationSuggestions = const [];
      });
      return;
    }

    setState(() {
      _searchingLocationSuggestions = true;
    });

    _searchDebounce = Timer(const Duration(milliseconds: 300), () async {
      final resolved = await ref.read(yandexMapServiceProvider).searchPlaces(
            trimmed,
          );
      if (!mounted || _locationController.text.trim() != trimmed) {
        return;
      }

      setState(() {
        _searchingLocationSuggestions = false;
        _locationSuggestions = resolved;
      });
    });
  }

  void _applyLocationSuggestion(ResolvedAddress suggestion) {
    final normalizedCity = normalizeCityLabel(suggestion.address);
    setState(() {
      _didTouchForm = true;
      city = normalizedCity.isNotEmpty
          ? normalizedCity
          : suggestion.address.trim();
      area = normalizeAreaLabel(
        suggestion.name.trim().isEmpty ? null : suggestion.name.trim(),
        city: normalizedCity,
      );
      _locationController.text = suggestion.name;
      _locationSuggestions = const [];
      _searchingLocationSuggestions = false;
    });
  }

  void _showHint(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}

Future<DateTime?> showBirthDateSheet(
  BuildContext context, {
  required DateTime initialValue,
  required DateTime firstDate,
  required DateTime lastDate,
}) {
  return showModalBottomSheet<DateTime>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => _BirthDateSheet(
      initialValue: initialValue,
      firstDate: firstDate,
      lastDate: lastDate,
    ),
  );
}

class _BirthDateSection extends StatelessWidget {
  const _BirthDateSection({
    required this.value,
    required this.onTap,
  });

  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final hasValue = value.trim().isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Дата рождения', style: AppTextStyles.screenTitle),
        const SizedBox(height: 8),
        Text(
          'Возраст появится в профиле. Его не получится менять часто.',
          style: AppTextStyles.bodySoft,
        ),
        const SizedBox(height: 14),
        Material(
          color: colors.card,
          borderRadius: AppRadii.cardBorder,
          child: InkWell(
            key: const Key('onboarding-birth-date-picker'),
            onTap: onTap,
            borderRadius: AppRadii.cardBorder,
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: AppRadii.cardBorder,
                border: Border.all(color: colors.border),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: colors.primarySoft,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(
                      Icons.calendar_month_rounded,
                      color: colors.primary,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          hasValue ? value : 'Выбрать дату',
                          style: AppTextStyles.itemTitle.copyWith(
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'День, месяц, год',
                          style: AppTextStyles.meta.copyWith(
                            color: colors.inkMute,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.expand_more_rounded,
                    color: colors.inkMute,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _BirthDateSheet extends StatefulWidget {
  const _BirthDateSheet({
    required this.initialValue,
    required this.firstDate,
    required this.lastDate,
  });

  final DateTime initialValue;
  final DateTime firstDate;
  final DateTime lastDate;

  @override
  State<_BirthDateSheet> createState() => _BirthDateSheetState();
}

class _BirthDateSheetState extends State<_BirthDateSheet> {
  late DateTime _date = widget.initialValue;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return SafeArea(
      top: false,
      child: Container(
        height: MediaQuery.of(context).size.height * 0.9,
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colors.border,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
              child: Row(
                children: [
                  const SizedBox(width: 40),
                  Expanded(
                    child: Text(
                      'Дата рождения',
                      textAlign: TextAlign.center,
                      style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, size: 20),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: Column(
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: AppRadii.cardBorder,
                        border: Border.all(color: colors.border),
                      ),
                      child: Theme(
                        data: Theme.of(context).copyWith(
                          colorScheme: ColorScheme.light(
                            primary: colors.primary,
                            onPrimary: colors.primaryForeground,
                            surface: colors.card,
                            onSurface: colors.foreground,
                          ),
                        ),
                        child: CalendarDatePicker(
                          initialDate: _date,
                          firstDate: widget.firstDate,
                          lastDate: widget.lastDate,
                          initialCalendarMode: DatePickerMode.year,
                          onDateChanged: (value) {
                            setState(() => _date = value);
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      _formatDate(_date),
                      style: AppTextStyles.body.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: FilledButton(
                        key: const Key('birth-date-sheet-submit'),
                        style: FilledButton.styleFrom(
                          backgroundColor: colors.primary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        onPressed: () => Navigator.of(context).pop(_date),
                        child: Text(
                          'Выбрать',
                          style: AppTextStyles.button.copyWith(
                            color: colors.primaryForeground,
                          ),
                        ),
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

  String _formatDate(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    return '$day.$month.${date.year}';
  }
}

class _ChoiceCard extends StatelessWidget {
  const _ChoiceCard({
    required this.active,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final bool active;
  final IconData? icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: colors.card,
      borderRadius: AppRadii.cardBorder,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.cardBorder,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: AppRadii.cardBorder,
            border: Border.all(
              color: active ? colors.foreground : colors.border,
              width: active ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              if (icon != null) ...[
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: active ? colors.primary : colors.muted,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    icon,
                    color: active ? colors.primaryForeground : colors.inkSoft,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTextStyles.itemTitle.copyWith(fontSize: 16),
                    ),
                    const SizedBox(height: 2),
                    Text(subtitle, style: AppTextStyles.meta),
                  ],
                ),
              ),
              if (active) Icon(Icons.check_rounded, color: colors.foreground),
            ],
          ),
        ),
      ),
    );
  }
}

class _PillButton extends StatelessWidget {
  const _PillButton({
    required this.active,
    required this.label,
    required this.onTap,
    this.activeBackground,
    this.activeForeground,
    this.activeBorder,
  });

  final bool active;
  final String label;
  final VoidCallback onTap;
  final Color? activeBackground;
  final Color? activeForeground;
  final Color? activeBorder;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final resolvedBackground = activeBackground ?? colors.foreground;
    final resolvedForeground = activeForeground ?? colors.primaryForeground;
    final resolvedBorder = activeBorder ?? colors.foreground;
    return Material(
      color: active ? resolvedBackground : colors.card,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: active ? resolvedBorder : colors.border,
            ),
          ),
          child: Text(
            label,
            style: AppTextStyles.meta.copyWith(
              color: active ? resolvedForeground : colors.inkSoft,
              fontSize: 14,
            ),
          ),
        ),
      ),
    );
  }
}

import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

const _popularCities = ['Москва', 'СПб', 'Казань', 'Сочи', 'Алматы', 'Тбилиси'];

String _citySearchToken(String value) {
  return value.trim().toLowerCase().replaceAll('ё', 'е');
}

List<String> _cityMatchesFor(String query) {
  final token = _citySearchToken(query);
  if (token.length < 2) {
    return const [];
  }
  return _popularCities
      .where((city) => _citySearchToken(city).contains(token))
      .toList(growable: false);
}

bool _isExactPopularCity(String query) {
  final token = _citySearchToken(query);
  return _popularCities.any((city) => _citySearchToken(city) == token);
}

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final TextEditingController _cityController = TextEditingController();
  final TextEditingController _birthdayController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();

  int _index = 0;
  bool _hydrated = false;
  bool _saving = false;
  bool _searchingCity = false;
  String? _error;
  String? _selectedCity;
  String? _selectedArea;
  String? _selectedLocationInput;
  Timer? _citySearchDebounce;
  List<BackendCardItem> _citySuggestions = const [];
  final Set<String> _goals = {};
  final Set<String> _interests = {};
  String? _gender;
  String? _vibe;
  DateTime? _birthday;
  bool _uploadingPhoto = false;
  final ImagePicker _imagePicker = ImagePicker();
  final List<_OnboardingPhoto> _photos = [];

  List<_OnboardingStep> get _steps => [
        _OnboardingStep(
          key: 'goal',
          title: 'Зачем ты в Frendly?',
          subtitle: 'Можно выбрать несколько',
          child: _GoalsStep(
            selected: _goals,
            onToggle: _toggleGoal,
          ),
        ),
        _OnboardingStep(
          key: 'gender',
          title: 'Твой пол',
          child: _GenderStep(
            selected: _gender,
            onChanged: (value) => setState(() => _gender = value),
          ),
        ),
        _OnboardingStep(
          key: 'city',
          title: 'Где ты сейчас?',
          subtitle: 'Город или район',
          child: _CityStep(
            controller: _cityController,
            suggestions: _citySuggestions,
            searching: _searchingCity,
            onChanged: _handleCityChanged,
            onSelectCity: _applyCityValue,
            onSelect: _applyCitySuggestion,
          ),
        ),
        _OnboardingStep(
          key: 'interests',
          title: 'Что тебе по кайфу?',
          subtitle: 'Выбери 3 и больше',
          child: _InterestsStep(
            selected: _interests,
            onToggle: _toggleInterest,
          ),
        ),
        _OnboardingStep(
          key: 'vibe',
          title: 'Какой твой вайб?',
          child: _VibeStep(
            selected: _vibe,
            onChanged: (value) => setState(() => _vibe = value),
          ),
        ),
        _OnboardingStep(
          key: 'bday',
          title: 'Твой день рождения',
          subtitle: 'Покажем только возраст',
          child: _BirthdayStep(
            controller: _birthdayController,
            birthday: _birthday,
            onPick: _pickBirthday,
          ),
        ),
        _OnboardingStep(
          key: 'photos',
          title: 'Добавь фото',
          subtitle: 'Минимум 1, можно до 6. Первое — главное',
          child: _PhotosStep(
            photos: _photos,
            uploading: _uploadingPhoto,
            onAdd: _addPhotos,
            onRemove: _removePhoto,
            onMakePrimary: _makePrimaryPhoto,
          ),
        ),
        _OnboardingStep(
          key: 'contact',
          title: 'Контакты',
          subtitle: 'Email и телефон — для входа и безопасности',
          child: _ContactStep(
            emailController: _emailController,
            phoneController: _phoneController,
          ),
        ),
        const _OnboardingStep(
          key: 'perms',
          title: 'Разрешения',
          subtitle: 'Нужны для рекомендаций рядом',
          child: _PermissionsStep(),
        ),
      ];

  @override
  void dispose() {
    _citySearchDebounce?.cancel();
    _cityController.dispose();
    _birthdayController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final onboarding = ref.watch(onboardingProvider);
    final existing = onboarding.valueOrNull;
    if (!_hydrated && existing != null) {
      _hydrate(existing);
    }
    final step = _steps[_index];
    final progress = (_index + 1) / _steps.length;
    final isLast = _index == _steps.length - 1;

    return DateasyPhoneFrame(
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 32),
          child: Column(
            children: [
              _OnboardingTopBar(
                progress: progress,
                current: _index + 1,
                total: _steps.length,
                onBack: _handleBack,
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.only(top: 40, bottom: 24),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 160),
                    child: Column(
                      key: ValueKey('${step.key}-${_error ?? ''}'),
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (onboarding.isLoading && existing == null) ...[
                          const _InlineLoadingState(),
                          const SizedBox(height: 20),
                        ],
                        _OnboardingStepBody(step: step),
                        if (_error != null) ...[
                          const SizedBox(height: 16),
                          _InlineError(text: _error!),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
              _PrimaryButton(
                label: _saving
                    ? 'Сохраняем...'
                    : (isLast ? 'В Frendly' : 'Дальше'),
                onTap: _handleNext,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _hydrate(OnboardingData onboarding) {
    _hydrated = true;
    _goals
      ..clear()
      ..addAll(_splitIntent(onboarding.intent));
    _interests
      ..clear()
      ..addAll(onboarding.interests);
    _gender = onboarding.gender;
    _vibe = onboarding.vibe;
    _cityController.text = onboarding.city ?? '';
    _selectedCity = onboarding.city;
    _selectedArea = onboarding.area;
    _selectedLocationInput = onboarding.city;
    _emailController.text = onboarding.email ?? '';
    _phoneController.text = onboarding.phoneNumber ?? '';
    _birthday = _parseDate(onboarding.birthDate);
    _birthdayController.text = onboarding.birthDate ?? '';
  }

  Future<void> _handleNext() async {
    if (_saving) {
      return;
    }
    final isLast = _index == _steps.length - 1;
    if (!isLast) {
      if (_steps[_index].key == 'city') {
        await _resolveTypedCityBeforeContinue();
        if (!mounted) {
          return;
        }
      }
      setState(() {
        _error = null;
        _index += 1;
      });
      return;
    }
    await _submit();
  }

  Future<void> _submit() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final email = _emptyToNull(_emailController.text.trim());
      final phoneNumber = _emptyToNull(_phoneController.text.trim());
      if (email != null || phoneNumber != null) {
        await ref.read(onboardingFlowControllerProvider).checkContact(
              email: email,
              phoneNumber: phoneNumber,
            );
      }
      await ref.read(onboardingFlowControllerProvider).save(
            OnboardingData(
              intent: _goals.isEmpty ? null : _goals.join(', '),
              gender: _gender,
              birthDate: _emptyToNull(_birthdayController.text.trim()),
              city: _emptyToNull(_selectedCity ?? _cityController.text.trim()),
              area: _emptyToNull(_selectedArea ?? ''),
              interests: _interests.toList(growable: false),
              vibe: _vibe,
              email: email,
              phoneNumber: phoneNumber,
            ),
          );
      if (mounted) {
        context.go('/');
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Не получилось сохранить onboarding';
        });
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  void _handleBack() {
    if (_index > 0) {
      setState(() => _index -= 1);
      return;
    }

    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/welcome');
    }
  }

  void _toggleGoal(String goal) {
    setState(() {
      if (_goals.contains(goal)) {
        _goals.remove(goal);
      } else {
        _goals.add(goal);
      }
    });
  }

  void _toggleInterest(String interest) {
    setState(() {
      if (_interests.contains(interest)) {
        _interests.remove(interest);
      } else {
        _interests.add(interest);
      }
    });
  }

  void _handleCityChanged(String value) {
    final query = value.trim();
    _citySearchDebounce?.cancel();
    setState(() {
      _selectedCity = null;
      _selectedArea = null;
      _selectedLocationInput = null;
      if (_isExactPopularCity(query)) {
        _searchingCity = false;
        _citySuggestions = const [];
      }
    });
    if (_isExactPopularCity(query)) {
      return;
    }
    _queueCitySearch(query);
  }

  void _queueCitySearch(String query) {
    _citySearchDebounce?.cancel();
    if (query.length < 2) {
      setState(() {
        _searchingCity = false;
        _citySuggestions = const [];
      });
      return;
    }

    setState(() {
      _searchingCity = true;
    });

    late final Timer timer;
    timer = Timer(const Duration(milliseconds: 300), () async {
      if (!mounted || !identical(_citySearchDebounce, timer)) {
        return;
      }
      try {
        final page = await ref.read(backendRepositoryProvider).searchPlaces(
              query: query,
              limit: 8,
            );
        if (!mounted ||
            !identical(_citySearchDebounce, timer) ||
            _cityController.text.trim() != query) {
          return;
        }
        setState(() {
          _searchingCity = false;
          _citySuggestions = page.items;
        });
      } catch (_) {
        if (!mounted ||
            !identical(_citySearchDebounce, timer) ||
            _cityController.text.trim() != query) {
          return;
        }
        setState(() {
          _searchingCity = false;
          _citySuggestions = const [];
        });
      }
    });
    _citySearchDebounce = timer;
  }

  Future<void> _resolveTypedCityBeforeContinue() async {
    final query = _cityController.text.trim();
    if (query.isEmpty || _selectedLocationInput == query) {
      return;
    }
    if (_isExactPopularCity(query)) {
      _applyCityValue(query);
      return;
    }

    try {
      final page = await ref.read(backendRepositoryProvider).searchPlaces(
            query: query,
            limit: 1,
          );
      if (!mounted || _cityController.text.trim() != query) {
        return;
      }
      final first = page.items.isEmpty ? null : page.items.first;
      if (first != null) {
        setState(() {
          _applyCitySuggestionValue(first);
        });
      } else {
        setState(() {
          _selectedCity = query;
          _selectedArea = null;
          _selectedLocationInput = query;
        });
      }
    } catch (_) {
      if (!mounted || _cityController.text.trim() != query) {
        return;
      }
      setState(() {
        _selectedCity = query;
        _selectedArea = null;
        _selectedLocationInput = query;
      });
    }
  }

  void _applyCitySuggestion(BackendCardItem item) {
    setState(() {
      _applyCitySuggestionValue(item);
    });
  }

  void _applyCityValue(String city) {
    setState(() {
      _cityController.text = city;
      _selectedCity = city;
      _selectedArea = null;
      _selectedLocationInput = city;
      _citySuggestions = const [];
      _searchingCity = false;
      _citySearchDebounce?.cancel();
    });
  }

  void _applyCitySuggestionValue(BackendCardItem item) {
    final input = item.title.trim().isNotEmpty
        ? item.title.trim()
        : item.subtitle?.trim() ?? item.city?.trim() ?? '';
    final city = item.city?.trim();

    _cityController.text = input;
    _selectedCity = city != null && city.isNotEmpty ? city : input;
    _selectedArea = item.subtitle?.trim();
    _selectedLocationInput = input;
    _citySuggestions = const [];
    _searchingCity = false;
  }

  Future<void> _pickBirthday() async {
    final today = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate:
          _birthday ?? DateTime(today.year - 24, today.month, today.day),
      firstDate: DateTime(1940),
      lastDate: today,
      builder: (context, child) {
        return Theme(
          data: DateasyTheme.theme.copyWith(
            datePickerTheme: const DatePickerThemeData(
              backgroundColor: DateasyColors.surface,
              headerBackgroundColor: DateasyColors.surface2,
              headerForegroundColor: DateasyColors.foreground,
            ),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );

    if (picked == null || !mounted) {
      return;
    }

    setState(() {
      _birthday = picked;
      _birthdayController.text =
          '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    });
  }

  Future<void> _addPhotos() async {
    if (_uploadingPhoto || _photos.length >= 6) {
      return;
    }
    setState(() {
      _uploadingPhoto = true;
      _error = null;
    });
    try {
      final picked = await _imagePicker.pickMultiImage(
        maxWidth: 1600,
        maxHeight: 1600,
      );
      if (!mounted || picked.isEmpty) {
        return;
      }
      final remaining = 6 - _photos.length;
      for (final file in picked.take(remaining)) {
        final uploaded =
            await ref.read(profileActionsProvider).uploadProfilePhoto(
                  filePath: file.path,
                  fileName: file.name,
                  mimeType: _mimeTypeForPickedFile(file),
                );
        if (!mounted) {
          return;
        }
        final photo = uploaded['photo'];
        final id = photo is Map
            ? photo['id']?.toString()
            : uploaded['photoId']?.toString();
        final url = photo is Map
            ? (photo['url'] ?? (photo['media'] as Map?)?['url'])?.toString()
            : uploaded['url']?.toString();
        setState(() {
          _photos.add(
            _OnboardingPhoto(
              id: id ?? uploaded['assetId']?.toString() ?? file.path,
              url: url,
              localPath: file.path,
            ),
          );
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Не получилось загрузить фото';
        });
      }
    } finally {
      if (mounted) {
        setState(() => _uploadingPhoto = false);
      }
    }
  }

  Future<void> _removePhoto(_OnboardingPhoto photo) async {
    setState(() {
      _photos.removeWhere((item) => item.id == photo.id);
    });
    unawaited(ref.read(profileActionsProvider).deleteProfilePhoto(photo.id));
  }

  Future<void> _makePrimaryPhoto(_OnboardingPhoto photo) async {
    if (_photos.isEmpty || _photos.first.id == photo.id) {
      return;
    }
    setState(() {
      _photos.removeWhere((item) => item.id == photo.id);
      _photos.insert(0, photo);
    });
    unawaited(
        ref.read(profileActionsProvider).makePrimaryProfilePhoto(photo.id));
  }
}

class _OnboardingStep {
  const _OnboardingStep({
    required this.key,
    required this.title,
    required this.child,
    this.subtitle,
  });

  final String key;
  final String title;
  final String? subtitle;
  final Widget child;
}

class _OnboardingStepBody extends StatelessWidget {
  _OnboardingStepBody({required this.step}) : super(key: ValueKey(step.key));

  final _OnboardingStep step;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: ValueKey(step.key),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          step.title,
          style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                fontSize: 30,
                height: 1.15,
                fontWeight: FontWeight.w600,
                letterSpacing: 0,
              ),
        ),
        if (step.subtitle != null) ...[
          const SizedBox(height: 8),
          Text(
            step.subtitle!,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: DateasyColors.muted,
                ),
          ),
        ],
        const SizedBox(height: 32),
        step.child,
      ],
    );
  }
}

class _InlineLoadingState extends StatelessWidget {
  const _InlineLoadingState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: SizedBox(
        width: 24,
        height: 24,
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
    );
  }
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return _GlassBox(
      borderRadius: 14,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: DateasyColors.pink,
              ),
        ),
      ),
    );
  }
}

class _OnboardingTopBar extends StatelessWidget {
  const _OnboardingTopBar({
    required this.progress,
    required this.current,
    required this.total,
    required this.onBack,
  });

  final double progress;
  final int current;
  final int total;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _BackButton(onTap: onBack),
        const SizedBox(width: 12),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: SizedBox(
              height: 6,
              child: Stack(
                children: [
                  const Positioned.fill(
                    child: ColoredBox(color: Color(0x1AFFFFFF)),
                  ),
                  FractionallySizedBox(
                    widthFactor: progress,
                    child: const DecoratedBox(
                      decoration: BoxDecoration(gradient: dateasyLimeGradient),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Text(
          '$current/$total',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: DateasyColors.muted,
              ),
        ),
      ],
    );
  }
}

class _GoalsStep extends StatelessWidget {
  const _GoalsStep({
    required this.selected,
    required this.onToggle,
  });

  final Set<String> selected;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    const goals = [
      'Знакомиться',
      'Ходить на встречи',
      'Найти отношения',
      'Создавать движ',
      'Спорт',
      'Камерные вечера',
    ];

    return Column(
      children: [
        for (final goal in goals) ...[
          _ChoiceTile(
            label: goal,
            active: selected.contains(goal),
            onTap: () => onToggle(goal),
          ),
          if (goal != goals.last) const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _GenderStep extends StatelessWidget {
  const _GenderStep({
    required this.selected,
    required this.onChanged,
  });

  final String? selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _LargeChoiceButton(
            label: 'Мужской',
            active: selected == 'male',
            onTap: () => onChanged('male'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _LargeChoiceButton(
            label: 'Женский',
            active: selected == 'female',
            onTap: () => onChanged('female'),
          ),
        ),
      ],
    );
  }
}

class _CityStep extends StatelessWidget {
  const _CityStep({
    required this.controller,
    required this.suggestions,
    required this.searching,
    required this.onChanged,
    required this.onSelectCity,
    required this.onSelect,
  });

  final TextEditingController controller;
  final List<BackendCardItem> suggestions;
  final bool searching;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSelectCity;
  final ValueChanged<BackendCardItem> onSelect;

  @override
  Widget build(BuildContext context) {
    final cityMatches = _cityMatchesFor(controller.text);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _GlassInputShell(
          child: Row(
            children: [
              const Icon(
                Icons.location_on_rounded,
                color: DateasyColors.lime,
                size: 20,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: controller,
                  onChanged: onChanged,
                  style: const TextStyle(
                    color: DateasyColors.foreground,
                    fontSize: 18,
                    height: 1.2,
                  ),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (searching || cityMatches.isNotEmpty || suggestions.isNotEmpty) ...[
          const SizedBox(height: 12),
          _GlassBox(
            borderRadius: 18,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: searching && suggestions.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            'Ищем место',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: DateasyColors.muted,
                                    ),
                          ),
                        ],
                      ),
                    )
                  : Column(
                      children: [
                        for (final city in cityMatches)
                          _CityOptionTile(
                            city: city,
                            onTap: () => onSelectCity(city),
                          ),
                        for (final item in suggestions)
                          _CitySuggestionTile(
                            item: item,
                            onTap: () => onSelect(item),
                          ),
                      ],
                    ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final city in _popularCities)
              _ChipButton(
                label: city,
                active: controller.text == city,
                onTap: () {
                  onSelectCity(city);
                },
              ),
          ],
        ),
      ],
    );
  }
}

class _CityOptionTile extends StatelessWidget {
  const _CityOptionTile({
    required this.city,
    required this.onTap,
  });

  final String city;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          children: [
            const Icon(
              Icons.location_city_rounded,
              color: DateasyColors.lime,
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    city,
                    style: const TextStyle(
                      color: DateasyColors.foreground,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Выбрать город',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CitySuggestionTile extends StatelessWidget {
  const _CitySuggestionTile({
    required this.item,
    required this.onTap,
  });

  final BackendCardItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final subtitle = [
      item.subtitle,
      item.city,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(' · ');

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          children: [
            const Icon(
              Icons.place_rounded,
              color: DateasyColors.lime,
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    style: const TextStyle(
                      color: DateasyColors.foreground,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (subtitle.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.muted,
                          ),
                    ),
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

class _InterestsStep extends StatelessWidget {
  const _InterestsStep({
    required this.selected,
    required this.onToggle,
  });

  final Set<String> selected;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    const interests = [
      '🎵 Музыка',
      '☕ Кофе',
      '🍷 Вино',
      '🏃 Спорт',
      '🎨 Арт',
      '🎬 Кино',
      '📚 Книги',
      '🍣 Еда',
      '🌃 Тусовки',
      '🧘 Йога',
      '🎮 Игры',
      '✈️ Путешествия',
      '🎤 Караоке',
      '🎲 Настолки',
    ];

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final interest in interests)
          _ChipButton(
            label: interest,
            active: selected.contains(interest),
            onTap: () => onToggle(interest),
          ),
      ],
    );
  }
}

class _VibeStep extends StatelessWidget {
  const _VibeStep({
    required this.selected,
    required this.onChanged,
  });

  final String? selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    const vibes = [
      ('Чилл', '🌿'),
      ('Движ', '🔥'),
      ('Романтик', '💌'),
      ('Авантюрист', '🚀'),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.22,
      children: [
        for (final vibe in vibes)
          _VibeCard(
            label: vibe.$1,
            emoji: vibe.$2,
            active: selected == vibe.$1,
            onTap: () => onChanged(vibe.$1),
          ),
      ],
    );
  }
}

class _BirthdayStep extends StatelessWidget {
  const _BirthdayStep({
    required this.controller,
    required this.birthday,
    required this.onPick,
  });

  final TextEditingController controller;
  final DateTime? birthday;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: onPick,
          child: AbsorbPointer(
            child: _GlassInputShell(
              child: Row(
                children: [
                  const Icon(
                    Icons.cake_rounded,
                    color: DateasyColors.lime,
                    size: 20,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: controller,
                      style: const TextStyle(
                        color: DateasyColors.foreground,
                        fontSize: 18,
                        height: 1.2,
                      ),
                      decoration: InputDecoration(
                        border: InputBorder.none,
                        isDense: true,
                        hintText: 'ГГГГ-ММ-ДД',
                        hintStyle: TextStyle(
                          color: DateasyColors.muted.withValues(alpha: 0.72),
                        ),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (birthday != null) ...[
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text.rich(
              TextSpan(
                children: [
                  const TextSpan(text: 'Возраст: '),
                  TextSpan(
                    text: '${_ageFor(birthday!)}',
                    style: const TextStyle(
                      color: DateasyColors.foreground,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const TextSpan(text: ' лет, видно другим'),
                ],
              ),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                  ),
            ),
          ),
        ],
      ],
    );
  }

  int _ageFor(DateTime date) {
    final now = DateTime.now();
    var age = now.year - date.year;
    if (now.month < date.month ||
        (now.month == date.month && now.day < date.day)) {
      age -= 1;
    }
    return age < 0 ? 0 : age;
  }
}

class _PhotosStep extends StatelessWidget {
  const _PhotosStep({
    required this.photos,
    required this.uploading,
    required this.onAdd,
    required this.onRemove,
    required this.onMakePrimary,
  });

  final List<_OnboardingPhoto> photos;
  final bool uploading;
  final VoidCallback onAdd;
  final ValueChanged<_OnboardingPhoto> onRemove;
  final ValueChanged<_OnboardingPhoto> onMakePrimary;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GridView.builder(
          padding: EdgeInsets.zero,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 6,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
          ),
          itemBuilder: (context, index) {
            final photo = index < photos.length ? photos[index] : null;
            if (photo == null) {
              return _AddPhotoSlot(
                first: photos.isEmpty && index == 0,
                loading: uploading && index == photos.length,
                enabled: photos.length < 6 && !uploading,
                onTap: onAdd,
              );
            }
            return _PhotoSlot(
              photo: photo,
              primary: index == 0,
              onTap: () => onMakePrimary(photo),
              onRemove: () => onRemove(photo),
            );
          },
        ),
        const SizedBox(height: 12),
        Text(
          'Лица без масок и фильтров проходят верификацию быстрее.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: DateasyColors.muted,
                fontSize: 11,
              ),
        ),
      ],
    );
  }
}

class _PhotoSlot extends StatelessWidget {
  const _PhotoSlot({
    required this.photo,
    required this.primary,
    required this.onTap,
    required this.onRemove,
  });

  final _OnboardingPhoto photo;
  final bool primary;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Stack(
          fit: StackFit.expand,
          children: [
            File(photo.localPath).existsSync()
                ? Image.file(File(photo.localPath), fit: BoxFit.cover)
                : DateasyRemoteImage(
                    imageUrl: photo.url,
                    usage: DateasyImageUsage.card,
                  ),
            DecoratedBox(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                borderRadius: BorderRadius.circular(18),
              ),
            ),
            if (primary)
              Positioned(
                left: 6,
                top: 6,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    gradient: dateasyLimeGradient,
                  ),
                  child: Text(
                    'Главное',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.backgroundDeep,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
              ),
            Positioned(
              right: 6,
              top: 6,
              child: GestureDetector(
                onTap: onRemove,
                child: Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: DateasyColors.background.withValues(alpha: 0.86),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.close_rounded, size: 16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddPhotoSlot extends StatelessWidget {
  const _AddPhotoSlot({
    required this.first,
    required this.loading,
    required this.enabled,
    required this.onTap,
  });

  final bool first;
  final bool loading;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          color: DateasyColors.glass,
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.16),
            style: BorderStyle.solid,
          ),
        ),
        child: Center(
          child: loading
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Icon(
                  first ? Icons.photo_camera_outlined : Icons.add_rounded,
                  size: first ? 26 : 24,
                  color: DateasyColors.muted,
                ),
        ),
      ),
    );
  }
}

class _ContactStep extends StatelessWidget {
  const _ContactStep({
    required this.emailController,
    required this.phoneController,
  });

  final TextEditingController emailController;
  final TextEditingController phoneController;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _GlassInputShell(
          child: Row(
            children: [
              const Icon(Icons.mail_rounded,
                  color: DateasyColors.lime, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: emailController,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  style: const TextStyle(
                    color: DateasyColors.foreground,
                    fontSize: 18,
                    height: 1.2,
                  ),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    hintText: 'you@frendly.app',
                    hintStyle: TextStyle(
                      color: DateasyColors.muted.withValues(alpha: 0.72),
                    ),
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _GlassInputShell(
          child: Row(
            children: [
              const Icon(Icons.phone_rounded,
                  color: DateasyColors.lime, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: phoneController,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s]')),
                  ],
                  style: const TextStyle(
                    color: DateasyColors.foreground,
                    fontSize: 18,
                    height: 1.2,
                  ),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                    hintText: '+7 999 000 00 00',
                    hintStyle: TextStyle(
                      color: DateasyColors.muted.withValues(alpha: 0.72),
                    ),
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Text(
            'Не показываем в профиле. Используем только для входа, восстановления и SOS.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 11,
                ),
          ),
        ),
      ],
    );
  }
}

class _PermissionsStep extends StatelessWidget {
  const _PermissionsStep();

  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.location_on_rounded, 'Геолокация', 'Встречи и события рядом'),
      (Icons.notifications_rounded, 'Уведомления', 'Приглашения, лайки, чаты'),
      (Icons.groups_rounded, 'Контакты', 'Найти друзей в Frendly'),
    ];

    return Column(
      children: [
        for (final item in items) ...[
          _PermissionTile(icon: item.$1, title: item.$2, subtitle: item.$3),
          if (item != items.last) const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _PermissionTile extends StatelessWidget {
  const _PermissionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return _GlassBox(
      borderRadius: 16,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: Icon(icon, color: DateasyColors.lime, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: DateasyColors.foreground,
                      fontSize: 16,
                      height: 1.2,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DateasyColors.muted,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _SmallGlassButton(label: 'Разрешить', onTap: () {}),
          ],
        ),
      ),
    );
  }
}

class _ChoiceTile extends StatelessWidget {
  const _ChoiceTile({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _PressableSurface(
      active: active,
      borderRadius: 16,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Text(
            label,
            style: TextStyle(
              color: active
                  ? DateasyColors.backgroundDeep
                  : DateasyColors.foreground,
              fontSize: 16,
              height: 1.2,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

class _LargeChoiceButton extends StatelessWidget {
  const _LargeChoiceButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _PressableSurface(
      active: active,
      borderRadius: 16,
      onTap: onTap,
      child: SizedBox(
        height: 84,
        child: Center(
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: active
                  ? DateasyColors.backgroundDeep
                  : DateasyColors.foreground,
              fontSize: 18,
              height: 1.2,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _VibeCard extends StatelessWidget {
  const _VibeCard({
    required this.label,
    required this.emoji,
    required this.active,
    required this.onTap,
  });

  final String label;
  final String emoji;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _PressableSurface(
      active: active,
      borderRadius: 24,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 30, height: 1)),
            const SizedBox(height: 12),
            Text(
              label,
              style: TextStyle(
                color: active
                    ? DateasyColors.backgroundDeep
                    : DateasyColors.foreground,
                fontSize: 16,
                height: 1.2,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChipButton extends StatelessWidget {
  const _ChipButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(99),
        child: Ink(
          decoration: BoxDecoration(
            gradient: active ? dateasyLimeGradient : null,
            color: active ? null : DateasyColors.glass,
            borderRadius: BorderRadius.circular(99),
            border: active
                ? null
                : Border.all(color: Colors.white.withValues(alpha: 0.1)),
            boxShadow: active ? _activeShadow : null,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Text(
            label,
            style: TextStyle(
              color: active
                  ? DateasyColors.backgroundDeep
                  : DateasyColors.foreground,
              fontSize: 14,
              height: 1.2,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          width: double.infinity,
          height: 56,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: dateasyLimeGradient,
            boxShadow: _activeShadow,
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
    );
  }
}

class _SmallGlassButton extends StatelessWidget {
  const _SmallGlassButton({
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(99),
        child: Ink(
          decoration: BoxDecoration(
            color: DateasyColors.glass,
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Text(
            label,
            style: const TextStyle(
              color: DateasyColors.foreground,
              fontSize: 14,
              height: 1.2,
            ),
          ),
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
            size: 24,
            color: DateasyColors.foreground,
          ),
        ),
      ),
    );
  }
}

class _PressableSurface extends StatelessWidget {
  const _PressableSurface({
    required this.active,
    required this.borderRadius,
    required this.onTap,
    required this.child,
  });

  final bool active;
  final double borderRadius;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(borderRadius),
        child: Ink(
          decoration: BoxDecoration(
            gradient: active ? dateasyLimeGradient : null,
            color: active ? null : DateasyColors.glass,
            borderRadius: BorderRadius.circular(borderRadius),
            border: active
                ? null
                : Border.all(color: Colors.white.withValues(alpha: 0.1)),
            boxShadow: active ? _activeShadow : null,
          ),
          child: child,
        ),
      ),
    );
  }
}

class _GlassInputShell extends StatelessWidget {
  const _GlassInputShell({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return _GlassBox(
      borderRadius: 16,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: child,
      ),
    );
  }
}

class _GlassBox extends StatelessWidget {
  const _GlassBox({
    required this.borderRadius,
    required this.child,
  });

  final double borderRadius;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: child,
    );
  }
}

Set<String> _splitIntent(String? intent) {
  if (intent == null || intent.trim().isEmpty) {
    return <String>{};
  }
  return intent
      .split(',')
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toSet();
}

DateTime? _parseDate(String? value) {
  if (value == null || value.isEmpty) {
    return null;
  }
  return DateTime.tryParse(value);
}

String? _emptyToNull(String value) {
  return value.isEmpty ? null : value;
}

String _mimeTypeForPickedFile(XFile file) {
  final explicit = file.mimeType;
  if (explicit != null && explicit.isNotEmpty) {
    return explicit;
  }
  final name = file.name.toLowerCase();
  if (name.endsWith('.png')) {
    return 'image/png';
  }
  if (name.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

class _OnboardingPhoto {
  const _OnboardingPhoto({
    required this.id,
    required this.localPath,
    this.url,
  });

  final String id;
  final String localPath;
  final String? url;
}

const _activeShadow = [
  BoxShadow(
    color: Color(0x59BEFF67),
    blurRadius: 60,
    spreadRadius: -20,
    offset: Offset(0, 20),
  ),
];

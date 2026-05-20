import 'dart:async';

import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:drift/native.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/app/core/local_cache/app_local_database.dart';
import 'package:mobile2/app/core/local_cache/chat_local_store.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/app/dateasy_app.dart';
import 'package:mobile2/features/ai_builder/presentation/ai_builder_screen.dart';
import 'package:mobile2/features/chats/presentation/meeting_chat_screen.dart';
import 'package:mobile2/features/city/presentation/city_screen.dart';
import 'package:mobile2/features/dating/presentation/dating_filter_screen.dart';
import 'package:mobile2/features/host/presentation/host_dashboard_screen.dart';
import 'package:mobile2/features/map/presentation/map_screen.dart';
import 'package:mobile2/features/meetings/presentation/meeting_detail_screen.dart';
import 'package:mobile2/features/meetings/presentation/meetings_screen.dart';
import 'package:mobile2/features/meetings/presentation/new_meeting_screen.dart';
import 'package:mobile2/features/paywall/presentation/paywall_screen.dart';
import 'package:mobile2/features/profile/presentation/profile_edit_screen.dart';
import 'package:mobile2/features/profile/presentation/profile_gallery_screen.dart';
import 'package:mobile2/features/profile/presentation/profile_history_screen.dart';
import 'package:mobile2/features/profile/presentation/profile_screen.dart';
import 'package:mobile2/features/profile/presentation/public_user_screen.dart';
import 'package:mobile2/features/settings/presentation/settings_screen.dart';
import 'package:mobile2/features/share/presentation/share_screen.dart';
import 'package:mobile2/features/sos/presentation/sos_screen.dart';
import 'package:mobile2/features/splash/presentation/splash_screen.dart';
import 'package:mobile2/features/stories/presentation/stories_screen.dart';
import 'package:mobile2/features/verify/presentation/verify_screen.dart';
import 'package:mobile2/features/wallet/presentation/wallet_screen.dart';
import 'package:mobile2/features/onboarding/presentation/onboarding_screen.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/data/backend_repository.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_top_bar.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';
import 'package:url_launcher/url_launcher.dart';

void main() {
  testWidgets('mobile2 opens welcome and opens phone auth', (tester) async {
    await _pumpDateasyAppWelcome(tester);

    expect(find.textContaining('Реальные'), findsOneWidget);
    expect(find.textContaining('встречи'), findsOneWidget);

    expect(find.text('Войти по номеру телефона'), findsOneWidget);
    expect(find.text('Через Telegram'), findsOneWidget);
    expect(find.text('Яндекс'), findsOneWidget);

    await tester.tap(find.text('Войти по номеру телефона'));
    await tester.pumpAndSettle();

    expect(find.text('Введи номер телефона'), findsOneWidget);
    expect(find.text('Получить код'), findsOneWidget);

    await tester.tap(find.text('Получить код'));
    await tester.pumpAndSettle();

    expect(find.text('Код из SMS'), findsNothing);

    await tester.enterText(find.byType(EditableText).first, '9991234567');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Получить код'));
    await tester.pumpAndSettle();

    expect(find.text('Код из SMS'), findsOneWidget);
    expect(find.text('Отправить код снова'), findsOneWidget);

    final inputs = find.byType(EditableText);
    await tester.enterText(inputs.at(0), '1');
    await tester.enterText(inputs.at(1), '2');
    await tester.enterText(inputs.at(2), '3');
    await tester.enterText(inputs.at(3), '4');
    await tester.pump(const Duration(milliseconds: 650));
    await tester.pumpAndSettle();

    expect(find.text('Зачем ты в Frendly?'), findsOneWidget);
  });

  testWidgets('mobile2 opens telegram auth and confirms code', (tester) async {
    await _pumpDateasyAppWelcome(tester);

    await tester.tap(find.text('Через Telegram'));
    await tester.pumpAndSettle();

    expect(find.text('Вход через Telegram'), findsOneWidget);
    expect(find.textContaining('@frendly_code_bot'), findsOneWidget);
    expect(find.text('Подтвердить'), findsNothing);

    await tester.tap(find.text('Открыть Telegram'));
    await tester.pumpAndSettle();

    expect(find.text('Введи 4-значный код из бота'), findsOneWidget);
    expect(find.text('Подтвердить'), findsOneWidget);

    await tester.ensureVisible(find.text('Подтвердить'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Подтвердить'));
    await tester.pumpAndSettle();

    expect(find.text('Зачем ты в Frendly?'), findsNothing);

    await tester.enterText(find.byType(EditableText).last, '1234');
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Подтвердить'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Подтвердить'));
    await tester.pumpAndSettle();

    expect(find.text('Зачем ты в Frendly?'), findsOneWidget);
  });

  testWidgets('mobile2 onboarding walks through Dateasy steps', (tester) async {
    await _pumpDateasyAppWelcome(tester);

    await tester.tap(find.text('Войти по номеру телефона'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(EditableText).first, '9991234567');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Получить код'));
    await tester.pumpAndSettle();

    final inputs = find.byType(EditableText);
    await tester.enterText(inputs.at(0), '1');
    await tester.enterText(inputs.at(1), '2');
    await tester.enterText(inputs.at(2), '3');
    await tester.enterText(inputs.at(3), '4');
    await tester.pump(const Duration(milliseconds: 650));
    await tester.pumpAndSettle();

    expect(find.text('Зачем ты в Frendly?'), findsOneWidget);
    expect(find.text('1/9'), findsOneWidget);

    const expectedSteps = [
      'Твой пол',
      'Где ты сейчас?',
      'Что тебе по кайфу?',
      'Какой твой вайб?',
      'Твой день рождения',
      'Добавь фото',
      'Контакты',
      'Разрешения',
    ];

    for (final title in expectedSteps) {
      await tester.tap(find.text('Дальше'));
      await tester.pumpAndSettle();
      expect(find.text(title), findsOneWidget);
    }

    expect(find.text('В Frendly'), findsOneWidget);
    await tester.tap(find.text('В Frendly'));
    await tester.pumpAndSettle();

    expect(find.text('Привет, Алекс 👋'), findsOneWidget);
    await tester.drag(find.text('Привет, Алекс 👋'), const Offset(0, -500));
    await tester.pumpAndSettle();
    expect(find.text('Ближайшие встречи'), findsOneWidget);
    await tester.drag(find.text('Ближайшие встречи'), const Offset(0, -900));
    await tester.pumpAndSettle();
    expect(find.text('AI DATE BUILDER'), findsOneWidget);

    await tester.tap(find.byIcon(LucideIcons.calendarHeart));
    await tester.pumpAndSettle();

    expect(find.text('32 встречи рядом'), findsOneWidget);
    expect(find.text('Список '), findsNothing);
    expect(find.text('AI подберёт встречу под вечер'), findsOneWidget);
    expect(find.text('Speciality coffee tasting'), findsOneWidget);

    await tester.ensureVisible(find.text('Иду').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Иду').first);
    await tester.pumpAndSettle();
    expect(find.text('✓ Иду'), findsOneWidget);
  });

  testWidgets('mobile2 onboarding searches place and saves its city',
      (tester) async {
    final repository = _RecordingOnboardingRepository();

    await tester.pumpWidget(_onboardingHarness(repository));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Дальше'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Дальше'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(EditableText).first, 'Покровка');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(repository.placeQueries, contains('Покровка'));
    expect(find.text('Кофейня на Покровке'), findsOneWidget);

    await tester.tap(find.text('Кофейня на Покровке'));
    await tester.pumpAndSettle();

    for (var index = 0; index < 6; index += 1) {
      await tester.tap(find.text('Дальше'));
      await tester.pumpAndSettle();
    }

    await tester.tap(find.text('В Frendly'));
    await tester.pumpAndSettle();

    expect(repository.saved?.city, 'Москва');
    expect(find.text('home-opened complete=true'), findsOneWidget);
  });

  testWidgets('mobile2 onboarding shows city option before venue results',
      (tester) async {
    final repository = _RecordingOnboardingRepository();

    await tester.pumpWidget(_onboardingHarness(repository));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Дальше'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Дальше'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(EditableText).first, 'Москва');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(repository.placeQueries, isNot(contains('Москва')));
    expect(find.text('Выбрать город'), findsOneWidget);
    expect(find.text('Кофейня на Покровке'), findsNothing);

    await tester.tap(find.text('Выбрать город'));
    await tester.pumpAndSettle();

    for (var index = 0; index < 6; index += 1) {
      await tester.tap(find.text('Дальше'));
      await tester.pumpAndSettle();
    }

    await tester.tap(find.text('В Frendly'));
    await tester.pumpAndSettle();

    expect(repository.saved?.city, 'Москва');
    expect(repository.saved?.area, isNull);
    expect(find.text('home-opened complete=true'), findsOneWidget);
  });

  testWidgets('mobile2 onboarding marks current user complete after save',
      (tester) async {
    final repository = _RecordingOnboardingRepository(
      fetchMeAfterSaveReturnsIncomplete: true,
    );

    await tester.pumpWidget(_onboardingHarness(repository));
    await tester.pumpAndSettle();

    for (var index = 0; index < 8; index += 1) {
      await tester.tap(find.text('Дальше'));
      await tester.pumpAndSettle();
    }

    await tester.tap(find.text('В Frendly'));
    await tester.pumpAndSettle();

    expect(repository.saved, isNotNull);
    expect(find.text('home-opened complete=true'), findsOneWidget);
  });

  testWidgets('mobile2 profile matches Dateasy profile blocks', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1500));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _backendTestApp(
        home: const ProfileScreen(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Профиль'), findsOneWidget);
    expect(find.text('Алекс, 27'), findsOneWidget);
    expect(find.text('Москва · Патрики'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(find.text('48'), findsOneWidget);
    expect(find.text('4.9'), findsOneWidget);
    expect(find.text('Frendly Plus'), findsOneWidget);
    expect(find.text('Пройти верификацию'), findsOneWidget);
    expect(find.text('+ галочка'), findsOneWidget);
    expect(find.text('Кошелёк токенов'), findsOneWidget);
    expect(find.text('Розыгрыши месяца'), findsOneWidget);
    expect(find.text('Билеты, история, победители'), findsOneWidget);
    expect(find.text('Интересы'), findsOneWidget);
    expect(find.text('Speciality coffee'), findsOneWidget);
    expect(find.text('Галерея'), findsOneWidget);
    expect(find.text('Мои встречи'), findsOneWidget);
    expect(find.text('Винил-вечер на крыше'), findsOneWidget);
  });

  testWidgets('mobile2 public profile uses backend social actions',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _PublicProfileRepository();
    final router = GoRouter(
      initialLocation: '/u/user-nina',
      routes: [
        GoRoute(
          path: '/u/:userId',
          builder: (_, state) => PublicUserScreen(
            userId: state.pathParameters['userId'] ?? 'user-nina',
          ),
        ),
        GoRoute(
          path: '/chats',
          builder: (_, __) => const Scaffold(body: Text('chats-opened')),
        ),
        GoRoute(
          path: '/ai-builder',
          builder: (_, __) => const Scaffold(body: Text('ai-opened')),
        ),
        GoRoute(
          path: '/dating',
          builder: (_, __) => const Scaffold(body: Text('dating-opened')),
        ),
        GoRoute(
          path: '/report',
          builder: (_, __) => const Scaffold(body: Text('report-opened')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(repository),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Нина'), findsOneWidget);
    expect(find.text('1.2 км · онлайн'), findsOneWidget);
    expect(find.text('Дизайнер из Москвы'), findsOneWidget);
    expect(find.text('32 подписчиков'), findsOneWidget);
    expect(find.text('Подписаться'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('4.9'),
      260,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    expect(find.text('4.9'), findsOneWidget);

    await tester.tap(find.text('Подписаться'));
    await tester.pumpAndSettle();
    expect(repository.followActions, ['user-nina:true']);
    expect(find.text('Вы подписаны'), findsOneWidget);
    expect(find.text('33 подписчиков'), findsOneWidget);
    expect(find.byIcon(LucideIcons.bellRing), findsOneWidget);

    await tester.tap(find.byIcon(LucideIcons.bellRing));
    await tester.pumpAndSettle();
    expect(repository.notificationActions, ['user-nina:false']);
    expect(find.byIcon(LucideIcons.bell), findsOneWidget);

    await tester.tap(find.text('Лайк'));
    await tester.pumpAndSettle();
    expect(repository.likedUserIds, contains('user-nina'));
    expect(find.text('Лайк отправлен'), findsOneWidget);

    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(LucideIcons.messageCircle));
    await tester.pumpAndSettle();
    expect(repository.directChatRequests, 1);
    expect(find.text('chats-opened'), findsOneWidget);
  });

  testWidgets('mobile2 profile gallery matches Dateasy gallery controls',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/profile/gallery',
      routes: [
        GoRoute(
          path: '/profile/gallery',
          builder: (_, __) => const ProfileGalleryScreen(),
        ),
        GoRoute(
          path: '/profile/edit',
          builder: (_, __) => const Scaffold(body: Text('edit-opened')),
        ),
        GoRoute(
          path: '/profile',
          builder: (_, __) => const Scaffold(body: Text('profile-opened')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Галерея'), findsOneWidget);
    expect(find.text('2 фото · обновлено сегодня'), findsOneWidget);
    expect(find.text('Главное'), findsOneWidget);
    expect(find.text('Загрузить ещё фото'), findsOneWidget);

    await tester.tap(find.byIcon(LucideIcons.plus));
    await tester.pumpAndSettle();

    expect(find.text('edit-opened'), findsOneWidget);
  });

  testWidgets('mobile2 profile history uses front2 date format',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _backendTestApp(
        home: const ProfileHistoryScreen(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('История'), findsOneWidget);
    expect(find.text('Встреч завершено'), findsOneWidget);
    expect(find.text('Винил-вечер на крыше'), findsOneWidget);
    expect(find.textContaining('19 мая · 21:00'), findsOneWidget);
  });

  testWidgets('mobile2 profile history shows empty state', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _backendTestApp(
        home: const ProfileHistoryScreen(),
        repository: _EmptyHistoryRepository(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('История'), findsOneWidget);
    expect(find.text('0'), findsWidgets);
    expect(find.text('История пока пустая'), findsOneWidget);
  });

  testWidgets('mobile2 settings shortcuts open linked screens', (tester) async {
    final repository = _SettingsRepository();

    Future<void> pumpSettingsRouter() async {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();

      final router = GoRouter(
        initialLocation: '/settings',
        routes: [
          GoRoute(
              path: '/settings', builder: (_, __) => const SettingsScreen()),
          GoRoute(path: '/paywall', builder: (_, __) => const PaywallScreen()),
          GoRoute(path: '/wallet', builder: (_, __) => const WalletScreen()),
          GoRoute(
            path: '/profile/edit',
            builder: (_, __) => const ProfileEditScreen(),
          ),
          GoRoute(path: '/city', builder: (_, __) => const CityScreen()),
          GoRoute(path: '/sos', builder: (_, __) => const SosScreen()),
          GoRoute(path: '/verify', builder: (_, __) => const VerifyScreen()),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: _backendTestOverrides(repository),
          child: MaterialApp.router(
            theme: DateasyTheme.theme,
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    await pumpSettingsRouter();
    expect(find.text('Приватность'), findsOneWidget);
    expect(find.text('Возраст виден'), findsOneWidget);
    expect(find.text('Видимость профиля'), findsOneWidget);
    expect(find.text('Все'), findsOneWidget);
    expect(find.text('Тихие часы'), findsNothing);

    await tester.tap(find.text('Видимость профиля'));
    await tester.pumpAndSettle();
    expect(repository.updatedSettings.last['discoverable'], false);

    await pumpSettingsRouter();
    await tester.tap(find.text('Frendly Plus'));
    await tester.pumpAndSettle();
    expect(find.text('Frendly'), findsOneWidget);

    await pumpSettingsRouter();
    await tester.scrollUntilVisible(find.text('Кошелёк'), 500);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Кошелёк'));
    await tester.pumpAndSettle();
    expect(find.text('Кошелёк'), findsOneWidget);

    await pumpSettingsRouter();
    await tester.scrollUntilVisible(find.text('Редактировать профиль'), 300);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Редактировать профиль'));
    await tester.pumpAndSettle();
    expect(find.text('Редактировать'), findsOneWidget);
  });

  testWidgets('mobile2 city screen matches front2 picker and saves backend',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _CityRepository();
    final router = GoRouter(
      initialLocation: '/city',
      routes: [
        GoRoute(path: '/city', builder: (_, __) => const CityScreen()),
        GoRoute(
            path: '/',
            builder: (_, __) => const Scaffold(body: Text('home-opened'))),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(repository),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Город'), findsOneWidget);
    expect(find.text('Найти город'), findsOneWidget);
    expect(find.text('Определить автоматически'), findsOneWidget);
    expect(find.text('Каталог городов локальный. Backend endpoint не найден'),
        findsNothing);
    expect(find.text('Москва'), findsWidgets);

    await tester.tap(find.text('Берлин').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Готово'));
    await tester.pumpAndSettle();

    expect(repository.updatedProfile.last['city'], 'Берлин');
    expect(find.text('home-opened'), findsOneWidget);
  });

  testWidgets('mobile2 top bar city picker saves manual city', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 720));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _CityRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(repository),
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const Scaffold(
            backgroundColor: DateasyColors.background,
            body: SafeArea(child: DateasyTopBar()),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Москва'), findsOneWidget);

    await tester.tap(find.text('Москва'));
    await tester.pumpAndSettle();

    expect(find.text('Если включен VPN, укажи город вручную.'), findsOneWidget);
    expect(find.text('Открыть полный выбор города'), findsOneWidget);

    await tester.tap(find.text('Казань'));
    await tester.pumpAndSettle();

    expect(repository.updatedProfile.last['city'], 'Казань');
  });

  testWidgets('mobile2 verification skip stays synced with backend',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _VerificationRepository();

    await tester.pumpWidget(
      _backendTestApp(
        home: const VerifyScreen(),
        repository: repository,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Верификация'), findsOneWidget);
    expect(find.text('1/4'), findsOneWidget);

    await tester.tap(find.text('Начать'));
    await tester.pumpAndSettle();
    expect(find.text('Селфи-челлендж'), findsOneWidget);

    await tester.tap(find.text('Сделать селфи'));
    await tester.pumpAndSettle();
    expect(repository.submittedSteps, ['selfie']);
    expect(find.textContaining('Документ', findRichText: true), findsOneWidget);

    await tester.tap(find.text('Пропустить шаг'));
    await tester.pumpAndSettle();

    expect(repository.submittedSteps, ['selfie', 'document']);
    expect(find.text('Готово'), findsOneWidget);
    expect(find.text('4/4'), findsOneWidget);
    expect(find.textContaining('Проверка займёт до 2 часов'), findsOneWidget);
  });

  testWidgets('mobile2 sos matches front2 safety cards and masks contacts',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1100));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _SosRepository();

    await tester.pumpWidget(
      _backendTestApp(
        home: const SosScreen(),
        repository: repository,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Безопасность'), findsOneWidget);
    expect(find.text('Удерживай'), findsOneWidget);
    expect(find.text('БЫСТРЫЕ ДЕЙСТВИЯ'), findsOneWidget);
    expect(find.text('Мама'), findsOneWidget);
    expect(find.text('+7 ··· 21'), findsOneWidget);
    expect(find.text('Чек-ин на встрече'), findsOneWidget);
    expect(find.text('Напомним через 2 часа, всё ли ок'), findsOneWidget);
    expect(find.text('Скрыть точную гео'), findsNothing);

    await tester.tap(find.byKey(const ValueKey('sos-checkin-toggle')));
    await tester.pumpAndSettle();

    expect(repository.updatedSafety.last['autoSharePlans'], false);
  });

  testWidgets('mobile2 wallet uses backend catalog and ledger history',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1500));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _backendTestApp(
        home: const WalletScreen(),
        repository: _WalletRepository(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Кошелёк'), findsOneWidget);
    expect(find.text('Frendly Tokens'), findsOneWidget);
    expect(find.text('240'), findsOneWidget);
    expect(find.text('БАЗОВЫЙ'), findsOneWidget);
    expect(find.text('199 ₽'), findsOneWidget);
    expect(find.text('Plus подписка'), findsOneWidget);
    expect(find.text('от 250 FT / мес'), findsOneWidget);
    expect(find.text('Буст встречи'), findsOneWidget);
    expect(find.text('80 FT / 24ч'), findsOneWidget);
    expect(find.text('Super-like'), findsOneWidget);
    expect(find.text('5 FT / шт'), findsOneWidget);
    expect(find.text('Промокод'), findsOneWidget);
    expect(find.text('Активировать'), findsOneWidget);
    expect(find.text('Нет endpoint'), findsNothing);
    expect(find.text('Пополнение токенов'), findsOneWidget);
    expect(find.text('+100 FT'), findsOneWidget);
    expect(find.text('Frendly+'), findsOneWidget);
    expect(find.text('-250 FT'), findsOneWidget);
  });

  test('mobile2 wallet opens token payment in in-app browser', () {
    expect(walletPaymentLaunchMode, LaunchMode.inAppBrowserView);
  });

  testWidgets('mobile2 paywall defaults to front2 middle plan', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _backendTestApp(
        home: const PaywallScreen(),
        repository: _BillingRepository(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Frendly'), findsOneWidget);
    expect(find.text('Plus'), findsOneWidget);
    expect(find.text('3 месяца'), findsOneWidget);
    expect(find.text('Активировать за 600 FT'), findsOneWidget);
  });

  testWidgets('mobile2 paywall does not duplicate wallet and plan requests',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _CountingBillingRepository();
    var tick = 0;
    late StateSetter rebuild;

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(repository),
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: StatefulBuilder(
            builder: (context, setState) {
              rebuild = setState;
              return Stack(
                children: [
                  const PaywallScreen(),
                  Text('$tick', textDirection: TextDirection.ltr),
                ],
              );
            },
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(repository.walletCalls, 1);
    expect(repository.catalogCalls, 1);
    expect(repository.planCalls, 1);

    rebuild(() => tick += 1);
    await tester.pumpAndSettle();

    expect(repository.walletCalls, 1);
    expect(repository.catalogCalls, 1);
    expect(repository.planCalls, 1);
  });

  testWidgets('mobile2 map matches Dateasy radar screen', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1100));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _backendTestApp(
        home: const MapScreen(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Места, события, люди'), findsOneWidget);
    expect(find.byIcon(LucideIcons.slidersHorizontal), findsOneWidget);
    expect(find.text('Все'), findsWidgets);
    expect(find.text('Встречи'), findsWidgets);
    expect(find.text('Места'), findsOneWidget);
    expect(find.text('Люди'), findsOneWidget);
    expect(find.text('Афиша'), findsOneWidget);
    expect(find.text('Сейчас'), findsOneWidget);
    expect(find.byIcon(LucideIcons.arrowLeft), findsOneWidget);
    expect(find.text('РЯДОМ СЕЙЧАС · 5'), findsOneWidget);
    expect(find.text('Rooftop 17 · винил-вечер'), findsOneWidget);
    expect(find.text('Сегодня 21:00 · 0.8 км'), findsOneWidget);
    expect(find.text('+Я'), findsWidgets);
  });

  testWidgets('mobile2 splash matches Dateasy splash flow', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: DateasyTheme.theme,
        home: const SplashScreen(),
      ),
    );
    await tester.pump();

    expect(find.text('frendly'), findsOneWidget);
    expect(find.text('встречайся · собирай вечера'), findsOneWidget);
    expect(find.byKey(const ValueKey('dateasy-splash-mark')), findsOneWidget);
    expect(find.byKey(const ValueKey('splash-dot-0')), findsOneWidget);
    expect(find.byKey(const ValueKey('splash-dot-1')), findsOneWidget);
    expect(find.byKey(const ValueKey('splash-dot-2')), findsOneWidget);
    expect(find.text('Продолжить'), findsNothing);

    await tester.pump(const Duration(milliseconds: 1500));
    await tester.pumpAndSettle();

    expect(find.text('Продолжить'), findsOneWidget);
  });

  testWidgets('mobile2 ai builder matches Dateasy prompt builder',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1500));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: DateasyTheme.theme,
        home: const AiBuilderScreen(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('AI билдер'), findsOneWidget);
    expect(find.text('Опиши вайб —'), findsOneWidget);
    expect(find.text('соберём вечер'), findsOneWidget);
    expect(find.textContaining('Один абзац'), findsOneWidget);
    expect(find.text('ПРОМТ'), findsOneWidget);
    expect(find.text('0'), findsOneWidget);
    expect(find.text('символов'), findsOneWidget);
    expect(find.text('2-3 предложения — идеально'), findsOneWidget);
    expect(find.text('ПРИМЕРЫ ПРОМТОВ'), findsOneWidget);
    expect(find.text('Уютный вечер вдвоём'), findsOneWidget);
    expect(find.text('Активная компания на 4-6'), findsOneWidget);
    expect(find.text('Гастро-приключение'), findsOneWidget);
    expect(find.text('Креативное свидание'), findsOneWidget);
    expect(find.text('КАК ОПИСАТЬ КРУЧЕ'), findsOneWidget);
    expect(find.textContaining('Укажи количество людей'), findsOneWidget);
    expect(find.text('Сгенерировать вечер'), findsOneWidget);
    expect(find.byIcon(LucideIcons.arrowLeft), findsOneWidget);
    expect(find.byIcon(LucideIcons.sparkles), findsWidgets);
    expect(find.byIcon(LucideIcons.wand), findsOneWidget);
    expect(find.byIcon(LucideIcons.lightbulb), findsWidgets);
    expect(find.byIcon(LucideIcons.calendarHeart), findsOneWidget);

    await tester.tap(find.text('Гастро-приключение'));
    await tester.pumpAndSettle();

    expect(find.text('Очистить'), findsOneWidget);
    expect(find.textContaining('Хочу гастро-тур'), findsWidgets);

    await tester.tap(find.text('Очистить'));
    await tester.pumpAndSettle();

    expect(find.text('Очистить'), findsNothing);
    expect(find.text('0'), findsOneWidget);
  });

  testWidgets('mobile2 ai builder shows failed generation state',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _backendTestApp(
        home: const AiBuilderScreen(),
        repository: _FailingAiBuilderRepository(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'бар и стендап сегодня');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Сгенерировать вечер'));
    await tester.pumpAndSettle();

    expect(find.text('Не удалось собрать маршрут'), findsOneWidget);
  });

  testWidgets('mobile2 meeting chat matches Dateasy chat blocks',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          backendRepositoryProvider.overrideWithValue(_MeetingChatRepository()),
          appLocalCacheRuntimeDisabledProvider.overrideWith((_) => true),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const MeetingChatScreen(meetingId: 'coffee'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Speciality coffee tasting'), findsOneWidget);
    expect(find.text('4 онлайн · 6 участников'), findsOneWidget);
    expect(find.text('Сегодня · 19:30'), findsOneWidget);
    expect(find.text('Brew Lab, Патрики'), findsOneWidget);
    expect(find.text('Встреча создана · сегодня 12:04'), findsOneWidget);
    expect(find.text('Frendly'), findsNothing);
    expect(find.text('Привеет! Я хост, очень рада всем 🤍'), findsOneWidget);
    expect(find.text('Огонь, я тогда подтянусь к 19:30 ✌️'), findsOneWidget);
    expect(find.text('Сообщение в чат встречи'), findsOneWidget);
    expect(find.text('Предложи тост'), findsNothing);
    expect(find.text('Перенести'), findsNothing);
    expect(find.text('Поделиться местом'), findsNothing);

    await tester.tap(find.byIcon(LucideIcons.plus).last);
    await tester.pumpAndSettle();
    expect(find.text('Фото/видео'), findsOneWidget);
    expect(find.text('Локация'), findsOneWidget);

    await tester.tap(find.byIcon(LucideIcons.ellipsis));
    await tester.pumpAndSettle();
    expect(find.text('Меню чата'), findsOneWidget);
    expect(find.text('Поиск по чату'), findsOneWidget);

    await tester.tap(find.byIcon(LucideIcons.x));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Speciality coffee tasting'));
    await tester.pumpAndSettle();
    expect(find.text('Участники'), findsOneWidget);
    expect(find.text('Лия'), findsWidgets);
  });

  testWidgets('mobile2 chat opens public profile from message', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/chats/coffee',
      routes: [
        GoRoute(
          path: '/chats/:chatId',
          builder: (_, state) => MeetingChatScreen(
            meetingId: state.pathParameters['chatId'] ?? 'coffee',
          ),
        ),
        GoRoute(
          path: '/u/:userId',
          builder: (_, state) => Scaffold(
            body: Text('profile-opened-${state.pathParameters['userId']}'),
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          backendRepositoryProvider.overrideWithValue(_MeetingChatRepository()),
          appLocalCacheRuntimeDisabledProvider.overrideWith((_) => true),
        ],
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Привеет! Я хост, очень рада всем 🤍'));
    await tester.pumpAndSettle();

    expect(find.text('profile-opened-u-lia'), findsOneWidget);
  });

  testWidgets('mobile2 meeting chat scroll near top loads older messages',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _MeetingChatPagedRepository();
    final database = AppLocalDatabase.forTesting(NativeDatabase.memory());
    final chatStore = ChatLocalStore(database);
    addTearDown(database.close);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          backendRepositoryProvider.overrideWithValue(repository),
          chatLocalStoreProvider.overrideWithValue(chatStore),
          currentUserProvider.overrideWith(
            (ref) => const BackendUser(id: 'user-1', name: 'Alex'),
          ),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const MeetingChatScreen(meetingId: 'coffee'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.drag(find.byType(Scrollable).first, const Offset(0, -900));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(Scrollable).first, const Offset(0, 850));
    await tester.pumpAndSettle();

    expect(repository.cursors, [null, 'older-1']);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  });

  testWidgets('mobile2 chat opens public profile from participant list',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/chats/coffee',
      routes: [
        GoRoute(
          path: '/chats/:chatId',
          builder: (_, state) => MeetingChatScreen(
            meetingId: state.pathParameters['chatId'] ?? 'coffee',
          ),
        ),
        GoRoute(
          path: '/u/:userId',
          builder: (_, state) => Scaffold(
            body: Text('profile-opened-${state.pathParameters['userId']}'),
          ),
        ),
        GoRoute(
          path: '/profile',
          builder: (_, __) => const Scaffold(body: Text('own-profile-opened')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          backendRepositoryProvider.overrideWithValue(_MeetingChatRepository()),
          appLocalCacheRuntimeDisabledProvider.overrideWith((_) => true),
        ],
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Speciality coffee tasting'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Лия').last);
    await tester.pumpAndSettle();

    expect(find.text('profile-opened-u-lia'), findsOneWidget);
  });

  testWidgets('mobile2 meeting chat back arrow returns to chats',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/meetings/coffee/chat',
      routes: [
        GoRoute(
          path: '/chats',
          builder: (_, __) => const Scaffold(body: Text('chats-opened')),
        ),
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, __) => const Scaffold(body: Text('meeting-opened')),
        ),
        GoRoute(
          path: '/meetings/:meetingId/chat',
          builder: (_, state) => MeetingChatScreen(
            meetingId: state.pathParameters['meetingId'] ?? 'coffee',
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          backendRepositoryProvider.overrideWithValue(_MeetingChatRepository()),
          appLocalCacheRuntimeDisabledProvider.overrideWith((_) => true),
        ],
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Speciality coffee tasting'), findsOneWidget);

    await tester.tap(find.byIcon(LucideIcons.arrowLeft));
    await tester.pumpAndSettle();

    expect(find.text('chats-opened'), findsOneWidget);
    expect(find.text('meeting-opened'), findsNothing);
  });

  testWidgets('mobile2 meeting detail renders backend attachments and host',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1300));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/meetings/coffee',
      routes: [
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => MeetingDetailScreen(
            meetingId: state.pathParameters['meetingId'] ?? 'coffee',
          ),
        ),
        GoRoute(
          path: '/meetings/:meetingId/chat',
          builder: (_, state) => Scaffold(
            body: Text('chat-opened-${state.pathParameters['meetingId']}'),
          ),
        ),
        GoRoute(
          path: '/u/:userId',
          builder: (_, state) => Scaffold(
            body: Text('profile-opened-${state.pathParameters['userId']}'),
          ),
        ),
        GoRoute(
          path: '/routes/:routeId',
          builder: (_, state) => Scaffold(
            body: Text('route-opened-${state.pathParameters['routeId']}'),
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(_MeetingDetailRepository()),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Speciality coffee tasting'), findsOneWidget);
    expect(find.text('Хост'), findsWidgets);
    expect(find.text('Лия'), findsWidgets);
    expect(find.text('4.9 · 12 встреч · проверен'), findsOneWidget);
    expect(find.text('Вложено во встречу'), findsOneWidget);
    expect(find.text('Афиша'), findsOneWidget);
    expect(find.text('Билет'), findsOneWidget);
    expect(find.text('Заведение'), findsOneWidget);
    expect(find.text('Забронировать'), findsOneWidget);
    expect(find.text('Маршрут'), findsWidgets);
    expect(find.text('Открыть'), findsOneWidget);
    expect(find.text('О встрече'), findsOneWidget);
    expect(find.text('Пробуем 3 фильтра и идем гулять'), findsOneWidget);
    expect(find.text('Кто идёт'), findsOneWidget);
    expect(find.text('Локация'), findsOneWidget);

    await tester.tap(find.byIcon(LucideIcons.messageCircle).first);
    await tester.pumpAndSettle();

    expect(find.text('chat-opened-chat-coffee'), findsOneWidget);
  });

  testWidgets('mobile2 meeting detail hides chat action without backend chatId',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1300));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/meetings/no-chat',
      routes: [
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => MeetingDetailScreen(
            meetingId: state.pathParameters['meetingId'] ?? 'no-chat',
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(_MeetingNoChatRepository()),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Speciality coffee tasting'), findsOneWidget);
    expect(find.text('Чат встречи'), findsNothing);
  });

  testWidgets('mobile2 host dashboard approves and rejects requests',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1100));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _HostDashboardRepository();
    final router = GoRouter(
      initialLocation: '/host',
      routes: [
        GoRoute(
          path: '/host',
          builder: (_, __) => const HostDashboardScreen(),
        ),
        GoRoute(
          path: '/profile',
          builder: (_, __) => const Scaffold(body: Text('profile-opened')),
        ),
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => Scaffold(
            body: Text('meeting-${state.pathParameters['meetingId']}'),
          ),
        ),
        GoRoute(
          path: '/meetings/new',
          builder: (_, __) => const Scaffold(body: Text('edit-opened')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(repository),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Host dashboard'), findsOneWidget);
    expect(find.text('Заявки'), findsOneWidget);
    expect(find.text('Нина'), findsOneWidget);
    expect(find.byIcon(LucideIcons.badgeCheck), findsOneWidget);
    expect(find.byIcon(LucideIcons.crown), findsOneWidget);

    await tester.tap(find.byIcon(LucideIcons.check));
    await tester.pumpAndSettle();

    expect(repository.approvedRequestIds, ['request-1']);
    expect(find.text('Заявка одобрена'), findsOneWidget);

    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(LucideIcons.x));
    await tester.pumpAndSettle();

    expect(repository.rejectedRequestIds, ['request-1']);
    expect(find.text('Заявка отклонена'), findsOneWidget);
  });

  testWidgets('mobile2 meeting detail shows front2 host actions for own event',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1300));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/meetings/own',
      routes: [
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => MeetingDetailScreen(
            meetingId: state.pathParameters['meetingId'] ?? 'own',
          ),
        ),
        GoRoute(
          path: '/meetings/new',
          builder: (_, __) => const Scaffold(body: Text('edit-opened')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(_MeetingHostRepository()),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Редактировать'), findsOneWidget);
    expect(find.text('Продвинуть'), findsOneWidget);
    expect(find.text('Пригласить'), findsOneWidget);
    expect(find.text('Вы идёте'), findsOneWidget);

    expect(find.byIcon(LucideIcons.pencil), findsOneWidget);
    expect(find.byIcon(LucideIcons.zap), findsOneWidget);
  });

  testWidgets('mobile2 meeting detail reads nested host and attendee photos',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1300));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/meetings/photos',
      routes: [
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => MeetingDetailScreen(
            meetingId: state.pathParameters['meetingId'] ?? 'photos',
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(_MeetingPhotosRepository()),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is DateasyRemoteImage &&
            widget.imageUrl == 'https://example.com/host-profile.jpg',
      ),
      findsWidgets,
    );
    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is DateasyRemoteImage &&
            widget.imageUrl == 'https://example.com/guest-profile.jpg',
      ),
      findsOneWidget,
    );
  });

  testWidgets('mobile2 empty stories can close back to meeting detail',
      (tester) async {
    final router = GoRouter(
      initialLocation: '/stories?eventId=coffee',
      routes: [
        GoRoute(
          path: '/stories',
          builder: (_, state) => StoriesScreen(
            eventId: state.uri.queryParameters['eventId'],
          ),
        ),
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => Scaffold(
            body: Text('meeting-opened-${state.pathParameters['meetingId']}'),
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(_EmptyStoriesRepository()),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Stories пока нет'), findsOneWidget);
    expect(find.byIcon(LucideIcons.x), findsOneWidget);

    await tester.tap(find.byIcon(LucideIcons.x));
    await tester.pumpAndSettle();

    expect(find.text('meeting-opened-coffee'), findsOneWidget);
  });

  testWidgets('mobile2 share screen creates public event link', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1100));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _ShareRepository();

    await tester.pumpWidget(
      _backendTestApp(
        home: const ShareScreen(targetType: 'event', targetId: 'event-1'),
        repository: repository,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Stories'));
    await tester.pumpAndSettle();

    expect(repository.createdShares, [
      {'targetType': 'event', 'targetId': 'event-1'}
    ]);
    expect(find.text('https://frendly.test/abc'), findsOneWidget);
    expect(find.text('Ссылка готова'), findsOneWidget);
  });

  testWidgets('mobile2 meeting detail sends join request for request access',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1300));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _MeetingJoinRequestRepository();
    final router = GoRouter(
      initialLocation: '/meetings/requested',
      routes: [
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => MeetingDetailScreen(
            meetingId: state.pathParameters['meetingId'] ?? 'requested',
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(repository),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Отправить заявку'), findsOneWidget);
    expect(find.byIcon(LucideIcons.messageCircle), findsOneWidget);

    await tester.tap(find.text('Отправить заявку'));
    await tester.pumpAndSettle();

    expect(repository.createdJoinRequest, true);
    expect(find.text('Заявка отправлена'), findsOneWidget);
    expect(find.text('Отменить заявку'), findsOneWidget);
  });

  testWidgets('mobile2 meeting detail opens requirement actions',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1300));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/meetings/locked',
      routes: [
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => MeetingDetailScreen(
            meetingId: state.pathParameters['meetingId'] ?? 'locked',
          ),
        ),
        GoRoute(
          path: '/verify',
          builder: (_, __) => const Scaffold(body: Text('verify-opened')),
        ),
        GoRoute(
          path: '/paywall',
          builder: (_, __) => const Scaffold(body: Text('paywall-opened')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(_MeetingLockedRepository()),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Доступ закрыт'), findsOneWidget);
    expect(find.text('Нужна верификация'), findsOneWidget);
    expect(find.text('Нужен Frendly+'), findsOneWidget);
    expect(find.text('Пройти верификацию'), findsOneWidget);

    await tester.tap(find.text('Пройти верификацию'));
    await tester.pumpAndSettle();

    expect(find.text('verify-opened'), findsOneWidget);
  });

  testWidgets('mobile2 meeting detail opens paywall requirement action',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1300));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/meetings/locked',
      routes: [
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => MeetingDetailScreen(
            meetingId: state.pathParameters['meetingId'] ?? 'locked',
          ),
        ),
        GoRoute(
          path: '/verify',
          builder: (_, __) => const Scaffold(body: Text('verify-opened')),
        ),
        GoRoute(
          path: '/paywall',
          builder: (_, __) => const Scaffold(body: Text('paywall-opened')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(_MeetingLockedRepository()),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Открыть Frendly+').last);
    await tester.pumpAndSettle();

    expect(find.text('paywall-opened'), findsOneWidget);
  });

  testWidgets('mobile2 meeting detail invites following users', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1300));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _MeetingInviteRepository();
    final router = GoRouter(
      initialLocation: '/meetings/invite',
      routes: [
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => MeetingDetailScreen(
            meetingId: state.pathParameters['meetingId'] ?? 'invite',
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(repository),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(LucideIcons.userPlus));
    await tester.pumpAndSettle();

    expect(repository.followingEventIds, ['invite']);
    expect(find.text('Кого позвать'), findsOneWidget);
    expect(find.text('Нина'), findsOneWidget);
    expect(find.text('Пригласить'), findsOneWidget);

    await tester.tap(find.text('Пригласить'));
    await tester.pumpAndSettle();

    expect(repository.invitedUserIds, ['friend-1']);
    expect(find.text('Отправлено'), findsOneWidget);
  });

  testWidgets('mobile2 meeting invite search debounces and cancels old request',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1300));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _MeetingInviteSearchRepository();
    final router = GoRouter(
      initialLocation: '/meetings/invite',
      routes: [
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => MeetingDetailScreen(
            meetingId: state.pathParameters['meetingId'] ?? 'invite',
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(repository),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(LucideIcons.userPlus));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));

    expect(repository.queries, [null]);
    expect(repository.cancelTokens.single.isCancelled, false);

    await tester.enterText(find.byType(TextField), 'ни');
    await tester.pump(const Duration(milliseconds: 249));

    expect(repository.queries, [null]);

    await tester.pump(const Duration(milliseconds: 1));

    expect(repository.queries, [null, 'ни']);
    expect(repository.cancelTokens.first.isCancelled, true);

    repository.completeAll();
    await tester.pumpAndSettle();
  });

  testWidgets('mobile2 meeting invite sheet loads next following page',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1300));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _MeetingInvitePagedRepository();
    final router = GoRouter(
      initialLocation: '/meetings/invite',
      routes: [
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => MeetingDetailScreen(
            meetingId: state.pathParameters['meetingId'] ?? 'invite',
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: _backendTestOverrides(repository),
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(LucideIcons.userPlus));
    await tester.pumpAndSettle();

    await tester.drag(find.byType(ListView).last, const Offset(0, -1200));
    await tester.pumpAndSettle();

    expect(repository.cursors, [null, 'next-1']);
    await tester.scrollUntilVisible(
      find.text('Друг 25'),
      120,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Друг 25'), findsOneWidget);
  });

  testWidgets('mobile2 new meeting matches Dateasy creation blocks',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _backendTestApp(
        home: const NewMeetingScreen(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Новая встреча'), findsOneWidget);
    expect(find.text('Добавить обложку'), findsOneWidget);
    expect(find.text('Название встречи'), findsOneWidget);
    expect(find.text('Короткое описание'), findsOneWidget);
    expect(find.text('Категория'.toUpperCase()), findsOneWidget);
    expect(find.text('Кофе'), findsOneWidget);
    expect(find.text('Музыка'), findsOneWidget);
    expect(find.text('Когда'.toUpperCase()), findsOneWidget);
    expect(find.text('Длительность'.toUpperCase()), findsNothing);
    expect(find.text('1.5'), findsNothing);
    expect(find.text('Где'.toUpperCase()), findsOneWidget);
    expect(find.text('Сколько людей'.toUpperCase()), findsOneWidget);

    await tester.ensureVisible(find.text('Прикрепить'.toUpperCase()));
    await tester.pumpAndSettle();
    expect(find.text('Афиша'), findsOneWidget);
    expect(find.text('Промо'), findsOneWidget);
    expect(find.text('Маршрут'), findsOneWidget);

    await tester.tap(find.text('Афиша'));
    await tester.pumpAndSettle();
    expect(find.text('Прикрепить из афиши'), findsOneWidget);
    expect(find.text('Сегодня'), findsWidgets);
    expect(find.text('Завтра'), findsWidgets);
    expect(find.text('Музыка'), findsWidgets);
    expect(find.text('Бар'), findsWidgets);
    expect(find.text('Арт'), findsWidgets);
    await tester.tap(find.byIcon(LucideIcons.x).last);
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Кому доступно'.toUpperCase()));
    await tester.pumpAndSettle();
    expect(find.text('Только верифицированные'), findsOneWidget);
    expect(find.text('Прошли проверку Frendly'), findsOneWidget);
    expect(find.text('Только Frendly+'), findsOneWidget);

    await tester.tap(find.text('Только верифицированные'));
    await tester.pumpAndSettle();
    expect(find.text('Сначала пройди верификацию'), findsOneWidget);

    await tester.tap(find.text('Только Frendly+'));
    await tester.pumpAndSettle();
    expect(find.text('Frendly+ доступен только подписчикам'), findsOneWidget);

    await tester.ensureVisible(find.text('Кто может видеть'.toUpperCase()));
    await tester.pumpAndSettle();
    expect(find.text('Все рядом'), findsOneWidget);
    expect(find.text('По ссылке'), findsOneWidget);

    await tester.ensureVisible(find.text('Продвинуть встречу'));
    await tester.pumpAndSettle();
    expect(find.text('50 FT'), findsOneWidget);
    expect(find.text('Опубликовать встречу'), findsOneWidget);

    await tester.ensureVisible(find.text('Промо'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Промо'));
    await tester.pumpAndSettle();

    expect(find.text('Промо · заведения со скидками'), findsOneWidget);
    expect(find.text('Surf Coffee'), findsOneWidget);
    expect(find.text('−15% по Frendly'), findsWidgets);
  });

  testWidgets('mobile2 new meeting promo fills draft before publish',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _MeetingCreateRepository();
    await tester.pumpWidget(
      _backendTestApp(
        home: const NewMeetingScreen(),
        repository: repository,
      ),
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Промо'));
    await tester.tap(find.text('Промо'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('attach-promo-promo-1')));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Опубликовать встречу'),
      420,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Опубликовать встречу'));
    await tester.pumpAndSettle();

    expect(repository.createdData?['title'], 'Встречаемся в Surf Coffee');
    expect(repository.createdData?['description'], '−15% по Frendly');
    expect(repository.createdData?['externalPlaceId'], 'place-1');
  });

  testWidgets('mobile2 new meeting route fills draft before publish',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _MeetingCreateRepository();
    await tester.pumpWidget(
      _backendTestApp(
        home: const NewMeetingScreen(),
        repository: repository,
      ),
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Маршрут'));
    await tester.tap(find.text('Маршрут'));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Вечерний маршрут').last);
    await tester.pumpAndSettle();

    expect(find.textContaining('Вечерний маршрут'), findsWidgets);

    await tester.scrollUntilVisible(
      find.text('Опубликовать встречу'),
      420,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Опубликовать встречу'));
    await tester.pumpAndSettle();

    expect(repository.createdData?['routeId'], 'route-1');
    expect(repository.createdData?['place'], contains('Вечерний маршрут'));
  });

  testWidgets('mobile2 meetings filters use front2 visible counts',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _backendTestApp(
        home: const MeetingsScreen(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Сегодня'), findsWidgets);
    expect(find.text('Завтра'), findsOneWidget);
    expect(find.text('Эти выходные'), findsOneWidget);
    expect(find.text('Все'), findsWidgets);
    expect(find.text('32'), findsWidgets);
    expect(find.text('8'), findsOneWidget);
    expect(find.text('6'), findsOneWidget);

    await tester.drag(find.byType(ListView).at(1), const Offset(-320, 0));
    await tester.pumpAndSettle();

    expect(find.text('Бар'), findsOneWidget);
    expect(find.text('Арт'), findsOneWidget);
    expect(find.text('7'), findsOneWidget);
    expect(find.text('4'), findsOneWidget);
  });

  testWidgets('mobile2 new meeting afisha sheet keeps front2 bottom height',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 812));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _backendTestApp(
        home: const NewMeetingScreen(),
        repository: _LongAfficheRepository(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Афиша'),
      420,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Афиша'));
    await tester.pumpAndSettle();

    final titleTop = tester.getTopLeft(find.text('Прикрепить из афиши')).dy;
    expect(titleTop, greaterThan(150));
    expect(find.text('Афиша 1'), findsOneWidget);
  });

  testWidgets('mobile2 new meeting applies affiche query prefill',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _backendTestApp(
        home: const NewMeetingScreen(afficheEventId: 'poster-1'),
        repository: _AfficheCreateRepository(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Идем на Rooftop cinema'), findsOneWidget);
    expect(find.text('Кино на крыше'), findsOneWidget);
    expect(find.text('2026-05-20'), findsOneWidget);
    expect(find.text('20:00'), findsOneWidget);
    expect(find.text('Rooftop 17'), findsWidgets);
    expect(find.text('Петровка 1'), findsOneWidget);
  });

  testWidgets('mobile2 new meeting publish sends affiche event id',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _AfficheCreateRepository();
    await tester.pumpWidget(
      _backendTestApp(
        home: const NewMeetingScreen(afficheEventId: 'poster-1'),
        repository: repository,
      ),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Опубликовать встречу'),
      420,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Опубликовать встречу'));
    await tester.pumpAndSettle();

    expect(repository.createdData?['afficheEventId'], 'poster-1');
  });

  testWidgets('mobile2 dating filters match Dateasy controls', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _backendTestApp(
        home: const DatingFilterScreen(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Фильтры'), findsOneWidget);
    expect(find.text('Кого показывать'), findsOneWidget);
    expect(find.text('Девушки'), findsOneWidget);
    expect(find.text('Парни'), findsOneWidget);
    expect(find.text('Все'), findsOneWidget);
    expect(find.text('Возраст'), findsOneWidget);
    expect(find.text('18–99'), findsOneWidget);
    expect(find.text('Расстояние'), findsOneWidget);
    expect(find.text('500 км'), findsOneWidget);
    expect(find.text('Цель'), findsOneWidget);
    expect(find.text('Свидание'), findsOneWidget);
    expect(find.text('Networking'), findsOneWidget);
    expect(find.text('Вайбы'), findsOneWidget);
    expect(find.text('Творческий'), findsOneWidget);
    expect(find.text('Только верифицированные'), findsOneWidget);
    expect(find.text('Профили с галочкой Frendly'), findsOneWidget);
    expect(find.text('Только Frendly+'), findsOneWidget);
    expect(find.text('Онлайн сейчас'), findsOneWidget);
    expect(find.text('Новые на этой неделе'), findsOneWidget);
    expect(find.text('Применить фильтры'), findsOneWidget);

    await tester.tap(find.text('Парни'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Активный'));
    await tester.pumpAndSettle();
    expect(find.text('Активный'), findsOneWidget);

    await tester.tap(find.text('Только верифицированные'));
    await tester.pumpAndSettle();
    expect(find.text('Только верифицированные'), findsOneWidget);
  });
}

Future<void> _pumpDateasyAppWelcome(WidgetTester tester) async {
  await tester.pumpWidget(
    DateasyApp(
      overrides: [
        appLocalCacheRuntimeDisabledProvider.overrideWith((_) => true),
        backendRepositoryProvider.overrideWithValue(_AuthFlowRepository()),
      ],
    ),
  );
  await tester.pump(const Duration(milliseconds: 1500));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Продолжить'));
  await tester.pumpAndSettle();
}

const _testAuthTokens = AuthTokens(
  accessToken: 'access',
  refreshToken: 'refresh',
);

const _testUser = BackendUser(
  id: 'user-1',
  name: 'Алекс',
  gender: 'male',
  onboardingComplete: true,
  city: 'Москва',
);

List<Override> _backendTestOverrides([BackendRepository? repository]) {
  return [
    appLocalCacheRuntimeDisabledProvider.overrideWith((_) => true),
    initialAuthTokensProvider.overrideWithValue(_testAuthTokens),
    currentUserProvider.overrideWith((_) => _testUser),
    radarNativeMapEnabledProvider.overrideWith((_) => false),
    backendRepositoryProvider.overrideWithValue(
      repository ?? _AuthFlowRepository(),
    ),
  ];
}

Widget _backendTestApp({
  required Widget home,
  BackendRepository? repository,
}) {
  return ProviderScope(
    overrides: _backendTestOverrides(repository),
    child: MaterialApp(
      theme: DateasyTheme.theme,
      home: home,
    ),
  );
}

class _AuthFlowRepository extends _RecordingOnboardingRepository {
  @override
  Future<PhoneAuthChallenge> requestPhoneCode(
    String phoneNumber, {
    CancelToken? cancelToken,
  }) async {
    return PhoneAuthChallenge(
      challengeId: 'phone-challenge',
      maskedPhone: phoneNumber,
    );
  }

  @override
  Future<AuthSession> verifyPhone({
    required String challengeId,
    required String code,
    CancelToken? cancelToken,
  }) async {
    if (code.length < 4) {
      throw const BackendActionException(message: 'invalid_code');
    }
    return const AuthSession(
      tokens: AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
      userId: 'user-1',
      isNewUser: true,
    );
  }

  @override
  Future<TelegramAuthStart> startTelegramAuth({
    String? startToken,
    CancelToken? cancelToken,
  }) async {
    return const TelegramAuthStart(
      loginSessionId: 'telegram-session',
      botUrl: '',
      codeLength: 4,
    );
  }

  @override
  Future<AuthSession> verifyTelegramAuth({
    required String loginSessionId,
    required String code,
    CancelToken? cancelToken,
  }) async {
    if (code.length < 4) {
      throw const BackendActionException(message: 'invalid_code');
    }
    return const AuthSession(
      tokens: AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
      userId: 'user-1',
      isNewUser: true,
    );
  }

  @override
  Future<BackendPage<BackendCardItem>> fetchEvents({
    String? city,
    String? filter,
    String? query,
    String? lifestyle,
    String? price,
    String? gender,
    String? access,
    String? date,
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    final primary = BackendCardItem(
      id: 'event-1',
      title: 'Speciality coffee tasting',
      subtitle: 'Bloom Coffee',
      startsAt: DateTime(2026, 5, 19, 19),
    );
    if (limit == 20) {
      return BackendPage(
        items: [
          primary,
          for (var index = 2; index <= 32; index++)
            BackendCardItem(
              id: 'event-$index',
              title: 'Встреча $index',
              subtitle: 'Dateasy spot',
              startsAt: DateTime(2026, 5, 19, 19),
            ),
        ],
      );
    }
    return BackendPage(items: [primary]);
  }

  @override
  Future<BackendCardItem> joinEvent(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    return BackendCardItem(
      id: eventId,
      title: eventId == 'event-1'
          ? 'Speciality coffee tasting'
          : 'Встреча ${eventId.replaceAll('event-', '')}',
      subtitle: eventId == 'event-1' ? 'Bloom Coffee' : 'Dateasy spot',
      startsAt: DateTime(2026, 5, 19, 19),
      raw: const {'participantState': 'joined'},
    );
  }

  @override
  Future<BackendCardItem> leaveEvent(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    return BackendCardItem(
      id: eventId,
      title: eventId == 'event-1'
          ? 'Speciality coffee tasting'
          : 'Встреча ${eventId.replaceAll('event-', '')}',
      subtitle: eventId == 'event-1' ? 'Bloom Coffee' : 'Dateasy spot',
      startsAt: DateTime(2026, 5, 19, 19),
    );
  }

  @override
  Future<Map<String, Object?>> logout({CancelToken? cancelToken}) async {
    return const {};
  }

  @override
  Future<BackendCardItem> fetchOwnProfile({CancelToken? cancelToken}) async {
    return const BackendCardItem(
      id: 'user-1',
      title: 'Алекс',
      subtitle: 'Люблю кофе, прогулки и спокойные встречи',
      imageUrl: 'https://example.com/alex.jpg',
      city: 'Москва',
      raw: {
        'verified': true,
        'age': 27,
        'area': 'Патрики',
        'meetupCount': 12,
        'rating': 4.9,
        'stats': {
          'matchesCount': 48,
        },
        'interests': [
          'Speciality coffee',
          'Винил',
          'Прогулки',
        ],
        'photos': [
          {'url': 'https://example.com/alex-1.jpg'},
          {'url': 'https://example.com/alex-2.jpg'},
        ],
      },
    );
  }

  @override
  Future<VerificationStateData> fetchVerification({
    CancelToken? cancelToken,
  }) async {
    return const VerificationStateData(
      status: 'pending',
      selfieDone: false,
      documentDone: false,
    );
  }

  @override
  Future<BackendPage<BackendCardItem>> fetchAffiche({
    String? city,
    String? query,
    String? date,
    String? dateFrom,
    String? dateTo,
    String? priceMode,
    String? category,
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    return BackendPage(
      items: [
        BackendCardItem(
          id: 'poster-1',
          title: 'Rooftop cinema',
          city: 'cinema',
          startsAt: DateTime(2026, 5, 20, 20),
        ),
      ],
    );
  }

  @override
  Future<BackendPage<BackendCardItem>> fetchMapEvents({
    required double north,
    required double south,
    required double east,
    required double west,
    int limit = 80,
    CancelToken? cancelToken,
  }) async {
    return const BackendPage(
      items: [
        BackendCardItem(
          id: 'map-1',
          title: 'Rooftop 17 · винил-вечер',
          subtitle: '0.8 км',
          city: 'Сегодня 21:00',
          latitude: 55.76,
          longitude: 37.61,
        ),
        BackendCardItem(
          id: 'map-2',
          title: 'Brew Lab · спешелти',
          subtitle: '0.4 км',
          city: 'Сейчас',
          latitude: 55.75,
          longitude: 37.6,
        ),
        BackendCardItem(
          id: 'map-3',
          title: 'Noor Bar',
          subtitle: '1.1 км',
          city: 'Сегодня',
          latitude: 55.77,
          longitude: 37.62,
        ),
        BackendCardItem(
          id: 'map-4',
          title: 'Art Gallery',
          subtitle: '1.4 км',
          city: 'Завтра',
          latitude: 55.74,
          longitude: 37.59,
        ),
        BackendCardItem(
          id: 'map-5',
          title: 'Park Run',
          subtitle: '2.0 км',
          city: 'Суббота',
          latitude: 55.78,
          longitude: 37.63,
        ),
      ],
    );
  }

  @override
  Future<BackendPage<BackendCardItem>> fetchPerks({
    String? city,
    String? category,
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    return const BackendPage(
      items: [
        BackendCardItem(
          id: 'perk-1',
          title: 'Surf Coffee',
          subtitle: '−15% по Frendly',
        ),
      ],
    );
  }

  @override
  Future<BackendPage<BackendCardItem>> fetchMatches({
    int limit = 10,
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    return const BackendPage(
      items: [
        BackendCardItem(id: 'match-1', title: 'Маша'),
        BackendCardItem(id: 'match-2', title: 'Лера'),
      ],
    );
  }

  @override
  Future<TokenWalletData> fetchTokenWallet({CancelToken? cancelToken}) async {
    return const TokenWalletData(balance: 240);
  }

  @override
  Future<BackendPage<BackendCardItem>> fetchHistory({
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    return BackendPage(
      items: [
        BackendCardItem(
          id: 'history-1',
          title: 'Винил-вечер на крыше',
          subtitle: 'Rooftop 17',
          startsAt: DateTime(2026, 5, 19, 21),
          raw: const {'role': 'Хост'},
        ),
      ],
    );
  }

  @override
  Future<AppSettingsData> fetchSettings({CancelToken? cancelToken}) async {
    return const AppSettingsData(
      allowPush: true,
      discoverable: true,
      showAge: true,
      darkMode: true,
    );
  }

  @override
  Future<AppSettingsData> updateSettings(
    Map<String, Object?> data, {
    CancelToken? cancelToken,
  }) async {
    return AppSettingsData.fromJson(data);
  }

  @override
  Future<SafetyData> fetchSafety({CancelToken? cancelToken}) async {
    return const SafetyData(
      trustScore: 72,
      settings: AppSettingsData(
        autoSharePlans: true,
        hideExactLocation: false,
      ),
    );
  }

  @override
  Future<SafetyData> updateSafety(
    Map<String, Object?> data, {
    CancelToken? cancelToken,
  }) async {
    return SafetyData(
      trustScore: 72,
      settings: AppSettingsData.fromJson(data),
      raw: {
        'trustScore': 72,
        'settings': data,
      },
    );
  }
}

class _LongAfficheRepository extends _AuthFlowRepository {
  @override
  Future<BackendPage<BackendCardItem>> fetchAffiche({
    String? city,
    String? query,
    String? date,
    String? dateFrom,
    String? dateTo,
    String? priceMode,
    String? category,
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    return BackendPage(
      items: [
        for (var index = 1; index <= 24; index++)
          BackendCardItem(
            id: 'poster-$index',
            title: 'Афиша $index',
            city: 'Музыка',
            startsAt: DateTime(2026, 5, 20, 20),
          ),
      ],
    );
  }
}

class _AfficheCreateRepository extends _AuthFlowRepository {
  Map<String, Object?>? createdData;

  @override
  Future<BackendCardItem> fetchAfficheDetail(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    return BackendCardItem(
      id: eventId,
      title: 'Rooftop cinema',
      subtitle: 'Rooftop 17',
      city: 'Кино',
      startsAt: DateTime(2026, 5, 20, 20),
      raw: const {
        'id': 'poster-1',
        'title': 'Rooftop cinema',
        'description': 'Кино на крыше',
        'venue': 'Rooftop 17',
        'address': 'Петровка 1',
        'price': '1500 ₽',
        'actionUrl': 'https://tickets.test/poster-1',
      },
    );
  }

  @override
  Future<BackendCardItem> createEvent({
    required Map<String, Object?> data,
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async {
    createdData = data;
    return const BackendCardItem(
      id: 'created-1',
      title: 'Created',
      raw: {'participantState': 'host'},
    );
  }
}

class _MeetingCreateRepository extends _AuthFlowRepository {
  Map<String, Object?>? createdData;

  @override
  Future<BackendPage<BackendCardItem>> fetchPerks({
    String? city,
    String? category,
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    return const BackendPage(
      items: [
        BackendCardItem(
          id: 'promo-1',
          title: 'Surf Coffee',
          subtitle: '−15% по Frendly',
          city: 'Москва',
          raw: {
            'description': '−15% по Frendly',
            'venueName': 'Surf Coffee',
            'address': 'Покровка 17',
            'placeId': 'place-1',
          },
        ),
      ],
    );
  }

  @override
  Future<BackendPage<BackendCardItem>> fetchRoutes({
    String? city,
    String? query,
    int limit = 20,
    CancelToken? cancelToken,
  }) async {
    return const BackendPage(
      items: [
        BackendCardItem(
          id: 'route-1',
          title: 'Вечерний маршрут',
          subtitle: 'Москва · 2 часа',
          city: 'Москва',
          raw: {
            'area': 'Патрики',
            'durationLabel': '2 часа',
            'blurb': 'Маршрут для вечера',
          },
        ),
      ],
    );
  }

  @override
  Future<BackendCardItem> createEvent({
    required Map<String, Object?> data,
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async {
    createdData = data;
    return const BackendCardItem(
      id: 'created-1',
      title: 'Created',
      raw: {'participantState': 'host'},
    );
  }
}

class _WalletRepository extends _AuthFlowRepository {
  @override
  Future<TokenWalletData> fetchTokenWallet({CancelToken? cancelToken}) async {
    return const TokenWalletData(
      balance: 240,
      history: [
        BackendCardItem(
          id: 'ledger-1',
          title: '',
          raw: {
            'amount': 100,
            'type': 'topup',
            'note': 'Пополнение токенов',
            'timestamp': '2026-05-19T10:00:00.000Z',
          },
        ),
        BackendCardItem(
          id: 'ledger-2',
          title: '',
          raw: {
            'amount': 250,
            'type': 'spend',
            'note': 'Frendly+',
            'timestamp': '2026-05-18T10:00:00.000Z',
          },
        ),
      ],
      raw: {
        'promoOptions': [
          {
            'id': 'boost-24',
            'title': 'Буст · 24 часа',
            'subtitle': 'Топ ленты + бейдж',
            'cost': 80,
            'durationHours': 24,
          },
        ],
      },
    );
  }

  @override
  Future<PaymentsCatalog> fetchPaymentsCatalog({
    CancelToken? cancelToken,
  }) async {
    return const PaymentsCatalog(
      tbankEnabled: true,
      tokenPacks: [
        TokenPackProduct(
          id: 'p1',
          label: 'Базовый',
          tokens: 100,
          priceRub: 199,
        ),
      ],
    );
  }

  @override
  Future<List<SubscriptionPlan>> fetchSubscriptionPlans({
    CancelToken? cancelToken,
  }) async {
    return const [
      SubscriptionPlan(
        id: 'month',
        label: 'Месячный',
        tokenCost: 250,
        tokenMonthlyCost: 250,
      ),
    ];
  }
}

class _CityRepository extends _AuthFlowRepository {
  final updatedProfile = <Map<String, Object?>>[];

  @override
  Future<int> fetchNotificationUnreadCount({CancelToken? cancelToken}) async {
    return 0;
  }

  @override
  Future<BackendCardItem> updateOwnProfile({
    required Map<String, Object?> data,
    CancelToken? cancelToken,
  }) async {
    updatedProfile.add(data);
    return BackendCardItem(
      id: 'user-1',
      title: 'Алекс',
      city: data['city']?.toString(),
      raw: data,
    );
  }
}

class _HostDashboardRepository extends _AuthFlowRepository {
  final approvedRequestIds = <String>[];
  final rejectedRequestIds = <String>[];

  @override
  Future<HostDashboardData> fetchHostDashboard({
    int eventsLimit = 20,
    int requestsLimit = 20,
    CancelToken? cancelToken,
  }) async {
    return HostDashboardData(
      stats: const HostDashboardStats(
        meetupsCount: 3,
        rating: 4.9,
        guestsCount: 18,
        fillRate: 80,
      ),
      pendingRequestsCount: 1,
      requests: const [
        HostJoinRequestData(
          id: 'request-1',
          eventId: 'event-1',
          eventTitle: 'Кофе на Патриках',
          userId: 'user-nina',
          userName: 'Нина',
          avatarUrl: null,
          verified: true,
          frendlyPlus: true,
        ),
      ],
      events: [
        BackendCardItem(
          id: 'event-1',
          title: 'Кофе на Патриках',
          subtitle: 'Сегодня',
          startsAt: DateTime(2026, 5, 20, 19),
          raw: const {
            'status': 'active',
            'capacity': 8,
            'participantCount': 5,
            'chatId': 'chat-event-1',
          },
        ),
      ],
      raw: const {
        'stats': {
          'meetupsCount': 3,
          'rating': 4.9,
          'guestsCount': 18,
          'fillRate': 80,
        },
        'pendingRequestsCount': 1,
        'requests': [
          {
            'id': 'request-1',
            'eventId': 'event-1',
            'eventTitle': 'Кофе на Патриках',
            'userId': 'user-nina',
            'userName': 'Нина',
            'verified': true,
            'frendlyPlus': true,
          }
        ],
        'events': [
          {
            'id': 'event-1',
            'title': 'Кофе на Патриках',
            'subtitle': 'Сегодня',
            'startsAt': '2026-05-20T19:00:00.000Z',
            'status': 'active',
            'capacity': 8,
            'participantCount': 5,
            'chatId': 'chat-event-1',
          }
        ],
      },
    );
  }

  @override
  Future<HostJoinRequestData> approveHostRequest(
    String requestId, {
    CancelToken? cancelToken,
  }) async {
    approvedRequestIds.add(requestId);
    return const HostJoinRequestData(
      id: 'request-1',
      eventId: 'event-1',
      eventTitle: 'Кофе на Патриках',
      userId: 'user-nina',
      userName: 'Нина',
      status: 'approved',
      verified: true,
      frendlyPlus: true,
    );
  }

  @override
  Future<HostJoinRequestData> rejectHostRequest(
    String requestId, {
    CancelToken? cancelToken,
  }) async {
    rejectedRequestIds.add(requestId);
    return const HostJoinRequestData(
      id: 'request-1',
      eventId: 'event-1',
      eventTitle: 'Кофе на Патриках',
      userId: 'user-nina',
      userName: 'Нина',
      status: 'rejected',
      verified: true,
      frendlyPlus: true,
    );
  }
}

class _VerificationRepository extends _AuthFlowRepository {
  VerificationStateData _state = const VerificationStateData(
    status: 'not_started',
    selfieDone: false,
    documentDone: false,
  );

  final submittedSteps = <String>[];

  @override
  Future<VerificationStateData> fetchVerification({
    CancelToken? cancelToken,
  }) async {
    return _state;
  }

  @override
  Future<VerificationStateData> submitVerification({
    required String step,
    CancelToken? cancelToken,
  }) async {
    submittedSteps.add(step);
    if (step == 'selfie') {
      _state = const VerificationStateData(
        status: 'selfie_submitted',
        selfieDone: true,
        documentDone: false,
      );
    } else if (step == 'document') {
      _state = const VerificationStateData(
        status: 'under_review',
        selfieDone: true,
        documentDone: true,
      );
    }
    return _state;
  }
}

class _SosRepository extends _AuthFlowRepository {
  final updatedSafety = <Map<String, Object?>>[];

  @override
  Future<SafetyData> fetchSafety({CancelToken? cancelToken}) async {
    return const SafetyData(
      trustScore: 80,
      settings: AppSettingsData(autoSharePlans: true),
    );
  }

  @override
  Future<BackendPage<BackendCardItem>> fetchTrustedContacts({
    CancelToken? cancelToken,
  }) async {
    return const BackendPage(
      items: [
        BackendCardItem(
          id: 'contact-mom',
          title: 'Мама',
          raw: {
            'name': 'Мама',
            'channel': 'phone',
            'value': '+79991230021',
          },
        ),
      ],
    );
  }

  @override
  Future<SafetyData> updateSafety(
    Map<String, Object?> data, {
    CancelToken? cancelToken,
  }) async {
    updatedSafety.add(data);
    return SafetyData(
      trustScore: 80,
      settings: AppSettingsData.fromJson(data),
      raw: {
        'trustScore': 80,
        'settings': data,
      },
    );
  }
}

class _BillingRepository extends _AuthFlowRepository {
  @override
  Future<TokenWalletData> fetchTokenWallet({CancelToken? cancelToken}) async {
    return const TokenWalletData(balance: 700);
  }

  @override
  Future<PaymentsCatalog> fetchPaymentsCatalog({
    CancelToken? cancelToken,
  }) async {
    return const PaymentsCatalog(
      tbankEnabled: true,
      raw: {
        'perks': [
          'Безлимит лайков и свайпов',
          'Кто тебя лайкнул',
          '5 буст-вечеров в месяц',
          'AI-маршруты без лимитов',
        ],
      },
    );
  }

  @override
  Future<List<SubscriptionPlan>> fetchSubscriptionPlans({
    CancelToken? cancelToken,
  }) async {
    return const [
      SubscriptionPlan(
        id: 'm',
        label: '1 месяц',
        tokenCost: 250,
        tokenMonthlyCost: 250,
      ),
      SubscriptionPlan(
        id: 'q',
        label: '3 месяца',
        tokenCost: 600,
        tokenMonthlyCost: 200,
        badge: '−20%',
      ),
      SubscriptionPlan(
        id: 'y',
        label: '12 месяцев',
        tokenCost: 1800,
        tokenMonthlyCost: 150,
        badge: 'Лучшее',
      ),
    ];
  }
}

class _FailingAiBuilderRepository extends _AuthFlowRepository {
  @override
  Future<EveningAiDraftData> createEveningAiDraft({
    required String prompt,
    String? city,
    CancelToken? cancelToken,
  }) async {
    throw StateError('generation failed');
  }
}

class _EmptyHistoryRepository extends _AuthFlowRepository {
  @override
  Future<BackendPage<BackendCardItem>> fetchHistory({
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    return const BackendPage(items: []);
  }
}

class _CountingBillingRepository extends _BillingRepository {
  int walletCalls = 0;
  int catalogCalls = 0;
  int planCalls = 0;

  @override
  Future<TokenWalletData> fetchTokenWallet({CancelToken? cancelToken}) {
    walletCalls += 1;
    return super.fetchTokenWallet(cancelToken: cancelToken);
  }

  @override
  Future<PaymentsCatalog> fetchPaymentsCatalog({CancelToken? cancelToken}) {
    catalogCalls += 1;
    return super.fetchPaymentsCatalog(cancelToken: cancelToken);
  }

  @override
  Future<List<SubscriptionPlan>> fetchSubscriptionPlans({
    CancelToken? cancelToken,
  }) {
    planCalls += 1;
    return super.fetchSubscriptionPlans(cancelToken: cancelToken);
  }
}

Widget _onboardingHarness(_RecordingOnboardingRepository repository) {
  final router = GoRouter(
    initialLocation: '/onboarding',
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (_, __) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/',
        builder: (_, __) => Scaffold(
          body: Center(
            child: Consumer(
              builder: (context, ref, _) {
                final complete =
                    ref.watch(currentUserProvider)?.onboardingComplete;
                return Text('home-opened complete=$complete');
              },
            ),
          ),
        ),
      ),
    ],
  );

  return ProviderScope(
    overrides: [
      backendRepositoryProvider.overrideWithValue(repository),
      currentUserProvider.overrideWith(
        (ref) => const BackendUser(
          id: 'user-1',
          name: 'Алекс',
          onboardingComplete: false,
        ),
      ),
      onboardingProvider.overrideWith(
        (ref) async => repository.fetchOnboarding(),
      ),
    ],
    child: MaterialApp.router(
      theme: DateasyTheme.theme,
      routerConfig: router,
    ),
  );
}

class _MeetingChatRepository extends BackendRepository {
  _MeetingChatRepository() : super(Dio());

  static const _summary = BackendChatSummary(
    id: 'coffee',
    title: 'Speciality coffee tasting',
    kind: 'meetup',
    raw: {
      'id': 'coffee',
      'title': 'Speciality coffee tasting',
      'kind': 'meetup',
      'eventId': 'coffee',
      'status': 'Сегодня',
      'time': '19:30',
      'contextLine': 'Brew Lab, Патрики',
      'memberProfiles': [
        {'userId': 'u-lia', 'name': 'Лия', 'online': true},
        {'userId': 'u-masha', 'name': 'Маша', 'online': true},
        {'userId': 'u-sasha', 'name': 'Саша', 'online': true},
        {'userId': 'u-kirill', 'name': 'Кирилл', 'online': true},
        {'userId': 'u-anya', 'name': 'Аня', 'online': false},
        {
          'userId': 'user-1',
          'name': 'Вы',
          'online': false,
          'isCurrentUser': true,
        },
      ],
    },
  );

  @override
  Future<BackendPage<BackendChatSummary>> fetchMeetupChats({
    CancelToken? cancelToken,
  }) async {
    return const BackendPage(items: [_summary]);
  }

  @override
  Future<BackendPage<BackendChatSummary>> fetchPersonalChats({
    CancelToken? cancelToken,
  }) async {
    return const BackendPage(items: []);
  }

  @override
  Future<BackendPage<BackendChatMessage>> fetchChatMessages(
    String chatId, {
    String? cursor,
    int limit = 20,
    CancelToken? cancelToken,
  }) async {
    return BackendPage(
      items: [
        BackendChatMessage(
          id: 'system-1',
          chatId: chatId,
          text: 'Встреча создана · сегодня 12:04',
          senderName: 'Frendly',
          createdAt: DateTime(2026, 5, 19, 12, 4),
        ),
        BackendChatMessage(
          id: 'message-1',
          chatId: chatId,
          text: 'Привеет! Я хост, очень рада всем 🤍',
          senderId: 'u-lia',
          senderName: 'Лия',
          createdAt: DateTime(2026, 5, 19, 12, 12),
        ),
        BackendChatMessage(
          id: 'message-2',
          chatId: chatId,
          text: 'Огонь, я тогда подтянусь к 19:30 ✌️',
          senderId: 'u-sasha',
          senderName: 'Саша',
          createdAt: DateTime(2026, 5, 19, 12, 18),
        ),
      ],
    );
  }

  @override
  Future<Map<String, Object?>> markChatRead(
    String chatId, {
    required String messageId,
    CancelToken? cancelToken,
  }) async {
    return const {};
  }
}

class _MeetingChatPagedRepository extends _MeetingChatRepository {
  final List<String?> cursors = [];

  @override
  Future<BackendPage<BackendChatMessage>> fetchChatMessages(
    String chatId, {
    String? cursor,
    int limit = 20,
    CancelToken? cancelToken,
  }) async {
    cursors.add(cursor);
    if (cursor == 'older-1') {
      return BackendPage(
        items: [
          BackendChatMessage(
            id: 'older-message',
            chatId: chatId,
            text: 'Самое раннее сообщение',
            senderName: 'Frendly',
            createdAt: DateTime(2026, 5, 19, 11),
            raw: {
              'id': 'older-message',
              'chatId': chatId,
              'text': 'Самое раннее сообщение',
              'senderName': 'Frendly',
              'createdAt': '2026-05-19T11:00:00.000',
            },
          ),
        ],
      );
    }
    return BackendPage(
      nextCursor: 'older-1',
      items: List.generate(
        80,
        (index) => BackendChatMessage(
          id: 'message-$index',
          chatId: chatId,
          text: 'Сообщение $index',
          senderId: index.isEven ? 'u-lia' : 'user-1',
          senderName: index.isEven ? 'Лия' : 'Вы',
          createdAt: DateTime(2026, 5, 19, 12, index),
          raw: {
            'id': 'message-$index',
            'chatId': chatId,
            'text': 'Сообщение $index',
            'senderId': index.isEven ? 'u-lia' : 'user-1',
            'senderName': index.isEven ? 'Лия' : 'Вы',
            'mine': index.isOdd,
            'createdAt': DateTime(2026, 5, 19, 12, index).toIso8601String(),
          },
        ),
      ),
    );
  }
}

class _MeetingDetailRepository extends _AuthFlowRepository {
  @override
  Future<BackendCardItem> fetchEventDetail(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    return BackendCardItem(
      id: eventId,
      title: 'Speciality coffee tasting',
      subtitle: 'Brew Lab, Патрики',
      imageUrl: 'https://example.com/coffee.jpg',
      startsAt: DateTime(2026, 5, 19, 19, 30),
      city: 'Москва',
      latitude: 55.764,
      longitude: 37.592,
      raw: const {
        'description': 'Пробуем 3 фильтра и идем гулять',
        'place': 'Brew Lab, Патрики',
        'going': 4,
        'capacity': 6,
        'chatId': 'chat-coffee',
        'ticketUrl': 'https://tickets.example/coffee',
        'ticketPriceFrom': 490,
        'ticketProvider': 'MTS Live',
        'ticketVenue': 'Brew Lab',
        'partnerName': 'Brew Lab',
        'partnerOffer': '-20% по Frendly',
        'bookingUrl': 'https://book.example/brew',
        'routeId': 'route-1',
        'routePointCount': 3,
        'vibe': 'Coffee',
        'requiresVerification': true,
        'host': {
          'id': 'host-1',
          'displayName': 'Лия',
          'verified': true,
          'rating': 4.9,
          'meetupCount': 12,
          'avatarUrl': 'https://example.com/lia.jpg',
        },
        'attendees': [
          {
            'id': 'user-nina',
            'displayName': 'Нина',
            'avatarUrl': 'https://example.com/nina.jpg',
          },
        ],
        'participantState': 'none',
      },
    );
  }
}

class _EmptyStoriesRepository extends _AuthFlowRepository {
  @override
  Future<BackendPage<BackendCardItem>> fetchEventStories(
    String eventId, {
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    return const BackendPage(items: []);
  }
}

class _ShareRepository extends _MeetingDetailRepository {
  final List<Map<String, String>> createdShares = [];

  @override
  Future<Map<String, Object?>> createShare({
    required String targetType,
    required String targetId,
    CancelToken? cancelToken,
  }) async {
    createdShares.add({'targetType': targetType, 'targetId': targetId});
    return {
      'slug': 'abc',
      'url': 'https://frendly.test/abc',
      'targetType': targetType,
      'targetId': targetId,
    };
  }
}

class _MeetingJoinRequestRepository extends _MeetingDetailRepository {
  bool createdJoinRequest = false;

  @override
  Future<BackendCardItem> fetchEventDetail(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    return _requestEvent(joinRequestStatus: null);
  }

  @override
  Future<BackendCardItem> createJoinRequest(
    String eventId, {
    String? note,
    CancelToken? cancelToken,
  }) async {
    createdJoinRequest = true;
    return _requestEvent(joinRequestStatus: 'pending');
  }

  BackendCardItem _requestEvent({required String? joinRequestStatus}) {
    return BackendCardItem(
      id: 'requested',
      title: 'Closed dinner',
      subtitle: 'Secret Bar',
      startsAt: DateTime(2026, 5, 20, 20),
      city: 'Москва',
      raw: {
        'description': 'Встреча по заявкам',
        'place': 'Secret Bar',
        'accessMode': 'request',
        'joinMode': 'request',
        'joinRequestStatus': joinRequestStatus,
        'participantState': 'none',
        'entryRequirements': const {
          'canJoin': true,
          'missing': <String>[],
        },
      },
    );
  }
}

class _MeetingHostRepository extends _MeetingDetailRepository {
  @override
  Future<BackendCardItem> fetchEventDetail(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    return BackendCardItem(
      id: 'own',
      title: 'Speciality coffee tasting',
      subtitle: 'Brew Lab, Патрики',
      imageUrl: 'https://example.com/coffee.jpg',
      startsAt: DateTime(2026, 5, 19, 19, 30),
      city: 'Москва',
      raw: const {
        'description': 'Моя встреча',
        'place': 'Brew Lab, Патрики',
        'going': 1,
        'capacity': 6,
        'participantState': 'none',
        'host': {
          'id': 'user-1',
          'displayName': 'Алекс',
          'avatarUrl': 'https://example.com/alex.jpg',
        },
      },
    );
  }
}

class _MeetingNoChatRepository extends _MeetingDetailRepository {
  @override
  Future<BackendCardItem> fetchEventDetail(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    final meeting = await super.fetchEventDetail(eventId);
    final raw = Map<String, Object?>.of(meeting.raw)..remove('chatId');
    return BackendCardItem(
      id: meeting.id,
      title: meeting.title,
      subtitle: meeting.subtitle,
      imageUrl: meeting.imageUrl,
      startsAt: meeting.startsAt,
      city: meeting.city,
      latitude: meeting.latitude,
      longitude: meeting.longitude,
      raw: raw,
    );
  }
}

class _MeetingPhotosRepository extends _MeetingDetailRepository {
  @override
  Future<BackendCardItem> fetchEventDetail(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    return BackendCardItem(
      id: 'photos',
      title: 'Photo coffee',
      subtitle: 'Brew Lab',
      startsAt: DateTime(2026, 5, 19, 19, 30),
      raw: const {
        'description': 'Проверяем фото',
        'place': 'Brew Lab',
        'host': {
          'id': 'host-1',
          'displayName': 'Лия',
          'profile': {
            'avatarUrl': 'https://example.com/host-profile.jpg',
          },
        },
        'participants': [
          {
            'user': {
              'id': 'guest-1',
              'displayName': 'Нина',
              'profile': {
                'avatarUrl': 'https://example.com/guest-profile.jpg',
              },
            },
          },
        ],
      },
    );
  }
}

class _MeetingLockedRepository extends _MeetingDetailRepository {
  @override
  Future<BackendCardItem> fetchEventDetail(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    return BackendCardItem(
      id: 'locked',
      title: 'Verified dinner',
      subtitle: 'Secret Bar',
      startsAt: DateTime(2026, 5, 20, 20),
      city: 'Москва',
      raw: const {
        'description': 'Только для проверенных участников',
        'place': 'Secret Bar',
        'accessMode': 'open',
        'participantState': 'none',
        'requiresVerification': true,
        'requiresFrendlyPlus': true,
        'entryRequirements': {
          'canJoin': false,
          'missing': ['verification', 'frendly_plus'],
        },
      },
    );
  }
}

class _MeetingInviteRepository extends _MeetingDetailRepository {
  final List<String> followingEventIds = [];
  final List<String> invitedUserIds = [];

  @override
  Future<BackendCardItem> fetchEventDetail(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    return BackendCardItem(
      id: 'invite',
      title: 'Coffee friends',
      subtitle: 'Brew Lab',
      startsAt: DateTime(2026, 5, 20, 20),
      city: 'Москва',
      raw: const {
        'description': 'Встреча для друзей',
        'place': 'Brew Lab',
        'participantState': 'joined',
      },
    );
  }

  @override
  Future<BackendPage<BackendCardItem>> fetchFollowingPeople({
    required String eventId,
    String? q,
    String? cursor,
    int limit = 20,
    CancelToken? cancelToken,
  }) async {
    followingEventIds.add(eventId);
    return const BackendPage(
      items: [
        BackendCardItem(
          id: 'friend-1',
          title: 'Нина',
          subtitle: 'Кофе и прогулки',
          imageUrl: 'https://example.com/nina.jpg',
          raw: {
            'inviteState': 'available',
          },
        ),
      ],
    );
  }

  @override
  Future<Map<String, Object?>> inviteUserToEvent(
    String eventId,
    String userId, {
    CancelToken? cancelToken,
  }) async {
    invitedUserIds.add(userId);
    return const {'inviteState': 'pending_invite'};
  }
}

class _MeetingInviteSearchRepository extends _MeetingInviteRepository {
  final List<String?> queries = [];
  final List<CancelToken> cancelTokens = [];
  final List<Completer<BackendPage<BackendCardItem>>> _requests = [];

  @override
  Future<BackendPage<BackendCardItem>> fetchFollowingPeople({
    required String eventId,
    String? q,
    String? cursor,
    int limit = 20,
    CancelToken? cancelToken,
  }) {
    queries.add(q);
    if (cancelToken != null) {
      cancelTokens.add(cancelToken);
    }
    final completer = Completer<BackendPage<BackendCardItem>>();
    _requests.add(completer);
    return completer.future;
  }

  void completeAll() {
    for (final request in _requests) {
      if (!request.isCompleted) {
        request.complete(const BackendPage(items: []));
      }
    }
  }
}

class _MeetingInvitePagedRepository extends _MeetingInviteRepository {
  final List<String?> cursors = [];

  @override
  Future<BackendPage<BackendCardItem>> fetchFollowingPeople({
    required String eventId,
    String? q,
    String? cursor,
    int limit = 20,
    CancelToken? cancelToken,
  }) async {
    cursors.add(cursor);
    if (cursor == 'next-1') {
      return const BackendPage(
        items: [
          BackendCardItem(
            id: 'friend-25',
            title: 'Друг 25',
            raw: {'inviteState': 'available'},
          ),
        ],
      );
    }
    return BackendPage(
      nextCursor: 'next-1',
      items: List.generate(
        25,
        (index) => BackendCardItem(
          id: 'friend-$index',
          title: 'Друг $index',
          raw: const {'inviteState': 'available'},
        ),
      ),
    );
  }
}

class _PublicProfileRepository extends _AuthFlowRepository {
  final List<String> likedUserIds = [];
  final List<String> followActions = [];
  final List<String> notificationActions = [];
  int directChatRequests = 0;

  @override
  Future<BackendCardItem> fetchPublicUser(
    String userId, {
    CancelToken? cancelToken,
  }) async {
    return const BackendCardItem(
      id: 'user-nina',
      title: 'Нина',
      imageUrl: 'https://example.com/nina.jpg',
      raw: {
        'id': 'user-nina',
        'displayName': 'Нина',
        'verified': true,
        'online': true,
        'age': 26,
        'bio': 'Дизайнер из Москвы',
        'distanceKm': 1.2,
        'meetupCount': 32,
        'rating': 4.9,
        'interests': [
          'Speciality coffee',
          'Винил',
          'Галереи',
        ],
        'photos': [
          {'url': 'https://example.com/nina-1.jpg'},
          {'url': 'https://example.com/nina-2.jpg'},
        ],
        'social': {
          'liked': false,
          'followers': 32,
          'iFollow': false,
          'followNotifications': false,
        },
      },
    );
  }

  @override
  Future<Map<String, Object?>> createDirectChat(
    String userId, {
    CancelToken? cancelToken,
  }) async {
    directChatRequests += 1;
    return const {'id': 'direct-chat-nina'};
  }

  @override
  Future<Map<String, Object?>> setProfileReaction({
    required String userId,
    required String kind,
    required bool active,
    CancelToken? cancelToken,
  }) async {
    if (kind == 'like' && active) {
      likedUserIds.add(userId);
    }
    return const {
      'liked': true,
    };
  }

  @override
  Future<ProfileSocialData> fetchProfileSocial(
    String userId, {
    CancelToken? cancelToken,
  }) async {
    return const ProfileSocialData(
      followers: 32,
      likes: 0,
      superLikes: 0,
      iFollow: false,
      iLike: false,
      iSuper: false,
      followNotifications: false,
      raw: {
        'followers': 32,
        'likes': 0,
        'superLikes': 0,
        'iFollow': false,
        'iLike': false,
        'iSuper': false,
        'followNotifications': false,
      },
    );
  }

  @override
  Future<ProfileSocialData> setProfileFollow({
    required String userId,
    required bool active,
    CancelToken? cancelToken,
  }) async {
    followActions.add('$userId:$active');
    return const ProfileSocialData(
      followers: 33,
      likes: 0,
      superLikes: 0,
      iFollow: true,
      iLike: false,
      iSuper: false,
      followNotifications: true,
      raw: {
        'followers': 33,
        'likes': 0,
        'superLikes': 0,
        'iFollow': true,
        'iLike': false,
        'iSuper': false,
        'followNotifications': true,
      },
    );
  }

  @override
  Future<ProfileSocialData> setProfileFollowNotifications({
    required String userId,
    required bool enabled,
    CancelToken? cancelToken,
  }) async {
    notificationActions.add('$userId:$enabled');
    return ProfileSocialData(
      followers: 33,
      likes: 0,
      superLikes: 0,
      iFollow: true,
      iLike: false,
      iSuper: false,
      followNotifications: enabled,
      raw: {
        'followers': 33,
        'likes': 0,
        'superLikes': 0,
        'iFollow': true,
        'iLike': false,
        'iSuper': false,
        'followNotifications': enabled,
      },
    );
  }
}

class _SettingsRepository extends _AuthFlowRepository {
  final List<Map<String, Object?>> updatedSettings = [];

  @override
  Future<AppSettingsData> updateSettings(
    Map<String, Object?> data, {
    CancelToken? cancelToken,
  }) async {
    updatedSettings.add(data);
    return AppSettingsData.fromJson({
      'allowPush': true,
      'discoverable': data['discoverable'] ?? true,
      'showAge': data['showAge'] ?? true,
      'darkMode': data['darkMode'] ?? true,
    });
  }
}

class _RecordingOnboardingRepository extends BackendRepository {
  _RecordingOnboardingRepository({
    this.fetchMeAfterSaveReturnsIncomplete = false,
  }) : super(Dio());

  final bool fetchMeAfterSaveReturnsIncomplete;
  final List<String> placeQueries = [];
  OnboardingData? saved;

  @override
  Future<OnboardingData> fetchOnboarding({CancelToken? cancelToken}) async {
    return const OnboardingData();
  }

  @override
  Future<BackendPage<BackendCardItem>> searchPlaces({
    required String query,
    String? city,
    int limit = 20,
    CancelToken? cancelToken,
  }) async {
    placeQueries.add(query);
    return const BackendPage(
      items: [
        BackendCardItem(
          id: 'place-1',
          title: 'Кофейня на Покровке',
          subtitle: 'Покровка 17',
          city: 'Москва',
          latitude: 55.757,
          longitude: 37.648,
        ),
      ],
    );
  }

  @override
  Future<OnboardingData> saveOnboarding(
    OnboardingData data, {
    CancelToken? cancelToken,
  }) async {
    saved = data;
    return data;
  }

  @override
  Future<BackendUser> fetchMe({CancelToken? cancelToken}) async {
    return BackendUser(
      id: 'user-1',
      name: 'Алекс',
      onboardingComplete: !fetchMeAfterSaveReturnsIncomplete,
      city: saved?.city,
    );
  }

  @override
  Future<Map<String, Object?>> checkOnboardingContact({
    String? email,
    String? phoneNumber,
    CancelToken? cancelToken,
  }) async {
    return const {'available': true};
  }
}

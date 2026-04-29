import 'dart:typed_data';

import 'package:big_break_mobile/app/core/device/app_media_picker_service.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/features/add_photo/presentation/add_photo_screen.dart';
import 'package:big_break_mobile/features/edit_profile/presentation/edit_profile_screen.dart';
import 'package:big_break_mobile/features/profile/presentation/profile_screen.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/onboarding_data.dart';
import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../../test_overrides.dart';

class _FakeMediaPickerService implements AppMediaPickerService {
  var cameraCalls = 0;
  var galleryCalls = 0;
  var multiGalleryCalls = 0;
  List<PlatformFile>? galleryFiles;

  @override
  Future<PlatformFile?> pickFromCamera() async {
    cameraCalls += 1;
    return PlatformFile(
      name: 'camera.jpg',
      size: _pngBytes.length,
      bytes: Uint8List.fromList(_pngBytes),
      path: '/tmp/camera.jpg',
    );
  }

  @override
  Future<PlatformFile?> pickFromGallery() async {
    galleryCalls += 1;
    return PlatformFile(
      name: 'gallery.jpg',
      size: _pngBytes.length,
      bytes: Uint8List.fromList(_pngBytes),
      path: '/tmp/gallery.jpg',
    );
  }

  @override
  Future<List<PlatformFile>> pickMultipleFromGallery(
      {required int limit}) async {
    multiGalleryCalls += 1;
    return galleryFiles ??
        [
          PlatformFile(
            name: 'gallery.jpg',
            size: _pngBytes.length,
            bytes: Uint8List.fromList(_pngBytes),
            path: '/tmp/gallery.jpg',
          ),
        ];
  }
}

class _FakeAvatarRepository extends BackendRepository {
  _FakeAvatarRepository({
    required super.ref,
    required super.dio,
  });

  Map<String, dynamic>? lastProfilePayload;
  var updateProfileCalls = 0;

  var uploadedPhotos = 0;

  @override
  Future<ProfilePhoto> uploadProfilePhotoFile(PlatformFile file) async {
    uploadedPhotos += 1;
    return ProfilePhoto(
      id: 'ph$uploadedPhotos',
      url: 'https://cdn.example.com/ph$uploadedPhotos.jpg',
      order: uploadedPhotos - 1,
    );
  }

  @override
  Future<ProfileData> updateProfile(Map<String, dynamic> payload) async {
    updateProfileCalls += 1;
    lastProfilePayload = payload;
    return fetchProfile();
  }

  @override
  Future<ProfileData> fetchProfile() async {
    return const ProfileData(
      id: 'user-me',
      displayName: 'Никита М',
      verified: true,
      online: true,
      age: 28,
      city: 'Москва',
      area: 'Чистые пруды',
      bio: 'bio',
      vibe: 'Спокойно',
      rating: 4.8,
      meetupCount: 12,
      avatarUrl: null,
      interests: ['Кофе'],
      intent: ['Друзья'],
    );
  }

  @override
  Future<OnboardingData> saveOnboarding(OnboardingData data) async => data;
}

Widget _wrap(
  _FakeMediaPickerService mediaPickerService,
  void Function(_FakeAvatarRepository repository)? onRepository,
) {
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => ProviderScope(
          overrides: [
            ...buildTestOverrides(),
            appMediaPickerServiceProvider.overrideWithValue(mediaPickerService),
            backendRepositoryProvider.overrideWith(
              (ref) {
                final repository = _FakeAvatarRepository(ref: ref, dio: Dio());
                onRepository?.call(repository);
                return repository;
              },
            ),
          ],
          child: const AddPhotoScreen(),
        ),
      ),
      GoRoute(
        path: AppRoute.tonight.path,
        name: AppRoute.tonight.name,
        builder: (context, state) => const SizedBox.shrink(),
      ),
      GoRoute(
        path: AppRoute.onboarding.path,
        name: AppRoute.onboarding.name,
        builder: (context, state) => const SizedBox.shrink(),
      ),
      GoRoute(
        path: AppRoute.verification.path,
        name: AppRoute.verification.name,
        builder: (context, state) => const SizedBox.shrink(),
      ),
    ],
  );

  return MaterialApp.router(routerConfig: router);
}

Future<void> _tapActionButton(WidgetTester tester, Key key) async {
  await tester.scrollUntilVisible(
    find.byKey(key),
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.drag(
    find.byType(Scrollable).first,
    const Offset(0, -120),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(key), warnIfMissed: false);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('add photo uses camera and gallery actions separately',
      (tester) async {
    final mediaPickerService = _FakeMediaPickerService();

    await tester.pumpWidget(_wrap(mediaPickerService, null));
    await tester.pumpAndSettle();

    await _tapActionButton(tester, const Key('add-photo-camera-action'));
    await _tapActionButton(tester, const Key('add-photo-gallery-action'));

    expect(mediaPickerService.cameraCalls, 1);
    expect(mediaPickerService.multiGalleryCalls, 1);
  });

  testWidgets('add photo continues to onboarding after avatar upload',
      (tester) async {
    final mediaPickerService = _FakeMediaPickerService();

    await tester.pumpWidget(_wrap(mediaPickerService, null));
    await tester.pumpAndSettle();

    await _tapActionButton(tester, const Key('add-photo-camera-action'));

    await tester.scrollUntilVisible(
      find.byKey(const Key('add-photo-name-field')),
      -200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(
        find.byKey(const Key('add-photo-name-field')), 'Никита');
    await tester.pumpAndSettle();

    await tester.tap(find.text('Готово'));
    await tester.pumpAndSettle();

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    final router = app.routerConfig! as GoRouter;
    expect(router.routeInformationProvider.value.uri.path, '/onboarding');
  });

  testWidgets('add photo shows preview right after upload', (tester) async {
    final mediaPickerService = _FakeMediaPickerService();

    await tester.pumpWidget(_wrap(mediaPickerService, null));
    await tester.pumpAndSettle();

    await _tapActionButton(tester, const Key('add-photo-camera-action'));

    expect(find.byType(Image), findsWidgets);
  });

  testWidgets('add photo can accumulate several uploaded photos',
      (tester) async {
    final mediaPickerService = _FakeMediaPickerService();

    await tester.pumpWidget(_wrap(mediaPickerService, null));
    await tester.pumpAndSettle();

    await _tapActionButton(tester, const Key('add-photo-camera-action'));
    await _tapActionButton(tester, const Key('add-photo-gallery-action'));

    await tester.fling(
        find.byType(Scrollable).first, const Offset(0, 300), 1000);
    await tester.pumpAndSettle();

    expect(find.text('2/2'), findsOneWidget);
  });

  testWidgets('add photo uploads several gallery photos but keeps max five',
      (tester) async {
    final mediaPickerService = _FakeMediaPickerService()
      ..galleryFiles = List<PlatformFile>.generate(
        6,
        (index) => PlatformFile(
          name: 'gallery-$index.jpg',
          size: _pngBytes.length,
          bytes: Uint8List.fromList(_pngBytes),
          path: '/tmp/gallery-$index.jpg',
        ),
      );
    _FakeAvatarRepository? repository;

    await tester.pumpWidget(
      _wrap(mediaPickerService, (value) => repository = value),
    );
    await tester.pumpAndSettle();

    await _tapActionButton(tester, const Key('add-photo-gallery-action'));

    await tester.fling(
        find.byType(Scrollable).first, const Offset(0, 300), 1000);
    await tester.pumpAndSettle();

    expect(mediaPickerService.multiGalleryCalls, 1);
    expect(mediaPickerService.galleryCalls, 0);
    expect(repository?.uploadedPhotos, 5);
    expect(find.text('5/5'), findsOneWidget);
  });

  testWidgets('add photo saves entered display name before onboarding',
      (tester) async {
    final mediaPickerService = _FakeMediaPickerService();
    _FakeAvatarRepository? repository;

    await tester.pumpWidget(
      _wrap(mediaPickerService, (value) => repository = value),
    );
    await tester.pumpAndSettle();

    await _tapActionButton(tester, const Key('add-photo-camera-action'));
    await tester.scrollUntilVisible(
      find.byKey(const Key('add-photo-name-field')),
      -200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(
        find.byKey(const Key('add-photo-name-field')), 'Сергей');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Готово'));
    await tester.pumpAndSettle();

    expect(repository, isNotNull);
    expect(repository!.lastProfilePayload?['displayName'], 'Сергей');
  });

  testWidgets('profile screen shows just uploaded onboarding photo', (
    tester,
  ) async {
    final mediaPickerService = _FakeMediaPickerService();
    final container = ProviderContainer(
      overrides: [
        ...buildTestOverrides(),
        appMediaPickerServiceProvider.overrideWithValue(mediaPickerService),
        backendRepositoryProvider.overrideWith(
          (ref) => _FakeAvatarRepository(ref: ref, dio: Dio()),
        ),
        profileProvider.overrideWith((ref) async {
          final profile =
              await ref.read(backendRepositoryProvider).fetchProfile();
          final draftPhotos = ref.watch(profilePhotoDraftProvider);
          return mergeProfileDraftPhotos(profile, draftPhotos);
        }),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: AddPhotoScreen()),
      ),
    );
    await tester.pumpAndSettle();

    await _tapActionButton(tester, const Key('add-photo-camera-action'));

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: ProfileScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('profile-photo-gallery-pageview')),
      findsOneWidget,
    );
    expect(find.text('1/1'), findsOneWidget);
    expect(find.byType(Image), findsWidgets);
  });

  testWidgets('edit profile saves after adding a photo', (tester) async {
    final mediaPickerService = _FakeMediaPickerService();
    _FakeAvatarRepository? repository;

    await tester.pumpWidget(
      MaterialApp.router(
        routerConfig: GoRouter(
          initialLocation: '/',
          routes: [
            GoRoute(
              path: '/',
              builder: (context, state) => ProviderScope(
                overrides: [
                  ...buildTestOverrides(),
                  appMediaPickerServiceProvider.overrideWithValue(
                    mediaPickerService,
                  ),
                  backendRepositoryProvider.overrideWith(
                    (ref) {
                      final value = _FakeAvatarRepository(ref: ref, dio: Dio());
                      repository = value;
                      return value;
                    },
                  ),
                ],
                child: const EditProfileScreen(),
              ),
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.add_rounded).first, warnIfMissed: false);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Готово'));
    await tester.pumpAndSettle();

    expect(repository, isNotNull);
    expect(repository!.uploadedPhotos, 1);
    expect(repository!.updateProfileCalls, 1);
  });
}

const _pngBytes = <int>[
  0x89,
  0x50,
  0x4E,
  0x47,
  0x0D,
  0x0A,
  0x1A,
  0x0A,
  0x00,
  0x00,
  0x00,
  0x0D,
  0x49,
  0x48,
  0x44,
  0x52,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01,
  0x08,
  0x06,
  0x00,
  0x00,
  0x00,
  0x1F,
  0x15,
  0xC4,
  0x89,
  0x00,
  0x00,
  0x00,
  0x0D,
  0x49,
  0x44,
  0x41,
  0x54,
  0x78,
  0x9C,
  0x63,
  0xF8,
  0xCF,
  0xC0,
  0x00,
  0x00,
  0x03,
  0x01,
  0x01,
  0x00,
  0xC9,
  0xFE,
  0x92,
  0xEF,
  0x00,
  0x00,
  0x00,
  0x00,
  0x49,
  0x45,
  0x4E,
  0x44,
  0xAE,
  0x42,
  0x60,
  0x82,
];

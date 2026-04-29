import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:big_break_mobile/shared/widgets/bb_profile_photo_gallery.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('gallery shows page counter and reacts to swipe', (tester) async {
    const photos = [
      ProfilePhoto(
        id: 'ph1',
        url: 'https://cdn.example.com/ph1.jpg',
        order: 0,
      ),
      ProfilePhoto(
        id: 'ph2',
        url: 'https://cdn.example.com/ph2.jpg',
        order: 1,
      ),
    ];

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: BbProfilePhotoGallery(
            displayName: 'Аня К',
            photos: photos,
          ),
        ),
      ),
    );

    expect(find.text('1/2'), findsOneWidget);

    await tester.fling(
      find.byKey(const ValueKey('profile-photo-gallery-pageview')),
      const Offset(-600, 0),
      1200,
    );
    await tester.pumpAndSettle();

    expect(find.text('2/2'), findsOneWidget);
  });
}

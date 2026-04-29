import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('chat attachment image resolves local file before remote url', () {
    final source = File(
      'lib/shared/widgets/bb_chat_attachment_image.dart',
    ).readAsStringSync();

    expect(source, contains('resolveLocalPath'));
    expect(source, contains('resolveRemoteUrl'));
    expect(
      source.indexOf('resolveLocalPath'),
      lessThan(source.indexOf('resolveRemoteUrl')),
    );
  });

  test('chat screens use shared attachment image viewer', () {
    final personalChat = File(
      'lib/features/personal_chat/presentation/personal_chat_screen.dart',
    ).readAsStringSync();
    final meetupChat = File(
      'lib/features/meetup_chat/presentation/meetup_chat_screen.dart',
    ).readAsStringSync();

    for (final source in [personalChat, meetupChat]) {
      expect(source, contains('BbChatAttachmentImage'));
      expect(source, isNot(contains('CachedNetworkImage')));
    }
  });
}

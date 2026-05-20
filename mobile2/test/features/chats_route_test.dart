import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/features/chats/presentation/chats_screen.dart';
import 'package:mobile2/shared/models/backend_models.dart';

void main() {
  test('personal chat rows open the personal chat route', () {
    const summary = BackendChatSummary(
      id: 'direct-1',
      title: 'Nina',
      kind: 'personal',
    );

    expect(chatRouteForSummary(summary), '/chats/direct-1');
  });

  test('meetup chat rows keep the meetup chat route', () {
    const summary = BackendChatSummary(
      id: 'meetup-1',
      title: 'Coffee',
      kind: 'meetup',
    );

    expect(chatRouteForSummary(summary), '/meetings/meetup-1/chat');
  });
}

import 'package:big_break_mobile/shared/data/mock_data.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('mock events list is not empty', () {
    expect(mockEvents, isNotEmpty);
  });

  test('mock meetup chats list is not empty', () {
    expect(mockMeetupChats, isNotEmpty);
  });

  test('mock meetup chats include front-parity phase examples', () {
    expect(
      mockMeetupChats.any((chat) =>
          chat.phase == MeetupPhase.live &&
          chat.currentStep != null &&
          chat.currentPlace != null),
      isTrue,
    );
    expect(
      mockMeetupChats.any((chat) =>
          chat.phase == MeetupPhase.soon &&
          chat.startsInLabel != null &&
          chat.routeId != null),
      isTrue,
    );
    expect(
      mockMeetupChats.any((chat) => chat.phase == MeetupPhase.upcoming),
      isTrue,
    );
  });
}

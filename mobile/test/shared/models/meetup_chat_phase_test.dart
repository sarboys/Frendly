import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('meetup chat parses evening phase metadata from backend', () {
    final chat = MeetupChat.fromJson(const {
      'id': 'evening-chat-r-cozy-circle',
      'eventId': null,
      'title': 'Теплый круг на Покровке',
      'emoji': '🍇',
      'time': '19:00',
      'lastMessage': 'Стартуем через час',
      'lastAuthor': 'Frendly',
      'lastTime': 'сейчас',
      'unread': 2,
      'members': ['Ты', 'Аня К'],
      'phase': 'live',
      'currentStep': 2,
      'totalSteps': 4,
      'currentPlace': 'Standup Store',
      'endTime': '22:00',
      'startsInLabel': null,
      'routeId': 'r-cozy-circle',
      'mode': 'hybrid',
      'privacy': 'request',
      'joinedCount': 5,
      'maxGuests': 10,
      'hostUserId': 'user-anya',
      'hostName': 'Аня К',
      'area': 'Покровка',
    });

    expect(chat.phase, MeetupPhase.live);
    expect(chat.currentStep, 2);
    expect(chat.totalSteps, 4);
    expect(chat.currentPlace, 'Standup Store');
    expect(chat.endTime, '22:00');
    expect(chat.routeId, 'r-cozy-circle');
    expect(chat.mode, EveningLaunchMode.hybrid);
    expect(chat.privacy, EveningPrivacy.request);
    expect(chat.joinedCount, 5);
    expect(chat.maxGuests, 10);
    expect(chat.hostUserId, 'user-anya');
    expect(chat.hostName, 'Аня К');
    expect(chat.area, 'Покровка');
  });

  test('unknown meetup phase falls back to upcoming', () {
    final chat = MeetupChat.fromJson(const {
      'id': 'mc1',
      'title': 'Встреча',
      'emoji': '🍷',
      'time': '20:00',
      'lastMessage': '',
      'lastAuthor': '',
      'lastTime': '',
      'unread': 0,
      'members': [],
      'phase': 'other',
    });

    expect(chat.phase, MeetupPhase.upcoming);
  });

  test('meetupPhase backend field is accepted as a phase fallback', () {
    final chat = MeetupChat.fromJson(const {
      'id': 'evening-chat-r-date-noir',
      'title': 'Свидание Noir',
      'emoji': '🎬',
      'time': '20:00',
      'lastMessage': '',
      'lastAuthor': '',
      'lastTime': '',
      'unread': 0,
      'members': [],
      'meetupPhase': 'soon',
    });

    expect(chat.phase, MeetupPhase.soon);
  });

  test('unknown evening privacy falls back to open', () {
    final chat = MeetupChat.fromJson(const {
      'id': 'evening-chat-r-date-noir',
      'title': 'Свидание Noir',
      'emoji': '🎬',
      'time': '20:00',
      'lastMessage': '',
      'lastAuthor': '',
      'lastTime': '',
      'unread': 0,
      'members': [],
      'privacy': 'friends',
    });

    expect(chat.privacy, EveningPrivacy.open);
  });
}

import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('evening session summary parses backend payload', () {
    final session = EveningSessionSummary.fromJson(const {
      'id': 'session-1',
      'sessionId': 'session-1',
      'routeId': 'r-cozy-circle',
      'chatId': 'chat-1',
      'phase': 'live',
      'chatPhase': 'live',
      'privacy': 'request',
      'title': 'Теплый круг',
      'vibe': 'Камерно',
      'emoji': '🍷',
      'area': 'Покровка',
      'hostUserId': 'user-anya',
      'hostName': 'Аня К',
      'joinedCount': 5,
      'maxGuests': 10,
      'currentStep': 2,
      'totalSteps': 3,
      'currentPlace': 'Brix Wine',
      'lat': 55.7601,
      'lng': 37.6401,
      'endTime': '21:30',
      'startsAt': '2026-04-26T16:00:00.000Z',
      'inviteToken': 'host-token',
      'isJoined': true,
      'isRequested': true,
    });

    expect(session.id, 'session-1');
    expect(session.phase, EveningSessionPhase.live);
    expect(session.chatPhase, MeetupPhase.live);
    expect(session.privacy, EveningPrivacy.request);
    expect(session.joinedCount, 5);
    expect(session.maxGuests, 10);
    expect(session.hostUserId, 'user-anya');
    expect(session.inviteToken, 'host-token');
    expect(session.isJoined, isTrue);
    expect(session.isRequested, isTrue);
    expect(session.lat, 55.7601);
    expect(session.lng, 37.6401);
  });

  test('evening session detail parses participants and steps', () {
    final detail = EveningSessionDetail.fromJson(const {
      'id': 'session-1',
      'routeId': 'r-cozy-circle',
      'chatId': 'chat-1',
      'phase': 'scheduled',
      'chatPhase': 'soon',
      'privacy': 'open',
      'title': 'Теплый круг',
      'participants': [
        {
          'userId': 'user-anya',
          'name': 'Аня К',
          'role': 'host',
          'status': 'joined',
        }
      ],
      'steps': [
        {
          'id': 's1',
          'time': '19:00',
          'endTime': '20:15',
          'kind': 'bar',
          'title': 'Аперитив',
          'venue': 'Backend Wine',
          'address': 'Покровка 12',
          'emoji': '🍷',
          'status': 'current',
          'checkedIn': true,
          'startedAt': '2026-04-26T16:00:00.000Z',
        }
      ],
      'pendingRequests': [
        {
          'id': 'request-1',
          'userId': 'user-ira',
          'name': 'Ира',
          'status': 'requested',
          'note': 'Хочу познакомиться с ребятами',
        }
      ],
    });

    expect(detail.participants.single.role, 'host');
    expect(detail.steps.single.venue, 'Backend Wine');
    expect(detail.steps.single.status, 'current');
    expect(detail.steps.single.checkedIn, isTrue);
    expect(detail.steps.single.startedAt, '2026-04-26T16:00:00.000Z');
    expect(detail.pendingRequests.single.name, 'Ира');
    expect(detail.phase, EveningSessionPhase.scheduled);
  });
}

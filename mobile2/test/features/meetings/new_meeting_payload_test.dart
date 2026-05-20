import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/features/meetings/presentation/new_meeting_screen.dart';
import 'package:mobile2/shared/models/backend_models.dart';

void main() {
  test('builds legacy create source payload from query params', () {
    expect(
      buildNewMeetingSourcePayload(
        inviteeUserId: ' u1 ',
        sourceChatId: ' chat-1 ',
        communityId: ' club-1 ',
        routeId: ' route-1 ',
      ),
      {
        'inviteeUserId': 'u1',
        'sourceChatId': 'chat-1',
        'communityId': 'club-1',
        'routeId': 'route-1',
      },
    );
  });

  test('builds create event base payload for backend contract', () {
    final payload = buildNewMeetingBasePayload(
      title: 'Кофе',
      description: 'Встречаемся после работы',
      vibe: 'Кофе',
      place: 'Duo',
      address: 'Рубинштейна 20',
      startsAt: DateTime.utc(2026, 5, 20, 16),
      capacity: 6,
      gender: 'any',
      visibility: 'private',
    );

    expect(payload, {
      'title': 'Кофе',
      'description': 'Встречаемся после работы',
      'vibe': 'Кофе',
      'place': 'Duo, Рубинштейна 20',
      'startsAt': '2026-05-20T16:00:00.000Z',
      'capacity': 6,
      'genderMode': 'all',
      'visibility': 'private',
      'accessMode': 'request',
      'priceMode': 'free',
    });
  });

  test('validates create meeting draft before publish', () {
    expect(
      validateNewMeetingDraft(
        title: '',
        description: 'Описание',
        place: 'Duo',
        startsAt: DateTime.utc(2026, 5, 20, 16),
      ),
      NewMeetingDraftValidation.missingRequired,
    );
    expect(
      validateNewMeetingDraft(
        title: 'Кофе',
        description: 'Описание',
        place: 'Duo',
        startsAt: null,
      ),
      NewMeetingDraftValidation.invalidDateTime,
    );
    expect(
      validateNewMeetingDraft(
        title: 'Кофе',
        description: 'Описание',
        place: 'Duo',
        startsAt: DateTime.utc(2026, 5, 20, 16),
      ),
      NewMeetingDraftValidation.valid,
    );
  });

  test('attached route overrides query route source', () {
    expect(
      buildNewMeetingSourcePayload(
        routeId: 'route-from-query',
        attachedRouteId: 'route-from-picker',
      ),
      {
        'routeId': 'route-from-picker',
      },
    );
  });

  test('builds route source prefill draft from route detail', () {
    final draft = buildNewMeetingRoutePrefill(
      const BackendCardItem(
        id: 'route-1',
        title: 'Барный маршрут',
        subtitle: 'Центр',
        raw: {
          'area': 'Центр',
          'durationLabel': '2 часа',
          'blurb': 'Три места рядом, без долгих переходов',
        },
      ),
    );

    expect(draft.id, 'route-1');
    expect(draft.attachedTitle, 'Барный маршрут');
    expect(draft.attachedSubtitle, 'Центр · 2 часа');
    expect(draft.title, 'Барный маршрут');
    expect(draft.description, 'Три места рядом, без долгих переходов');
    expect(draft.place, 'Барный маршрут');
    expect(draft.address, 'Центр');
  });

  test('builds affiche source prefill draft from poster detail', () {
    final draft = buildNewMeetingAffichePrefill(
      BackendCardItem(
        id: 'poster-1',
        title: 'Джаз вечер',
        startsAt: DateTime(2026, 5, 20, 19, 30),
        raw: const {
          'description': 'Живая музыка и кофе',
          'venueName': 'Клуб 44',
          'place': {'address': 'Невский 10'},
        },
      ),
    );

    expect(draft.id, 'poster-1');
    expect(draft.attachedTitle, 'Джаз вечер');
    expect(draft.attachedSubtitle, '20.5 · 19:30 · Клуб 44');
    expect(draft.title, 'Идем на Джаз вечер');
    expect(draft.description, 'Живая музыка и кофе');
    expect(draft.dateInput, '2026-05-20');
    expect(draft.timeInput, '19:30');
    expect(draft.place, 'Клуб 44');
    expect(draft.address, 'Невский 10');
  });

  test('debounces place search query before provider reads it', () {
    final timers = <_FakeTimer>[];
    final debouncer = NewMeetingPlaceSearchDebouncer(
      delay: const Duration(milliseconds: 300),
      timerFactory: (_, callback) {
        final timer = _FakeTimer(callback);
        timers.add(timer);
        return timer;
      },
    );
    addTearDown(debouncer.dispose);

    debouncer.update('b');
    expect(debouncer.query, '');

    debouncer.update('bar  ');
    expect(timers.first.isActive, false);
    expect(debouncer.query, '');

    timers.last.fire();
    expect(debouncer.query, 'bar');
  });

  test('keeps one create idempotency key for draft retries', () {
    var tick = 1000;
    final draftKey = NewMeetingCreateIdempotency(
      timestampFactory: () => tick++,
    );

    final first = draftKey.currentKey();
    final retry = draftKey.currentKey();

    expect(first, 'mobile2-1000');
    expect(retry, first);
    expect(tick, 1001);
  });
}

class _FakeTimer implements Timer {
  _FakeTimer(this._callback);

  final void Function() _callback;
  var _active = true;

  void fire() {
    if (!_active) {
      return;
    }
    _active = false;
    _callback();
  }

  @override
  void cancel() {
    _active = false;
  }

  @override
  bool get isActive => _active;

  @override
  int get tick => 0;
}

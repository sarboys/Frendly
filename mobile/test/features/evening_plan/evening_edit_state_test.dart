import 'package:big_break_mobile/features/evening_plan/presentation/evening_edit_state.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_plan_data.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('edit policy allows everything before live', () {
    final policy = EveningEditPolicy.forPhase(MeetupPhase.soon);

    expect(policy.meta, isTrue);
    expect(policy.stepEditable(0, currentStep: 2), isTrue);
    expect(policy.addStep, isTrue);
    expect(policy.removeStep, isTrue);
    expect(policy.reorderStep, isTrue);
  });

  test('edit policy freezes meta and past steps during live', () {
    final policy = EveningEditPolicy.forPhase(MeetupPhase.live);

    expect(policy.meta, isFalse);
    expect(policy.stepEditable(0, currentStep: 2), isFalse);
    expect(policy.stepEditable(2, currentStep: 2), isTrue);
    expect(policy.addStep, isTrue);
  });

  test('edit policy is readonly after done', () {
    final policy = EveningEditPolicy.forPhase(MeetupPhase.done);

    expect(policy.meta, isFalse);
    expect(policy.stepEditable(2, currentStep: 2), isFalse);
    expect(policy.addStep, isFalse);
    expect(policy.removeStep, isFalse);
    expect(policy.reorderStep, isFalse);
  });

  test('diff lists meta and step changes for chat system message', () {
    final previous = eveningRoutes.first;
    final next = previous.copyWith(
      title: 'Новый тёплый круг',
      area: 'Покровка',
      steps: [
        previous.steps.first.copyWith(
          time: '19:30',
          venue: 'Brix Wine Bar',
          ticketPrice: 500,
        ),
        ...previous.steps.skip(1),
      ],
    );

    final diff = buildEveningEditDiff(
      previous: EveningEditSnapshot(
        route: previous,
        privacy: EveningPrivacy.open,
        maxGuests: 8,
      ),
      next: EveningEditSnapshot(
        route: next,
        privacy: EveningPrivacy.request,
        maxGuests: null,
      ),
    );

    expect(
      diff,
      contains('Название: «Тёплый круг на Покровке» → «Новый тёплый круг»'),
    );
    expect(diff, contains('Район: Чистые пруды → Покровка → Покровка'));
    expect(diff, contains('Доступ: открытый → по заявке'));
    expect(diff, contains('Лимит мест: 8 → без лимита'));
    expect(diff.any((line) => line.startsWith('Шаг 1:')), isTrue);
  });

  test('next time adds thirty minutes', () {
    expect(nextEveningStepTime('21:45'), '22:15');
    expect(nextEveningStepTime('23:45'), '00:15');
    expect(nextEveningStepTime('Завтра'), '21:00');
  });
}

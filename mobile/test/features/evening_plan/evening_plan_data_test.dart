import 'package:big_break_mobile/features/evening_plan/presentation/evening_plan_data.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('evening plan static data keeps front copy parity', () {
    final cozy = eveningRoutes.first;
    final date = eveningRoutes.firstWhere((route) => route.id == 'r-date-noir');
    final followUp = cozy.steps.firstWhere((step) => step.id == 's1-4');

    expect(cozy.durationLabel, '19:00 — 00:30');
    expect(cozy.steps.first.perk, '−15% на бокалы и бутылку для группы');
    expect(
      cozy.steps.first.description,
      'Знакомство за бокалом — без формальностей и спешки',
    );
    expect(followUp.distance, '—');
    expect(date.vibe, 'Вечер для двоих — кино и поздний бар');
    expect(date.steps[1].description, 'Маленький бистро на двоих, тёплый свет');
    expect(eveningBudgets[1].blurb, '500–1500 ₽');
    expect(eveningBudgets[2].blurb, '1500–3000 ₽');
  });
}

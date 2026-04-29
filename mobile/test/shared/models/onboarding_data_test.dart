import 'package:big_break_mobile/shared/models/onboarding_data.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('onboarding data maps birth date to and from json', () {
    const data = OnboardingData(
      intent: 'dating',
      gender: 'female',
      birthDate: '2000-04-24',
      city: 'Москва',
      area: 'Покровка',
      interests: ['Кофе', 'Кино'],
      vibe: 'calm',
    );

    expect(data.toJson()['birthDate'], '2000-04-24');
    expect(OnboardingData.fromJson(data.toJson()).birthDate, '2000-04-24');
  });
}

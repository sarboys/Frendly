import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/features/auth/presentation/phone_auth_screen.dart';

void main() {
  test('formats Russian phone digits while preserving raw digits', () {
    final formatter = PhoneNumberTextInputFormatter();

    var value = TextEditingValue.empty;
    for (final digit in '9991234567'.split('')) {
      value = formatter.formatEditUpdate(
        value,
        TextEditingValue(
          text: '${value.text}$digit',
          selection: TextSelection.collapsed(offset: value.text.length + 1),
        ),
      );
    }

    expect(value.text, '999 123-45-67');
    expect(PhoneNumberTextInputFormatter.digitsOnly(value.text), '9991234567');
  });

  test('limits phone input to ten digits', () {
    final formatter = PhoneNumberTextInputFormatter();
    final value = formatter.formatEditUpdate(
      TextEditingValue.empty,
      const TextEditingValue(
        text: '999123456789',
        selection: TextSelection.collapsed(offset: 12),
      ),
    );

    expect(value.text, '999 123-45-67');
    expect(PhoneNumberTextInputFormatter.digitsOnly(value.text).length, 10);
  });
}

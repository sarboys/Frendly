import 'package:flutter/widgets.dart';

class AppRadii {
  const AppRadii._();

  static const input = Radius.circular(16);
  static const card = Radius.circular(24);
  static const shell = Radius.circular(32);
  static const bubble = Radius.circular(24);
  static const pill = Radius.circular(999);

  static const inputBorder = BorderRadius.all(input);
  static const cardBorder = BorderRadius.all(card);
  static const shellBorder = BorderRadius.all(shell);
  static const pillBorder = BorderRadius.all(pill);
}

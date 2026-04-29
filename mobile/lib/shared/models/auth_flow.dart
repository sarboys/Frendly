import 'package:big_break_mobile/shared/models/tokens.dart';

class PhoneAuthChallenge {
  const PhoneAuthChallenge({
    required this.challengeId,
    required this.maskedPhone,
    required this.resendAfterSeconds,
    this.localCodeHint,
  });

  final String challengeId;
  final String maskedPhone;
  final int resendAfterSeconds;
  final String? localCodeHint;

  factory PhoneAuthChallenge.fromJson(Map<String, dynamic> json) {
    return PhoneAuthChallenge(
      challengeId: json['challengeId'] as String,
      maskedPhone: json['maskedPhone'] as String,
      resendAfterSeconds: (json['resendAfterSeconds'] as num?)?.toInt() ?? 0,
      localCodeHint: json['localCodeHint'] as String?,
    );
  }
}

class PhoneAuthSession {
  const PhoneAuthSession({
    required this.userId,
    required this.isNewUser,
    required this.tokens,
  });

  final String userId;
  final bool isNewUser;
  final AuthTokens tokens;

  factory PhoneAuthSession.fromJson(Map<String, dynamic> json) {
    return PhoneAuthSession(
      userId: json['userId'] as String,
      isNewUser: (json['isNewUser'] as bool?) ?? false,
      tokens: AuthTokens.fromJson(json),
    );
  }
}

class TelegramAuthStart {
  const TelegramAuthStart({
    required this.loginSessionId,
    required this.botUrl,
    required this.expiresAt,
    required this.codeLength,
  });

  final String loginSessionId;
  final String botUrl;
  final String expiresAt;
  final int codeLength;

  factory TelegramAuthStart.fromJson(Map<String, dynamic> json) {
    return TelegramAuthStart(
      loginSessionId: json['loginSessionId'] as String,
      botUrl: json['botUrl'] as String,
      expiresAt: json['expiresAt'] as String,
      codeLength: (json['codeLength'] as num?)?.toInt() ?? 4,
    );
  }
}

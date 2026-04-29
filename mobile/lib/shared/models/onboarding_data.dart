enum OnboardingContactRequirement {
  email,
  phone;

  static OnboardingContactRequirement? fromJson(Object? value) {
    return switch (value) {
      'email' => OnboardingContactRequirement.email,
      'phone' => OnboardingContactRequirement.phone,
      _ => null,
    };
  }

  String toJson() {
    return switch (this) {
      OnboardingContactRequirement.email => 'email',
      OnboardingContactRequirement.phone => 'phone',
    };
  }
}

class OnboardingData {
  const OnboardingData({
    required this.intent,
    this.gender,
    this.birthDate,
    required this.city,
    required this.area,
    required this.interests,
    required this.vibe,
    this.email,
    this.phoneNumber,
    this.requiredContact,
  });

  final String? intent;
  final String? gender;
  final String? birthDate;
  final String? city;
  final String? area;
  final List<String> interests;
  final String? vibe;
  final String? email;
  final String? phoneNumber;
  final OnboardingContactRequirement? requiredContact;

  factory OnboardingData.fromJson(Map<String, dynamic> json) {
    return OnboardingData(
      intent: json['intent'] as String?,
      gender: json['gender'] as String?,
      birthDate: json['birthDate'] as String?,
      city: json['city'] as String?,
      area: json['area'] as String?,
      interests: ((json['interests'] as List?) ?? const [])
          .whereType<String>()
          .toList(growable: false),
      vibe: json['vibe'] as String?,
      email: json['email'] as String?,
      phoneNumber: json['phoneNumber'] as String?,
      requiredContact:
          OnboardingContactRequirement.fromJson(json['requiredContact']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'intent': intent,
      'gender': gender,
      if (birthDate != null) 'birthDate': birthDate,
      'city': city,
      'area': area,
      'interests': interests,
      'vibe': vibe,
      if (email != null) 'email': email,
      if (phoneNumber != null) 'phoneNumber': phoneNumber,
    };
  }
}

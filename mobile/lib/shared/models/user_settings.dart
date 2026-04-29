class UserSettingsData {
  const UserSettingsData({
    required this.allowLocation,
    required this.allowPush,
    required this.allowContacts,
    required this.autoSharePlans,
    required this.hideExactLocation,
    required this.quietHours,
    required this.showAge,
    required this.discoverable,
    required this.darkMode,
  });

  final bool allowLocation;
  final bool allowPush;
  final bool allowContacts;
  final bool autoSharePlans;
  final bool hideExactLocation;
  final bool quietHours;
  final bool showAge;
  final bool discoverable;
  final bool darkMode;

  static const fallback = UserSettingsData(
    allowLocation: false,
    allowPush: false,
    allowContacts: false,
    autoSharePlans: false,
    hideExactLocation: false,
    quietHours: false,
    showAge: true,
    discoverable: true,
    darkMode: false,
  );

  factory UserSettingsData.fromJson(Map<String, dynamic> json) {
    return UserSettingsData(
      allowLocation: (json['allowLocation'] as bool?) ?? false,
      allowPush: (json['allowPush'] as bool?) ?? false,
      allowContacts: (json['allowContacts'] as bool?) ?? false,
      autoSharePlans: (json['autoSharePlans'] as bool?) ?? false,
      hideExactLocation: (json['hideExactLocation'] as bool?) ?? false,
      quietHours: (json['quietHours'] as bool?) ?? false,
      showAge: (json['showAge'] as bool?) ?? true,
      discoverable: (json['discoverable'] as bool?) ?? true,
      darkMode: (json['darkMode'] as bool?) ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'allowLocation': allowLocation,
      'allowPush': allowPush,
      'allowContacts': allowContacts,
      'autoSharePlans': autoSharePlans,
      'hideExactLocation': hideExactLocation,
      'quietHours': quietHours,
      'showAge': showAge,
      'discoverable': discoverable,
      'darkMode': darkMode,
    };
  }

  UserSettingsData copyWith({
    bool? allowLocation,
    bool? allowPush,
    bool? allowContacts,
    bool? autoSharePlans,
    bool? hideExactLocation,
    bool? quietHours,
    bool? showAge,
    bool? discoverable,
    bool? darkMode,
  }) {
    return UserSettingsData(
      allowLocation: allowLocation ?? this.allowLocation,
      allowPush: allowPush ?? this.allowPush,
      allowContacts: allowContacts ?? this.allowContacts,
      autoSharePlans: autoSharePlans ?? this.autoSharePlans,
      hideExactLocation: hideExactLocation ?? this.hideExactLocation,
      quietHours: quietHours ?? this.quietHours,
      showAge: showAge ?? this.showAge,
      discoverable: discoverable ?? this.discoverable,
      darkMode: darkMode ?? this.darkMode,
    );
  }
}

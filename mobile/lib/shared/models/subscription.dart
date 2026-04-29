class SubscriptionPlanData {
  const SubscriptionPlanData({
    required this.id,
    required this.label,
    required this.priceRub,
    required this.priceMonthlyRub,
    required this.trialDays,
    required this.badge,
  });

  final String id;
  final String label;
  final int priceRub;
  final int priceMonthlyRub;
  final int trialDays;
  final String? badge;

  factory SubscriptionPlanData.fromJson(Map<String, dynamic> json) {
    return SubscriptionPlanData(
      id: json['id'] as String,
      label: json['label'] as String,
      priceRub: (json['priceRub'] as num?)?.toInt() ?? 0,
      priceMonthlyRub: (json['priceMonthlyRub'] as num?)?.toInt() ?? 0,
      trialDays: (json['trialDays'] as num?)?.toInt() ?? 0,
      badge: json['badge'] as String?,
    );
  }
}

class SubscriptionStateData {
  const SubscriptionStateData({
    required this.plan,
    required this.status,
    required this.startedAt,
    required this.renewsAt,
    required this.trialEndsAt,
  });

  final String? plan;
  final String status;
  final DateTime? startedAt;
  final DateTime? renewsAt;
  final DateTime? trialEndsAt;

  factory SubscriptionStateData.fromJson(Map<String, dynamic> json) {
    return SubscriptionStateData(
      plan: json['plan'] as String?,
      status: json['status'] as String? ?? 'inactive',
      startedAt: json['startedAt'] == null
          ? null
          : DateTime.parse(json['startedAt'] as String),
      renewsAt: json['renewsAt'] == null
          ? null
          : DateTime.parse(json['renewsAt'] as String),
      trialEndsAt: json['trialEndsAt'] == null
          ? null
          : DateTime.parse(json['trialEndsAt'] as String),
    );
  }
}

class VerificationStateData {
  const VerificationStateData({
    required this.status,
    required this.selfieDone,
    required this.documentDone,
    required this.reviewedAt,
  });

  final String status;
  final bool selfieDone;
  final bool documentDone;
  final DateTime? reviewedAt;

  factory VerificationStateData.fromJson(Map<String, dynamic> json) {
    return VerificationStateData(
      status: json['status'] as String? ?? 'not_started',
      selfieDone: (json['selfieDone'] as bool?) ?? false,
      documentDone: (json['documentDone'] as bool?) ?? false,
      reviewedAt: json['reviewedAt'] == null
          ? null
          : DateTime.parse(json['reviewedAt'] as String),
    );
  }
}

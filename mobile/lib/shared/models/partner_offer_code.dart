enum PartnerOfferCodeStatus { issued, activated, expired }

class PartnerOfferCode {
  const PartnerOfferCode({
    required this.id,
    required this.codeUrl,
    required this.status,
    required this.expiresAt,
    required this.offerTitle,
    required this.venueName,
    required this.partnerName,
    this.activatedAt,
  });

  final String id;
  final String codeUrl;
  final PartnerOfferCodeStatus status;
  final DateTime expiresAt;
  final DateTime? activatedAt;
  final String offerTitle;
  final String venueName;
  final String partnerName;

  bool get isIssued => status == PartnerOfferCodeStatus.issued;
  bool get isActivated => status == PartnerOfferCodeStatus.activated;
  bool get isExpired => status == PartnerOfferCodeStatus.expired;

  factory PartnerOfferCode.fromJson(Map<String, dynamic> json) {
    return PartnerOfferCode(
      id: json['id'] as String? ?? '',
      codeUrl: json['codeUrl'] as String? ?? '',
      status: parsePartnerOfferCodeStatus(json['status'] as String?),
      expiresAt: _parseDate(json['expiresAt'] as String?),
      activatedAt: _parseNullableDate(json['activatedAt'] as String?),
      offerTitle: json['offerTitle'] as String? ?? '',
      venueName: json['venueName'] as String? ?? '',
      partnerName: json['partnerName'] as String? ?? '',
    );
  }
}

PartnerOfferCodeStatus parsePartnerOfferCodeStatus(String? value) {
  switch (value) {
    case 'activated':
      return PartnerOfferCodeStatus.activated;
    case 'expired':
      return PartnerOfferCodeStatus.expired;
    case 'issued':
    default:
      return PartnerOfferCodeStatus.issued;
  }
}

String partnerOfferCodeStatusToJson(PartnerOfferCodeStatus status) {
  switch (status) {
    case PartnerOfferCodeStatus.activated:
      return 'activated';
    case PartnerOfferCodeStatus.expired:
      return 'expired';
    case PartnerOfferCodeStatus.issued:
      return 'issued';
  }
}

DateTime _parseDate(String? value) {
  final parsed = _parseNullableDate(value);
  return parsed ?? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
}

DateTime? _parseNullableDate(String? value) {
  if (value == null || value.isEmpty) {
    return null;
  }
  return DateTime.tryParse(value);
}

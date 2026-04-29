import 'package:big_break_mobile/shared/models/partner_offer_code.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('partner offer code parses issued response', () {
    final code = PartnerOfferCode.fromJson(const {
      'id': 'code-1',
      'codeUrl': 'https://frendly.tech/code/ABCDEFG234567',
      'status': 'issued',
      'expiresAt': '2026-05-11T03:00:00.000Z',
      'activatedAt': null,
      'offerTitle': 'Бокал в подарок',
      'venueName': 'Brix Wine',
      'partnerName': 'Brix',
    });

    expect(code.id, 'code-1');
    expect(code.status, PartnerOfferCodeStatus.issued);
    expect(code.isIssued, isTrue);
    expect(
        code.expiresAt.toUtc().toIso8601String(), '2026-05-11T03:00:00.000Z');
    expect(code.activatedAt, isNull);
    expect(code.offerTitle, 'Бокал в подарок');
    expect(code.venueName, 'Brix Wine');
    expect(code.partnerName, 'Brix');
  });

  test('partner offer code parses terminal statuses', () {
    expect(
      PartnerOfferCode.fromJson(const {
        'status': 'activated',
        'expiresAt': '2026-05-11T03:00:00.000Z',
        'activatedAt': '2026-05-10T20:00:00.000Z',
      }).isActivated,
      isTrue,
    );
    expect(
      PartnerOfferCode.fromJson(const {
        'status': 'expired',
        'expiresAt': '2026-05-11T03:00:00.000Z',
      }).isExpired,
      isTrue,
    );
  });

  test('partner offer code status serializes to backend value', () {
    expect(
      partnerOfferCodeStatusToJson(PartnerOfferCodeStatus.issued),
      'issued',
    );
    expect(
      partnerOfferCodeStatusToJson(PartnerOfferCodeStatus.activated),
      'activated',
    );
    expect(
      partnerOfferCodeStatusToJson(PartnerOfferCodeStatus.expired),
      'expired',
    );
  });
}

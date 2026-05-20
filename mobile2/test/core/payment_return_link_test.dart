import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/core/deep_links/payment_return_link.dart';

void main() {
  test('maps frendly payment return link to wallet route', () {
    final route = paymentReturnRouteForUri(
      Uri.parse('frendly://payment/success?orderId=order-1&productKind=tokens'),
    );

    expect(
      route,
      '/wallet?paymentResult=success&orderId=order-1&productKind=tokens',
    );
  });

  test('maps dateasy payment return link to wallet route', () {
    final route = paymentReturnRouteForUri(
      Uri.parse('dateasy://payment/fail?orderId=order-2'),
    );

    expect(route, '/wallet?paymentResult=fail&orderId=order-2');
  });

  test('ignores unrelated links', () {
    expect(
        paymentReturnRouteForUri(Uri.parse('frendly://event/event-1')), null);
  });
}

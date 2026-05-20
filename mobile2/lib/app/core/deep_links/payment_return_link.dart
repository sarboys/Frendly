String? paymentReturnRouteForUri(Uri uri) {
  if (uri.scheme != 'frendly' && uri.scheme != 'dateasy') {
    return null;
  }

  final parts = _paymentPathParts(uri);
  if (parts.length < 2 || parts.first != 'payment') {
    return null;
  }

  final result = parts[1];
  if (result != 'success' && result != 'fail') {
    return null;
  }

  final query = <String, String>{
    'paymentResult': result,
    ...uri.queryParameters,
  };
  return Uri(path: '/wallet', queryParameters: query).toString();
}

List<String> _paymentPathParts(Uri uri) {
  if (uri.host.isEmpty) {
    return uri.pathSegments;
  }
  return [uri.host, ...uri.pathSegments];
}

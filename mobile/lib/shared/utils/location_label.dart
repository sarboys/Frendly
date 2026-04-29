String normalizeCityLabel(String? raw) {
  final parts = (raw ?? '')
      .split(',')
      .map(_normalizeSegment)
      .where((item) => item.isNotEmpty)
      .toList(growable: false);
  if (parts.isEmpty) {
    return '';
  }

  for (final part in parts) {
    if (!_isCountry(part)) {
      return part;
    }
  }

  return parts.first;
}

String? normalizeAreaLabel(
  String? raw, {
  required String city,
}) {
  final normalizedArea = _normalizeSegment(raw ?? '');
  if (normalizedArea.isEmpty) {
    return null;
  }

  final normalizedCity = normalizeCityLabel(city);
  if (normalizedCity.isNotEmpty &&
      normalizeCityLabel(normalizedArea).toLowerCase() ==
          normalizedCity.toLowerCase()) {
    return null;
  }

  if (_looksLikeAddress(normalizedArea)) {
    return null;
  }

  return normalizedArea;
}

String composeLocationLabel(
  String? city,
  String? area,
) {
  final normalizedCity = normalizeCityLabel(city);
  final normalizedArea = normalizeAreaLabel(
    area,
    city: normalizedCity,
  );
  final parts = [
    if (normalizedCity.isNotEmpty) normalizedCity,
    if (normalizedArea != null && normalizedArea.isNotEmpty) normalizedArea,
  ];
  return parts.join(' · ');
}

String _normalizeSegment(String raw) {
  final withoutIndex = raw.trim().replaceFirst(RegExp(r'^\d{5,6}\s*'), '');
  if (withoutIndex.isEmpty) {
    return '';
  }

  final withoutCityPrefix = withoutIndex.replaceFirst(
    RegExp(r'^(г\.?|город)\s+', caseSensitive: false),
    '',
  );

  return withoutCityPrefix.replaceAll(RegExp(r'\s+'), ' ').trim();
}

bool _isCountry(String value) {
  final normalized = value.toLowerCase();
  return normalized == 'россия' || normalized == 'russia';
}

bool _looksLikeAddress(String value) {
  return RegExp(
    r'\d|улиц|ул\.|просп|пр-т|переул|пер\.|шоссе|бульвар|бул\.|наб\.|набереж|проезд|пл\.|площад|дом|д\.|street|st\.|avenue|ave\.|road|rd\.',
    caseSensitive: false,
  ).hasMatch(value);
}

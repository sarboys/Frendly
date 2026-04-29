import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

class SocialShareService {
  const SocialShareService();

  static const MethodChannel _channel = MethodChannel('app.social.share');

  Future<bool> shareToTelegram({
    required String url,
    required String text,
  }) {
    final uri = Uri.https('t.me', '/share/url', {
      'url': url,
      'text': text,
    });
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<bool> shareToInstagramStories({
    required Uint8List backgroundImageBytes,
    required String contentUrl,
    required String facebookAppId,
  }) async {
    final result = await _channel.invokeMethod<bool>(
      'shareInstagramStory',
      {
        'backgroundImageBytes': backgroundImageBytes,
        'contentUrl': contentUrl,
        'facebookAppId': facebookAppId,
      },
    );

    return result ?? false;
  }
}

import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile2/app/core/deep_links/payment_return_link.dart';
import 'package:mobile2/app/dateasy_router.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_keyboard_dismiss.dart';
import 'package:url_launcher/url_launcher.dart';

class DateasyApp extends StatefulWidget {
  const DateasyApp({super.key, this.overrides = const []});

  final List<Override> overrides;

  @override
  State<DateasyApp> createState() => _DateasyAppState();
}

class _DateasyAppState extends State<DateasyApp> {
  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: widget.overrides,
      child: const _DateasyAppContent(),
    );
  }
}

class _DateasyAppContent extends StatefulWidget {
  const _DateasyAppContent();

  @override
  State<_DateasyAppContent> createState() => _DateasyAppContentState();
}

class _DateasyAppContentState extends State<_DateasyAppContent> {
  GoRouter? _router;
  DateasyRouterRefresh? _refresh;
  AppLinks? _appLinks;
  StreamSubscription<Uri>? _appLinksSub;
  bool _initialLinkChecked = false;

  @override
  void dispose() {
    _appLinksSub?.cancel();
    _refresh?.dispose();
    _router?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) {
        ref.watch(authBootstrapProvider);
        _refresh ??= DateasyRouterRefresh(ref);
        _router ??= buildDateasyRouter(ref, refreshListenable: _refresh!);
        _startAppLinks(ref);
        return MaterialApp.router(
          title: 'Dateasy',
          debugShowCheckedModeBanner: false,
          theme: DateasyTheme.theme,
          routerConfig: _router!,
          builder: (context, child) {
            return DateasyKeyboardDismiss(
              child: child ?? const SizedBox.shrink(),
            );
          },
        );
      },
    );
  }

  void _startAppLinks(WidgetRef ref) {
    final appLinks = _appLinks ??= AppLinks();
    if (!_initialLinkChecked) {
      _initialLinkChecked = true;
      appLinks.getInitialLink().then((uri) {
        if (!mounted || uri == null) {
          return;
        }
        _handlePaymentReturnLink(ref, uri);
      }).catchError((_) {});
    }
    _appLinksSub ??= appLinks.uriLinkStream.listen(
      (uri) => _handlePaymentReturnLink(ref, uri),
      onError: (_) {},
    );
  }

  void _handlePaymentReturnLink(WidgetRef ref, Uri uri) {
    final route = paymentReturnRouteForUri(uri);
    if (route == null) {
      return;
    }
    unawaited(closeInAppWebView());
    ref.read(paymentActionsProvider).handlePaymentReturn();
    _router?.go(route);
  }
}

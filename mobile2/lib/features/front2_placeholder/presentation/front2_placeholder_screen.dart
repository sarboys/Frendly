import 'package:flutter/material.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_logo.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';

class Front2PlaceholderScreen extends StatelessWidget {
  const Front2PlaceholderScreen({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return DateasyPhoneFrame(
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const DateasyLogo(size: DateasyLogoSize.sm),
              const Spacer(),
              Text(
                title,
                style: Theme.of(context).textTheme.headlineLarge,
              ),
              const SizedBox(height: 12),
              Text(
                'Экран будет собран по front2 на следующем шаге.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: DateasyColors.muted,
                    ),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}

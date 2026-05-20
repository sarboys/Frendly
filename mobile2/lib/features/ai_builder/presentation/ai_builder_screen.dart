import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_bottom_nav.dart';
import 'package:mobile2/shared/widgets/dateasy_phone_frame.dart';

const _examples = [
  _PromptExample(
    title: 'Уютный вечер вдвоём',
    text:
        'Найди тихий винный бар на двоих в центре, с виниловой музыкой и небольшим залом. Не громко, рядом с метро.',
  ),
  _PromptExample(
    title: 'Активная компания на 4-6',
    text:
        'Собери активный вечер на 4-6 человек: что-то спортивное или адреналиновое, потом перекус. Бюджет до 3к на человека.',
  ),
  _PromptExample(
    title: 'Гастро-приключение',
    text:
        'Хочу гастро-тур по 3 местам в районе Патриарших — необычная кухня, авторские коктейли, новые впечатления.',
  ),
  _PromptExample(
    title: 'Креативное свидание',
    text:
        'Что-нибудь странное и креативное для первого свидания — выставка, перформанс, нестандартное место. Удивить.',
  ),
];

const _tips = [
  'Укажи количество людей и вайб (тихо / активно / шумно)',
  'Добавь район или метро рядом',
  'Намекни на бюджет — «дёшево», «средне», «без лимита»',
  'Опиши настроение — «отдохнуть», «познакомиться», «удивить»',
];

class AiBuilderScreen extends ConsumerStatefulWidget {
  const AiBuilderScreen({super.key});

  @override
  ConsumerState<AiBuilderScreen> createState() => _AiBuilderScreenState();
}

class _AiBuilderScreenState extends ConsumerState<AiBuilderScreen> {
  final _controller = TextEditingController();
  String _prompt = '';
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _setPrompt(String value) {
    _controller.text = value;
    _controller.selection = TextSelection.collapsed(offset: value.length);
    setState(() => _prompt = value);
  }

  void _clearPrompt() => _setPrompt('');

  Future<void> _generate() async {
    final prompt = _prompt.trim();
    if (prompt.length < 3 || _loading) {
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final draft =
          await ref.read(eveningAiActionsProvider).createDraft(prompt);
      if (!mounted) {
        return;
      }
      context.go(
          '/ai-builder/result?draftId=${Uri.encodeComponent(draft.draftId)}');
    } on BackendActionException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() => _error = 'Не удалось собрать маршрут');
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final canGenerate = _prompt.trim().length >= 3 && !_loading;

    return DateasyPhoneFrame(
      child: Stack(
        children: [
          ListView(
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + 16,
              bottom: 188,
            ),
            children: [
              const _AiBuilderHeader(),
              const _HeroCopy(),
              _PromptCard(
                controller: _controller,
                prompt: _prompt,
                onChanged: (value) => setState(() => _prompt = value),
                onClear: _clearPrompt,
              ),
              if (_error != null) _ErrorNotice(message: _error!),
              _ExamplesSection(onPick: _setPrompt),
              const _TipsSection(),
            ],
          ),
          _GenerateButton(
            enabled: canGenerate,
            loading: _loading,
            onTap: _generate,
          ),
          const _BottomNav(),
        ],
      ),
    );
  }
}

class _ErrorNotice extends StatelessWidget {
  const _ErrorNotice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: _GlassPanel(
        borderRadius: 14,
        padding: const EdgeInsets.all(12),
        child: Text(
          message,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: DateasyColors.pink,
                fontSize: 12,
              ),
        ),
      ),
    );
  }
}

class _AiBuilderHeader extends StatelessWidget {
  const _AiBuilderHeader();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.go('/'),
            child: const _GlassSquare(
              child: Icon(
                LucideIcons.arrowLeft,
                size: 20,
                color: DateasyColors.foreground,
              ),
            ),
          ),
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  LucideIcons.sparkles,
                  size: 18,
                  color: DateasyColors.lime,
                ),
                const SizedBox(width: 8),
                Text(
                  'AI билдер',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 44, height: 44),
        ],
      ),
    );
  }
}

class _HeroCopy extends StatelessWidget {
  const _HeroCopy();

  @override
  Widget build(BuildContext context) {
    final titleStyle = Theme.of(context).textTheme.headlineLarge?.copyWith(
          fontSize: 34,
          height: 1.04,
          fontWeight: FontWeight.w600,
        );

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Опиши вайб —', style: titleStyle),
          Text('соберём вечер',
              style: titleStyle?.copyWith(color: DateasyColors.lime)),
          const SizedBox(height: 10),
          Text(
            'Один абзац свободным текстом. AI разберёт детали, подберёт места, маршрут и людей рядом.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DateasyColors.muted,
                  fontSize: 14,
                ),
          ),
        ],
      ),
    );
  }
}

class _PromptCard extends StatelessWidget {
  const _PromptCard({
    required this.controller,
    required this.prompt,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final String prompt;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: 20,
            right: 20,
            top: -10,
            bottom: -10,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: DateasyColors.lime.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(32),
                boxShadow: [
                  BoxShadow(
                    color: DateasyColors.lime.withValues(alpha: 0.30),
                    blurRadius: 38,
                    spreadRadius: -16,
                    offset: const Offset(0, 18),
                  ),
                ],
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: DateasyColors.background,
              borderRadius: BorderRadius.circular(32),
              border: Border.all(color: DateasyColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: DateasyColors.lime.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            LucideIcons.sparkles,
                            size: 12,
                            color: DateasyColors.lime,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'ПРОМТ',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: DateasyColors.lime,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 1.6,
                                    ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    if (prompt.isNotEmpty)
                      GestureDetector(
                        onTap: onClear,
                        child: Text(
                          'Очистить',
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: DateasyColors.muted,
                                    fontSize: 11,
                                  ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: controller,
                  onChanged: onChanged,
                  minLines: 5,
                  maxLines: 5,
                  cursorColor: DateasyColors.lime,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DateasyColors.foreground,
                        fontSize: 15,
                        height: 1.45,
                      ),
                  decoration: InputDecoration(
                    hintText:
                        'Например: уютный винный бар на двоих в центре, негромкая музыка, рядом с метро Чистые пруды, бюджет до 3к...',
                    hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: DateasyColors.muted.withValues(alpha: 0.72),
                          fontSize: 15,
                          height: 1.45,
                        ),
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Text(
                      '${prompt.length}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.lime,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'символов',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DateasyColors.muted,
                            fontSize: 12,
                          ),
                    ),
                    const SizedBox(width: 12),
                    const Icon(
                      LucideIcons.lightbulb,
                      size: 14,
                      color: DateasyColors.lime,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '2-3 предложения — идеально',
                        textAlign: TextAlign.right,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DateasyColors.muted,
                              fontSize: 12,
                            ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ExamplesSection extends StatelessWidget {
  const _ExamplesSection({required this.onPick});

  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionLabel(
            icon: LucideIcons.wand,
            text: 'Примеры промтов',
          ),
          const SizedBox(height: 12),
          for (var index = 0; index < _examples.length; index++) ...[
            _ExampleCard(
              example: _examples[index],
              onTap: () => onPick(_examples[index].text),
            ),
            if (index != _examples.length - 1) const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

class _ExampleCard extends StatelessWidget {
  const _ExampleCard({
    required this.example,
    required this.onTap,
  });

  final _PromptExample example;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              example.title,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              example.text,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DateasyColors.muted,
                    fontSize: 13,
                    height: 1.25,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TipsSection extends StatelessWidget {
  const _TipsSection();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
      child: _GlassPanel(
        borderRadius: 16,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SectionLabel(
              icon: LucideIcons.lightbulb,
              iconColor: DateasyColors.lime,
              text: 'Как описать круче',
            ),
            const SizedBox(height: 12),
            for (var index = 0; index < _tips.length; index++) ...[
              _TipRow(_tips[index]),
              if (index != _tips.length - 1) const SizedBox(height: 8),
            ],
          ],
        ),
      ),
    );
  }
}

class _TipRow extends StatelessWidget {
  const _TipRow(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 6,
          height: 6,
          margin: const EdgeInsets.only(top: 6),
          decoration: const BoxDecoration(
            color: DateasyColors.lime,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DateasyColors.foreground.withValues(alpha: 0.80),
                  fontSize: 13,
                  height: 1.35,
                ),
          ),
        ),
      ],
    );
  }
}

class _GenerateButton extends StatelessWidget {
  const _GenerateButton({
    required this.enabled,
    required this.loading,
    required this.onTap,
  });

  final bool enabled;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: 96,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: GestureDetector(
            onTap: enabled ? onTap : null,
            child: Opacity(
              opacity: enabled ? 1 : 0.44,
              child: Container(
                height: 56,
                decoration: BoxDecoration(
                  gradient: dateasyLimeGradient,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x66BEFF67),
                      blurRadius: 34,
                      spreadRadius: -14,
                      offset: Offset(0, 18),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      LucideIcons.sparkles,
                      size: 18,
                      color: DateasyColors.backgroundDeep,
                    ),
                    const SizedBox(width: 10),
                    Flexible(
                      child: Text(
                        loading ? 'Собираем маршрут' : 'Сгенерировать вечер',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: DateasyColors.backgroundDeep,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Icon(
                      LucideIcons.arrowRight,
                      size: 18,
                      color: DateasyColors.backgroundDeep,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav();

  @override
  Widget build(BuildContext context) {
    return const DateasyBottomNav();
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({
    required this.icon,
    required this.text,
    this.iconColor = DateasyColors.muted,
  });

  final IconData icon;
  final String text;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: iconColor),
        const SizedBox(width: 8),
        Text(
          text.toUpperCase(),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: DateasyColors.muted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.8,
              ),
        ),
      ],
    );
  }
}

class _GlassSquare extends StatelessWidget {
  const _GlassSquare({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: DateasyColors.border),
      ),
      child: child,
    );
  }
}

class _GlassPanel extends StatelessWidget {
  const _GlassPanel({
    required this.child,
    required this.borderRadius,
    this.padding = EdgeInsets.zero,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: DateasyColors.glass,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: DateasyColors.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 24,
            spreadRadius: -14,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _PromptExample {
  const _PromptExample({
    required this.title,
    required this.text,
  });

  final String title;
  final String text;
}

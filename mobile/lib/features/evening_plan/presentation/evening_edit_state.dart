import 'package:big_break_mobile/features/evening_plan/presentation/evening_plan_data.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final eveningRouteOverridesProvider =
    StateProvider<Map<String, EveningRouteData>>((ref) => const {});

EveningRouteData resolveEveningRoute(
  WidgetRef ref,
  String routeId, {
  EveningRouteData? fallback,
}) {
  return ref.watch(eveningRouteOverridesProvider)[routeId] ??
      fallback ??
      findEveningRoute(routeId);
}

EveningRouteData readEveningRoute(
  WidgetRef ref,
  String routeId, {
  EveningRouteData? fallback,
}) {
  return ref.read(eveningRouteOverridesProvider)[routeId] ??
      fallback ??
      findEveningRoute(routeId);
}

class EveningEditPolicy {
  const EveningEditPolicy({
    required this.meta,
    required this.allSteps,
    required this.addStep,
    required this.removeStep,
    required this.reorderStep,
  });

  final bool meta;
  final bool allSteps;
  final bool addStep;
  final bool removeStep;
  final bool reorderStep;

  factory EveningEditPolicy.forPhase(MeetupPhase? phase) {
    if (phase == null ||
        phase == MeetupPhase.upcoming ||
        phase == MeetupPhase.soon) {
      return const EveningEditPolicy(
        meta: true,
        allSteps: true,
        addStep: true,
        removeStep: true,
        reorderStep: true,
      );
    }

    if (phase == MeetupPhase.live) {
      return const EveningEditPolicy(
        meta: false,
        allSteps: false,
        addStep: true,
        removeStep: true,
        reorderStep: true,
      );
    }

    return const EveningEditPolicy(
      meta: false,
      allSteps: false,
      addStep: false,
      removeStep: false,
      reorderStep: false,
    );
  }

  bool stepEditable(int index, {int? currentStep}) {
    if (allSteps) {
      return true;
    }
    if (!addStep && !removeStep && !reorderStep) {
      return false;
    }
    final futureFromIndex = currentStep == null ? 1 : currentStep.clamp(0, 999);
    return index >= futureFromIndex;
  }
}

class EveningEditSnapshot {
  const EveningEditSnapshot({
    required this.route,
    required this.privacy,
    this.maxGuests,
  });

  final EveningRouteData route;
  final EveningPrivacy privacy;
  final int? maxGuests;
}

List<String> buildEveningEditDiff({
  required EveningEditSnapshot previous,
  required EveningEditSnapshot next,
}) {
  final lines = <String>[];
  if (previous.route.title != next.route.title) {
    lines.add('Название: «${previous.route.title}» → «${next.route.title}»');
  }
  if (previous.route.area != next.route.area) {
    lines.add('Район: ${previous.route.area} → ${next.route.area}');
  }
  if (previous.route.durationLabel != next.route.durationLabel) {
    lines.add(
      'Время: ${previous.route.durationLabel} → ${next.route.durationLabel}',
    );
  }
  if (previous.route.blurb != next.route.blurb) {
    lines.add('Описание обновлено');
  }
  if (previous.route.premium != next.route.premium) {
    lines.add('Frendly+: ${next.route.premium ? 'включён' : 'выключен'}');
  }
  if (previous.privacy != next.privacy) {
    lines.add(
      'Доступ: ${_privacyLabel(previous.privacy)} → ${_privacyLabel(next.privacy)}',
    );
  }
  if (previous.maxGuests != next.maxGuests) {
    lines.add(
      'Лимит мест: ${previous.maxGuests ?? 'без лимита'} → ${next.maxGuests ?? 'без лимита'}',
    );
  }

  final previousById = {
    for (final step in previous.route.steps) step.id: step,
  };
  final nextById = {
    for (final step in next.route.steps) step.id: step,
  };

  for (final step in previous.route.steps) {
    if (!nextById.containsKey(step.id)) {
      lines.add('Удалён шаг: ${step.time} ${step.title}');
    }
  }

  for (var i = 0; i < next.route.steps.length; i++) {
    final nextStep = next.route.steps[i];
    final previousStep = previousById[nextStep.id];
    if (previousStep == null) {
      lines.add(
          'Добавлен шаг: ${nextStep.time} ${nextStep.title} (${nextStep.venue})');
      continue;
    }

    final changes = <String>[];
    if (previousStep.time != nextStep.time) {
      changes.add('${previousStep.time} → ${nextStep.time}');
    }
    if (previousStep.endTime != nextStep.endTime) {
      changes.add(
          'до ${previousStep.endTime ?? '—'} → ${nextStep.endTime ?? '—'}');
    }
    if (previousStep.title != nextStep.title) {
      changes.add('«${previousStep.title}» → «${nextStep.title}»');
    }
    if (previousStep.venue != nextStep.venue) {
      changes.add('место: ${previousStep.venue} → ${nextStep.venue}');
    }
    if (previousStep.perk != nextStep.perk) {
      changes
          .add(nextStep.perk == null ? 'перк убран' : 'перк: ${nextStep.perk}');
    }
    if (previousStep.ticketPrice != nextStep.ticketPrice) {
      changes.add(
        nextStep.ticketPrice == null
            ? 'билет убран'
            : 'билет ${nextStep.ticketPrice} ₽',
      );
    }
    if (previousStep.emoji != nextStep.emoji) {
      changes.add('${previousStep.emoji} → ${nextStep.emoji}');
    }
    if (changes.isNotEmpty) {
      lines.add('Шаг ${i + 1}: ${changes.join(', ')}');
    }
  }

  final previousKept = previous.route.steps
      .where((step) => nextById.containsKey(step.id))
      .map((step) => step.id)
      .join('>');
  final nextKept = next.route.steps
      .where((step) => previousById.containsKey(step.id))
      .map((step) => step.id)
      .join('>');
  if (previousKept.isNotEmpty &&
      nextKept.isNotEmpty &&
      previousKept != nextKept) {
    lines.add('Порядок шагов изменён');
  }

  return lines;
}

String nextEveningStepTime(String previous) {
  final match = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(previous);
  if (match == null) {
    return '21:00';
  }
  var hour = int.parse(match.group(1)!);
  var minute = int.parse(match.group(2)!) + 30;
  if (minute >= 60) {
    hour += 1;
    minute -= 60;
  }
  if (hour >= 24) {
    hour -= 24;
  }
  return '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
}

String _privacyLabel(EveningPrivacy privacy) {
  switch (privacy) {
    case EveningPrivacy.open:
      return 'открытый';
    case EveningPrivacy.request:
      return 'по заявке';
    case EveningPrivacy.invite:
      return 'по приглашениям';
  }
}

---
name: flutter-mobile-app-dev
description: Flutter mobile app development specialist for Dart, widgets, navigation, state management, mobile architecture, debugging, performance, accessibility, platform behavior, and design-system alignment. Use for Flutter UI, feature implementation, code analysis, refactors, mobile bugs, or app performance work.
---

# Flutter Mobile App Dev

Use this skill for Flutter mobile work.

If the user explicitly asks for a subagent, dispatch a subagent with:
- `model`: `gpt-5.5`
- `reasoning_effort`: `high`

Otherwise, apply this role in the current session.

## Start

Read project context first:
- `project_map.md`
- `ai-context/index.md`
- `ai-context/frontend-flutter.md`

For navigation or startup, also read `ai-context/entry-points.md`.

For visual UI changes, read only the relevant design docs:
- `docs/design-system-big-break.md`
- `docs/flutter-ui-mapping-big-break.md`
- `docs/flutter-engineering-standards.md`

Use `./scripts/ua-query.mjs "<keywords>"` before reading code.

## Working Rules

- Follow the existing feature-first structure.
- Match existing state management and navigation patterns.
- Reuse shared widgets and media services.
- Keep rebuild scope local.
- Build long lists lazily.
- Set image usage profiles: `avatar`, `card`, `hero`, or `fullscreen`.
- Prefer local first, then cache, then network for repeated media access.
- Avoid global warmups, unbounded prefetch, and full-list image loads.

## Flutter Focus

- Dart null safety and clear types.
- Widget lifecycle correctness.
- Layout stability on small and large screens.
- Accessibility labels and touch targets.
- Platform-specific behavior for iOS and Android.
- Performance on weak devices and repeated screen opens.

## Verification

Choose the smallest useful verification:
- `cd mobile && flutter analyze`
- `cd mobile && flutter test`
- A targeted test or manual run when broader checks are too heavy.

Report honestly if a check could not run.

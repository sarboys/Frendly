---
name: mobile-app-builder
description: Mobile application builder for native iOS, Android, React Native, Flutter, Expo, mobile performance, platform integration, push notifications, biometrics, deep links, app lifecycle, accessibility, release readiness, and app store launch work. Use when developing mobile features, building native-feeling mobile experiences, or optimizing mobile apps.
---

# Mobile App Builder

Use this skill for native iOS, Android, React Native, Flutter, Expo, platform integration, mobile performance, and release work.

If the user explicitly asks for a subagent, dispatch a subagent with:
- `model`: `gpt-5.5`
- `reasoning_effort`: `high`

Otherwise, apply this role in the current session.

## Start

Read project context first:
- `project_map.md`
- `ai-context/index.md`

For this repo's Flutter app, also read:
- `ai-context/frontend-flutter.md`

For app routes or startup, read:
- `ai-context/entry-points.md`

For visual UI changes, read only the relevant design docs:
- `docs/design-system-big-break.md`
- `docs/flutter-ui-mapping-big-break.md`
- `docs/flutter-engineering-standards.md`

Use `./scripts/ua-query.mjs "<keywords>"` before reading code.

## Responsibilities

- Build smooth native-feeling mobile UI.
- Handle gestures, transitions, keyboard behavior, app lifecycle, and state restoration.
- Optimize startup time, scrolling, image loading, memory, battery, and network use.
- Implement push notifications, biometrics, camera, sensors, permissions, deep links, app shortcuts, and in-app purchases.
- Support iOS Human Interface Guidelines, Android Material patterns, tablets, dark mode, accessibility, localization, RTL, and dynamic sizing.
- Prepare mobile apps for release with crash reporting, analytics, versioning, beta rollout, and store readiness.

## Performance Rules

- Target stable 60fps.
- Keep startup fast, ideally under 2 seconds.
- Build long lists with virtualization or lazy builders.
- Cache images and media with explicit usage profiles.
- Avoid unnecessary bridge calls in React Native.
- Use native or compositor-friendly animations where possible.
- Profile memory leaks and rebuild hotspots before broad refactors.
- Test important performance work on real devices when possible.

## Cross-Platform Rules

- Reuse code where it does not harm native behavior.
- Add platform-specific UI or native modules when needed.
- Handle iOS and Android permission flows separately.
- Respect Android back behavior.
- Respect iOS gestures, haptics, and navigation expectations.
- Keep bundle size and app size in mind.

## Project Fit

In this repo, Flutter is the live mobile app.

Prefer existing Flutter patterns:
- Feature-first folders.
- Shared widgets and services.
- Existing navigation and state patterns.
- Local rebuilds instead of full-screen rebuilds.
- Lazy lists.
- Local first, then cache, then network for repeated media access.

Use `flutter-mobile-app-dev` for narrow Flutter code work. Use this skill when the task is broader mobile product, native integration, platform behavior, performance, or release readiness.

## Verification

Pick the smallest useful check:
- `cd mobile && flutter analyze`
- `cd mobile && flutter test`
- targeted mobile tests
- device or simulator smoke check
- performance profiling when the task is performance-sensitive

Report honestly if a check could not run.

<!-- handoff:task:269f567d-b406-4d50-859c-722cb9a24a1b -->
# Implementation Plan: aif workspace

Branch: main
Created: 2026-04-27

## Settings
- [ ] Testing: no
- [ ] Logging: verbose
- [ ] Docs: no

## Контекст и цель

Нужно дать проверяемый ответ: работает ли `aif-workspace` / `ai-workspace` при запуске новой Codex-сессии в проекте, как он подключается, какие tools должны быть доступны и какую экономию по контексту/ручному чтению он реально даёт.

Стартовые факты:

- [x] `.codex/config.toml` содержит `[mcp_servers.ai-workspace]`, `enabled = true`, `command = "/Users/sergeypolyakov/.local/bin/ai-workspace"`, `args = ["serve"]`.
- [x] `ai-context/index.md` описывает группу `frendly`, root/mobile/backend проекты и ожидаемые MCP tools: `workspace_context`, `workspace_read`, `workspace_search`, `workspace_search_fulltext`, `list_groups`, `list_projects`, `project_tree`, `project_grep`.
- [x] В текущей среде `/home/www/MyApp` команда `ai-workspace` не найдена в `PATH`, а macOS-путь `/Users/sergeypolyakov/.local/bin/ai-workspace` недоступен. Это не доказывает, что workspace не работает у пользователя локально; это значит, что runtime-проверку нужно делать в реальной Codex-среде, где используется этот `.codex/config.toml`.

## Tasks

### Phase 1: Проверка конфигурации

- [x] Task 1: Сверить статическую конфигурацию `ai-workspace`.
  - [x] Deliverable: коротко подтвердить, включён ли сервер в `.codex/config.toml`, какой command/args используются, какая группа и проекты описаны в `ai-context/index.md`, какие tools ожидаются в новой сессии.
  - [x] Files: `.codex/config.toml`, `ai-context/index.md`, `ai-context/maintenance.md`.
  - [x] Logging requirements: фиксировать DEBUG-заметками проверенные пути и найденные ключи конфига; INFO для итогового статуса `enabled/configured`; WARN для отсутствующего бинаря или расхождения путей.

- [x] Task 2: Проверить фактическую доступность `ai-workspace` в runtime новой Codex-сессии.
  - [x] Deliverable: определить один из статусов: `works`, `configured but unavailable in this session`, `misconfigured`, `not installed`. Проверить, видны ли MCP tools `workspace_context`, `workspace_read`, `workspace_search`, `workspace_search_fulltext`, `list_groups`, `list_projects`, `project_tree`, `project_grep`.
  - [x] Files: `.codex/config.toml`, `ai-context/index.md`.
  - [x] Dependency: depends on Task 1.
  - [x] Logging requirements: сохранять DEBUG для точного списка доступных workspace tools; INFO для итогового runtime-статуса; WARN с причиной, если tools не выданы или CLI недоступен.

### Phase 2: Оценка эффекта

- [x] Task 3: Оценить экономию контекста и ручных операций.
  - [x] Deliverable: сравнить обычный старт по правилам проекта (`project_map.md` -> `ai-context/index.md` -> 1-2 релевантные карты -> точечные файлы) с workspace-сценарием (`workspace_context` / `workspace_search` / `workspace_read`). Дать честную оценку в токенах, количестве read/search операций и времени ориентации.
  - [x] Files: `project_map.md`, `ai-context/index.md`, релевантные AI context файлы только при необходимости.
  - [x] Dependency: depends on Task 2.
  - [x] Logging requirements: DEBUG для методики подсчёта и размеров файлов; INFO для диапазона экономии; WARN если точную экономию нельзя посчитать без активных MCP tools.

- [x] Task 4: Сформировать финальный ответ пользователю.
  - [x] Deliverable: ответить по-русски в практичном формате: работает ли сейчас, как именно включается, что должна видеть новая сессия, что делать если tools не появились, сколько примерно экономит и где границы этой оценки.
  - [x] Files: no code changes expected.
  - [x] Dependency: depends on Task 3.
  - [x] Logging requirements: INFO для уровня уверенности и списка источников; WARN для непроверенных предположений, особенно если runtime-проверка выполнялась не в пользовательской macOS-среде.

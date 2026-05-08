# План очистки старого UI в mobile

**Summary**

- Цель: убрать старый UI код из `mobile/`, который остался после перехода на v5.
- `front/` не трогать вообще. Не читать, не менять, не добавлять в git.
- Full screen `/search`, legacy posters UI, старые shared widgets, poster providers, poster tests удалить.
- Backend контракты не ломать без отдельной задачи. Legacy `poster` в chat ticket source оставить только для чтения старых данных.

**Public API Changes**

- Удалить mobile routes `AppRoute.search`, `AppRoute.posters`, `AppRoute.poster`.
- Добавить reusable V5 search modal API, например `showV5SearchModal(BuildContext context)`.
- Удалить `CreateMeetupScreen.posterId`, `_poster`, `posterId` submit payload.
- Удалить mobile `Poster` model, `fetchPosters`, `fetchPosterDetail`, `posterFeedProvider`, `posterDetailProvider`, `featuredPostersProvider`.
- `GroupedSearchResults` в mobile больше не парсит `posters`.

**Checklist**

- [x] Создать план файл `.ai-factory/plans/mobile-old-ui-cleanup.md` с этим чеклистом.
- [x] Зафиксировать границу: любые изменения только в `mobile/`, `ai-context/`, `scripts/` при нужде. `front/` исключен.
- [x] Перед удалением выполнить поиск ссылок: `rg -n "AppRoute\\.search|AppRoute\\.posters|AppRoute\\.poster|Poster|posterId|BbSearchBar|BbChip|BbEventCard|showEventFilterSheet" mobile/lib mobile/test`.
- [x] Вынести V5 search modal из `mobile/lib/features/tonight/presentation/tonight_screen.dart` в новый reusable файл.
- [x] Подключить новый `showV5SearchModal` в Home, Chats, Map вместо `context.pushRoute(AppRoute.search)`.
- [x] В modal убрать переходы на удаленный `/search`. Для meetup/all вести на `/tonight`, для clubs на `/communities`, для people на `/dating`, для routes на `/routes`, для affiche на `/affiche`.
- [x] Удалить `mobile/lib/features/search/`.
- [x] Удалить `mobile/lib/shared/widgets/event_filter_sheet.dart` и `mobile/lib/shared/models/event_filters.dart`, если после поиска нет живых ссылок.
- [x] Удалить `mobile/lib/features/posters/`.
- [x] Перевести Create Meetup на Affiche only: убрать `posterId`, `_poster`, `_loadingPoster`, `_applyPosterSelection`, `_PosterPreviewCard`, `posterId` в `createEvent`.
- [x] Оставить `showAfficheEventPickerSheet` как единственный picker для кнопки `Афиша`.
- [x] Удалить `Poster` imports из `backend_repository.dart`, `app_providers.dart`, `create_meetup_screen.dart`, тестов.
- [x] Удалить `/posters` helpers из `BackendRepository`.
- [x] Удалить poster providers из `app_providers.dart` и invalidation в `app_session_controller.dart`.
- [x] Удалить `posters` из `GroupedSearchResults` mobile parsing и `postersLimit` из mobile search request.
- [x] Удалить old shared widgets: `bb_search_bar.dart`, `bb_chip.dart`, `bb_event_card.dart`.
- [x] Удалить тесты этих old widgets.
- [x] Удалить search and posters screen tests. Заменить их тестами на V5 modal, Create Meetup Affiche flow, router without old routes.
- [x] Убрать local fallback gathering images из `TonightScreen`, если после удаления они нужны только для fake Home data.
- [x] Удалить из `mobile/pubspec.yaml` unused assets `event-wine.jpg`, `event-cinema.jpg`, если `rg` подтвердит ноль ссылок.
- [x] Удалить unused files из `mobile/assets/images/`, если они не объявлены в `pubspec.yaml` и не используются.
- [x] Обновить `ai-context/frontend-flutter.md`: `/search` и legacy Posters больше не часть mobile UI.
- [x] Обновить `ai-context/entry-points.md`: убрать routes `/search`, `/posters`, `/poster/:posterId`.
- [x] Проверить, что `front/` не изменился: `git diff -- front`.
- [x] Проверить, что старых символов нет: `rg -n "BbSearchBar|BbChip|BbEventCard|AppRoute\\.search|AppRoute\\.posters|AppRoute\\.poster|features/search|features/posters" mobile/lib`.
- [x] Запустить `cd mobile && flutter analyze`.
- [x] Запустить focused tests: router, create meetup, affiche, tonight, chats, map, backend repository.
- [x] Запустить `cd mobile && flutter test`.
- [x] Запустить `bash scripts/update-understand-graph.sh`.

**Verification notes**

- `flutter analyze` прошел без ошибок.
- Focused tests по cleanup зонам прошли.
- Полный `flutter test` запущен, но общий suite остался красным на старых тестах вне cleanup.
- `scripts/update-understand-graph.sh` прошел без ошибок.

**Test Plan**

- `cd mobile && flutter analyze`
- `cd mobile && flutter test test/navigation/app_router_test.dart`
- `cd mobile && flutter test test/features/create_meetup/presentation/create_meetup_screen_test.dart`
- `cd mobile && flutter test test/features/affiche/presentation/affiche_events_screen_test.dart`
- `cd mobile && flutter test test/features/parity/tonight_screen_test.dart`
- `cd mobile && flutter test`
- `bash scripts/update-understand-graph.sh`

**Assumptions**

- `front/` нельзя менять.
- Удаляем именно mobile UI, не backend.
- Legacy `poster` ticket source в chat model остается, чтобы старые встречи не падали при чтении.
- Если backend еще возвращает `posters` в `/search`, mobile просто игнорирует это поле.

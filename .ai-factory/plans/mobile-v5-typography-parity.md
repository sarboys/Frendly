# План ревизии типографики Flutter V5

> Для реализации по задачам используй чекбоксы ниже. Ничего не считать готовым, пока рядом с пунктом нет `[x]`.

**Статус:** основная статическая ревизия выполнена, ручная визуальная сверка остается.  
**Дата:** 2026-05-07.  
**Зона:** только Flutter V5 typography parity.  
**Цель:** привести Flutter к `front/src/pages/v5/` и `front/src/pages/HomeV5.tsx` по типографике, размерам текста, весам, line-height, letter-spacing, внутренним отступам блоков и расстояниям между блоками.

## Граница задачи

- [x] Не менять бизнес-логику.
- [x] Не менять API, DTO, модели, providers, navigation.
- [x] Не менять цвета, изображения, медиа, тени, радиусы, если это не связано напрямую с размером текстового блока.
- [x] Не менять `front/`. Он только эталон.
- [x] Не добавлять новые фичи.
- [x] Не добавлять новый дизайн слой без явной нужды.
- [x] Все правки делать минимально, через существующие Flutter точки: `AppTextStyles`, `AppSpacing`, `bb_v5_ui.dart`, конкретные V5 presentation файлы.

## Источники правды

### React V5

- [x] `front/src/pages/v5/_tokens.ts`: базовые цвета, шрифты, веса, радиусы, тени.
- [x] `front/src/pages/v5/_ui.tsx`: `Kicker`, `Section`, `HeroTitle`, `TopBar`, `Pill`, `Chip`.
- [x] `front/src/pages/v5/_BottomNav.tsx`: нижняя навигация V5.
- [x] `front/src/pages/HomeV5.tsx`: главный Home экран.
- [x] `front/src/components/bigbreak/PosterFilterSheet.tsx`: filter sheet для V5 афиши.
- [x] `front/src/components/bigbreak/PosterPickerSheet.tsx`: picker sheet для выбора афиши.
- [x] `front/src/components/bigbreak/LaunchEveningSheet.tsx`: launch sheet для вечернего маршрута.
- [x] `front/src/components/bigbreak/PerkRedeemSheet.tsx`: partner perk sheet.
- [x] `front/src/components/bigbreak/screens/EveningPlan.tsx`: evening plan timeline and locked surface.
- [x] `front/src/components/bigbreak/screens/UserProfile.tsx`: public profile typography.
- [x] `front/src/components/bigbreak/screens/Report.tsx`: report flow typography.
- [x] `front/src/components/bigbreak/screens/SafetyHub.tsx`: safety hub and SOS sheets typography.
- [x] `front/src/components/bigbreak/screens/Permissions.tsx`: standalone permissions flow typography.
- [x] `front/src/components/bigbreak/screens/Verification.tsx`: verification flow typography.
- [x] Все экраны `front/src/pages/v5/*.tsx`: конкретные размеры, отступы, line-height, letter-spacing.
- [x] `front/src/index.css`: глобальные font rules, font smoothing, базовые CSS переменные.
- [x] `front/tailwind.config.ts`: font families, spacing shorthand, token mapping.

### Flutter

- [x] `mobile/lib/app/theme/app_text_styles.dart`: общая типографика Flutter.
- [x] `mobile/lib/app/theme/app_spacing.dart`: шкала отступов.
- [x] `mobile/lib/app/theme/app_theme.dart`: Material text theme, buttons, chips, inputs, nav labels.
- [x] `mobile/lib/shared/widgets/bb_v5_ui.dart`: V5 primitives.
- [x] `mobile/lib/shared/widgets/bb_bottom_nav.dart`: shared bottom nav.
- [x] `mobile/lib/shared/widgets/bb_chat_bubble.dart`: chat bubbles typography.
- [x] `mobile/lib/shared/widgets/bb_pinned_meetup_card.dart`: pinned meetup card.
- [x] `mobile/lib/shared/widgets/bb_system_overlays.dart`: announcement and toast typography.
- [x] `mobile/lib/features/affiche/presentation/affiche_filters.dart`: shared search and chip controls.
- [x] `mobile/lib/features/affiche/presentation/affiche_event_picker_sheet.dart`: picker sheet для CreateMeetup.
- [x] `mobile/lib/features/evening_plan/presentation/evening_plan_screen.dart`: evening plan sheets and controls.
- [x] `mobile/lib/features/user_profile/presentation/user_profile_screen.dart`: public profile and actions sheet.
- [x] `mobile/lib/features/report/presentation/report_screen.dart`: report flow.
- [x] `mobile/lib/features/safety/presentation/safety_hub_screen.dart`: safety hub and SOS sheets.
- [x] `mobile/lib/features/permissions/presentation/permissions_screen.dart`: standalone permissions flow.
- [x] `mobile/lib/features/verification/presentation/verification_screen.dart`: verification flow.
- [x] V5 presentation files under `mobile/lib/features/**/presentation/`.

## Текущие риски

- [x] В Flutter много локальных `fontSize`, `letterSpacing`, `height`, `FontWeight`, `copyWith`.
  Отчет: пока найдено много локальных override в feature files. Самые крупные зоны ниже.

- [x] Самые крупные зоны по количеству локальных текстовых override:
  - `mobile/lib/features/tonight/presentation/tonight_screen.dart`
  - `mobile/lib/features/evening_plan/presentation/evening_plan_screen.dart`
  - `mobile/lib/features/chats/presentation/chats_screen.dart`
  - `mobile/lib/features/create_meetup/presentation/create_meetup_screen.dart`
  - `mobile/lib/features/dating/presentation/dating_screen.dart`

- [x] `AppTextStyles` почти везде ставит `letterSpacing: 0`.
  Отчет: `front/v5` часто использует `tracking-tight`, `tracking-[-0.035em]`, `0.14em`, `0.18em`, `0.22em`, `0.24em`.

- [x] В `front/v5` встречаются дробные размеры: `9.5`, `10.5`, `11.5`, `12.5`, `13.5`, `14.5`, `15.5`.
  Отчет: Flutter должен повторять их там, где они влияют на плотность и визуальный ритм.

- [x] Не все Flutter экраны используют V5 primitives.
  Отчет: если локальный текст совпадает с эталоном, оставляем. Если повторяется в 2 или более местах, переносим в существующий helper.

## Целевая матрица ролей

Заполняй `React` и `Flutter` фактом из кода перед правкой. В `Result` пиши, что изменилось.

| Роль | React source | Flutter source | Требование | Result |
|---|---|---|---|---|
| Screen title | `_ui.tsx`, screen files | `AppTextStyles.screenTitle`, `bbV5DisplayStyle`, local title | Проверить Sora, size, weight, height, letterSpacing | Базовый tracking приведен к `-0.02em`. |
| Hero title | `_ui.tsx`, HomeV5, detail screens | `BbV5HeroTitle`, local hero | Проверить Sora, serif accent, height, tracking | `bbV5DisplayStyle` и `BbV5HeroTitle` теперь считают React `tracking-tight` от размера. |
| Kicker | `_ui.tsx`, screen sections | `bbV5KickerStyle`, `BbV5Kicker` | Проверить 10px, Sora, semibold, uppercase spacing | Сверено с React `0.24em`, без правок. |
| Section title | `_ui.tsx`, `Section` | `BbV5Section`, local section headers | Проверить top margin, bottom gap, px 1 mapping | Gap после header исправлен до `12`. |
| Card title | screen cards | `AppTextStyles.cardTitle`, local card titles | Проверить 13.5 to 18px, Sora, semibold, tight leading | Shared title tracking приведен к `-0.02em`. |
| List title | lists, rows | `AppTextStyles.itemTitle`, local rows | Проверить 13 to 15.5px, Sora, semibold | Shared title tracking приведен к `-0.02em`. |
| Body | paragraphs | `AppTextStyles.body`, `bodySoft` | Проверить Manrope, 12 to 15px, relaxed where needed | Пока без глобальной правки, локальные body сверяются по экрану. |
| Meta | dates, places, helper copy | `AppTextStyles.meta` | Проверить 10.5 to 13px, muted color, line-height | Пока без глобальной правки, локальные meta сверяются по экрану. |
| Caption | badges, labels | `AppTextStyles.caption` | Проверить 9 to 11.5px, compact height | Точечно исправлены V5 label roles в Welcome, Paywall, Settings, Dating. |
| Chip | `_ui.tsx`, filter rows | `BbV5Chip`, local chips | Проверить height, padding, 11.5px, letterSpacing 0.02em | `BbV5Chip` и SearchModal chip сверены. |
| Button | `_ui.tsx`, screen CTAs | `BbV5PillButton`, Material buttons | Проверить 11 to 15px, Sora, semibold, vertical rhythm | `BbV5PillButton` зафиксирован с `height: 1.1`, `letterSpacing: 0`. |
| Input | search, phone, create forms | `BbV5SearchPill`, TextField styles | Проверить 13 to 16px, placeholder weight, dense height | `BbV5SearchPill` приведен к Manrope 13, regular, height 1.2. |
| Nav label | `_BottomNav.tsx`, HomeV5 nav | `bb_bottom_nav.dart` | Проверить 9.5px, Sora, semibold, letterSpacing 0.04em | Сверено, Flutter уже совпадает. |
| Numeric counters | Home metrics, streak, stats | local numeric styles | Проверить tabular nums, Sora, size, tight tracking | Повторно пройдено: Home, Profile, Dating, Chats, Clubs, Affiche, Routes, MeetupDetail, CreateMeetup, PhoneAuth, Onboarding, Streak, MemoryMap, Paywall, Splash. Добавлены `FontFeature.tabularFigures()` на числовые роли. |

## Общий чеклист токенов

- [x] Сверить `fontDisplay`, `fontBody`, `fontSerif` из React с Flutter font families.
- [x] Сверить веса `regular`, `medium`, `semibold`. Убрать лишний `bold`, если в React там `semibold`.
- [x] Проверить, где React реально использует `font-bold`. Не заменять его глобально.
- [x] Сверить `bbV5KickerStyle` с React `Kicker`.
- [x] Сверить `bbV5DisplayStyle` с React `HeroTitle` и display usage.
- [x] Сверить `BbV5HeroTitle` line-height. React `HeroTitle` использует `leading-tight`.
- [x] Сверить `BbV5Section`: React `Section` имеет `mt-6`, header `mb-3`, `px-1`.
- [x] Сверить `BbV5PillButton`: React `Pill` имеет `h-8 px-3 text-[11px]` или `h-10 px-4 text-[12px]`.
- [x] Сверить `BbV5Chip`: React `Chip` имеет `h-8 px-3 text-[11.5px]`, `letterSpacing: 0.02em`.
- [x] Сверить `BbV5SearchPill`: React search pills обычно `h-11`, input `text-[13px]`.
- [x] Сверить Material theme buttons. Не ломать shared non-V5 экраны.
- [x] Сверить bottom nav text, icon gap, height, badge text.

## Чеклист экранов

Для каждого экрана заполняй отчет:

```text
React:
Flutter:
Проверено:
Расхождения:
Исправлено:
Визуальная проверка:
Статус:
```

### Home

- [x] React: `front/src/pages/HomeV5.tsx`
- [x] Flutter: `mobile/lib/features/tonight/presentation/tonight_screen.dart`
- [x] Header brand kicker, city meta, action button text.
- [x] Hero date, main headline `44px`, line-height `0.95`, tracking `-0.035em`.
- [x] Section rhythm: `mb-7`, `mb-3`, `gap-3`, `space-y-3`.
- [x] Gathering, dating, affiche, routes, pulse, metrics, quick links, AI CTA.
- [x] Bottom nav labels, badges, FAB spacing.
- [x] Report:
  React: `front/src/pages/HomeV5.tsx`.
  Flutter: `mobile/lib/features/tonight/presentation/tonight_screen.dart`.
  Проверено: hero title, brand kicker, section rhythm, gathering cards, dating rail, affiche cards, routes, pulse, metrics, personal quick links, AI CTA, bottom nav, create FAB, city picker.
  Расхождения: section gaps were mostly `24` instead of React `mb-7`; Home route titles and card subtitles used tighter or wider rhythm; metrics unit tracking did not follow the numeric parent; quick portal cards had larger icon and inner gap than React; city picker title inherited compressed display tracking; city picker outer inset was `20` instead of React `16`; city picker geo button used Manrope `15px`; bottom nav unread badge was smaller than V5 unread badge role.
  Исправлено: Home gaps set to `28`, card gaps aligned to React `gap-3` and `mt-0.5/mt-2.5`, route title line-height and metadata gap corrected, metric unit tracking corrected, quick portal icon/gap/title/subtitle sizes corrected, city picker title/search/button/row typography and inset aligned, bottom nav unread badge set to `20px` with Sora `10px`. Radar legend оставлен `9.5px`, потому что React `10.5px` не помещается в Flutter card width without scaling, and parity test forbids `FittedBox`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Welcome

- [x] React: `front/src/pages/v5/Welcome.tsx`
- [x] Flutter: `mobile/lib/features/welcome/presentation/welcome_screen.dart`
- [x] H1 `34px`, `leading-[1.05]`, tracking tight.
- [x] Body `14px`, `leading-relaxed`.
- [x] Primary CTA `15px`, secondary CTA `14px`.
- [x] Social divider and terms caption.
- [x] Report:
  React: divider `10px`, semibold, `letterSpacing: 0.18em`.
  Flutter: `_AuthDivider`.
  Расхождения: divider был `letterSpacing: 0`.
  Исправлено: divider `letterSpacing: 1.8`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Splash

- [x] React: `front/src/pages/v5/Splash.tsx`
- [x] Flutter: `mobile/lib/features/splash/presentation/splash_screen.dart`
- [x] Wordmark, compact mark, animated text sizes.
- [x] InstrumentSerif accent only where React uses it.
- [x] Report:
  React: compact logo `Fr` is `30px`, bold, `letterSpacing: -0.04em`; final wordmark is `28px`, first letter Sora semibold, rest InstrumentSerif italic; tagline is `12px`, `letterSpacing: 0.18em`.
  Flutter: `_LiquidLogo`, `_BrandReveal`, `_LiquidWord`.
  Расхождения: logo tracking был не задан, tagline была bold с меньшим tracking, final wordmark был крупнее и полностью Sora.
  Исправлено: `Fr` получил `-1.2`, tagline `12px`, regular, `2.16`, final wordmark `28px` с serif italic accent.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### PhoneAuth

- [x] React: `front/src/pages/v5/PhoneAuth.tsx`
- [x] Flutter: `mobile/lib/features/phone_auth/presentation/phone_auth_screen.dart`
- [x] H1 `28px`, phone input `16px`, OTP `24px`.
- [x] Country button `14px`, menu rows `13px`.
- [x] Helper and resend text.
- [x] Report:
  React: H1 `28px`, accent InstrumentSerif italic; body `13.5px`; country `14px`; phone field `16px`; OTP cells `56x64`, text `24px`; helper `11px`; resend `12.5px`.
  Flutter: `_PhoneStep`, `_OtpStep`, `_PhoneAuthTitle`, `BbPhoneNumberField`.
  Расхождения: H1 accent отсутствовал, phone input был `18px`, OTP cells и digit были крупнее, helper и resend не повторяли размеры React. Country picker использовал дефолтный `ListTile`, а phone field был вложен в общий card padding вместо React `h-14` cells.
  Исправлено: добавлен `_PhoneAuthTitle`, phone field `16px`, country `14px`, phone input/country cells `56px` with `gap 8`, country picker rows `13px`/flag `18px`/`px-4 py-3`, OTP `56x64` and `24px`, helper `11px`, resend `12.5px`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Onboarding

- [x] React: `front/src/pages/v5/Onboarding.tsx`
- [x] Flutter: `mobile/lib/features/onboarding/presentation/onboarding_screen.dart`
- [x] Step title, helper text, option cards, chips, CTA.
- [x] Birthday, contact, permissions copy.
- [x] Report:
  React: step title `26px`, `leading 1.1`, serif italic last word; subtitle `13px`; birthday labels `10px`, `0.16em`; birthday inputs `56px`, text `16px`; permission title `14px`, subtitle `11.5px`; vibe subtitle `12.5px`.
  Flutter: `_buildStepHeading`, `_OnboardingTitle`, `_BirthPartField`, `_ChoiceCard`, `_PermissionCard`, contact field styles.
  Расхождения: step title был `28px`, subtitle `13.5px`, birthday had extra kicker, labels used default `0.24em`, permission text was larger or denser.
  Исправлено: step title `26px`, subtitle `13px`, serif accent, birthday label tracking `1.6`, input height `56`, field gaps `10`, permission title and subtitle sizes, vibe subtitle size and gap.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Permissions

- [x] React: `front/src/components/bigbreak/screens/Permissions.tsx`
- [x] Flutter: `mobile/lib/features/permissions/presentation/permissions_screen.dart`
- [x] Header back button, title, subtitle, permission tiles, privacy note, fixed CTA.
- [x] Report:
  React: H1 `28px`, `leading 1.15`, no tracking; subtitle `15px`, `mt-2`, `mb-7`; tile title `16px`, description `13px leading-snug`, `mt-0.5`; tile gap `12`; privacy note `12px leading-relaxed`, `mt-6`; fixed CTA `56px`, `16px`, `px-6`, `pt-4`, `pb-6`.
  Flutter: `PermissionsScreen`, `_PermissionTile`.
  Расхождения: H1 inherited compressed shared tracking, subtitle was `14px`, tile descriptions were `12px` and tighter, privacy note line-height was too tight, bottom CTA padding and radius differed from React.
  Исправлено: H1 `28px/1.15` with `letterSpacing: 0`, subtitle `15px`, section gaps `8/28`, tile title/description roles, privacy note `12px/1.625`, bottom CTA `px 24`, `pt 16`, `pb 24`, radius `16`, button text `16px`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Verification

- [x] React: `front/src/components/bigbreak/screens/Verification.tsx`
- [x] Flutter: `mobile/lib/features/verification/presentation/verification_screen.dart`
- [x] Header, hero card, step rows, privacy block, fixed CTA and helper.
- [x] Report:
  React: header title `16px`, no tracking; content `px-5`, `pt-6`, `pb-10`; hero title `22px leading-tight`, no tracking; hero copy `13px leading-relaxed`, `mt-1.5`; steps `mt-6`, gap `12`, title `15px`, subtitle `12px`; privacy title `13px`, privacy copy `12px leading-relaxed`; fixed CTA `56px`, `16px`, `pt-4`, `pb-6`, helper `12px`.
  Flutter: `VerificationScreen`, `_StepTile`.
  Расхождения: header/title inherited compressed tracking and wider side padding, content started at `8px` instead of React `24px`, hero title was `24px`, hero copy was `14px` with tighter line-height, step row gap was `12px` inside instead of React `16px`, last step spacing before privacy was too large, privacy copy used medium weight and tighter line-height, bottom CTA padding/radius differed.
  Исправлено: header side padding and title tracking, content top/bottom padding, hero title `22px/1.25`, hero copy `13px/1.625`, explicit step gaps, step title/subtitle tracking and weight, privacy radius/text line-height, bottom CTA `pt 16`, `pb 24`, radius `16`, helper weight.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Paywall

- [x] React: `front/src/pages/v5/Paywall.tsx`
- [x] Flutter: `mobile/lib/features/paywall/presentation/paywall_screen.dart`
- [x] FRENDLY+ pill, title, feature rows, price cards, fixed CTA.
- [x] Report:
  React: hero badge `10.5px`, semibold, `0.18em`; plan badge `10px`, semibold, `0.08em`.
  Flutter: `_PaywallHero`, `_PlanBadge`.
  Расхождения: оба бейджа были с `letterSpacing: 0`.
  Исправлено: hero badge `1.89`, plan badge `0.8`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Tonight Map, Radar

- [x] React: `front/src/pages/v5/Radar.tsx`
- [x] Flutter: `mobile/lib/features/map/presentation/map_screen.dart`
- [x] Top search, chips, map controls, create button.
- [x] Bottom nearby sheet title, card titles, meta labels.
- [x] Report:
  React: weather meta `10.5px`, event card meta `10.5px`, user count `10px`, compact map card gaps `2/6`.
  Flutter: `MapScreen`, radar filter row, event cards.
  Расхождения: small weather and event metadata were rounded up or had wider gaps.
  Исправлено: weather `10.5px`, event meta `10.5px`, user count `10px`, compact gaps aligned to React.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### SearchModal

- [x] React: `front/src/pages/v5/SearchModal.tsx`
- [x] Flutter: `mobile/lib/features/tonight/presentation/v5_search_modal.dart`
- [x] Search input `14px`, recent row `12.5px`, result title `13px`, meta `11px`.
- [x] Empty state title and copy.
- [x] Report:
  React: input `14px`, recent row `12.5px medium`, result title `13px semibold`, empty title `14px`, `py-10`.
  Flutter: `showV5SearchModal`, `_V5SearchFilterChip`, `_V5SearchResultRow`, `_V5SearchRecentRow`, `_V5SearchEmptyState`.
  Расхождения: chip tracking, result title tracking, recent row weight, empty state padding and title size.
  Исправлено: chip `0.23`, result title `-0.26`, recent row `w500`, empty state `vertical: 40`, title `14`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Chats

- [x] React: `front/src/pages/v5/Chats.tsx`
- [x] Flutter: `mobile/lib/features/chats/presentation/chats_screen.dart`
- [x] Header, search launcher, active rail, filter chips.
- [x] Chat row title, message preview, time, unread badge.
- [x] AI launch CTA.
- [x] Report:
  React: row preview gap `mt-0.5`, meta gap `mt-1.5`, empty state body `13px`, AI card body relaxed and CTA `13px`.
  Flutter: `ChatsScreen`, fallback/all/meetup/personal rows, AI card.
  Расхождения: row vertical rhythm был шире, empty state and AI CTA sizes differed.
  Исправлено: row gaps `2/6`, empty state `13px`, AI card body relaxed and CTA `13px`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### ChatRoom

- [x] React: `front/src/pages/v5/ChatRoom.tsx`
- [x] Flutter: `mobile/lib/features/meetup_chat/presentation/meetup_chat_screen.dart`
- [x] Flutter: `mobile/lib/features/personal_chat/presentation/personal_chat_screen.dart`
- [x] Flutter: `mobile/lib/shared/widgets/bb_chat_bubble.dart`
- [x] Top bar, pinned card, system pills, message text, timestamps, composer.
- [x] Voice bubble labels and durations.
- [x] Report:
  React: day divider `9.5px`, `0.22em`; bubble text `13.5px`, `leading-snug`; timestamps `9.5px`; composer input `13.5px`; pinned card title `20px`.
  Flutter: meetup and personal chat headers, `BbChatBubble`, `BbComposer`, `BbPinnedMeetupCard`.
  Расхождения: bubble text and composer were too large or dense, pinned meetup card had rounded sizes, headers missed smaller title/subtitle roles.
  Исправлено: bubbles `13.5px`, timestamps `9.5px`, author `10px`, composer `13.5px`, day divider tracking, pinned card title and ticket/action text, chat headers `14px/10.5px`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Dating

- [x] React: `front/src/pages/v5/Dating.tsx`
- [x] Flutter: `mobile/lib/features/dating/presentation/dating_screen.dart`
- [x] Header title, tabs, discover card overlay, prompt text, tags.
- [x] Likes list, action buttons, filter sheet.
- [x] Report:
  React: discover tags `10.5px`, semibold, `letterSpacing: 0.04em`; counter `10.5px`, `0.16em`; likes row title `15px leading-tight`; likes status `10px`, `0.06em`; filter title `18px`; filter buttons `13px`.
  Flutter: `_DatingTag`, `_DatingPhotoInfoOverlay`, `_buildLikes`, `_openFilters`.
  Расхождения: counter tracking был `0`; likes row title and gaps were tighter or wider than React; status tracking was missing; filter sheet header/section gaps and button font were off; photo overlay title was `30px` instead of `28px`.
  Исправлено: counter tracking `1.68`, likes title/gaps/status tracking, filter title/gaps/buttons, premium badge tracking, overlay title/about/meta/pill text sizes and action button text.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Clubs

- [x] React: `front/src/pages/v5/Clubs.tsx`
- [x] Flutter: `mobile/lib/features/communities/presentation/communities_screen.dart`
- [x] Hero, stats, search, filter button, club row title, badges, next meetup strip.
- [x] Report:
  React: header `22px leading-tight`, hero title `19px`, FRENDLY+ badge `10px 0.08em`, card title `15.5px`, description `11.5px leading-snug`, badges `9.5px 0.06em`, next meetup kicker `0.16em`.
  Flutter: `CommunitiesScreen`, `_CommunitiesHeroCard`, `_CommunityListCard`, `_CommunityNextMeetup`.
  Расхождения: title line-height was tighter, hero badge casing and tracking differed, card description and section gaps were off.
  Исправлено: header and hero line-height `1.25`, FRENDLY+ uppercase with `0.8`, card title/description rhythm, section gaps `24/12`, mini badges and next meetup kicker tracking.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### ClubDetail

- [x] React: `front/src/pages/v5/ClubDetail.tsx`
- [x] Flutter: `mobile/lib/features/communities/presentation/community_detail_screen.dart`
- [x] Header, hero initials, stats, tabs, news, social, meetup cards, member rows.
- [x] Report:
  React: hero title `20px leading-tight`, description `13px leading-relaxed`, tabs `11.5px`, news body `12px relaxed`, social labels `10px`, meetup title `14.5px`.
  Flutter: `CommunityDetailScreen`, hero card, tabs, overview, meetups, members.
  Расхождения: hero and news copy line-height was tighter, mood and stat gaps differed, social and meetup text roles were rounded.
  Исправлено: hero gaps and relaxed body, stat label gap, tab height `36`, news body `1.625`, social labels/values, meetup title/gaps.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Posters, Affiche

- [x] React: `front/src/pages/v5/Posters.tsx`
- [x] Flutter: `mobile/lib/features/affiche/presentation/affiche_events_screen.dart`
- [x] Flutter: `mobile/lib/features/affiche/presentation/affiche_event_card.dart`
- [x] Search, filter, chips, grid card title, date, place, price, empty state.
- [x] Report:
  React: grid date badge `9.5px 0.06em`, title `13px leading-tight`, venue `10.5px`, price `11.5px`, active filter badge `10px bold`, filter sheet title `22px`, group label `13px`, CTA `48px/14px`, radius scale `10.5px 0.14em`, picker search `48px/14px`.
  Flutter: `AfficheEventsScreen`, `_AfficheGridCardV5`, `_AfficheV5FilterButton`, `_AfficheFilterSheet`, `AfficheSearchField`, `AfficheEventPickerSheet`.
  Расхождения: date badge missed tracking, title line-height was lower, card padding and venue icon/gap differed, active filter counter was smaller. Filter sheet title, reset text, section labels, radius scale and CTA were using rounded Flutter defaults. Picker search reused the main Affiche `44px/13px` search pill, while React picker uses `48px/14px`; empty picker text was `12px`.
  Исправлено: date tracking `0.57`, title height `1.25`, content padding `12`, venue gap `6`, icon `10`, filter counter `18px/10px bold`, filter sheet title/reset/group labels/radius scale/CTA, picker search size and empty text size.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### PosterDetail, AfficheDetail

- [x] React: `front/src/pages/v5/PosterDetail.tsx`
- [x] Flutter: `mobile/lib/features/affiche/presentation/affiche_event_detail_screen.dart`
- [x] Ticket hero, title, date, info tiles, together callout, fixed CTA.
- [x] Report:
  React: hero title `24px leading-tight`, info tile label `10px 0.14em`, value `13px`, subtitle `11px`, description `13px leading-relaxed`, callout title `14px`, body `12px relaxed`, CTAs `13px/14px`.
  Flutter: `AfficheEventDetailScreen`, `_AfficheHeroTicket`, `_InfoTile`, `_TogetherCallout`.
  Расхождения: hero title was too tight, info labels had no tracking, description and callout copy used tighter line-height, CTA font sizes were default.
  Исправлено: hero height `1.25` and tracking `-0.6`, info labels `1.4`, value/subtitle gaps, description `1.625`, callout rhythm, CTA sizes `13/14`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Routes

- [x] React: `front/src/pages/v5/Routes.tsx`
- [x] Flutter: `mobile/lib/features/evening_routes/presentation/evening_routes_screen.dart`
- [x] Flutter: `mobile/lib/features/evening_routes/presentation/evening_route_card.dart`
- [x] Header, search, mood chips, count line, route cards, step pills, CTA.
- [x] Report:
  React: header `22px leading-tight`, mood chips `11.5px 0.02em`, route title `18px leading-tight`, blurb `12px relaxed`, meta `11px`, savings badge `10px 0.06em`, CTA `12.5px`.
  Flutter: `EveningRoutesScreen`, `EveningRouteCard`.
  Расхождения: titles and blurbs were too tight, meta spacing was larger, savings badge had no tracking.
  Исправлено: header/title height `1.25`, chip tracking `0.23`, blurb `1.625`, meta gap/icon size, step strip and CTA gaps, savings badge `0.6`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### RouteDetail

- [x] React: `front/src/pages/v5/RouteDetail.tsx`
- [x] Flutter: `mobile/lib/features/evening_routes/presentation/evening_route_detail_screen.dart`
- [x] Header, hero, metrics, budget row, steps timeline, sticky CTA.
- [x] Report:
  React: hero title `24px leading-tight`, blurb `13px relaxed`, metric value `14px leading-none`, step time `10px 0.16em`, title `14.5px`, venue `11.5px`, description `12px relaxed`, walk meta `10.5px`, CTA `14px`.
  Flutter: `EveningRouteDetailScreen`, `_RouteHero`, `_RouteStepCard`, sticky CTA.
  Расхождения: hero blurb and step descriptions were tighter, step time missed tracking, title gaps were wider.
  Исправлено: blurb `1.625`, metric value height `1`, stat gap `6`, step time tracking `1.6`, title height `1.25`, venue/description/walk gaps aligned.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### EveningPlan

- [x] React: `front/src/components/bigbreak/screens/EveningPlan.tsx`
- [x] React: `front/src/components/bigbreak/LaunchEveningSheet.tsx`
- [x] React: `front/src/components/bigbreak/PerkRedeemSheet.tsx`
- [x] Flutter: `mobile/lib/features/evening_plan/presentation/evening_plan_screen.dart`
- [x] Timeline detail sheet, launch sheet, perk redeem sheet, locked overlay, action buttons.
- [x] Report:
  React: launch title `18px`, subtitle `11px`, summary meta `11px`, step preview index/time `10px`, section labels `11px uppercase tracking-wider`, privacy title `13px`, privacy hint `11px`, participants title `13px`, launch CTA `15px`; perk sheet label `11px uppercase tracking-wider`, address `12px`, body items `13px`, form section `12px uppercase tracking-wider`, input `15px medium`, promo label `10px 0.2em`, promo code `22px tracking-wider`.
  Flutter: `_LaunchEveningSheet`, `_PerkRedeemSheet`, `_SheetActionButton`, `_RedeemField`, `_TinyPill`.
  Расхождения: launch summary meta and step preview were larger than React, section labels missed V5 tracking, participant badge inherited Manrope caption, perk labels and promo code were compressed, form inputs used semibold, redeem field padding was wider than React. Text casing kept as existing Flutter strings to avoid changing public copy and test selectors.
  Исправлено: launch meta, step preview index/time, section label tracking, privacy hints, participant title/subtitle/badge, perk header/bonus labels, intro body, form label/input weight, promo label/code tracking, redeem field padding and main sheet CTA size.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### MeetupDetail

- [x] React: `front/src/pages/v5/MeetupDetail.tsx`
- [x] Flutter: `mobile/lib/features/event_detail/presentation/event_detail_screen.dart`
- [x] Hero title, metric tiles, host block, quote, steps, attendee rail, map, conditions, perks, safety, fixed CTA.
- [x] Report:
  React: info tile label `10px 0.14em`, value `13px`, host gap `8`, quote `15px serif relaxed`, program title `13.5px`, attendee role `10px`, map title `13.5px`, perk/safety title `12.5px`, CTA `14px`.
  Flutter: `EventDetailScreen`, `_V5MeetupHeroCard`, `_V5InfoTile`, host, program, attendees, map, perk and safety cards.
  Расхождения: info label tracking and value line-height differed, quote and safety copy were tighter, program/attendee/map/perk roles were rounded; program count used heavier `w700` and lower tracking than React semibold kicker.
  Исправлено: info labels `1.4`, value `1.25`, host gaps, quote `15px/1.625`, program and attendee sizes, program count `10px` semibold with `0.18em`, map title `13.5`, perk/safety `12.5`, CTA `14`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### CreateMeetup

- [x] React: `front/src/pages/v5/CreateMeetup.tsx`
- [x] Flutter: `mobile/lib/features/create_meetup/presentation/create_meetup_screen.dart`
- [x] Flutter sheets: `mobile/lib/features/create_meetup/presentation/widgets/*.dart`
- [x] Sticky header, mode tabs, live preview, title input, icon rail, where, when, attach, vibe, capacity, lifestyle, price, access, gender, description, AI helper, visibility, bottom CTA.
- [x] Report:
  React: header title `15px`, mode tabs `12px`, preview title `24px leading-tight`, preview meta `11.5px`, field labels `10px 0.18em`, field value `13.5px`, description `13.5px relaxed`, AI title `13px`, visibility title `12.5px`, bottom helper `10.5px`.
  Flutter: `CreateMeetupScreen`, V5 atoms in the same file, picker sheets in `presentation/widgets`.
  Расхождения: preview title was too tight, title input padding was wider, field labels had default kicker tracking, description was `14px`, AI and visibility gaps were wider, CTA helper was `11px`; picker sheets still used older itemTitle/caption defaults with missing V5 kicker tracking, rounded input text roles and a place sheet button that inherited global Material `14px`.
  Исправлено: header and preview line-height, input padding and placeholder family, tag padding, field labels `1.8`, field values `1.25`, capacity label/counter, lifestyle/price hints, description `13.5px/1.625`, AI and visibility gaps, CTA helper `10.5px`; date, place, partner and route picker sheet titles, labels, search inputs, rows, chips and buttons aligned to V5 typography roles; place sheet custom action buttons use local V5 `13px` button text.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### AICreate

- [x] React: `front/src/pages/v5/AICreate.tsx`
- [x] Flutter: `mobile/lib/features/ai_create/presentation/ai_create_screen.dart`
- [x] Prompt, templates, vibes, time, budget, group size, generated plan.
- [x] Report:
  React: prompt textarea `14px`; template chips `11px`; vibe tile labels `11px`; CTA `14px`; generated plan title `20px`; time `15px bold`; tag `9px`, `0.16em`; place `13.5px`; subtitle `11px`.
  Flutter: `_AiCreateScreenState`, `_PromptTemplateChip`, `_VibeTile`, `_GeneratedPlanCard`, `_PlanStepRow`.
  Расхождения: mood section top gap was `24` instead of `16`; empty AI note was `11px`; generated plan tag had no tracking; time was semibold; row title line-height and subtitle gap were looser.
  Исправлено: mood gap `16`, note `11.5px`, time bold with height `1`, tag tracking `1.44`, place line-height `1.25`, subtitle gap `2`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### AIVoice

- [x] React: `front/src/pages/v5/AIVoice.tsx`
- [x] Flutter: `mobile/lib/features/ai_voice/presentation/ai_voice_screen.dart`
- [x] Mic card, dictated prompt, route preview, nearby people.
- [x] InstrumentSerif accent usage.
- [x] Report:
  React: phase label `10px bold`, `0.22em`, uppercase; idle copy `13px` relaxed; transcript `16px` InstrumentSerif italic; preset text `13px`; stop time `11px bold`, `0.1em`; stop title `15px`; stop subtitle `11.5px`; nearby match `10px`, `0.14em`; CTA `14px`.
  Flutter: `_AiVoiceScreenState`, `_PromptPreset`, `_RoutePlan`, `_StopRow`, `_NearbyPeople`, `_PersonCard`.
  Расхождения: phase label used default kicker and mixed case, idle copy and transcript were different sizes, preset text was too large, stop and person card labels missed React tracking.
  Исправлено: phase labels uppercase with `2.2` tracking, idle copy `13px`, transcript and preset `16/13px` serif italic, stop metadata sizes and tracking, nearby match tracking, CTA `14px`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Profile

- [x] React: `front/src/pages/v5/Profile.tsx`
- [x] Flutter: `mobile/lib/features/profile/presentation/profile_screen.dart`
- [x] Hero, name, social counters, Frendly+ card, intent, vibe, interests, about, history.
- [x] Report:
  React: profile name `20px`, `tracking-tight`; stats value `15px`, label `9.5px`; action buttons `12.5px`; Frendly+ title `14.5px`, copy `11.5px`; section content gap `10px`; about `13.5px` relaxed; history value `20px`, label `10.5px`.
  Flutter: `_ProfileHeroCard`, `_MetricTile`, `_FrendlyPlusCard`, `_ProfileSection`, `_VibeCard`, `_AboutCard`, `_HistoryGrid`.
  Расхождения: stats were smaller and taller, section gap was `12`, Frendly+ inner gap was wider, about line-height was tighter, history gap and tile ratio were off.
  Исправлено: name tracking `-0.4`, stats `15/9.5`, section gap `10`, Frendly+ gap `12/2`, about height `1.625`, history padding and gap.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### PublicUserProfile, Report

- [x] React: `front/src/components/bigbreak/screens/UserProfile.tsx`
- [x] React: `front/src/components/bigbreak/screens/Report.tsx`
- [x] Flutter: `mobile/lib/features/user_profile/presentation/user_profile_screen.dart`
- [x] Flutter: `mobile/lib/features/report/presentation/report_screen.dart`
- [x] Public profile name, location meta, trust counters, section labels, intent/interest chips, about copy, sticky actions.
- [x] Report header, warning card, reason rows, details textarea, block row, submit CTA.
- [x] Report:
  React: public profile name `22px`, location `13px`, trust value `16px`, trust label `11px`, section label `11px uppercase tracking-wider`, chips `13px semibold`, about `14px relaxed`, sticky actions `14px`; report title `16px`, warning title `14px`, warning copy `12px relaxed`, reason title `14px`, reason subtitle `12px`, details title/input `14px`, submit CTA `16px`.
  Flutter: `UserProfileScreen`, `_UserSection`, `_TrustCard`, `_showProfileActions`, `ReportScreen`, `_ReasonTile`.
  Расхождения: public profile location and trust counters were smaller than React, section labels had no tracking, chips were medium instead of semibold, about copy used tighter line-height, sticky action labels inherited body line-height. Report list started too high, warning copy was `14px`, section label was missing, reason titles were `15px`, details title was `15px`, textarea line-height was tighter, block row title used body style, bottom CTA padding/radius differed.
  Исправлено: location meta `13px`, trust value/label `16/11`, section labels Sora `11px` with `0.05em`, chips `13px` semibold, about and textarea copy relaxed, sticky action label height, actions sheet row titles, report list top gap, warning body, reason tiles, details block, block row and submit CTA rhythm.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### SafetyHub

- [x] React: `front/src/components/bigbreak/screens/SafetyHub.tsx`
- [x] Flutter: `mobile/lib/features/safety/presentation/safety_hub_screen.dart`
- [x] Header, trust score, SOS card, trusted contacts, included SOS list, safety groups, moderation rows, help card.
- [x] Add contact sheet, scope options, SOS confirm sheet, sent state.
- [x] Report:
  React: header title `16px`, trust title `16px`, trust meta `12px`, SOS title `15px`, SOS copy `12px relaxed`, SOS CTA `15px`; section labels `11px uppercase tracking-wider`, count `11px`, contact title `14px semibold`, contact meta `12px`, scope badge `10px tracking-wide`, included title `14px`, bullet `12.5px leading-snug`, group rows `14px/12px`, help copy `12px relaxed`, support CTA `13px`; add sheet title `17px`, channel labels `12px`, field labels `12px`, inputs `14px`, scope option `13px/11px`; SOS sheet title `17px`, intro `12.5px relaxed`, preview label `10px tracking-wider`, preview body `12.5px relaxed`, recipients `13.5px/11.5px`, sheet CTAs `14px`.
  Flutter: `SafetyHubScreen`, `_TrustScoreCard`, `_SosHeroCard`, `_TrustedContactsSection`, `_SosIncludedCard`, `_SafetyGroup`, `_ToggleRow`, `_ActionRow`, `_HelpCard`, `_AddContactSheet`, `_ConfirmState`, `_SentState`, `_SosRecipientRow`.
  Расхождения: section labels and scope/preview labels had no V5 tracking, several relaxed copy blocks used tighter `1.35`, bullet text used `1.25` instead of React snug, support and sheet CTAs inherited body/button line-height, sheet text fields used wider horizontal padding than React.
  Исправлено: label tracking, SOS/help/confirm/preview relaxed line-height, contact and group row title/meta rhythm, included card title gap and bullet line-height, scope badge tracking, channel/field/scope option line-height, sheet CTA line-height and text field `px` mapping. Text casing kept as existing Flutter strings to avoid changing public copy and test selectors.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Settings

- [x] React: `front/src/pages/v5/Settings.tsx`
- [x] Flutter: `mobile/lib/features/settings/presentation/settings_screen.dart`
- [x] Header, account accent, groups, row title, row subtext, switch labels, logout pill, version footer.
- [x] Report:
  React: footer `10.5px`, `letterSpacing: 0.16em`; group title uses `Kicker` rhythm.
  Flutter: version footer, `_SettingsHeader`, `_SettingsGroup`, row widgets.
  Расхождения: footer был `letterSpacing: 0`.
  Исправлено: footer `letterSpacing: 1.68`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Streak

- [x] React: `front/src/pages/v5/Streak.tsx`
- [x] Flutter: `mobile/lib/features/streak/presentation/streak_screen.dart`
- [x] Hero number, progress, calendar cells, reward rows, CTA.
- [x] Report:
  React: hero number `42px`, `-0.03em`, suffix `18px regular`; body `12.5px` relaxed; calendar meta `10.5px`; reward threshold `10px bold`, `0.18em`; reward title `14.5px`; reward subtitle `11.5px`; CTA `13px`.
  Flutter: `StreakScreen`, `_MonthMapCard`, `_LegendDot`, `_RewardCard`.
  Расхождения: suffix inherited `42px`, body was `12px`, reward kicker used default `0.24em`, title and subtitle sizes were rounded.
  Исправлено: hero suffix `18px`, hero tracking `-1.26`, body `12.5px`, calendar meta `10.5px`, reward threshold `1.8`, title `14.5px`, subtitle `11.5px`, CTA `13px`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### MemoryMap

- [x] React: `front/src/pages/v5/MemoryMap.tsx`
- [x] Flutter: `mobile/lib/features/memory_map/presentation/memory_map_screen.dart`
- [x] Intro text, memory cards, stats, footer note.
- [x] Report:
  React: intro `12px` relaxed and `mb-4`; active pin title `15px`, subtitle `11.5px`; avatar initials `10px`; stats value `18px`, label `10px`; footer note `10.5px`.
  Flutter: `_MemoryMapScreenState`, `_ActivePinCard`, `_PersonBubble`, `_MapStats`, `_StatCard`.
  Расхождения: intro gap was `14` not `20`, active pin line-height and subtitle size differed, initials were bolder and larger, stats gaps were `8`, footer note was `11px`.
  Исправлено: intro top `20` and height `1.625`, active pin title height `1.25`, subtitle `11.5px`, initials `10px Sora semibold`, stats gap `10`, label `10px`, footer `10.5px`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

### Perks

- [x] React: `front/src/pages/v5/Perks.tsx`
- [x] Flutter: `mobile/lib/features/perks/presentation/perks_screen.dart`
- [x] Kicker, perk row title, meta, action button, footer CTA.
- [x] Report:
  React: intro `12px` relaxed; venue label `10px bold`, `0.18em`; type `10px`; title `15.5px`; condition `11.5px`; activated label `11.5px`; locked label `10.5px`, `0.1em`; footer CTA `13px`.
  Flutter: `PerksScreen`, `_PerkTicket`.
  Расхождения: intro was tighter, venue used default kicker tracking, title was `16px`, type and condition were smaller or larger than React, locked label had no tracking.
  Исправлено: intro top `20` and height `1.625`, venue `1.8`, type `10px`, title `15.5px`, condition `11.5px`, activated `11.5px`, locked `10.5px` and `1.05`, CTA `13px`.
  Визуальная проверка: открыта как финальный шаг.
  Статус: статически сверено.

## Правила исправления

- [x] Сначала исправлять shared roles в `AppTextStyles` и `bb_v5_ui.dart`, если это не ломает другие экраны.
- [x] Локальные override оставлять там, где React сам задает локальное значение.
- [x] Если React использует дробный размер, Flutter может использовать такой же `double`.
- [x] Letter-spacing переводить из `em` в Flutter pixels: `fontSize * em`.
- [x] `tracking-tight` считать как примерно `-0.02em`, если в React не задано точное значение.
- [x] `tracking-[-0.035em]` считать как `fontSize * -0.035`.
- [ ] `leading-tight` сверять визуально, обычно `1.1` to `1.25` по роли.
- [x] `leading-none` использовать только для цифр, эмодзи, крупных hero counters.
- [x] Body copy с `leading-relaxed` не ужимать до плотного line-height.
- [x] Не заменять все `FontWeight.w700` массово. Сначала проверить React.
- [x] Не менять отступы, если они держат layout не из-за текста.

## Команды для аудита

```bash
rg --count "AppTextStyles\\.[a-zA-Z]+\\.copyWith\\(|TextStyle\\(|fontSize:|letterSpacing:|height:" mobile/lib/features mobile/lib/shared/widgets | sort
rg --count "text-\\[|font-|tracking|leading|mt-|mb-|gap-|px-|py-|space-y" front/src/pages/v5 front/src/pages/HomeV5.tsx | sort
rg -n "letterSpacing: 0|FontWeight\\.w700|fontSize: 44|fontSize: 28|fontSize: 9\\.5|fontSize: 10\\.5|fontSize: 11\\.5|fontSize: 12\\.5|fontSize: 13\\.5" mobile/lib/features mobile/lib/shared/widgets
```

## Финальная проверка

- [x] Проверить, что `front/` не изменился:

```bash
git diff -- front
```

- [x] Запустить Flutter analyzer:

```bash
cd mobile && flutter analyze
```

- [x] Запустить Flutter tests:

```bash
cd mobile && flutter test
```

- [x] Обновить Understand graph:

```bash
bash scripts/update-understand-graph.sh
```

## Итоговый отчет

Заполнить перед закрытием задачи.

- [ ] Все V5 экраны прошли ручную сверку на viewport 390x820.
- [x] Все роли текста из матрицы проверены статически.
- [ ] Все найденные расхождения либо исправлены, либо записаны с причиной.
- [ ] Shared typography не ломает non-V5 экраны.
- [x] `front/` без diff.
- [x] `flutter analyze` выполнен.
- [x] `flutter test` выполнен.
- [x] `update-understand-graph.sh` выполнен.

### Что исправлено

- Shared display title tracking в `AppTextStyles`: screen, section, card и item title теперь соответствуют React `tracking-tight`.
- `bbV5DisplayStyle` и `BbV5HeroTitle` считают `letterSpacing` от `fontSize`, чтобы hero title не был одинаково сжатым на разных размерах.
- `BbV5Section` получил gap `12`, как React `mb-3`.
- `BbV5PillButton` зафиксирован с `height: 1.1` и `letterSpacing: 0`, потому что React pill buttons не задают tracking.
- `BbV5SearchPill` приведен к Manrope 13, regular, height 1.2.
- Shared voice: `BbVoiceMessage` duration приведен к React `_voice.tsx` `10.5px` Sora semibold tabular; composer recording duration приведен к `12px` Sora semibold.
- Shared social actions: full and compact button labels lowered to React-like `12.5px` and `11.5px`, counters tightened.
- Chat shared: V5 message avatar switched to `28px`, author and timestamp offsets match React `px-1`, timestamps use tabular figures.
- Message action sheet: author preview, message preview and action rows aligned with V5 chat text roles.
- Composer attachment menu: V5 item text, icon size and row height aligned to React `13px`, `font-medium`, `16px` icon, `40px` row.
- System overlays: announcement label, title, message, CTA and city-limit toast text aligned with React `AnnouncementBanner.tsx` and `CityLimitToast.tsx`; label uses uppercase Sora `10px`, `height: 1.1`, `letterSpacing: 0.14em`.
- Chat members sheet: participant row avatar, title, meta, host label, invite row and search input sizes aligned to V5 member rows and search control rhythm.
- Meetup chat edit modal: header/title gaps changed to React `mb-4`, edit inputs use `px-4`, label line-height fixed.
- Numeric counters: added tabular figures across Home, Profile, Dating, Chats, Clubs, Affiche, Routes, MeetupDetail, CreateMeetup, PhoneAuth, Onboarding, Streak, MemoryMap, Paywall and Splash.
- Bottom nav unread badge приведен к V5 unread role: `20px`, horizontal padding `6`, Sora `10px`, tight leading.
- Home CityPicker приведен к React: modal inset `16`, title `18px` without compressed tracking, search `14px`, geo button `13px`, city row `13px/10.5px`.
- `font-bold` сверен точечно. Глобальной замены на `w700` нет; program count in MeetupDetail returned to semibold kicker.
- SearchModal: chip tracking, result title tracking, recent row weight, empty state padding and title size.
- Dating: prompt tags приведены к `10.5px` и `0.04em`.
- Welcome: social divider получил `letterSpacing: 0.18em`.
- Paywall: hero FRENDLY+ badge и plan badge получили React tracking.
- Settings: bottom sheets, option rows and version footer приведены к V5 typography roles.
- Splash: compact logo, tagline и final wordmark приведены к React размерам, tracking и serif accent.
- PhoneAuth: title accent, body, phone field, country button, country picker rows, OTP cells, helper и resend приведены к React.
- Onboarding: step title, subtitle, birthday labels and inputs, permission cards and vibe subtitles приведены к React.
- Permissions: standalone permission title, subtitle, tile titles/descriptions, privacy note and fixed CTA rhythm приведены к React.
- Verification: header, hero title/body, step rows, privacy block and fixed CTA rhythm приведены к React.
- Streak: hero number suffix, reward labels, calendar meta and CTA sizes приведены к React.
- MemoryMap: intro rhythm, active pin card, avatar initials, stats and footer note приведены к React.
- Perks: venue labels, title, condition, locked status and footer CTA приведены к React.
- Profile: stats, section gap, Frendly+ card, about text and history cards приведены к React.
- PublicUserProfile and Report: public profile location, trust counters, section labels, chips, about copy, sticky actions, report warning card, reason rows, textarea and submit CTA typography приведены к React.
- SafetyHub: trust/SOS cards, section labels, contact rows, scope badges, included list, group rows, help card, add-contact sheet and SOS confirm sheet typography приведены к React.
- AICreate: mood gap, generated plan text roles, tag tracking and empty note приведены к React.
- AIVoice: phase label, transcript, preset text, route rows, nearby cards and CTA приведены к React.
- Radar: small weather, event meta, user count and compact card gaps приведены к React.
- Chats: row preview/meta gaps, empty state, AI card body and CTA приведены к React.
- ChatRoom: bubble text, timestamps, composer, pinned meetup card and chat headers приведены к React.
- Clubs and ClubDetail: header/hero line-height, badge tracking, card body rhythm, social/news/meetup rows приведены к React.
- Posters and PosterDetail: grid card date/title/meta, info tiles, hero ticket title, callout copy and CTA sizes приведены к React.
- Affiche filter and picker sheets: filter title, reset, section labels, radius scale, CTA, picker search and empty text приведены к React `PosterFilterSheet` and `PosterPickerSheet`.
- Affiche shared filters and map sheet options: search field, chips, map option title/subtitle and row icon sizes aligned with V5 primitive typography.
- Routes and RouteDetail: route card title/body/meta rhythm, savings badges, hero metrics and step timeline приведены к React.
- EveningPlan sheets: launch sheet section label tracking, step preview, privacy hints, participant row, perk redeem labels, form fields and promo code typography приведены к React.
- MeetupDetail: info tiles, host/quote/program count/attendee/map/perk/safety typography and CTA size приведены к React.
- CreateMeetup: preview, input, field rows, description, AI helper, visibility cards and CTA helper приведены к React.
- Home: section rhythm, gathering cards, dating rail, affiche cards, route rows, pulse, metrics and quick portal typography приведены к React.
- Dating: likes list, counter, filter sheet and photo overlay typography приведены к React.
- CreateMeetup picker sheets: date, place, partner and route picker text roles, including place sheet action buttons, приведены к V5 typography rules.

### Что осталось

- Провести визуальную сверку рядом с React на viewport `390x820`.
- Отдельно пройти bottom nav/FAB spacing в визуальной сверке.
- После визуальной сверки закрыть оставшиеся `[ ]` пункты по каждому экрану.

### Проверки

- `git diff -- front`: выполнено, diff пустой.
- `cd mobile && flutter analyze`: выполнено, `No issues found`.
- `cd mobile && flutter test`: выполнено после последней итерации, итог `429` прошло, `65` упало. Падения остались в smoke/parity/auth/theme тестах, например `app_smoke_test.dart`, `detail_chat_and_user_profile_screen_test.dart`, `evening_routes_screen_test.dart`, `add_photo_screen_test.dart`, `dating_screen_test.dart`, `bb_brand_icon_test.dart`, `app_colors_test.dart`.
- `cd mobile && flutter test test/shared/widgets/bb_system_overlays_test.dart -r expanded`: выполнено после правки announcement typography, `3` passed.
- `cd mobile && flutter test test/features/parity/notifications_and_profile_screen_test.dart --plain-name "profile metric tiles do not overflow on narrow screens"`: выполнено, проходит после правки profile tile ratios.
- `cd mobile && flutter test test/features/parity/tonight_screen_test.dart --plain-name "tonight radar legend keeps full row width"`: выполнено, проходит после правки radar legend без `FittedBox`.
- `bash scripts/update-understand-graph.sh`: выполнено, `591` files analyzed, `0` warnings.

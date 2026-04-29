# Landing Map

## Назначение

`landing/` это отдельный React/Vite сайт Frendly.

Он живет как отдельный git-проект и пушится в репозиторий `sarboys/Frendly-landing`.
В проде деплой использует URL `https://github.com/sarboys/frendly_landing.git`.

Главные страницы:

- `/`: пользовательский лендинг Frendly.
- `/landing`: redirect на `/`.
- `/partners`: лендинг для заведений и партнеров.
- `/code/:code`: публичная страница активации партнерского QR оффера.
- `*`: redirect на `/`.

## Когда читать эту карту

Читать после `project_map.md` и `ai-context/index.md`, если задача касается:

- лендинга Frendly;
- страницы `/` или `/partners`;
- `Live · Demonstration`;
- `AnimatedDemo`;
- Tailwind tokens лендинга;
- сборки, Docker, nginx, GitHub Actions деплоя лендинга.

Если задача про перенос визуала в Flutter, дополнительно читать `ai-context/frontend-flutter.md`.

## Стек

- React `18.3`.
- React Router `6.30`.
- Vite `7.3`.
- TypeScript `5.8`.
- Tailwind CSS `3.4`.
- `lucide-react` для иконок.
- `@vitejs/plugin-react-swc`.

Команды:

```bash
cd landing && npm run dev
cd landing && npm run build
cd landing && npm run lint
cd landing && npm run preview
```

Dev server из `vite.config.ts`:

- host: `::`
- port: `8080`
- alias: `@` -> `landing/src`
- React dedupe включен для `react`, `react-dom`, `react/jsx-runtime`, `react/jsx-dev-runtime`

## Workspace

`landing/.ai-workspace.json` регистрирует проект:

- name: `frendly-landing`
- group: `frendly`

Расшаренные файлы:

- `package.json`, `package-lock.json`, `README.md`
- `src/`
- `index.html`
- `vite.config.ts`
- `tailwind.config.ts`
- `tsconfig.json`
- `eslint.config.js`
- `Dockerfile`
- `nginx.conf`
- `.github/workflows/deploy.yml`

После изменения workspace shares:

```bash
cd landing && ai-workspace sync
ai-workspace list
```

После изменения `ai-context`:

```bash
cd /Users/sergeypolyakov/MyApp
ai-workspace reindex
ai-workspace search "landing" --limit 5
```

## Файлы запуска

- `landing/src/main.tsx`
  - монтирует React root в `#root`.
  - подключает `App`.
  - подключает `landing/src/index.css`.
- `landing/src/App.tsx`
  - создает `BrowserRouter`.
  - задает routes `/`, `/landing`, `/partners`, `/code/:code`, `/:slug`, `*`.
  - `/code/:code` стоит перед `/:slug`, чтобы QR ссылки не попадали в public share route.
- `landing/index.html`
  - HTML shell для Vite.

## Страницы

### Public share page

Файл: `landing/src/pages/PublicSharePage.tsx`.

Роль:

- публичная страница встречи или Evening session по короткому slug `https://frendly.tech/:slug`;
- тянет snapshot из `VITE_API_BASE_URL/public/shares/:slug`, default API `https://api.frendly.tech`;
- показывает описание, дату, место, host, preview людей и route steps, если они есть;
- CTA сначала открывает `deepLink` из API, потом fallback в App Store или Google Play по user agent.

Env:

- example file: `landing/.env.example`
- `VITE_API_BASE_URL`
- `VITE_IOS_STORE_URL`
- `VITE_ANDROID_STORE_URL`
- `VITE_DEFAULT_STORE_URL`

### Offer code page

Файл: `landing/src/pages/OfferCodePage.tsx`.

Роль:

- публичная страница `https://frendly.tech/code/<code>`;
- на загрузке вызывает `POST ${VITE_API_BASE_URL}/public/offer-codes/:code/activate`, default API `https://api.frendly.tech`;
- показывает статусы `activated`, `already_activated`, `expired`, `not_found`;
- показывает только offer title, venue or partner and activation time;
- не показывает персональные данные пользователя.
- этот route должен оставаться выше `/:slug` в `landing/src/App.tsx`, иначе QR ссылки будут открываться как public share slug.

### Пользовательский лендинг

Файл: `landing/src/pages/Landing.tsx`.

Роль:

- основной лендинг продукта Frendly;
- editorial layout с главами;
- раскрывает продукт, демо, сценарии, After Dark, цены, FAQ, CTA.

Локальные данные:

- `features`: возможности продукта.
- `flow`: метод в четыре шага.
- `eventCards`: карточки вечеров с картинками из `src/assets`.
- `testimonials`: отзывы.
- `faq`: FAQ.

Ключевые блоки:

- hero и nav;
- stats strip;
- `AnimatedDemo`, секция `id="demo"`, заголовок `Live · Demonstration`;
- `FeaturesShowcase`, секция `id="features"`, заголовок `Глава I · Возможности`;
- method, секция `id="how"`;
- events gallery, секция `id="events"`;
- After Dark;
- testimonials;
- pricing;
- FAQ, секция `id="faq"`;
- CTA, секция `id="cta"`;
- footer.

Важно по текущему порядку:

- `AnimatedDemo` идет перед `FeaturesShowcase`.
- Это значит `Live · Demonstration` визуально находится перед `Глава I · Возможности`.

### Партнерский лендинг

Файл: `landing/src/pages/Partners.tsx`.

Роль:

- страница для заведений, площадок, сетей и партнеров;
- показывает ценность размещения в Frendly, flow подключения, кейсы, тарифы, FAQ, форму заявки.

Локальные данные:

- `opportunities`: выгоды для партнера.
- `flow`: шаги подключения.
- `cases`: примеры кейсов.
- `tariffs`: тарифы.
- `faq`: FAQ.

Ключевые блоки:

- hero и nav;
- stats strip с `Counter`;
- why, секция `id="why"`;
- method, секция `id="how"`;
- cases, секция `id="cases"`;
- audience block;
- pricing, секция `id="pricing"`;
- FAQ, секция `id="faq"`;
- apply form, секция `id="apply"`;
- footer.

Форма заявки сейчас статическая. Она не отправляет данные в backend.

## Shared UI внутри страниц

`Landing.tsx` и `Partners.tsx` имеют локальные helpers:

- `useReveal`: IntersectionObserver для reveal-анимации.
- `Reveal`: wrapper для плавного появления блока.

`Partners.tsx` также имеет:

- `Counter`: animated counter через `requestAnimationFrame`.

Эти helpers не вынесены в shared слой, потому что пока используются локально в лендинге.
Если появится третья страница с тем же behavior, можно вынести в `landing/src/components/landing/`.

## Animated Demo

Файл: `landing/src/components/landing/AnimatedDemo.tsx`.

Роль:

- интерактивная витрина продукта внутри пользовательского лендинга;
- имитирует mobile app screens внутри `PhoneShell`;
- управляет сценариями, playback state, frame progress.

Главные части:

- `useFrame`: ticker на `requestAnimationFrame`.
- motion helpers: `lerp`, `clamp01`, `range`, `eo`.
- `PhoneShell`: общий корпус телефона.
- scene components:
  - `SceneTonight`
  - `SceneMap`
  - `SceneCreate`
  - `SceneBuilder`
  - `SceneChat`
  - `SceneLive`
  - `SceneSafety`
  - `SceneDating`
  - `ScenePosters`
  - `SceneCommunities`
  - `SceneAfterDark`
- `SCENARIOS`: список сценариев, label, blurb, duration, icon, render, dark.
- `AnimatedDemo`: section `id="demo"`, selector сценариев, play/pause, progress.

Сценарии:

- `tonight`: лента Tonight.
- `map`: карта города.
- `create`: создание встречи.
- `builder`: AI-конструктор вечера.
- `chat`: чат встречи.
- `live`: live-вечер с маршрутом.
- `safety`: безопасность и SOS.
- `dating`: свидания и матчи.
- `posters`: афиша города.
- `communities`: сообщества.
- `afterdark`: After Dark 18+.

Performance notes:

- анимация локальная, без сети;
- heavy state не уходит выше `AnimatedDemo`;
- frame state обновляет только demo section;
- картинки в сценах не грузятся через API.

## Стили

Файл: `landing/src/index.css`.

Роль:

- Tailwind base, components, utilities;
- CSS variables design tokens;
- landing-specific utility classes.

Основные token groups:

- warm editorial surfaces: `--background`, `--paper`, `--paper-deep`, `--hairline`;
- brand colors: `--primary`, `--secondary`, `--gold`;
- app tokens: bubbles, online state;
- After Dark tokens: `--ad-*`, `--gradient-after-dark`, `--gradient-neon`;
- shadows: card, soft, nav, paper, edge, neon.

Главные classes:

- `.site-shell`
- `.lux-paper`
- `.lux-grain`
- `.lux-eyebrow`
- `.lux-rule`
- `.lux-rule-v`
- `.lux-frame`
- `.lux-h1`
- `.lux-h1-italic`
- `.lux-num`
- `.lux-link`
- `.lux-magnetic`
- `.lux-marquee`
- `.lux-tilt`
- `.phone-shadow`
- `.phone-shadow-lux`
- `.safe-bottom`

Tailwind config: `landing/tailwind.config.ts`.

Роль:

- связывает Tailwind colors с CSS variables;
- задает fonts `Sora` и `Manrope`;
- задает box shadows, gradients, animations;
- подключает `tailwindcss-animate`.

## Assets

Путь: `landing/src/assets/`.

Используются локальные изображения:

- dating portraits: `dating-*.jpg`;
- event cards: `event-*.jpg`;
- app icons: `icon-v3-gradient.png`, `icon-v5-sage.png`.

При правках:

- не тянуть remote images без причины;
- не класть большие runtime artifacts в `src/assets`;
- `dist/` это build output, его не использовать как source.

## Build, Docker, nginx

`landing/Dockerfile`:

- build stage: `node:20-bookworm-slim`;
- `npm ci`;
- `npm run build`;
- runtime stage: `nginx:1.27-alpine`;
- копирует `nginx.conf`;
- копирует `/app/dist` в `/usr/share/nginx/html`;
- healthcheck: `GET /health`.

`landing/nginx.conf`:

- `root /usr/share/nginx/html`;
- `/health` возвращает `ok`;
- static assets кэшируются на 30 дней с `Cache-Control: public, immutable`;
- SPA fallback через `try_files $uri $uri/ /index.html`.

## Deploy

Workflow: `landing/.github/workflows/deploy.yml`.

Триггеры:

- push в `main`;
- manual `workflow_dispatch`.

Flow:

- подключается к серверу через `appleboy/ssh-action`;
- использует secret `DEPLOY_SSH_KEY`;
- выставляет:
  - `APP_DIR=/opt/frendly`
  - `ENV_FILE=/opt/frendly/.env.production`
  - `LANDING_DIR=/opt/frendly/landing`
  - `LANDING_REPO_URL=https://github.com/sarboys/frendly_landing.git`
  - `LANDING_BRANCH=main`
  - `LANDING_TARGET_SHA=${{ github.sha }}`
- запускает `/opt/frendly/scripts/deploy-landing.sh`.

Root deploy script: `scripts/deploy-landing.sh`.

Он:

- берет deploy lock;
- клонирует или обновляет landing repo;
- checkout/reset на target SHA;
- проверяет фактический SHA;
- запускает `docker compose` для `landing`;
- пересоздает `nginx`.

## Проверки перед завершением правки

Для обычной правки лендинга:

```bash
cd landing && npm run build
cd landing && npm run lint
```

Для правки deploy или workspace:

```bash
cd landing && ai-workspace sync
cd landing && ai-workspace status
cd /Users/sergeypolyakov/MyApp && ai-workspace reindex
```

Для визуальной правки:

- запустить `cd landing && npm run dev`;
- открыть `http://localhost:8080`;
- проверить desktop и mobile ширины;
- убедиться, что текст не налезает на соседние блоки.

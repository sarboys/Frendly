# Landing Map

Use this for the React/Vite landing project in `landing/`.

## Purpose

`landing/` is a separate Frendly site.

Routes:

- `/`: user landing.
- `/landing`: redirect to `/`.
- `/partners`: partner landing.
- `/code/:code`: public partner offer QR activation.
- `/:slug`: public share page.
- `*`: redirect to `/`.

The project is deployed as a separate repo. Production deploy uses `https://github.com/sarboys/frendly_landing.git`.

## Stack and commands

- React `18.3`.
- React Router `6.30`.
- Vite `7.3`.
- TypeScript `5.8`.
- Tailwind CSS `3.4`.
- Icons: `lucide-react`.

```bash
cd landing && npm run dev
cd landing && npm run build
cd landing && npm run lint
cd landing && npm run preview
```

Vite server:

- host `::`
- port `8080`
- alias `@` -> `landing/src`

## Key files

- `landing/src/main.tsx`: React root.
- `landing/src/App.tsx`: routes.
- `landing/src/pages/Landing.tsx`: user landing.
- `landing/src/pages/Partners.tsx`: partner landing.
- `landing/src/pages/PublicSharePage.tsx`: public event or Evening share by slug.
- `landing/src/pages/OfferCodePage.tsx`: public offer code activation.
- `landing/src/components/landing/AnimatedDemo.tsx`: interactive product demo.
- `landing/src/index.css`: Tailwind and design tokens.
- `landing/tailwind.config.ts`: theme mapping.
- `landing/Dockerfile`: static build into nginx.
- `landing/nginx.conf`: SPA fallback, `/health`, static cache.
- `landing/.github/workflows/deploy.yml`: deploy.

## Public share page

File: `landing/src/pages/PublicSharePage.tsx`.

- Fetches `VITE_API_BASE_URL/public/shares/:slug`.
- Default API: `https://api.frendly.tech`.
- Shows event or Evening snapshot.
- CTA opens API `deepLink`, then app store fallback by user agent.

Env:

- `VITE_API_BASE_URL`
- `VITE_IOS_STORE_URL`
- `VITE_ANDROID_STORE_URL`
- `VITE_DEFAULT_STORE_URL`

## Offer code page

File: `landing/src/pages/OfferCodePage.tsx`.

- Route: `/code/:code`.
- Calls `POST /public/offer-codes/:code/activate`.
- Shows statuses: `activated`, `already_activated`, `expired`, `not_found`.
- Shows offer title, venue or partner and activation time.
- Does not show user personal data.
- Route must stay before `/:slug` in `App.tsx`.

## User landing

File: `landing/src/pages/Landing.tsx`.

Main blocks:

- hero and nav
- stats strip
- `AnimatedDemo`, section `id="demo"`, title `Live · Demonstration`
- `FeaturesShowcase`, section `id="features"`
- method, events gallery, After Dark
- testimonials, pricing, FAQ, CTA, footer

Local data:

- `features`
- `flow`
- `eventCards`
- `testimonials`
- `faq`

`AnimatedDemo` currently comes before `FeaturesShowcase`.

## Partner landing

File: `landing/src/pages/Partners.tsx`.

Main blocks:

- hero and nav
- stats strip with `Counter`
- why, method, cases
- audience block
- pricing
- FAQ
- static apply form
- footer

Local data:

- `opportunities`
- `flow`
- `cases`
- `tariffs`
- `faq`

The apply form is static and does not submit to backend.

## Shared local helpers

`Landing.tsx` and `Partners.tsx` use local helpers:

- `useReveal`
- `Reveal`

`Partners.tsx` also uses:

- `Counter`

Keep them local unless a third page needs the same behavior.

## Animated demo

File: `landing/src/components/landing/AnimatedDemo.tsx`.

Role:

- interactive product demo inside phone shell
- scenario selector
- play/pause
- progress
- local animation through `requestAnimationFrame`

Important parts:

- `useFrame`
- `PhoneShell`
- `SCENARIOS`
- scene components for tonight, map, create, builder, chat, live, safety, dating, posters, communities, After Dark

Performance:

- no network
- state stays inside demo section
- frame updates do not touch page-level state

## Styles and assets

Styles:

- `landing/src/index.css`
- `landing/tailwind.config.ts`

Fonts:

- `Sora`
- `Manrope`

Assets:

- `landing/src/assets/`
- dating portraits
- event cards
- app icons

Do not use `dist/` as source. Do not add remote images without reason.

## Docker and deploy

Dockerfile:

- build stage: `node:20-bookworm-slim`
- runtime: `nginx:1.27-alpine`
- serves `/usr/share/nginx/html`

Nginx:

- `/health` returns `ok`
- static assets cached for 30 days
- SPA fallback to `index.html`

Deploy workflow:

- `landing/.github/workflows/deploy.yml`
- uses SSH and `/opt/frendly/scripts/deploy-landing.sh`
- rebuilds only landing and recreates nginx

## Checks

```bash
cd landing && npm run build
cd landing && npm run lint
```

For visual work, run dev server on `http://localhost:8080` and check desktop plus mobile widths.

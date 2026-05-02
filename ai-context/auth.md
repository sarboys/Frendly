# Auth Map

Use this for users, sessions, JWT, phone, Telegram, Google, Yandex and route access.

## Fast paths

- Flutter token state: `mobile/lib/app/core/providers/core_providers.dart`.
- Flutter API retry: `mobile/lib/app/core/network/api_client.dart`.
- Flutter auth config: `mobile/lib/app/core/config/backend_config.dart`.
- Flutter auth screens: `features/welcome/`, `features/phone_auth/`, `features/telegram_auth/`, `features/onboarding/`.
- Social auth controller: `mobile/lib/features/welcome/application/social_auth_controller.dart`.
- Router redirects: `mobile/lib/app/navigation/app_router.dart`.
- API controller: `backend/apps/api/src/controllers/auth.controller.ts`.
- API service: `backend/apps/api/src/services/auth.service.ts`.
- Telegram service: `backend/apps/api/src/services/telegram-auth.service.ts`.
- Social OAuth: `backend/apps/api/src/services/social-auth.service.ts`, `social-identity-verifier.service.ts`.
- Guard: `backend/apps/api/src/common/auth.guard.ts`.
- Admin guard: `backend/apps/api/src/common/admin-token.guard.ts`.
- Public decorator: `backend/apps/api/src/common/public.decorator.ts`.
- JWT helpers: `backend/packages/database/src/auth-tokens.ts`.
- DB models: `Session`, `PhoneOtpChallenge`, `TelegramAccount`, `TelegramLoginSession`, `ExternalAuthAccount`, `AuthAuditEvent`, `AdminUser`, `AdminSession`, `AdminAuditEvent`.

## Tokens and sessions

- Backend issues access token and refresh token.
- Access payload: `userId`, `sessionId`, `kind=access`.
- Refresh payload: `userId`, `sessionId`, `refreshTokenId`, `kind=refresh`.
- Default TTL: access `15m`, refresh `30d`.
- Secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
- Production rejects identical access and refresh secrets.
- `Session` stores user id, refresh token id, provider, created time, last used time and revoked time.
- Refresh rotates `refreshTokenId`.
- Logout sets `revokedAt`.
- Admin access and refresh tokens use the same JWT secrets with `kind=admin_access` and `kind=admin_refresh`.
- Admin refresh rotates `AdminSession.refreshTokenId`.

## API protection

- `AuthGuard` is global.
- Route is protected unless `@Public()`.
- Guard reads `Authorization: Bearer <token>`.
- Guard verifies access JWT and DB session.
- Controllers read user through `@CurrentUser()`.
- Admin browser auth uses httpOnly cookies, `frendly_admin_access` and `frendly_admin_refresh`.
- `AdminTokenGuard` accepts the admin access cookie or bearer admin access token.
- Legacy `x-admin-token` is accepted only when `ADMIN_API_TOKEN` is configured.

## Public endpoints

- `POST /auth/dev/login`
- `POST /auth/phone/request`
- `POST /auth/phone/verify`
- `POST /auth/phone/test-login`
- `POST /auth/refresh`
- `POST /auth/telegram/start`
- `POST /auth/telegram/verify`
- `POST /auth/google/verify`
- `POST /auth/yandex/verify`

Protected:

- `POST /auth/logout`
- `GET /me`

Admin public auth:

- `POST /admin/auth/login`
- `POST /admin/auth/refresh`

Admin protected auth:

- `POST /admin/auth/logout`
- `GET /admin/auth/me`

## Phone auth

- OTP challenges are stored as `codeHash` and `codeSalt`, not raw code.
- Request context and cooldown guard repeated sends.
- Production delivery uses `PHONE_OTP_DELIVERY_WEBHOOK_URL`.
- Delivery timeout: `PHONE_OTP_DELIVERY_TIMEOUT_MS`, default 5 seconds.
- Test shortcut endpoint is behind `ENABLE_TEST_PHONE_SHORTCUTS=true`.
- Seeded test numbers: `+71111111111` through `+77777777777`.

## Telegram auth

- Mobile uses `BackendConfig.telegramAuthUri`.
- Default bot username: `frendly_code_bot`.
- Start endpoint creates `TelegramLoginSession`.
- Verify requires `loginSessionId` plus code.
- Code-only global lookup is not accepted.
- Code TTL: 10 minutes.
- Max attempts: 5.
- Relay app: `backend/apps/telegram-relay/`.
- Relay calls `/internal/telegram/dispatch` with `x-telegram-internal-secret`.
- `TELEGRAM_INTERNAL_SECRET` fallback to bot token is allowed only outside production.

## Google and Yandex

- Google endpoint accepts mobile `idToken`.
- Backend verifies Google token through server-side verifier.
- Google email is linked only when provider marks it verified.
- Yandex endpoint accepts native SDK OAuth token.
- Backend fetches Yandex user info server-side and verifies `client_id`.
- DB stores `ExternalAuthAccount` by `provider + providerUserId`.
- No provider access token or auth code is stored.

Mobile config:

- `BIG_BREAK_GOOGLE_CLIENT_ID`
- `BIG_BREAK_GOOGLE_SERVER_CLIENT_ID`
- `BIG_BREAK_YANDEX_CLIENT_ID`

Yandex native bridge:

- Dart: `social_auth_controller.dart`.
- Method channel: `app.yandex.auth`.
- Android: `mobile/android/app/src/main/kotlin/com/example/big_break_mobile/MainActivity.kt`.
- iOS: `mobile/ios/Runner/AppDelegate.swift`, `mobile/ios/Runner/SceneDelegate.swift`.

## Onboarding contact rule

- `/onboarding/me` returns `email`, `phoneNumber`, `requiredContact`.
- Phone or Telegram sessions require email when missing.
- Google or Yandex sessions require phone when missing.
- `POST /onboarding/contact/check` preflights the required email or phone before the user leaves the contact step.
- `PUT /onboarding/me` enforces the same server-side rule.
- Duplicate contact returns `contact_already_used`.

## Flutter flow

- Startup restores tokens from secure storage.
- Legacy tokens can migrate from SharedPreferences.
- Token storage uses `FlutterSecureStorage`.
- API client adds bearer token before requests.
- Auth endpoints use `skipAuthHeader` and `skipAuthRefresh`.
- On 401, client refreshes once and retries.
- Refresh 401 clears tokens.
- Router sends guests to public auth flow.
- Incomplete setup redirects to `/onboarding`.

Public routes:

- `/splash`, `/welcome`, `/phone-auth`, `/telegram-auth`.

Setup routes:

- `/permissions`, `/add-photo`, `/onboarding`.

## Tests

- Flutter token tests: `mobile/test/core/auth_bootstrap_test.dart`, `mobile/test/core/auth_tokens_controller_test.dart`, `mobile/test/app/session/`.
- API auth tests: `backend/apps/api/test/integration/auth.integration.spec.ts`.
- Welcome social auth tests: `mobile/test/features/welcome/presentation/welcome_screen_test.dart`.

## Security notes

- Controllers use request context, not direct token decode.
- Refresh token rotation reduces replay window.
- WebSocket uses access token plus DB session check.
- Telegram internal route is public at guard level, then protected by secret.
- Test and dev auth paths must stay disabled or guarded in production.


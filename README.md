# POBO Area Ambassador (AA) app

React Native (Expo SDK 58) app for POBO Area Ambassadors (AAs). Built through Phases 0–3 and founder QA
Revisions 1–3: login and onboarding, action-first Home, leads and requirements (with Drafts), calls and
follow-ups, transfers and referrals, society mapping and unit surveys, listings with photos/video and
key custody, matching, shortlist and visits, earnings, My Week, leave and roster, notifications, and an
offline sync queue. All data and business rules come from the POBO API (`../backend`); the contract is
`../shared/openapi.yaml`.

**Start here:** `AGENTS.md` (also loaded by `CLAUDE.md`), then `docs/CONTEXT.md` (screens, components,
glossary), `docs/DECISIONS.md` (decisions and defaults pending founder confirmation),
`docs/REVISIONS.md` (history) and `docs/KNOWN_ISSUES.md`.

**Folder layout expected:** clone the backend, this app and the `shared` folder side by side:
```
<workspace>/backend   <workspace>/aa-app   <workspace>/shared
```
Scripts and docs refer to `../backend` and `../shared`.

## Requirements

- Node **22 LTS** recommended (Expo SDK 58 warns on Node 20.17 but still works for `start`/`export`).
- npm 10+. Install with `npm install` (`.npmrc` sets `legacy-peer-deps` because `openapi-typescript`
  still declares a TypeScript 5 peer).
- The POBO backend running (see `../shared/DEV_ACCOUNTS.md` / `../shared/STATUS.md`).
- On the phone: **Expo Go** from the Play Store (SDK 58), or the installable APK (see below).

## Run on a phone with Expo Go

1. Start the backend so it listens on all interfaces, e.g. `python manage.py runserver 0.0.0.0:8000`
   (see `../shared/STATUS.md` for the exact command).
2. Find your Mac's LAN IP: `ipconfig getifaddr en0` (e.g. `192.168.1.20`).
3. Create `.env` in this folder:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.20:8000/api/v1
   ```
   The phone and the Mac must be on the same Wi-Fi. Django must allow the host
   (`ALLOWED_HOSTS`) and plain HTTP is fine in dev.
4. `npm install && npx expo start` and scan the QR code with Expo Go.
5. Log in with a seeded AA account from `../shared/DEV_ACCOUNTS.md` (dev OTP is documented there).

### Testing from anywhere (ngrok tunnel)

Run `scripts/demo_tunnel.sh` in `../backend` **first**: it exposes the API on your ngrok HTTPS URL and
writes `.env.local`, which overrides `.env`. Then start Expo (`npx expo start --clear`). The free ngrok
plan allows one session, so don't also run `expo start --tunnel ngrok`, and stop old tunnels before
starting a new one.

### Installable APK (no Expo Go)

1. **Change the server address first.** In `eas.json` set `build.preview.env.EXPO_PUBLIC_API_URL` to
   *your* backend (e.g. your own ngrok URL + `/api/v1`). The committed value is the original developer's
   tunnel. Android release builds block plain `http://`, so use HTTPS.
2. `npx eas-cli login`, then `npx eas-cli init` to attach the project to your own Expo account (this
   replaces `extra.eas.projectId` in `app.json`).
3. `npx eas-cli build -p android --profile preview` and install the APK from the link it prints.

The JS and the API URL are baked into the APK, so every code change needs a new build. The backend and
tunnel must be running whenever someone uses the app.

### API URL cheat-sheet (`EXPO_PUBLIC_API_URL`)

| Where the app runs | URL |
|---|---|
| iOS simulator / web on the Mac | `http://localhost:8000/api/v1` (default) |
| Android emulator | `http://10.0.2.2:8000/api/v1` |
| Physical phone (Expo Go) | `http://<Mac LAN IP>:8000/api/v1` |
| Phone anywhere / APK | `https://<your ngrok domain>/api/v1` |

`EXPO_PUBLIC_*` vars are inlined at bundle time: restart `expo start` (add `-c` to clear cache) after
changing `.env`.

### Expo Go limitations

- **Push notifications:** remote push is not available in Expo Go on Android (SDK 53+). The app skips
  push-token registration in Expo Go and the in-app notification drawer still works from the API.
  Push works in a development/production build (`npx eas-cli build --profile development`).
- No custom native modules are used, so everything else runs in Expo Go. Photo/video upload uses
  `expo-file-system`'s native uploader (R3-4); it has not yet been proven on a real Android phone.

## Scripts

| Script | What it does |
|---|---|
| `npm start` | Expo dev server (Expo Go / emulator) |
| `npm run api:gen` | Regenerate `src/api/schema.d.ts` from `../shared/openapi.yaml` (openapi-typescript) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` (eslint-config-expo) |
| `npm test` | Jest unit/component tests (jest-expo + Testing Library) |
| `npm run test:integration` | Logs in against the live backend and exercises the main endpoints (see below) |
| `npm run test:integration:field` | Live checks for field, listings, visits, keys and the Revision 2/3 flows |
| `npm run export:android` | Bundles the Android JS (`expo export`), a CI-friendly build check without the Android SDK |

### Integration check against the live backend

```
npm run test:integration            # defaults: API_URL=http://localhost:8000/api/v1, Priya +919876543210, OTP 123456
```

26 checks with the app's own generated client and auth fetch: login, config, a website lead via
the public intake (it must show on Home/Leads), pagination/filters, lead detail, calls (incl. the
400 `fields.next_action` case), follow-ups, WhatsApp deep link, DNC `409 customer_dnc`, Add Lead
with the founder's fields, duplicate `409 customer_exists`, add requirement, transfer, referral,
escalation, a fresh territory float claim race (opt-in with `FLOAT_RACE=1`; two non-Priya candidates race, the second gets 409), duty, roster,
notifications, device registration, refresh rotation and logout. It creates test data (it never
claims seeded floats). It requests an OTP only once per run (the API allows 5 per phone per 15 min).

### Tests

- `__tests__/http.test.ts`: single-flight refresh rotation, retry with body, logout on rejected refresh, no logout when offline.
- `__tests__/errors.test.ts`: error envelope → inline field errors.
- `__tests__/screens.test.tsx`: renders Home, Leads and Lead detail with payloads captured from the
  live backend (`__tests__/fixtures/*.json`; refresh them with curl when the API changes).
- Components and logic: SlaChip countdown, ActionCard DNC suppression, call flow (dial → return), requirement drafts, deep links, analytics PII scrubbing.

## When the API changes

1. Read `../shared/API_CHANGELOG.md` (look for **BREAKING**).
2. `npm run api:gen`
3. `npm run typecheck`, fix errors, then `npm run test:integration`.

Missing endpoints/fields go in `../shared/REQUESTS.md` (REQ-n). A temporary typed mock may live
only in `src/api/mocks/` and must be listed in `../shared/STATUS.md`.

## Folder structure

```
src/
  app/                 expo-router routes (every file is a screen)
    _layout.tsx        providers + auth gate (Stack.Protected: login / onboarding / app)
    login.tsx          phone → OTP (resend timer)
    onboarding.tsx     4-step onboarding + conduct/DNC acknowledgement
    (app)/
      _layout.tsx      app stack + ActionHost (all action sheets, dial→return→outcome), drawers, toast, push
      (tabs)/          Home, Leads, Survey, Visits (Today/Upcoming/Past/No show/Cancelled), Earnings
      lead/            lead detail (customer + requirement cards, routing, messages, timeline), Add Lead
      listing/[id].tsx property detail (media panel, access/keys, submit for verification)
      field/           society mapping and unit survey
      earnings/        earnings detail
      more/…           Profile, Leave & roster, Keys, Field tasks, Listings, Floats, Reminders, Sync,
                       My Week, Learn & Help, tickets, Glossary
  api/
    schema.d.ts        GENERATED from openapi.yaml, do not edit
    client.ts          createApi() factory (openapi-fetch + auth fetch) + unwrap(); Node-safe
    instance.ts        the app's API instance (secure-store tokens)
    http.ts            auth fetch: bearer, single-flight refresh rotation, retry
    errors.ts          backend error envelope → ApiError (+ inline field errors)
    tokens.ts          TokenStore interface + in-memory store
    secureTokens.ts    expo-secure-store token storage
    hooks/             TanStack Query hooks per domain
    mocks/             temporary typed mocks (must be listed in shared/STATUS.md)
  components/
    ui/                design system (Card, Button, StagePill, SlaChip, BottomSheet, TextField, …)
    shell/             header, drawers, placeholders
    home/ leads/ lead/ leadForm/ sheets/
  hooks/               useNow (shared 1s ticker), useOnline, useCallFlow, …
  i18n/                en + hi UI strings (business labels come from /config/app)
  lib/                 analytics (PII-safe), push, deep links, native upload, money/time format helpers
  state/               zustand: session status + which sheet/drawer is open
  theme/               raw colour tokens (Tailwind tokens live in tailwind.config.js)
__tests__/             unit + component tests
scripts/integration.ts live-backend check
```

## Design notes

- Visual language ported from the AI Studio prototype: teal/slate palette, rounded-2xl cards, stage
  pills, SLA chips; styling via NativeWind (Tailwind tokens in `tailwind.config.js`).
- System font instead of Plus Jakarta Sans: custom font families break `fontWeight` on Android
  (one family per weight), and it keeps the app lighter.
- Business values (stages, outcomes, reasons, templates, SLA, glossary labels) are never hardcoded:
  they come from `GET /config/app` and the API.

## Known issues and what's not built

See `docs/KNOWN_ISSUES.md`. In short: the native upload still needs a device test, push needs a
development build, WhatsApp/SMS messages are logged only (shown under "Show messages" on a requirement)
until a provider is chosen, and the customer web dashboard, documents and negotiation screens are not
built yet.

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

---

# POBO AA app (project guide)

This section is the shared body for all coding agents. `CLAUDE.md` imports this file. Deeper detail: `docs/CONTEXT.md` (routes, components, data layer, glossary), `docs/REVISIONS.md` (timeline), `docs/DECISIONS.md` (product/UX decisions and defaults pending confirmation), `docs/KNOWN_ISSUES.md`. Claude Code users also get the `pobo-app` skill (`.claude/skills/pobo-app/SKILL.md`).

## What this is
The mobile app for POBO **Area Ambassadors (AAs)**: field agents for a Noida real-estate business. An AA works leads (call, follow up, transfer, refer), maps societies and surveys flats, adds properties and photos, handles keys, schedules and completes visits, and sees earnings, My Week and help. All data and business rules come from the POBO Django API (separate backend repo, `/api/v1`). The app never hardcodes business labels: stages, outcomes, reasons and other masters come from `GET /config/app`.

## Stack
| Piece | Where |
|---|---|
| Expo SDK 58 + expo-router (typed routes), Node 22 (`.nvmrc`; run `nvm use`) | routes in `src/app/` |
| TanStack Query, one hook file per domain | `src/api/hooks/*`, query keys in `src/api/keys.ts` (`qk`), `hooks/listings.ts` (`lk`), `hooks/field.ts` (`fk`) |
| openapi-fetch client typed by openapi-typescript | `src/api/schema.d.ts` is GENERATED (`npm run api:gen`), never edit; `src/api/client.ts`, `instance.ts`, `http.ts` (bearer + single-flight refresh) |
| i18next, English + Hindi | `src/i18n/en.json`, `src/i18n/hi.json` |
| NativeWind (Tailwind) | tokens in `tailwind.config.js`; UI kit in `src/components/ui/` |
| zustand (session, which sheet is open, success/toast) | `src/state/` |
| Offline outbox on `POST /sync/batch` (SQLite, in-memory fallback in Expo Go) | `src/offline/` |

## Running against a backend
The API URL comes from `EXPO_PUBLIC_API_URL` (see `.env.example`), inlined at bundle time. Restart Expo with `--clear` after changing it.
- **Local backend on the same Wi-Fi:** `.env` with `EXPO_PUBLIC_API_URL=http://<Mac LAN IP>:8000/api/v1` (`ipconfig getifaddr en0`). The backend must run on `0.0.0.0:8000`. Then `nvm use && npm install && npx expo start`, scan with Expo Go.
- **Phone on another network (ngrok):** in the backend repo run `scripts/demo_tunnel.sh` **first**. It opens one public HTTPS URL (API plus photo uploads) and writes `aa-app/.env.local` (overrides `.env`; deleted on Ctrl+C). Then `npx expo start --tunnel ngrok --clear`. The free ngrok plan allows one session, so the script refuses to start if Expo's tunnel is already running: stop Expo, start the tunnel, then start Expo.
- **Dev logins:** seeded accounts from the backend's `seed_demo`; with `DEBUG=True` the OTP `123456` works for them. Dev only.

## Expo Go vs the APK
- Expo Go is the normal dev loop. It has no remote push on Android and may lack ExpoSQLite (the outbox then falls back to memory).
- Installable Android APK: `eas.json` profile `preview` (internal distribution, `buildType: apk`). Build with `npx eas-cli build -p android --profile preview`.
- `EXPO_PUBLIC_API_URL` for the APK is set in `eas.json` → `build.preview.env` and **baked in at build time**. It currently points at the original developer's ngrok domain: change it to your own server before building.
- The APK runs the JS it was built with: **every code change needs a rebuild** (no EAS Update channel is configured).

## API contract
`npm run api:gen` reads `../shared/openapi.yaml` (a sibling folder outside this repo). To get it, clone the backend next to this repo and either run `manage.py spectacular --file ../shared/openapi.yaml` in the backend, or download the live schema: `mkdir -p ../shared && curl -o ../shared/openapi.yaml http://localhost:8000/api/schema/`. Never guess an endpoint shape; if something is missing, ask the backend team.

## Checks before committing
| Command | Needs |
|---|---|
| `npx tsc --noEmit` | nothing |
| `npx expo lint` | nothing |
| `npx jest` (143 tests, 25 suites as of Revision 3) | nothing (live-captured fixtures in `__tests__/fixtures`). For one file use `npx jest <file> --forceExit` |
| `npm run test:integration` (25 checks) | live backend on `:8000` with `seed_demo` data and `DEBUG=True` (dev OTP). `API_URL=` overrides the URL |
| `npm run test:integration:field` (40 checks) | same; logs in as two seeded AAs and creates test data each run |
Both live suites create records in the dev database. Never point them at production.

## Hard rules
1. **Add Lead → Requirement #1 is created automatically from the intent. Do not change this** (founder rule since Revision 1). It may be saved as a Draft (R3-2), but a normal save must never fail on requirement fields.
2. **Every UI string goes in both `en.json` and `hi.json`.** A jest test fails if `hi.json` misses any `en.json` key.
3. **12-hour times** (`formatTime` in `src/lib/time.ts`), never 24-hour, in anything an AA sees.
4. **Simple AA wording:** Leads, Mapping Society, Add Property, Visits, Earnings. No jargon.
5. **Visible feedback for every save:** success through `SuccessHost` (`useActions().showSuccess`, toast or success sheet); failure through R2-8 handling (`useFormFocus` / `FieldAnchor` / `FormScrollView`): message, scroll to the first invalid field, error under it.
6. **No hidden required fields:** never require (client or server) a field the form doesn't show.
7. Money via `MoneyField` / `formatINR` (`src/lib/money.ts`); business labels from `/config/app`, not hardcoded.
8. No secrets in the repo: `.env` and `.env*.local` are gitignored.

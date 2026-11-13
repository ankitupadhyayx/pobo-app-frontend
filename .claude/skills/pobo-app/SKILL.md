---
name: pobo-app
description: Working procedure for the POBO Area Ambassador (AA) mobile app. Use for any change to the POBO AA app's screens or routes, API hooks and query keys, en/hi i18n strings, the offline outbox, notifications/deep links, or building the Android APK.
---

# POBO AA app: working procedure

## 0. Read first
1. `AGENTS.md` (POBO section): stack, running, checks, hard rules.
2. `docs/CONTEXT.md`: route map, shared components, data layer, glossary.
3. `docs/DECISIONS.md` before changing behaviour (and its Pending confirmation list), `docs/KNOWN_ISSUES.md` before debugging.
4. `nvm use` (Node 22). Expo SDK 58 APIs change between SDKs: check the versioned Expo docs, not memory.

## 1. Reproduce first
For a bug, reproduce it against the live backend (`:8000`, seeded dev data, dev OTP) and the current build before changing code. Decide which it is: a real app bug, a backend/contract issue, a stale Expo Go bundle (restart with `--clear`), or the environment (LAN vs ngrok URL, presigned storage host). Write the finding in the commit message or the docs. Add a regression test for whatever was real.

## 2. Binding a backend change
1. Read the backend change note (look for BREAKING). Get the new schema into `../shared/openapi.yaml` (backend `manage.py spectacular --file ../shared/openapi.yaml`, or `curl -o ../shared/openapi.yaml http://localhost:8000/api/schema/`).
2. `npm run api:gen` → regenerates `src/api/schema.d.ts` (never edit it by hand). `npx tsc --noEmit` shows what broke.
3. Hooks and query keys in `src/api/hooks/<domain>.ts`; keys in `qk` (`src/api/keys.ts`), `lk` (`hooks/listings.ts`) or `fk` (`hooks/field.ts`). Mutations invalidate exactly what they change (see `invalidateLead`, `invalidateField`, `invalidateAfterSync`).
4. UI: success through `useActions().showSuccess(...)`; failures through `useFormFocus` / `FieldAnchor` / `FormScrollView` (R2-8). Never require a field the form doesn't show.
5. Strings: every new key in **both** `src/i18n/en.json` and `src/i18n/hi.json` (the parity test in `__tests__/phase3Screens.test.tsx` fails otherwise). Business labels come from `/config/app` via `useLabels`, not i18n.
6. `npx jest` (single file: `npx jest __tests__/<file> --forceExit`). Add tests next to the closest existing suite (`revision3Screens.test.tsx` is the newest pattern; fixtures in `__tests__/fixtures/`).
7. Live suites: `npm run test:integration`, then `npm run test:integration:field`. Add a live check to `scripts/integration-field.ts` for new contract behaviour.
Never guess an endpoint shape. If the contract lacks something, ask the backend team; don't mock around it.

## 3. Recipes
### Add a screen / route
- Create the file under `src/app/(app)/...` (e.g. copy the pattern of `src/app/(app)/more/reminders.tsx` for a list screen, `src/app/(app)/listing/[id].tsx` for a detail screen with `useLocalSearchParams`).
- Add a `<Stack.Screen name="..." />` in `src/app/(app)/_layout.tsx` next to the others.
- Link to it from where the AA will find it (e.g. `src/components/shell/ProfileDrawer.tsx` `LinkRow`, a Home section, or a card).
- If Metro isn't running, regenerate typed routes (command in `docs/CONTEXT.md`).
- Strings in en + hi; loading/empty/error states from `src/components/ui/States.tsx`.

### Add a notification kind or deep link
- Route mapping: `notificationHref` in `src/lib/deeplink.ts` (put the kind's branch before the generic `lead` fallback; read both flat and nested ids). From Ops reminders: `reminderHref`.
- Icon: `src/components/shell/notificationIcons.ts`.
- Tests: `__tests__/deeplink.test.ts` (and `__tests__/req11.test.tsx` for the REQ-11 kinds). No dead taps: every kind must open a record or a sensible list.

### Add an offline mutation
- Only if the backend's `/sync/batch` accepts the type and it is within the offline scope (DEC-06 in `docs/DECISIONS.md`). Money, submit, verification, transfers, claims and visit scheduling stay online.
- Add the type to `OFFLINE_TYPES` in `src/offline/types.ts`.
- Enqueue it like `src/components/listings/UnitSheets.tsx` (`key.taken`, `key.returned`) or `src/app/(app)/listing/[id].tsx` (`listing_draft.update`): `outbox.enqueue({ type, entity, entityId, baseVersion, payload, label })`. Send `baseVersion` from the server record so conflicts are detected.
- Refetch after sync in `invalidateAfterSync` (`src/api/hooks/listings.ts`) or the `onSynced` handler in `src/app/(app)/_layout.tsx`.
- Show the per-record chip with `useEntitySync(entity, id)`.
- Tests: `__tests__/outbox.test.ts`; the field suite replays a batch live.

### Money, time, location
- Money input `MoneyField`, display `formatINR` (`src/lib/money.ts`). Time `formatTime` (12-hour, `src/lib/time.ts`). Address `LocationField` (`src/lib/location.ts`; the server parser is the authority).

## 4. Checks before every commit
```bash
npx tsc --noEmit
npx expo lint
npx jest
npm run test:integration          # needs the live :8000 backend (seeded, DEBUG=True)
npm run test:integration:field    # same; creates test data each run
```
Report counts (e.g. "jest 143, integration 25/25, field 40/40"). If a live suite can't run (no backend), say so.

## 5. Building an APK
1. Set your server in `eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL` (it is baked in; the committed value is the original developer's ngrok domain).
2. `npx eas-cli build -p android --profile preview` (needs an Expo account with access to the EAS project in `app.json`, or run `eas init` for your own).
3. Install the APK from the build link. Every code or URL change needs a new build; Expo Go is the faster loop for development.
4. Remote push still needs a development build with push credentials; the preview APK has none.

## 6. Commits
- Conventional style with a scope, as in `git log`: `feat(r3-2/3/7): ...`, `fix(r3-4): ...`, `feat(rev2): ...`, `test(rev2): ...`, `chore(build): ...`, `feat(home): ...`, `fix(offline): ...`. Name the tracker code (APP-nn, FB-nn, R2-nn, R3-n, REQ-n) in the scope or subject.
- One logical change per commit; checks green first.
- End the message with the co-author line your tooling requires (the history uses `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` for agent commits).
- Never commit `.env`, `.env.local`, keys or tokens. Update `docs/` (REVISIONS, DECISIONS, KNOWN_ISSUES) when behaviour or defaults change.

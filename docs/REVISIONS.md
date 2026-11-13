# Revisions timeline

Newest last. Commit hashes are in this repo. Tracker codes: APP-nn (build tracker), FB-nn (founder QA round 1), R2-nn / RV2-x (round 2 bugs / decisions), REQ-n (app → backend requests), R3-n (round 3). Check counts are as recorded at the end of each step.

| Step | Date | App checks at the end |
|---|---|---|
| Phase 0/1: lead loop | 2026-10-23 | tsc, lint, jest, integration 26 |
| Phase 2: field intelligence | 2026-10-23 → 24 | all checks green (counts not recorded) |
| Phase 3: earnings, My Week, help | 2026-10-24 | jest 74, integration 25/25, field 20/20 |
| Revision 1 (founder QA v2) | 2026-10-26 | jest 98, integration 25/25, field 28/28 |
| Revision 2 (round 2 testing + decisions) | 2026-11-02 | jest 116, integration 25/25, field 37/37 |
| REQ-11 / REQ-12 | 2026-11-02 | jest 126 → 128, field 39/39 |
| APK build profile | 2026-11-03 | — |
| Revision 3 (round 3 testing) | 2026-11-10 | jest 143 (25 suites), integration 25/25, field 40/40 |

## Phase 0/1: lead loop (2026-10-23)
Login (phone OTP), onboarding with conduct/DNC acknowledgement, action-first Home, Leads, lead detail (customer, requirement cards, timeline), Add Lead (creates Requirement #1), action sheets (call outcome, follow-up, transfer, escalation, referral, messages), notification and profile drawers, duty status, leave and roster, push plumbing (skipped in Expo Go), analytics with PII scrubbing, en + hi strings, live integration script.
Key commits: `4e9e507` scaffold, `838a37c` design system/i18n/login/call flow, `acefd20` action sheets, `5d67c52` wired to the live API, `8511609` integration script, `e38e800` Home sections, `8219a72` Add Lead/Refer parity, `ecd538f` Node 22.

## Phase 2: field intelligence (2026-10-23 → 24)
Mapping (society → tower → floors/units, bulk generate with floor labels, duplicate tower check, structure corrections), survey with three contact slots and tenancy, unit details, opportunities, field tasks; offline outbox on `POST /sync/batch` with conflict screen; listings (draft, photos, submit, withdraw), keys, matches and shortlist, visits (complete/cancel/reschedule), Home visits and territory sections.
Key commits: `67a6c19` SQLite outbox, `47a31ef` unit matrix + sync banner, `06ba8a4` survey/mapping screens, `b26da2e` outbox bound to `/sync/batch`, `ca2bb50` listings/matches/visits/keys bound, `e1a3fdf` unit actions + Home sections, `27ce8fd` in-memory outbox fallback for Expo Go, `bfd8b2c` `@expo/ngrok`.

## Phase 3: deals, earnings, My Week, help (2026-10-24)
Earnings tab (gated states, interim label, null amounts hidden, payouts with UTR) and item detail; My Week; Learn & Help with support tickets; profile statuses; read-only deal stage on requirements; Hindi for every screen (parity test); demo-only prototype features removed (APP-34); REQ-8 interim label on Home.
Key commits: `5da8729` APP-34 + Hindi, `6eb55be` Phase 3 screens, `4b10787` REQ-8.

## Revision 1: founder QA feedback (2026-10-26)
- Shared SuccessHost (toast or success sheet) on every touched flow; Visit Scheduled/Rescheduled/Cancelled sheets with View visit (FB-06); Property Withdrawn sheet (FB-14).
- 12-hour times everywhere; callback picker with slots to 6 PM plus an explicit "customer asked for a later time" exception (FB-10).
- Plain floor-plan labels with helper text (FB-12).
- Add Property on SELL/RENT OUT requirements (FB-03); Matched vs Shortlisted and Share with client through the phone share sheet (FB-04); visit types by intent (FB-07); key access form, collect/return tasks, Home keys section (FB-08); Not sure / Verification pending (FB-13); five owner intents plus an Add Lead hint (FB-15); From Ops reminders on Home and an inbox (FB-23).
- REQ-9: `api:gen` passes `--default-non-nullable false` so defaulted request fields stay optional.
Key commits: `e69c81a`, `48db4e7`, `c4a3851`, `b3a8713`, `54ddff6`.

## Revision 2: round 2 testing + decisions (2026-11-02)
Every bug was reproduced against the live server first.
- R2-8 failed-save feedback (scroll to the first invalid field) on all forms and sheets.
- R2-2 Add Property asks "Where is this property?" (mapped flat / society flat not yet mapped / independent property).
- R2-3/10/11 requirement location through the Locality Master picker, preferred societies or Open area; nothing hidden is required.
- RV2-A address field with Open Google Maps and paste link/coordinates preview.
- R2-9 card shows Territory AA, Servicing AA, Relationship owner and the routing reason; RV2-D lead source; R2-12 "Location preference not captured".
- R2-5 visit outcomes by type; R2-6 MediaPanel (photos, video, cover) on the property and inside inspection visits, uploads fall back to `proxy_url`.
- R2-16/17 leave reason required, overlap explained, cancel, cover AA; R2-18 reminder deep links read nested and flat ids.
Key commits: `87ffd59`, `42c8afe`, `5dba8a9`, `2a92be5`, `f55f440`.

## REQ-11 and REQ-12 (2026-11-02)
- REQ-11: keys for independent properties (by listing, online and offline), notification kinds `VISIT_UPDATE` and `CUSTOMER_RESPONSE` with exact deep links, `KEY_TASK` actions, communication status display. Commit `5abf15e`.
- REQ-12: requirement message history behind "Show messages" on each requirement card. Commit `f5ecf2c`.

## APK build profile (2026-11-03)
`eas.json` `preview` profile for an installable Android APK with the API URL baked in. Commit `f9d1514`; EAS project id recorded in `eaf4b79` (2026-11-10).

## Revision 3: round 3 testing (2026-11-10)
- R3-4 photo/video upload uses Expo's native uploader (`expo-file-system` `File.upload`) for the direct PUT and the proxy fallback, replacing `fetch(uri).blob()`; real progress, Try again, Take another photo, move earlier. **Not yet proven on a device** (see `KNOWN_ISSUES.md`). Commit `e19a909`.
- R3-1 `MoneyField` and worded amounts (Lakh/Crore) on every money field and display. Commit `8001296`.
- R3-2 required requirement fields marked, inline errors, "Save as draft", Draft badge, missing list and "Complete requirement".
- R3-3 the card lists each preferred area with its territory AA; the creating AA keeps servicing.
- R3-7 no-show sheet (who, reason, note, next step) and Visits tabs Today / Upcoming / Past / No show / Cancelled.
- R3-5 a failed upload changes nothing on the listing draft.
Commit `1cea26f` (R3-2/3/7 + `api:gen`). An APK rebuild and a device test are pending.

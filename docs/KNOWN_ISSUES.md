# Known issues, limitations and not-done items

State as of 2026-11-10 (end of Revision 3). Newest findings first within each section.

## Needs verification
| Item | Detail |
|---|---|
| **R3-4 native upload not proven on a device** | Photo/video upload now uses `expo-file-system` `File.upload` (`src/lib/nativeUpload.ts`): direct PUT to the presigned URL, then `proxy_url`. Jest mocks the uploader and the Node live suites can't exercise it, so only a phone test can prove the bytes arrive on Android. Needs an APK rebuild first (no new native module was added). R3-5 (Draft → upload → submit on a phone) waits on this |
| Revision 2 and 3 founder phone tests | Both revisions were "done, awaiting founder phone test / APK rebuild" |

## Limitations
| Item | Detail |
|---|---|
| **Push notifications need a development build** | Expo Go on Android can't get push tokens (SDK 53+), and the current preview APK has no push setup either, so there is no remote push today. `src/lib/push.ts` skips registration in Expo Go. In-app notifications (drawer, From Ops) work from the API. The backend also only logs push for now |
| **Maps preview is parsed on the phone** | `src/lib/location.ts` gives an instant preview for pasted Maps links / coordinates; the server re-parses `location_input` and is the authority. Short `maps.app.goo.gl` links can't be resolved: the link is kept, coordinates stay empty. Keep the phone and server parsers in step (the field suite checks the preview against `/geo/parse-location`) |
| **APK points at a personal ngrok domain** | `eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL` is the original developer's ngrok domain, baked in at build time. Change it to your own server before building; every code or URL change needs a rebuild |
| **Dependency on `../shared/openapi.yaml`** | `npm run api:gen` reads a file outside this repo. Get it from the backend (`manage.py spectacular --file ../shared/openapi.yaml`) or from a running server's `/api/schema/`. `src/api/schema.d.ts` is committed, so the app builds without it |
| Offline outbox in Expo Go | Some Expo Go builds lack ExpoSQLite; the outbox then falls back to memory, so queued edits sync but don't survive an app restart |
| Messages are log-only | WhatsApp/SMS to customers and owners are recorded (`QUEUED_NO_PROVIDER`), not sent, until a provider is chosen. Visit confirmations to customers (R3 item 6) are logged the same way. The app doesn't display `to_phone`; `communications_count` was not added |
| A buyer visit's owner message also appears on the buyer requirement | Communications include rows linked by visit/listing |
| Server-written text isn't reformatted | Match reasons such as "Within budget (₹98 L)" come from the server and keep their own money format |
| Typed routes | New route files need typed routes regenerated when Metro isn't running (command in `docs/CONTEXT.md`) |
| `README.md` is partly out of date | It still describes Survey/Visits/Earnings as placeholders and says there is no offline queue. `AGENTS.md` and `docs/` are current |

## Test quirks
| Item | Detail |
|---|---|
| **Single-file jest runs hang** | `npx jest <file>` may not exit after the tests finish; add `--forceExit` |
| **One flaky jest run seen once** | One jest run failed once without a code change; not reproduced, cause unknown. Rerun before chasing it. Jest uses a 30 s timeout and 50% workers because cold screen renders are slow under parallel load |
| Live suites write dev data | `test:integration` and `test:integration:field` create leads, towers and properties in the dev DB each run. They need a live `:8000` backend with seeded data and `DEBUG=True` (dev OTP). The float-race check is opt-in (`FLOAT_RACE=1`) |
| Follow-up times in tests | The server rejects follow-ups outside 09:00–18:00 IST unless `after_hours`; use a fixed in-hours time, not "now + N hours" |
| RNTL 14 | Always `await fireEvent.press(...)` |

## Not done (out of scope so far)
- Customer web page/dashboard, document requests, offers/negotiation, agreements and e-sign UI (backend has models only).
- Visit-specific Area AA per property (Round 3 §3).
- Telephony integration (calls are AA-logged), SMS OTP provider, WhatsApp provider.
- CI, staging, Sentry, hosting, Play Store builds, device QA and pilot.
- Commission rules from Round 3 §B (recorded for the earnings work).
- Open app → backend requests: none (REQ-1 to REQ-12 are done).

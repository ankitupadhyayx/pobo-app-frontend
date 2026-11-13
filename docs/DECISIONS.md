# Product and UX decisions

Decisions that shape the app, with date and reason. "Founders" means the POBO founder team; the dev team chose a default wherever a decision was still open, and those are listed under **Pending confirmation** at the end. Where a reason was not written down, this file says so.

## Decided
| Date | Decision | Reason / source |
|---|---|---|
| 2026-10-23 | **Business labels come from the API** (`/config/app`, masters), never hardcoded; UI chrome strings are en + hi | Ops can change labels without an app release; the app is bilingual |
| 2026-10-23 | **Offline scope (DEC-06):** surveys, contacts, unit details, listing drafts, notes, follow-ups, keys work offline via the outbox; submit, verification, transfers, claims, visit scheduling and money need a connection | Phase 2 brief; conflicts must be visible, never silently overwritten |
| 2026-10-23 | **Mapping ≠ survey ≠ unit details ≠ opportunity ≠ listing (DEC-01)**, shown differently in the UI; only VERIFIED listings are matched; an AA can't verify their own | Phase 2 brief |
| 2026-10-23 | **Home = capped sections** (3 items each) with View all to filtered lists | Action-first Home; keeps it short |
| 2026-10-26 | **Add Lead → Requirement #1 is never changed** | Founder QA rule: it works; don't "fix" it |
| 2026-10-26 | **Visible success feedback on every action** (one shared SuccessHost) | Founder QA rule: a saved action must not leave the AA wondering |
| 2026-10-26 | **12-hour times; callbacks end at 6 PM**, later only with an explicit "customer asked for a later time" exception | FB-10; service hours 09:00–18:00 |
| 2026-10-26 | **Share with client uses the phone's share sheet** with a plain text summary, and records the channel; no customer web page yet | FB-04; the customer page was a pending founder decision |
| 2026-11-02 | **Address by paste instead of the Google Maps/Places API (RV2-A):** full text address (always enough), "Open Google Maps", paste a Maps link or "lat, lon" with a preview; short `maps.app.goo.gl` links are kept without coordinates | Founders asked for Maps/Places (QA item 1); the 2026-11-02 decision was "address without Google API". Interim choice "until we add the Google Maps API": no API key or billing yet, while still capturing a cross-check location the AA can copy from Google Maps |
| 2026-11-02 | **No hidden required fields** (R2-3): never reject on a field the form doesn't show; never force a single society | Round 2 bug: "Society is required" with no society field |
| 2026-11-02 | **Failed save → message, scroll to the first invalid field, error under it** (R2-8) | Round 2 testing |
| 2026-11-02 | **Controlled sector/locality master** instead of free text; "Other / not listed" goes to Ops review | R2-10: free-text sectors broke routing and matching |
| 2026-11-02 | **Visit outcomes depend on the visit type**; no buyer questions on inspections | R2-5 |
| 2026-11-02 | **Customer-facing web page/dashboard reached by a WhatsApp/SMS link**, rather than a customer app, for shortlists, responses and visit requests | Round 2 QA (items 13, 15) describes a "customer-facing web/dashboard"; backend has models only (`ShareLink`, `CustomerResponse`, `CustomerAccount`). Dev recommendation (2026-11-02): mobile web with phone OTP opens straight from the shared link with no install, and is cheaper to iterate; a native app can follow for repeat users. A founder team member also suggested a website login. Not built; confirm before building |
| 2026-11-02 → 11-10 | **Customer messages stay log-only under "Show messages"** on each requirement card; not made more prominent | Revision 3 brief (R3-6): no provider yet; the team tells testers where to look |
| 2026-11-10 | **The creator keeps servicing (R3-3):** the AA who adds a lead stays relationship owner and servicing AA until an explicit transfer; territory AAs are shown per preferred area. Website/admin/import leads route to the first preferred area that has an AA. This reverses the R2-9 behaviour | Round 3 §B founder rule |
| 2026-11-10 | **Matching only in the preferred areas** (no city-level "same area" matches); Open area matches widely | R3-3 |
| 2026-11-10 | **Requirement Drafts (R3-2):** required fields marked; missing fields offer "Save as draft"; a Draft is routed but excluded from matching, with a "Complete requirement" next action. A normal save sends nothing extra, so Add Lead never fails on these | Round 3 item 2 |
| 2026-11-10 | **Money format (R3-1):** Indian commas while typing (₹5,00,00,000), worded amount below (₹5 Crore, ₹1.25 Crore, ₹50 Lakh), exact digits kept; displays use the worded form | Round 3 item 1 |
| 2026-11-10 | **No-show flow (R3-7):** a retained outcome asking who was absent, reason (optional), note and next step (Reschedule → linked new visit, Follow up, Cancel) | Round 3 item 7: no-shows disappeared into Cancelled |
| 2026-11-10 | **Visits tabs:** Today / Upcoming / Past (completed + no-show) / No show / Cancelled; old `?bucket=completed` opens Past | R3-7; no-shows must not hide in Cancelled |
| 2026-11-10 | **Upload with the native file uploader** (direct PUT, then proxy) instead of `fetch(uri).blob()` | R3-4: blob uploads are unreliable on React Native Android |

## Pending confirmation
Defaults chosen by the dev team that the founders have not confirmed. Change them in code or server settings once decided.

**App defaults**
- SELL/RENT OUT "property type" = the configuration chips (no separate type field); not required once a property is added.
- RENT budget = the rent field (or a budget range).
- "Save as draft" appears only after a save stops on missing fields.
- Amounts under ₹1 lakh show exact (₹45,000), not "45 Thousand".
- The follow-up created from a no-show uses the no-show note as its notes.
- Past and No show are both separate tabs.
- Key take/return for an independent property sits on the property's Access card (listing AA).
- `CUSTOMER_RESPONSE` opens the requirement, except visit confirm/reschedule replies, which open the visit.
- Message status wording: "Queued, not sent: no provider yet", "Skipped (DNC)", "Not delivered", "To main contact".

**Server defaults the app relies on** (backend settings)
- SLA 15 min target / 30 min breach; service hours 09:00–18:00 (18:00 inclusive); any call outcome counts as first contact.
- Floats: 30 business-minute window, up to 5 candidates within 15 km; workload reference 60 open requirements.
- Collect-key task 60 min before the visit; return task 2 h after a PER_VISIT visit.
- Inspection "completed" outcomes need 3 photos; "Video completed" needs a video; videos up to 150 MB.
- Free-text "150" alone means Sector 150; shown territory AA for an uncovered area = the first covered preferred area.
- No-show reasons: Not reachable, Changed plans, Running late, Key not available, Emergency, Other. Reschedule copies property, type, meeting point and notes.
- Existing requirements were not flagged Draft; they become Draft when edited with fields missing.
- Earnings: interim rule set (10% pool; weights SOURCE 28 / SERVICING 42 / PROPERTY 30 / CLOSURE 0) are prototype values, not policy. Round 3 §B states different commission rules, recorded for later, not built.
- Message templates are placeholders pending approval; buyer visits message both customer and owner.

**Open founder decisions (not built)**
SMS OTP / WhatsApp / telephony providers; website submission auth; whether "no answer" stops the SLA; float window and radius; workload cap; commission weights and the deposit policy; four-eyes on deal verification and reconciliation; customer page/dashboard, documents, offers/negotiation, agreements and e-sign UI; visit-specific Area AA per property; hosting, Play Store builds and pilot.

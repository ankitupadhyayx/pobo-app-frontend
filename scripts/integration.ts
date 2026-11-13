/**
 * Live-backend integration check for the AA app's API usage.
 *   API_URL=http://localhost:8000/api/v1 npm run test:integration
 * Uses the same generated client + auth fetch (refresh rotation) as the app, with an in-memory
 * token store. Seeded accounts and the dev OTP come from ../shared/DEV_ACCOUNTS.md.
 * It creates data (a website lead, an AA lead, calls, follow-ups…) but never touches seeded floats.
 */
import { createApi, unwrap } from '../src/api/client';
import { ApiError } from '../src/api/errors';
import { memoryTokenStore } from '../src/api/tokens';
import { cursorFrom } from '../src/api/keys';
import { assert, step, summary } from './lib';

const API_URL = (process.env.API_URL ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/+$/, '');
const ORIGIN = API_URL.replace(/\/api\/v\d+$/, '');
const OTP = process.env.AA_OTP ?? '123456';
const PRIYA = process.env.AA_PHONE ?? '+919876543210';
const ANITA = '+919811122334';
const MEGHA = '+919711889900';
const ANKUR_DNC_SEARCH = 'Ankur';

const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const phone = () => `+9198${rnd()}`;
/** FB-10: callbacks must fall inside service hours (09:00–18:00 IST). Tomorrow at hh:mm IST. */
const tomorrowIst = (hh: number, mm = 0) => {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1, hh, mm) - 5.5 * 3600_000).toISOString();
};

async function expectError(p: Promise<unknown>, status: number, code?: string): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    assert(e instanceof ApiError, `expected ApiError, got ${String(e)}`);
    assert(e.status === status, `expected HTTP ${status}, got ${e.status} ${e.code}: ${e.message}`);
    if (code) assert(e.code === code, `expected code ${code}, got ${e.code}`);
    return e;
  }
  throw new Error(`expected HTTP ${status}${code ? ` ${code}` : ''} but the call succeeded`);
}

let otpRequested = false;
async function login(phoneE164: string) {
  let expired = 0;
  const store = memoryTokenStore();
  const inst = createApi({ baseUrl: ORIGIN, tokenStore: store, onSessionExpired: () => expired++ });
  // Request a code once per run only: the API allows 5 codes / phone / 15 min, and the dev code
  // verifies seeded accounts without a fresh challenge.
  if (!otpRequested) {
    const r = await unwrap(inst.client.POST('/api/v1/auth/otp/request', { body: { phone: phoneE164 } }));
    assert(r.sent && r.resend_after > 0, 'otp request returns resend timer');
    otpRequested = true;
  }
  const res = await unwrap(inst.client.POST('/api/v1/auth/otp/verify', { body: { phone: phoneE164, code: OTP } }));
  await store.set({ access: res.access, refresh: res.refresh });
  return { api: inst.client, store, user: res.user, expired: () => expired };
}

async function main() {
  console.log(`POBO AA integration against ${ORIGIN}\n`);
  const priya = await step('login Priya (AA) with dev OTP', async () => {
    const s = await login(PRIYA);
    assert(s.user.role === 'AA' && s.user.aa_profile, 'Priya is an AA with a profile');
    return s;
  });
  if (!priya) return;
  const { api } = priya;

  await step('GET /me: onboarding flag + duty', async () => {
    const me = await unwrap(api.GET('/api/v1/me'));
    assert(typeof me.aa_profile?.onboarding_required === 'boolean', 'onboarding_required present');
    assert(me.aa_profile?.duty_status, 'duty_status present');
  });

  const config = await step('GET /config/app: master lists + glossary + enums (en/hi)', async () => {
    const c = await unwrap(api.GET('/api/v1/config/app'));
    for (const k of ['CALL_OUTCOME', 'CONFIGURATION', 'FOLLOW_UP_TYPE', 'FOLLOW_UP_OUTCOME', 'TRANSFER_REASON', 'ESCALATION_CATEGORY', 'GLOSSARY', 'TIMELINE', 'LEAD_SOURCE']) {
      assert(c.master_lists[k]?.length, `master list ${k}`);
    }
    assert(c.master_lists.CONFIGURATION.some((m) => m.code === 'STUDIO'), 'Studio option present');
    const rt = c.enums.requirement_type as { code: string; label_hi?: string }[];
    assert(rt.every((e) => typeof e.label_hi === 'string'), 'enum label_hi present');
    return c;
  });

  // ------------------------------------------------------------- website lead via public intake
  const webName = `Web Test ${rnd().slice(0, 4)}`;
  const webPhone = phone();
  await step('public intake: website lead in Paras Tierea (OTP → intake)', async () => {
    const soc = await unwrap(api.GET('/api/v1/public/societies', { params: { query: { search: 'Paras Tierea' } } }));
    const s = (soc as { results?: { id: string; name: string }[] }).results?.[0] ?? (soc as unknown as { id: string }[])[0];
    assert(s?.id, 'Paras Tierea in public society search');
    await unwrap(api.POST('/api/v1/public/otp/request', { body: { phone: webPhone } }));
    const v = await unwrap(api.POST('/api/v1/public/otp/verify', { body: { phone: webPhone, code: OTP } }));
    const r = await unwrap(
      api.POST('/api/v1/public/intake', {
        body: {
          intake_token: (v as { intake_token: string }).intake_token,
          phone: webPhone,
          name: webName,
          consent: { contact: true, privacy: true, whatsapp: true },
          intents: ['BUY', 'SELL'],
          requirements: [
            { type: 'BUY', preferred_areas: ['Sector 137'], configuration: '3BHK', budget_min: 9000000, budget_max: 13000000 },
            { type: 'SELL', society_id: s.id, tower_name: 'T2', flat_number: '901', configuration: '2BHK', expected_price: 9500000 },
          ],
          attribution: { source: 'WEBSITE', utm_source: 'integration' },
        },
      }),
    );
    assert(r.requirements.length === 2, `two requirements from one submission (got ${r.requirements.length})`);
  });

  const home = await step('GET /me/home: ranked items, each with a next action', async () => {
    const h = await unwrap(api.GET('/api/v1/me/home'));
    assert(h.items.length > 0, 'home has items');
    for (let i = 1; i < h.items.length; i++) assert(h.items[i - 1].priority >= h.items[i].priority, 'ranked by priority');
    assert(h.items.every((i) => i.next_action), 'every card has a next action');
    assert(typeof h.items[0].customer_dnc === 'boolean', 'customer_dnc on items (REQ-2)');
    return h;
  });

  const webRel = await step('website lead appears on Leads (search) and Home', async () => {
    const list = await unwrap(api.GET('/api/v1/relationships', { params: { query: { search: webName } } }));
    const row = list.results.find((r) => r.customer.name === webName);
    assert(row, 'lead found by search');
    assert(row.requirements.length >= 1, 'requirement summaries present');
    const h = await unwrap(api.GET('/api/v1/me/home'));
    const onHome = h.items.some((i) => i.target.relationship_id === row.id);
    console.log(`   assigned requirements on Priya: ${row.requirements.filter((x) => x.is_mine).length}, on Home: ${onHome}`);
    return row;
  });

  await step('GET /relationships: cursor pagination + filters + SLA countdown fields', async () => {
    const p1 = await unwrap(api.GET('/api/v1/relationships', { params: { query: { page_size: 3 } } }));
    assert(p1.results.length === 3, 'page of 3');
    const cursor = cursorFrom(p1.next);
    assert(cursor, 'next cursor parsed');
    const p2 = await unwrap(api.GET('/api/v1/relationships', { params: { query: { page_size: 3, cursor } } }));
    assert(!p2.results.some((r) => p1.results.some((x) => x.id === r.id)), 'no overlap between pages');
    const buy = await unwrap(api.GET('/api/v1/relationships', { params: { query: { type: ['BUY'], page_size: 50 } } }));
    assert(buy.results.every((r) => r.requirements.some((q) => q.type === 'BUY')), 'type filter');
    const withSla = (await unwrap(api.GET('/api/v1/relationships', { params: { query: { page_size: 50 } } }))).results.find((r) => r.sla?.due_at);
    assert(withSla, 'a row with sla.due_at exists (REQ-1)');
  });

  const detail = await step('GET /relationships/{id}: customer + one card per requirement + timeline', async () => {
    assert(webRel, 'need website lead');
    const d = await unwrap(api.GET('/api/v1/relationships/{id}', { params: { path: { id: webRel.id } } }));
    assert(d.requirements.length === 2, 'two requirement cards');
    assert(d.requirements.every((r) => r.sla && 'next_action' in r && Array.isArray(r.allowed_transitions)), 'per-requirement sla/next_action/transitions');
    const tl = await unwrap(api.GET('/api/v1/relationships/{id}/timeline', { params: { path: { id: webRel.id } } }));
    assert(Array.isArray(tl.results), 'timeline list');
    return d;
  });

  const myReq = detail?.requirements.find((r) => r.can_act);

  await step('call outcome needing a next action → 400 fields.next_action (inline error)', async () => {
    assert(myReq, 'an actionable requirement on the website lead');
    const needs = config?.master_lists.CALL_OUTCOME.find((o) => (o.metadata as { requires_next_action?: boolean })?.requires_next_action);
    assert(needs, 'outcome with requires_next_action');
    const e = await expectError(api.POST('/api/v1/requirements/{id}/calls', { params: { path: { id: myReq.id } }, body: { outcome: needs.code, direction: 'OUTBOUND' } }).then(throwIfError), 400);
    assert(e.fields.next_action, `fields.next_action present (got ${JSON.stringify(e.fields)})`);
  });

  const callRes = await step('log call NO_ANSWER + next action → follow-up created; SLA stops', async () => {
    assert(myReq, 'actionable requirement');
    const due = tomorrowIst(11);
    const r = await unwrap(
      api.POST('/api/v1/requirements/{id}/calls', {
        params: { path: { id: myReq.id } },
        body: { outcome: 'NO_ANSWER', direction: 'OUTBOUND', duration_seconds: 25, notes: 'integration', next_action: { type: 'CALL', due_at: due, priority: 'NORMAL', after_hours: false }, client_id: crypto.randomUUID() },
      }),
    );
    assert(r.follow_up, 'follow-up returned');
    return r;
  });

  await step('complete follow-up', async () => {
    assert(callRes?.follow_up, 'follow-up from call');
    const r = await unwrap(api.POST('/api/v1/follow-ups/{id}/complete', { params: { path: { id: callRes.follow_up.id } }, body: { outcome: 'DONE', notes: 'done' } }));
    assert(r.follow_up.status === 'COMPLETED', 'completed');
  });

  await step('schedule follow-up + my follow-ups bucket', async () => {
    assert(myReq, 'actionable requirement');
    await unwrap(
      api.POST('/api/v1/requirements/{id}/follow-ups', {
        params: { path: { id: myReq.id } },
        body: { type: 'WHATSAPP', due_at: tomorrowIst(12), priority: 'NORMAL', notes: 'send brochure', after_hours: false, client_id: crypto.randomUUID() },
      }),
    );
    const mine = await unwrap(api.GET('/api/v1/me/follow-ups', { params: { query: { requirement_id: myReq.id, status: ['PENDING'] } } }));
    assert(mine.results.length >= 1, 'pending follow-up listed');
  });

  await step('templates → communication returns a WhatsApp deep link (logged)', async () => {
    assert(myReq, 'actionable requirement');
    const tpls = await unwrap(api.GET('/api/v1/templates'));
    const wa = tpls.find((t) => t.channel === 'WHATSAPP');
    assert(wa, 'a WhatsApp template');
    const c = await unwrap(api.POST('/api/v1/requirements/{id}/communications', { params: { path: { id: myReq.id } }, body: { template_code: wa.code, channel: 'WHATSAPP', to: 'CUSTOMER' } }));
    assert(/^(https:\/\/wa\.me|whatsapp:)/.test(c.deep_link), `deep link looks like WhatsApp: ${c.deep_link}`);
  });

  await step('DNC customer: outbound call blocked with 409 customer_dnc', async () => {
    const list = await unwrap(api.GET('/api/v1/relationships', { params: { query: { search: ANKUR_DNC_SEARCH } } }));
    const row = list.results.find((r) => r.customer.dnc);
    assert(row, 'seeded DNC customer visible to Priya');
    const req = row.requirements.find((r) => r.is_mine) ?? row.requirements[0];
    await expectError(api.POST('/api/v1/requirements/{id}/calls', { params: { path: { id: req.id } }, body: { outcome: 'INTERESTED', direction: 'OUTBOUND', next_action: { type: 'CALL', due_at: tomorrowIst(10), priority: 'NORMAL', after_hours: false } } }).then(throwIfError), 409, 'customer_dnc');
  });

  // ------------------------------------------------------------- Add Lead (founder's fields)
  const aaPhone = phone();
  const added = await step('Add Lead: email, Studio, tower/flat, RENT_OUT rent + lease, secondary contact, 2 intents', async () => {
    const soc = await unwrap(api.GET('/api/v1/geo/societies', { params: { query: { search: 'Logix' } } }));
    const s = soc.results[0];
    assert(s, 'Logix society');
    const rel = await unwrap(
      api.POST('/api/v1/relationships', {
        body: {
          name: 'Integration Owner',
          phone: aaPhone,
          email: 'owner@example.com',
          consent_confirmed: true,
          contacts: [{ name: 'Spouse Coordinator', phone: phone(), role: 'SPOUSE', priority: 'PRIMARY', address: 'Same flat' }],
          requirements: [
            { type: 'RENT_OUT', society_id: s.id, tower_name: 'A', flat_number: '1101', configuration: 'STUDIO', expected_rent: 22000, lease_term_months: 11 },
            { type: 'RENT', preferred_areas: ['Sector 137'], configuration: '2BHK', expected_rent: 30000, lease_term_months: 11 },
          ],
          source: { source: 'AA_DIRECT' },
        },
      }),
    );
    assert(rel.requirements.length === 2, 'two requirement cards');
    const ro = rel.requirements.find((r) => r.type === 'RENT_OUT');
    assert(ro?.expected_rent === 22000 && ro.lease_term_months === 11 && ro.configuration === 'STUDIO', 'rent/lease/studio stored');
    assert(rel.contacts.some((c) => c.priority === 'PRIMARY' && c.role === 'SPOUSE'), 'primary spouse contact');
    assert(rel.customer.email === 'owner@example.com', 'email stored');
    return rel;
  });

  await step('duplicate phone: lookup masked + Add Lead → 409 customer_exists (accessible)', async () => {
    const l = await unwrap(api.GET('/api/v1/customers/lookup', { params: { query: { phone: aaPhone } } }));
    assert(l.exists && l.can_access && l.phone_masked.includes('•'), 'lookup returns masked phone + access');
    const e = await expectError(
      api.POST('/api/v1/relationships', { body: { name: 'Dup', phone: aaPhone, consent_confirmed: true, requirements: [{ type: 'BUY' }] } }).then(throwIfError),
      409,
      'customer_exists',
    );
    assert((e.details as { accessible?: boolean })?.accessible === true, 'details.accessible');
  });

  await step('add requirement to existing customer (APP-12)', async () => {
    assert(added, 'lead from previous step');
    const r = await unwrap(api.POST('/api/v1/relationships/{id}/requirements', { params: { path: { id: added.id } }, body: { requirements: [{ type: 'BUY', preferred_areas: ['Sector 150'], budget_max: 15000000 }] } }));
    assert(Array.isArray(r) && r.length === 1, 'one requirement created');
  });

  await step('requirement transfer request → pending on lead (APP-15)', async () => {
    assert(added, 'lead');
    const req = added.requirements[0];
    const t = await unwrap(api.POST('/api/v1/transfer-requests', { body: { type: 'REQUIREMENT', requirement_id: req.id, reason: 'WRONG_TERRITORY', destination_area: 'Sector 150', urgency: 'NORMAL' } }));
    assert(t.status === 'PENDING', 'pending');
    const d = await unwrap(api.GET('/api/v1/relationships/{id}', { params: { path: { id: added.id } } }));
    assert(d.pending_transfers.some((p) => p.requirement_id === req.id), 'pending transfer visible on lead');
  });

  await step('referral + escalation (APP-16)', async () => {
    const r = await unwrap(api.POST('/api/v1/referrals', { body: { name: 'Referred Person', phone: phone(), consent_confirmed: true, requirements: [{ type: 'BUY' }] } }));
    assert(r.id, 'referral created');
    assert(added, 'lead');
    const cats = config?.master_lists.ESCALATION_CATEGORY.filter((c) => !(c.metadata as { system_only?: boolean })?.system_only) ?? [];
    const e = await unwrap(api.POST('/api/v1/escalations', { body: { category: cats[0].code, priority: 'NORMAL', notes: 'integration', relationship_id: added.id } }));
    assert(e.status, 'escalation created');
  });

  // ------------------------------------------------------------- Territory float race (fresh float)
  // Opt-in: creating a float notifies every candidate AA. It never claims as Priya (the founder
  // tests as Priya); two other candidates race, and Priya's notification for it is marked read.
  if (process.env.FLOAT_RACE === '1') {
    await step('territory float: fresh float via intake; one candidate wins, the second gets 409', async () => {
      const soc = await unwrap(api.GET('/api/v1/public/societies', { params: { query: { search: 'Uncovered' } } }));
      const s = (soc as { results?: { id: string }[] }).results?.[0];
      assert(s, 'uncovered society in seed');
      const p = phone();
      const v = await unwrap(api.POST('/api/v1/public/otp/verify', { body: { phone: p, code: OTP } })).catch(async () => {
        await unwrap(api.POST('/api/v1/public/otp/request', { body: { phone: p } }));
        return unwrap(api.POST('/api/v1/public/otp/verify', { body: { phone: p, code: OTP } }));
      });
      const name = `FloatRace${rnd().slice(0, 4)}`;
      await unwrap(
        api.POST('/api/v1/public/intake', {
          body: { intake_token: (v as { intake_token: string }).intake_token, phone: p, name, consent: { contact: true, privacy: true, whatsapp: false }, intents: ['SELL'], requirements: [{ type: 'SELL', society_id: s.id, configuration: '3BHK' }] },
        }),
      );
      const candidates: { api: typeof api; floatId: string }[] = [];
      for (const ph of [ANITA, MEGHA]) {
        const sess = await login(ph);
        const fl = await unwrap(sess.api.GET('/api/v1/me/floats'));
        const f = fl.results.find((x) => x.customer_first_name === name);
        if (f) candidates.push({ api: sess.api, floatId: f.id });
      }
      if (candidates.length < 2) {
        console.log(`   (only ${candidates.length} non-Priya candidate(s); race not exercised)`);
        if (!candidates.length) return;
      }
      const [a, b] = candidates;
      const won = await unwrap(a.api.POST('/api/v1/floats/{id}/claim', { params: { path: { id: a.floatId } } }));
      assert(won.is_mine, 'winner owns the requirement');
      if (b) await expectError(b.api.POST('/api/v1/floats/{id}/claim', { params: { path: { id: b.floatId } } }).then(throwIfError), 409);
      const notes = await unwrap(api.GET('/api/v1/notifications', { params: { query: { unread: true, page_size: 50 } } }));
      for (const n of notes.results) {
        if ((n.data as { float_id?: string } | undefined)?.float_id === a.floatId) {
          await unwrap(api.POST('/api/v1/notifications/{id}/read', { params: { path: { id: n.id } } }));
        }
      }
    });
  }

  // ------------------------------------------------------------- Me
  await step('duty off → on (APP-07) and temporarily unavailable', async () => {
    const off = await unwrap(api.PATCH('/api/v1/me/duty', { body: { duty_status: 'OFF_DUTY' } }));
    assert(off.aa_profile?.duty_status === 'OFF_DUTY', 'off');
    const un = await unwrap(api.PATCH('/api/v1/me/duty', { body: { duty_status: 'ON_DUTY', temporarily_unavailable: true, unavailable_reason: 'site visit' } }));
    assert(un.aa_profile?.temporarily_unavailable, 'unavailable');
    const back = await unwrap(api.PATCH('/api/v1/me/duty', { body: { temporarily_unavailable: false, unavailable_reason: '' } }));
    assert(back.aa_profile?.duty_status === 'ON_DUTY' && !back.aa_profile.temporarily_unavailable, 'restored');
  });

  await step('roster + leave list (APP-20)', async () => {
    const r = await unwrap(api.GET('/api/v1/me/roster'));
    assert(r.service_hours_start, 'service hours');
    const l = await unwrap(api.GET('/api/v1/me/leave'));
    assert(Array.isArray((l as { results?: unknown[] }).results ?? l), 'leave list');
  });

  await step('notifications: list, mark one read (APP-19)', async () => {
    const n = await unwrap(api.GET('/api/v1/notifications', { params: { query: { page_size: 5 } } }));
    assert(n.results.length, 'has notifications');
    await unwrap(api.POST('/api/v1/notifications/{id}/read', { params: { path: { id: n.results[0].id } } }));
  });

  await step('push device register + delete', async () => {
    await unwrap(api.POST('/api/v1/me/devices', { body: { token: `ExponentPushToken[integration-${rnd()}]`, provider: 'EXPO', platform: 'android', app_version: '0.1.0' } }));
    const { response } = await api.DELETE('/api/v1/me/devices');
    assert(response.status === 204, `delete 204 (got ${response.status})`);
  });

  await step('refresh rotation: auth fetch refreshes on 401 and old refresh is rejected', async () => {
    const s = await login(PRIYA);
    const before = await s.store.get();
    await s.store.set({ access: 'garbage.access.token', refresh: before!.refresh });
    const me = await unwrap(s.api.GET('/api/v1/me')); // 401 → refresh → retry
    assert(me.id, 'request succeeded after transparent refresh');
    const after = await s.store.get();
    assert(after!.refresh !== before!.refresh, 'refresh token rotated');
    const raw = await fetch(`${ORIGIN}/api/v1/auth/token/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: before!.refresh }) });
    assert(raw.status === 401, `old refresh token rejected (got ${raw.status})`);
    assert(s.expired() === 0, 'session not expired');
  });

  await step('logout blacklists refresh token', async () => {
    const s = await login(PRIYA);
    const tk = await s.store.get();
    const { response } = await s.api.POST('/api/v1/auth/logout', { body: { refresh: tk!.refresh } });
    assert(response.status === 204, 'logout 204');
    const raw = await fetch(`${ORIGIN}/api/v1/auth/token/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: tk!.refresh }) });
    assert(raw.status === 401, 'refresh after logout rejected');
  });

  void home;
}

/** openapi-fetch resolves on HTTP errors; turn them into ApiError like unwrap() does. */
async function throwIfError<T>(r: { data?: T; error?: unknown; response: Response }): Promise<T> {
  return unwrap(Promise.resolve(r));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exitCode = summary() || process.exitCode;
  });

/**
 * Phase 2 live checks (mapping, surveys, offline outbox, listings, photos, keys, matches, Home) as Megha, so the founder's Priya
 * data stays clean. Creates a test tower per run in Megha's first society.
 *   npm run test:integration:field
 */
import { createApi, unwrap } from '../src/api/client';
import { ApiError } from '../src/api/errors';
import { memoryOutboxStore } from '../src/offline/memoryStore';
import { Outbox } from '../src/offline/outbox';
import { makeSyncTransport } from '../src/offline/transport';
import { memoryTokenStore } from '../src/api/tokens';
import { previewUnits } from '../src/lib/mapping';
import { surveyPayload, emptySurvey, detailsPayload, emptyDetails } from '../src/components/survey/forms';
import { keyTakenPayload } from '../src/lib/keys';
import { assert, step, summary } from './lib';

const API_URL = (process.env.API_URL ?? 'http://localhost:8000/api/v1').replace(/\/+$/, '');
const ORIGIN = API_URL.replace(/\/api\/v\d+$/, '');
const MEGHA = '+919711889900';
const PARAS_TIEREA = 'Paras Tierea';
const rnd = () => Math.random().toString(36).slice(2, 6).toUpperCase();

async function login(phone: string) {
  const store = memoryTokenStore();
  const inst = createApi({ baseUrl: ORIGIN, tokenStore: store, onSessionExpired: () => {} });
  const r = await unwrap(inst.client.POST('/api/v1/auth/otp/verify', { body: { phone, code: '123456' } }));
  await store.set({ access: r.access, refresh: r.refresh });
  return inst.client;
}

async function main() {
  console.log(`POBO AA field integration against ${ORIGIN}\n`);
  const api = await login(MEGHA);
  const priya = await login('+919876543210');
  const tag = rnd();

  const society = await step('mapping societies: my territory, mapping and survey progress are separate fields', async () => {
    const list = await unwrap(api.GET('/api/v1/mapping/societies'));
    assert(list.length > 0, 'Megha has societies');
    const p = list[0].progress;
    assert('mapping_pct' in p && 'survey_coverage_pct' in p && 'units_surveyed' in p, 'separate progress');
    return list[0];
  });
  if (!society) return summary();

  const tower = await step('add tower; exact duplicate → 409 tower_exists; near-duplicate is FLAGGED', async () => {
    const tw = await unwrap(api.POST('/api/v1/mapping/societies/{id}/towers', { params: { path: { id: society.id } }, body: { name: `IT Tower ${tag}` } }));
    const dup = await api.POST('/api/v1/mapping/societies/{id}/towers', { params: { path: { id: society.id } }, body: { name: `IT Tower ${tag}` } });
    assert(dup.response.status === 409, `exact duplicate 409 (got ${dup.response.status})`);
    const near = await unwrap(api.POST('/api/v1/mapping/societies/{id}/towers', { params: { path: { id: society.id } }, body: { name: `IT-Tower-${tag}` } }));
    assert(near.duplicate_status === 'FLAGGED', `near duplicate flagged (got ${near.duplicate_status})`);
    return tw;
  });
  if (!tower) return summary();

  const grid = await step('generate floors/units: server numbers match the app preview; re-run is idempotent', async () => {
    const labels = ['G', '1', '2'];
    const r = await unwrap(api.POST('/api/v1/mapping/towers/{id}/generate', { params: { path: { id: tower.id } }, body: { floor_labels: labels, units_per_floor: 2, numbering_pattern: '{floor}{unit:02d}' } }));
    assert(r.units_created === 6, `6 created (got ${r.units_created})`);
    const expected = previewUnits(labels, 2, '{floor}{unit:02d}', tower.name).flatMap((f) => f.units).sort();
    const got = r.tower.units.map((u) => u.number).sort();
    assert(JSON.stringify(expected) === JSON.stringify(got), `numbers match preview: ${got.join(',')} vs ${expected.join(',')}`);
    const again = await unwrap(api.POST('/api/v1/mapping/towers/{id}/generate', { params: { path: { id: tower.id } }, body: { floor_labels: labels, units_per_floor: 2, numbering_pattern: '{floor}{unit:02d}' } }));
    assert(again.units_created === 0 && again.units_skipped === 6, 'idempotent');
    return r.tower;
  });
  if (!grid) return summary();
  const [u1, u2] = grid.units;

  const outbox = new Outbox(memoryOutboxStore(), makeSyncTransport(api, () => `integration-${tag}`));
  await outbox.init();

  await step('offline outbox: survey (3 contact slots, SELL intent) + unit details sync through the real API', async () => {
    const d = emptySurvey();
    d.occupancy = 'TENANT_OCCUPIED';
    d.intent = 'SELL';
    d.contacts.OWNER = { name: 'IT Owner', phone: '9876500001', relation: '', call_allowed: true, whatsapp_allowed: true, source: null };
    d.contacts.ADDITIONAL = { name: 'IT Spouse', phone: '9876500002', relation: 'spouse', call_allowed: true, whatsapp_allowed: false, source: null };
    d.contacts.TENANT = { name: 'IT Tenant', phone: '', relation: '', call_allowed: false, whatsapp_allowed: false, source: null };
    d.lease_end = new Date(Date.now() + 20 * 86400e3).toISOString().slice(0, 10);
    d.monthly_rent = '30000';
    await outbox.enqueue({ type: 'survey.create', entity: 'unit', entityId: u1.id, baseVersion: null, payload: surveyPayload(d), label: 'IT survey' });
    await outbox.enqueue({ type: 'unit_details.save', entity: 'unit', entityId: u1.id, baseVersion: null, payload: { ...detailsPayload({ ...emptyDetails(), balcony_count: '2', facing: null }) }, label: 'IT details' });
    await outbox.flush();
    assert(outbox.state.pending === 0 && outbox.state.conflicts === 0 && outbox.state.rejected === 0, `all synced (pending ${outbox.state.pending}, rejected ${outbox.state.rejected}: ${(await outbox.list())[0]?.error ?? ''})`);
    const u = await unwrap(api.GET('/api/v1/units/{id}', { params: { path: { id: u1.id } } }));
    assert(u.latest_survey?.occupancy === 'TENANT_OCCUPIED', 'survey saved');
    assert(u.contacts.length === 3 && u.contacts.filter((c) => c.name).length === 3, 'three slots filled');
    assert(u.details?.balcony_count === 2, 'details saved');
    assert(u.opportunities.some((o) => o.type === 'SELL'), 'SELL intent auto-created an opportunity');
    assert((u.tenancy?.days_to_expiry ?? 99) <= 30, 'tenancy with days_to_expiry');
  });

  await step('idempotent replay: the same survey client_id twice applies once', async () => {
    const cid = crypto.randomUUID();
    const body = { ...surveyPayload({ ...emptySurvey(), occupancy: 'VACANT' }), client_id: cid };
    const a = await api.POST('/api/v1/units/{id}/surveys', { params: { path: { id: u2.id } }, body });
    const b = await api.POST('/api/v1/units/{id}/surveys', { params: { path: { id: u2.id } }, body });
    assert(a.response.status === 201 && b.response.status === 200, `201 then 200 (got ${a.response.status}, ${b.response.status})`);
    const hist = await unwrap(api.GET('/api/v1/units/{id}/surveys', { params: { path: { id: u2.id } } }));
    assert(hist.length === 1, `one version (got ${hist.length})`);
  });

  await step('replaying the same sync batch twice applies once (duplicate on replay)', async () => {
    const transport = makeSyncTransport(api, () => `integration-${tag}`);
    const m = { client_id: crypto.randomUUID(), type: 'survey.create' as const, entity: 'unit', entity_id: u2.id, base_version: null, payload: surveyPayload({ ...emptySurvey(), occupancy: 'OWNER_OCCUPIED' }), queued_at: new Date().toISOString() };
    const [a] = await transport([m]);
    const [b] = await transport([m]);
    assert(a.status === 'applied' && b.status === 'duplicate', `applied then duplicate (got ${a.status}, ${b.status})`);
    const hist = await unwrap(api.GET('/api/v1/units/{id}/surveys', { params: { path: { id: u2.id } } }));
    assert(hist.length === 2, `exactly one new version (got ${hist.length})`);
  });

  await step('stale base_version → outbox keeps a visible conflict with the server copy (never overwrites)', async () => {
    const u = await unwrap(api.GET('/api/v1/units/{id}', { params: { path: { id: u1.id } } }));
    const stale = (u.details?.version ?? 1) - 1;
    await outbox.enqueue({ type: 'unit_details.save', entity: 'unit', entityId: u1.id, baseVersion: stale, payload: detailsPayload({ ...emptyDetails(), balcony_count: '5' }), label: 'IT stale details' });
    await outbox.flush();
    assert(outbox.state.conflicts === 1, `conflict surfaced (state ${JSON.stringify(outbox.state)})`);
    const [c] = (await outbox.list()).filter((i) => i.status === 'conflict');
    assert(c.server && (c.server as { balcony_count?: number }).balcony_count === 2, 'server copy kept for the diff');
    const after = await unwrap(api.GET('/api/v1/units/{id}', { params: { path: { id: u1.id } } }));
    assert(after.details?.balcony_count === 2, 'server record untouched');
    await outbox.keepServer(c.clientId);
  });

  await step('structure governance: delete unit with no history; unit with history → 409, correction request instead', async () => {
    const empty = grid.units[grid.units.length - 1];
    const del = await api.DELETE('/api/v1/units/{id}', { params: { path: { id: empty.id } } });
    assert(del.response.status === 204, `delete 204 (got ${del.response.status})`);
    const blocked = await api.DELETE('/api/v1/units/{id}', { params: { path: { id: u1.id } } });
    const err = blocked.response.ok ? null : (blocked.error as { error: { code: string } }).error;
    assert(blocked.response.status === 409 && err?.code === 'unit_has_history', `409 unit_has_history (got ${blocked.response.status} ${err?.code})`);
    const c = await unwrap(api.POST('/api/v1/mapping/corrections', { body: { target_type: 'UNIT', target_id: u1.id, action: 'RENAME', proposed: { number: `${u1.number}A` }, reason: 'integration' } }));
    assert(c.status, 'correction created');
  });

  await step('territory: Megha cannot see a Paras Tierea tower (Priya’s)', async () => {
    const soc = (await unwrap(priya.GET('/api/v1/mapping/societies'))).find((s) => s.name === PARAS_TIEREA);
    assert(soc, 'Priya has Paras Tierea');
    const d = await unwrap(priya.GET('/api/v1/mapping/societies/{id}', { params: { path: { id: soc.id } } }));
    const tw = d.towers[0];
    const r = await api.GET('/api/v1/mapping/towers/{id}', { params: { path: { id: tw.id } } });
    assert(r.response.status === 403 || r.response.status === 404, `outside territory blocked (got ${r.response.status})`);
  });

  await step('opportunity → lead with the owner slot and consent', async () => {
    const opps = await unwrap(api.GET('/api/v1/opportunities'));
    const o = opps.results.find((x) => x.unit_id === u1.id && x.status === 'OPEN');
    assert(o, 'open opportunity for the surveyed unit');
    const res = await api.POST('/api/v1/opportunities/{id}/convert-to-lead', { params: { path: { id: o.id } }, body: { slot: 'OWNER', consent_confirmed: true } });
    if (res.response.status === 409) {
      // Earlier runs may already hold an open SELL requirement for this society: the API refuses a duplicate.
      const code = (res.error as { error: { code: string } }).error.code;
      assert(code === 'duplicate_requirement', `409 must be duplicate_requirement (got ${code})`);
      return;
    }
    const r = await unwrap(Promise.resolve(res));
    assert(r.relationship_id || r.duplicate_review_id, 'lead or duplicate review created');
  });

  // ---------------------------------------------------------------- Phase 2 part 2 (APP-25…30)
  const listingId = await step('listing draft offline from the SELL opportunity (listing_draft.create → update) syncs', async () => {
    const u = await unwrap(api.GET('/api/v1/units/{id}', { params: { path: { id: u1.id } } }));
    const opp = u.opportunities.find((o) => o.type === 'SELL' && o.status === 'OPEN');
    assert(opp, 'open SELL opportunity');
    const lo = new Outbox(memoryOutboxStore(), makeSyncTransport(api, () => `integration-${tag}`));
    await lo.init();
    await lo.enqueue({ type: 'listing_draft.create', entity: 'unit', entityId: u1.id, baseVersion: null, payload: { type: 'SELL', opportunity_id: opp!.id, title: `IT ${tag}` }, label: 'IT listing' });
    await lo.flush();
    assert(lo.state.pending === 0 && lo.state.rejected === 0, `create synced (${JSON.stringify((await lo.list()).map((i) => i.error))})`);
    const mine = await unwrap(api.GET('/api/v1/listings', { params: { query: { scope: 'mine', status: 'DRAFT' } } }));
    const l = mine.results.find((x) => x.title === `IT ${tag}`);
    assert(l && l.status === 'DRAFT', 'draft listed under My listings');
    await lo.enqueue({ type: 'listing_draft.update', entity: 'listing', entityId: l!.id, baseVersion: l!.version ?? null, payload: { configuration: '3BHK', expected_price: 12500000 }, label: 'IT listing edit' });
    await lo.flush();
    const after = await unwrap(api.GET('/api/v1/listings/{id}', { params: { path: { id: l!.id } } }));
    assert(after.configuration === '3BHK' && after.expected_price === 12500000, 'draft edit applied');
    return l!.id;
  });

  if (listingId) {
    await step('photo via presign → direct upload → attach; then submit (online) → SUBMITTED', async () => {
      // 1x1 JPEG
      const jpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
      const pre = await unwrap(api.POST('/api/v1/uploads/presign', { body: { purpose: 'LISTING_PHOTO', content_type: 'image/jpeg', size_bytes: jpg.length } }));
      const put = await fetch(pre.url, { method: pre.method || 'PUT', headers: pre.headers as Record<string, string>, body: jpg });
      assert(put.ok, `direct upload ok (got ${put.status})`);
      await unwrap(api.POST('/api/v1/listings/{id}/photos', { params: { path: { id: listingId } }, body: { upload_id: pre.upload_id, is_cover: true } }));
      const sub = await unwrap(api.POST('/api/v1/listings/{id}/submit', { params: { path: { id: listingId } } }));
      assert(sub.status === 'SUBMITTED' && !sub.allowed_actions.includes('EDIT'), `submitted and locked (got ${sub.status})`);
    });
  }

  await step('keys offline: key.taken then key.returned sync; Keys held reflects both', async () => {
    const ko = new Outbox(memoryOutboxStore(), makeSyncTransport(api, () => `integration-${tag}`));
    await ko.init();
    await ko.enqueue({ type: 'key.taken', entity: 'unit', entityId: u2.id, baseVersion: null, payload: { unit_id: u2.id, taken_from: 'OWNER', key_count: 2, tag: `IT-${tag}`, taken_at: new Date().toISOString() }, label: 'IT key' });
    await ko.flush();
    assert(ko.state.pending === 0 && ko.state.rejected === 0, `key.taken synced (${JSON.stringify((await ko.list()).map((i) => i.error))})`);
    const held = await unwrap(api.GET('/api/v1/me/keys', { params: { query: { status: 'HELD' } } }));
    const k = held.find((x) => x.tag === `IT-${tag}`);
    assert(k && k.key_count === 2, 'key held');
    await ko.enqueue({ type: 'key.returned', entity: 'key', entityId: k!.id, baseVersion: k!.version ?? null, payload: { returned_to: 'OWNER', returned_at: new Date().toISOString() }, label: 'IT key return' });
    await ko.flush();
    const again = await unwrap(api.GET('/api/v1/me/keys', { params: { query: { status: 'HELD' } } }));
    assert(!again.some((x) => x.id === k!.id), 'no longer held');
  });

  await step('matches (Priya BUY): verified listings only, score + reasons + differences; shortlist + visits buckets', async () => {
    const rels = await unwrap(priya.GET('/api/v1/relationships', { params: { query: { page_size: 100 } } }));
    // R2-9: Priya can own a relationship whose BUY is serviced by the territory AA; use one she services.
    const req = rels.results.flatMap((r) => r.requirements ?? []).find((q) => q.type === 'BUY' && q.is_mine);
    assert(req, 'Priya services a BUY requirement');
    const m = await unwrap(priya.GET('/api/v1/requirements/{id}/matches', { params: { path: { id: req!.id } } }));
    assert(Array.isArray(m), 'matches list');
    for (const x of m) assert(typeof x.score === 'number' && Array.isArray(x.reasons) && Array.isArray(x.differences) && x.listing.status === 'VERIFIED', 'match shape, verified only');
    const sl = await unwrap(priya.GET('/api/v1/requirements/{id}/shortlist', { params: { path: { id: req!.id } } }));
    assert(Array.isArray(sl), 'shortlist list');
    for (const b of ['today', 'upcoming', 'completed', 'past', 'no_show', 'cancelled'] as const) assert(Array.isArray(await unwrap(priya.GET('/api/v1/me/visits', { params: { query: { bucket: b } } }))), `visits ${b}`);
    console.log(`   ${m.length} matches; top ${m[0]?.score ?? '-'}`);
  });

  await step('Home: territory/visits sections use known view_all screens; counters are numbers', async () => {
    const h = await unwrap(priya.GET('/api/v1/me/home'));
    const known = new Set(['leads', 'floats', 'visits', 'territory', 'keys', 'reminders', 'none']);
    for (const s of h.sections) assert(known.has(s.view_all.screen), `screen ${s.view_all.screen}`);
    assert(typeof h.counters.visits_today === 'number' && typeof h.counters.flats_surveyed_today === 'number', 'real counters');
    console.log(`   sections: ${h.sections.map((s) => `${s.key}:${s.total}`).join(' ')}`);
  });

  await step('field tasks list (tenancy expiry, revisit…)', async () => {
    const tasks = await unwrap(api.GET('/api/v1/me/field-tasks', { params: { query: { status: 'OPEN' } } }));
    assert(Array.isArray(tasks), 'tasks list');
    console.log(`   open tasks: ${tasks.map((x) => x.kind).join(', ') || 'none'}`);
  });

  // ---------------------------------------------------------------- Phase 3 (read-only for Priya; tickets as Megha)
  await step('earnings: every item states its gate; amounts are null or flagged interim per the rule set', async () => {
    const e = await unwrap(priya.GET('/api/v1/me/earnings'));
    assert(e.summary.length === 6, `6 summary states (got ${e.summary.length})`);
    for (const i of e.items) {
      assert(i.gate.message.length > 0, `gate message on ${i.id}`);
      if (!e.amounts_available) assert(i.amount === null, `amount hidden without rule set (${i.id})`);
      if (i.amount !== null && e.rule_set?.interim) assert(i.interim, `interim flag on ${i.id}`);
    }
    const paid = e.payouts.find((p) => p.status === 'PAID');
    if (paid) assert(paid.utrs.length > 0, 'paid batch has UTRs');
    if (e.items[0]) {
      const d = await unwrap(priya.GET('/api/v1/me/earnings/{item_id}', { params: { path: { item_id: e.items[0].id } } }));
      assert(Array.isArray(d.steps) && d.id === e.items[0].id, 'item detail with steps');
    }
    console.log(`   rule set: ${e.rule_set ? `${e.rule_set.name}${e.rule_set.interim ? ' (interim)' : ''}` : 'none'} · items ${e.items.length} · payouts ${e.payouts.length}`);
  });

  await step('My Week: headline is first-contact SLA; previous week loads', async () => {
    const w = await unwrap(priya.GET('/api/v1/me/week'));
    assert(w.headline.key === 'first_contact_sla_pct', `headline ${w.headline.key}`);
    assert(w.days.length === 7, '7 days');
    const [y, m, d] = w.week_start.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 7)).toISOString().slice(0, 10);
    const pw = await unwrap(priya.GET('/api/v1/me/week', { params: { query: { week_start: prev } } }));
    assert(pw.week_start === prev, `previous week ${pw.week_start}`);
  });

  await step('help articles in English and Hindi; one article opens', async () => {
    const en = await unwrap(priya.GET('/api/v1/help/articles', { params: { query: { language: 'en' } } }));
    const hi = await unwrap(priya.GET('/api/v1/help/articles', { params: { query: { language: 'hi' } } }));
    assert(Array.isArray(en) && Array.isArray(hi), 'lists');
    if (en[0]) {
      const a = await unwrap(priya.GET('/api/v1/help/articles/{id}', { params: { path: { id: en[0].id } } }));
      assert(a.body.length > 0, 'article body');
    }
    console.log(`   articles en ${en.length} · hi ${hi.filter((a) => a.language === 'hi').length}`);
  });

  await step('support ticket: raise (idempotent on client_id), reply, see it in my list', async () => {
    const clientId = (globalThis.crypto as Crypto).randomUUID();
    const body = { category: 'APP_ISSUE' as const, subject: `Integration ${tag}`, message: 'Integration check, please ignore.', client_id: clientId };
    const t1 = await unwrap(api.POST('/api/v1/support-tickets', { body }));
    const t2 = await unwrap(api.POST('/api/v1/support-tickets', { body }));
    assert(t1.id === t2.id, 'replay returns the same ticket');
    const r = await unwrap(api.POST('/api/v1/support-tickets/{id}/replies', { params: { path: { id: t1.id } }, body: { body: 'Follow-up from integration.' } }));
    assert(r.replies.length >= 1, 'reply stored');
    const mine = await unwrap(api.GET('/api/v1/me/support-tickets'));
    assert(mine.some((x) => x.id === t1.id), 'listed under my tickets');
  });

  // ---------------------------------------------------------------- Revision 1 (as Megha; Priya read-only)
  const tomorrowIst = (hh: number, mm = 0) => {
    const ist = new Date(Date.now() + 5.5 * 3600_000);
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1, hh, mm) - 5.5 * 3600_000).toISOString();
  };
  const meghaSell = await step('Rev1 FB-03/07: Megha SELL requirement offers inspection-type visits and lists its properties', async () => {
    const rels = await unwrap(api.GET('/api/v1/relationships', { params: { query: { page_size: 100 } } }));
    const r = rels.results.flatMap((x) => x.requirements ?? []).find((q) => q.type === 'SELL');
    assert(r, 'Megha services a SELL requirement (from the opportunity)');
    const full = await unwrap(api.GET('/api/v1/requirements/{id}', { params: { path: { id: r!.id } } }));
    assert(full.allowed_visit_types.includes('INSPECTION') && !full.allowed_visit_types.includes('VIEWING'), `SELL visit types ${full.allowed_visit_types}`);
    const ls = await unwrap(api.GET('/api/v1/requirements/{id}/listings', { params: { path: { id: r!.id } } }));
    assert(Array.isArray(ls) && Array.isArray(full.properties), 'requirement listings + properties');
    return full;
  });

  if (meghaSell) {
    await step('Rev1 FB-03: Add Property with a picked mapped flat links it to the requirement', async () => {
      const res = await api.POST('/api/v1/requirements/{id}/listings', { params: { path: { id: meghaSell.id } }, body: { unit_id: u1.id, expected_price: 9500000, unsure_fields: [{ field: 'carpet_area_sqft' }] } });
      if (res.response.status === 409) {
        const code = (res.error as { error: { code: string } }).error.code;
        console.log(`   409 ${code} (flat already tied to another requirement on an earlier run)`);
        return;
      }
      const l = await unwrap(Promise.resolve(res));
      assert(l.requirement_id === meghaSell.id, 'listing.requirement_id set');
      const again = await unwrap(api.GET('/api/v1/requirements/{id}', { params: { path: { id: meghaSell.id } } }));
      assert(again.properties.some((p) => p.id === l.id), 'property shows on the same requirement');
    });

    await step('Rev1 FB-10: callback after 6 PM → 400 unless the customer asked (after_hours + reason)', async () => {
      const late = tomorrowIst(20);
      const e = await api.POST('/api/v1/requirements/{id}/follow-ups', { params: { path: { id: meghaSell.id } }, body: { type: 'CALL', due_at: late, priority: 'NORMAL', after_hours: false } });
      assert(e.response.status === 400, `outside hours rejected (got ${e.response.status})`);
      const ok = await unwrap(api.POST('/api/v1/requirements/{id}/follow-ups', { params: { path: { id: meghaSell.id } }, body: { type: 'CALL', due_at: late, priority: 'NORMAL', after_hours: true, after_hours_reason: 'Customer asked for a later time' } }));
      assert(ok.after_hours === true, 'after_hours stored');
      await unwrap(api.PATCH('/api/v1/follow-ups/{id}', { params: { path: { id: ok.id } }, body: { status: 'CANCELLED' } }));
    });
  }

  await step('Rev1 FB-07: Priya BUY requirement offers Viewing, not Inspection (read-only)', async () => {
    const rels = await unwrap(priya.GET('/api/v1/relationships', { params: { query: { page_size: 100 } } }));
    const r = rels.results.flatMap((x) => x.requirements ?? []).find((q) => q.type === 'BUY' && q.is_mine);
    assert(r, 'Priya BUY requirement');
    const full = await unwrap(priya.GET('/api/v1/requirements/{id}', { params: { path: { id: r!.id } } }));
    assert(full.allowed_visit_types[0] === 'VIEWING' && !full.allowed_visit_types.includes('INSPECTION'), `BUY types ${full.allowed_visit_types}`);
  });

  await step('Rev1 FB-15: owner intent list has the five property intents; BUY on a survey → 400', async () => {
    const cfg = await unwrap(api.GET('/api/v1/config/app'));
    const codes = ((cfg.master_lists as Record<string, { code: string }[]>).PROPERTY_INTENT ?? []).map((x) => x.code).sort();
    assert(JSON.stringify(codes) === JSON.stringify(['DECLINED', 'NO_INTENT', 'RENT_OUT', 'SELL', 'UNSURE']), `intents ${codes}`);
    const d = emptySurvey();
    d.occupancy = 'OWNER_OCCUPIED';
    d.intent = 'BUY';
    const res = await api.POST('/api/v1/units/{id}/surveys', { params: { path: { id: u1.id } }, body: surveyPayload(d) as never });
    assert(res.response.status === 400, `BUY intent rejected (got ${res.response.status})`);
  });

  await step('Rev1 FB-13: flag a fact Not sure → pending on the unit; withdraw it', async () => {
    const f = await unwrap(api.POST('/api/v1/field-flags', { body: { target_type: 'UNIT', target_id: u1.id, field: 'super_area_sqft', note: 'integration' } }));
    assert(f.status === 'PENDING', 'pending flag');
    const u = await unwrap(api.GET('/api/v1/units/{id}', { params: { path: { id: u1.id } } }));
    assert((u.details?.field_flags ?? []).some((x) => x.field === 'super_area_sqft') || JSON.stringify(u).includes('super_area_sqft'), 'unit shows the pending fact');
    await unwrap(api.POST('/api/v1/field-flags/{id}/withdraw', { params: { path: { id: f.id } } }));
  });

  if (listingId) {
    await step('Rev1 FB-08: key access arrangement on the property', async () => {
      const l = await unwrap(api.PUT('/api/v1/listings/{id}/access', { params: { path: { id: listingId } }, body: { key_party: 'OWNER', contact_name: 'IT Owner', contact_phone: '+919876500001', collection_location: 'Security office', mode: 'PER_VISIT' } }));
      assert(l.access?.mode === 'PER_VISIT', 'access saved');
      const tasks = await unwrap(api.GET('/api/v1/me/field-tasks', { params: { query: { status: 'OPEN', kind: 'KEY_COLLECT,KEY_RETURN' } } }));
      assert(Array.isArray(tasks) && tasks.every((x) => x.kind === 'KEY_COLLECT' || x.kind === 'KEY_RETURN'), 'key task filter');
    });
  }

  await step('Rev1 FB-23: reminders list + Home from_ops counter', async () => {
    const rs = await unwrap(api.GET('/api/v1/me/reminders'));
    assert(Array.isArray(rs), 'reminders list');
    const h = await unwrap(api.GET('/api/v1/me/home'));
    assert(typeof h.counters.unread_reminders === 'number', 'unread_reminders counter');
    console.log(`   ${rs.length} reminders`);
  });

  // ---------------------------------------------------------------- Revision 2 (Round 2 testing)
  const phoneR2 = () => `+9197${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
  const sec150 = await step('R2-10: Locality Master finds "sec 150" / "150"', async () => {
    const a = await unwrap(priya.GET('/api/v1/geo/localities', { params: { query: { search: 'sec 150' } } }));
    const b = await unwrap(priya.GET('/api/v1/geo/localities', { params: { query: { search: '150' } } }));
    const hit = a.find((l) => l.name === 'Sector 150');
    assert(hit && b.some((l) => l.id === hit.id), 'Sector 150 by alias and number');
    return hit!;
  });

  if (sec150) {
    await step('R3-3/R3-2/R2-11: Priya adds BUY Sector 150 → Priya services + owns, area lists Anita; Draft until budget + configuration; RENT Open area', async () => {
      const rel = await unwrap(
        priya.POST('/api/v1/relationships', {
          body: { name: `IT R3 ${tag}`, phone: phoneR2(), consent_confirmed: true, requirements: [{ type: 'BUY', preferred_locality_ids: [sec150.id] }, { type: 'RENT', area_open: true }] },
        }),
      );
      const buy = rel.requirements.find((q) => q.type === 'BUY')!;
      const rent = rel.requirements.find((q) => q.type === 'RENT')!;
      // R3-3 (Round 3 §B): the creating AA stays servicing AA + relationship owner; area AAs are shown.
      assert(buy.routing.servicing_aa?.name.startsWith('Priya'), `BUY serviced by Priya (got ${buy.routing.servicing_aa?.name}: ${buy.routing.reason})`);
      assert(buy.routing.relationship_owner?.name.startsWith('Priya'), 'Priya stays relationship owner');
      const area = buy.routing.areas.find((a) => a.locality?.id === sec150.id);
      assert(area?.territory_aa?.name.startsWith('Anita'), 'routing.areas: Sector 150 → Anita');
      assert(buy.location_status === 'CAPTURED' && buy.preferred_localities.some((l) => l.id === sec150.id), 'BUY location captured');
      assert(rent.location_status === 'OPEN' && rent.area_open === true, 'RENT open area');
      // R3-2: Add Lead → Requirement #1 still saves; missing budget/configuration → Draft, no matches.
      assert(buy.is_draft === true && buy.missing_fields.some((m) => m.field === 'budget_min') && buy.missing_fields.some((m) => m.field === 'configuration'), `BUY is a Draft (${JSON.stringify(buy.missing_fields)})`);
      const m = await unwrap(priya.GET('/api/v1/requirements/{id}/matches', { params: { path: { id: buy.id } } }));
      assert(Array.isArray(m) && m.length === 0, 'Draft excluded from matching');
      const early = await priya.POST('/api/v1/requirements/{id}/complete', { params: { path: { id: buy.id } } });
      assert(early.response.status === 400 && !!early.error?.error?.fields?.budget_min, `complete while missing → 400 with fields (got ${early.response.status})`);
      const fresh = await unwrap(priya.GET('/api/v1/requirements/{id}', { params: { path: { id: buy.id } } }));
      const done = await unwrap(priya.PATCH('/api/v1/requirements/{id}', { params: { path: { id: buy.id } }, body: { version: fresh.version, budget_max: 15000000, configuration: '3BHK', save_as_draft: false } }));
      assert(done.is_draft === false && done.missing_fields.length === 0, 'filled → complete');
      console.log(`   ${buy.routing.reason}`);
    });
  }

  await step('RV2-A: server parse-location agrees with the app preview parser', async () => {
    const { parseLocation } = await import('../src/lib/location');
    for (const text of ['28.5355, 77.3910', 'https://www.google.com/maps/place/X/@28.5355161,77.3910265,17z', 'https://maps.google.com/?q=28.61,77.23']) {
      const srv = await unwrap(api.POST('/api/v1/geo/parse-location', { body: { text } }));
      const mine = parseLocation(text);
      assert(mine && Math.abs(Number(srv.latitude) - mine.latitude!) < 1e-5 && Math.abs(Number(srv.longitude) - mine.longitude!) < 1e-5, `same coords for ${text}`);
    }
  });

  if (meghaSell) {
    const ind = await step('R2-2: Add Property → independent builder floor with address + pasted pin (no society, no unit)', async () => {
      const l = await unwrap(
        api.POST('/api/v1/requirements/{id}/listings', {
          params: { path: { id: meghaSell.id } },
          body: { independent: { property_kind: 'BUILDER_FLOOR', address_text: `B-12 ${tag}, Sector 50, Noida`, location_input: '28.5355, 77.3910' }, expected_price: 7500000 },
        }),
      );
      assert(l.unit === null && l.is_independent && l.property_kind === 'BUILDER_FLOOR', 'independent listing');
      assert(Number(l.latitude) > 28 && l.location_source === 'PASTED_COORDS', 'pin parsed');
      return l;
    });

    if (ind) {
      await step('R2-6: video + photo through the upload proxy, choose cover', async () => {
        // Same requests as the app's putUpload (presign → PUT via proxy_url → attach).
        const up = async (purpose: 'LISTING_VIDEO' | 'LISTING_PHOTO', type: string) => {
          const bytes = new Uint8Array(2048).fill(7);
          const pre = await unwrap(api.POST('/api/v1/uploads/presign', { body: { purpose, content_type: type, size_bytes: bytes.length } }));
          assert(pre.proxy_url && pre.max_bytes > 0, 'presign has proxy_url + max_bytes');
          const r = await fetch(pre.proxy_url, { method: 'PUT', headers: { 'Content-Type': type }, body: bytes });
          assert(r.ok, `proxy PUT ${r.status}`);
          return unwrap(api.POST('/api/v1/listings/{id}/photos', { params: { path: { id: ind.id } }, body: { upload_id: pre.upload_id } }));
        };
        const v = await up('LISTING_VIDEO', 'video/mp4');
        assert(v.media_type === 'VIDEO', 'video saved');
        const p = await up('LISTING_PHOTO', 'image/jpeg');
        const c = await unwrap(api.PATCH('/api/v1/listings/{id}/photos/{photo_id}', { params: { path: { id: ind.id, photo_id: p.id } }, body: { is_cover: true } }));
        assert(c.is_cover, 'cover set');
      });

      await step('R2-5: inspection visit offers inspection outcomes; buyer outcome → 400; photos-completed with too few photos → 409', async () => {
        const visit = await unwrap(api.POST('/api/v1/requirements/{id}/visits', { params: { path: { id: meghaSell.id } }, body: { listing_id: ind.id, visit_type: 'INSPECTION', scheduled_at: tomorrowIst(11), duration_minutes: 30 } }));
        try {
          const codes = visit.allowed_outcomes.map((o) => o.code);
          assert(codes.includes('INSPECTION_COMPLETED') && !codes.includes('INTERESTED'), `inspection outcomes ${codes}`);
          assert(visit.media.required && visit.media.photos_pending > 0, 'media pending');
          const bad = await api.POST('/api/v1/visits/{id}/complete', { params: { path: { id: visit.id } }, body: { outcome: 'INTERESTED', feedback: { notes: 'it' } } as never });
          assert(bad.response.status === 400, `buyer outcome rejected (got ${bad.response.status})`);
          const gated = await api.POST('/api/v1/visits/{id}/complete', { params: { path: { id: visit.id } }, body: { outcome: 'PHOTOS_COMPLETED', feedback: { notes: 'it' } } as never });
          assert(gated.response.status === 409, `media gate (got ${gated.response.status})`);
        } finally {
          const cfg = await unwrap(api.GET('/api/v1/config/app'));
          const reason = ((cfg.master_lists as Record<string, { code: string }[]>).VISIT_CANCEL_REASON ?? [])[0]?.code ?? 'OTHER';
          await api.POST('/api/v1/visits/{id}/cancel', { params: { path: { id: visit.id } }, body: { reason, note: 'integration cleanup' } as never });
        }
      });

      await step('R3-7: no-show records who/next step; RESCHEDULE books a linked visit; no_show bucket, not cancelled', async () => {
        const visit = await unwrap(api.POST('/api/v1/requirements/{id}/visits', { params: { path: { id: meghaSell.id } }, body: { listing_id: ind.id, visit_type: 'INSPECTION', scheduled_at: tomorrowIst(10), duration_minutes: 30 } }));
        let nextId: string | undefined;
        try {
          const bad = await api.POST('/api/v1/visits/{id}/no-show', { params: { path: { id: visit.id } }, body: { who_absent: 'OWNER', next_step: 'RESCHEDULE' } });
          assert(bad.response.status === 400, `RESCHEDULE without a time → 400 (got ${bad.response.status})`);
          const ns = await unwrap(api.POST('/api/v1/visits/{id}/no-show', { params: { path: { id: visit.id } }, body: { who_absent: 'OWNER', note: 'IT owner away', next_step: 'RESCHEDULE', reschedule_at: tomorrowIst(15) } }));
          nextId = ns.rescheduled_visit?.id;
          assert(ns.status === 'NO_SHOW' && ns.no_show?.who_absent === 'OWNER' && ns.no_show?.next_step === 'RESCHEDULE', 'no-show details kept');
          assert(!!nextId && ns.rescheduled_visit?.status === 'SCHEDULED', 'new visit linked');
          const inNoShow = await unwrap(api.GET('/api/v1/me/visits', { params: { query: { bucket: 'no_show' } } }));
          const inCancelled = await unwrap(api.GET('/api/v1/me/visits', { params: { query: { bucket: 'cancelled' } } }));
          assert(inNoShow.some((v) => v.id === visit.id) && !inCancelled.some((v) => v.id === visit.id), 'listed under no_show, not cancelled');
        } finally {
          if (nextId) {
            const cfg = await unwrap(api.GET('/api/v1/config/app'));
            const reason = ((cfg.master_lists as Record<string, { code: string }[]>).VISIT_CANCEL_REASON ?? [])[0]?.code ?? 'OTHER';
            await api.POST('/api/v1/visits/{id}/cancel', { params: { path: { id: nextId } }, body: { reason, note: 'integration cleanup' } as never });
          }
        }
      });

      await step('REQ-11: independent property → access arrangement, key taken by listing (offline outbox, no unit_id), returned; KEY_TASK notifications open the key', async () => {
        const { notificationHref } = await import('../src/lib/deeplink');
        const acc = await unwrap(api.PUT('/api/v1/listings/{id}/access', { params: { path: { id: ind.id } }, body: { key_party: 'OWNER', contact_name: 'IT owner', mode: 'PER_VISIT' } }));
        assert(acc.unit === null && acc.access?.mode === 'PER_VISIT', 'access saved without a unit');
        const ko = new Outbox(memoryOutboxStore(), makeSyncTransport(api, () => `integration-ind-${tag}`));
        await ko.init();
        const payload = keyTakenPayload(null, ind.id, { taken_from: 'OWNER', key_count: 1, tag: `IND-${tag}`, taken_at: new Date().toISOString() });
        assert(!('unit_id' in payload), 'payload has no unit_id');
        await ko.enqueue({ type: 'key.taken', entity: 'listing_key', entityId: ind.id, baseVersion: null, payload, label: 'IT independent key' });
        await ko.flush();
        assert(ko.state.pending === 0 && ko.state.rejected === 0, `key.taken by listing synced (${JSON.stringify((await ko.list()).map((i) => i.error))})`);
        const held = await unwrap(api.GET('/api/v1/me/keys', { params: { query: { status: 'HELD' } } }));
        const k = held.find((x) => x.tag === `IND-${tag}`);
        assert(k && k.unit_id === null && k.listing_id === ind.id && !!k.unit_label && !!k.listing_title, `key by listing (${JSON.stringify(k)})`);
        await ko.enqueue({ type: 'key.returned', entity: 'key', entityId: k!.id, baseVersion: k!.version ?? null, payload: { returned_to: 'OWNER', returned_at: new Date().toISOString() }, label: 'IT independent key return' });
        await ko.flush();
        assert(ko.state.rejected === 0, 'returned');
        const ns = await unwrap(api.GET('/api/v1/notifications', { params: { query: { page_size: 50 } } }));
        const mine = ns.results.filter((n) => n.kind === 'KEY_TASK' && (n.data as { key_id?: string }).key_id === k!.id);
        const actions = mine.map((n) => (n.data as { action?: string }).action);
        assert(actions.includes('KEY_COLLECTED') && actions.includes('KEY_RETURNED'), `collected + returned notified (${actions})`);
        for (const n of mine) assert(notificationHref(n.kind, n.data) === `/more/keys?key=${k!.id}`, `KEY_TASK ${n.id} opens the key`);
      });

      await step('REQ-11: VISIT_UPDATE / CUSTOMER_RESPONSE / KEY_TASK notifications all deep-link (no dead taps)', async () => {
        const { notificationHref } = await import('../src/lib/deeplink');
        const ns = await unwrap(api.GET('/api/v1/notifications', { params: { query: { page_size: 100 } } }));
        const hits = ns.results.filter((n) => ['VISIT_UPDATE', 'CUSTOMER_RESPONSE', 'KEY_TASK'].includes(n.kind));
        assert(hits.some((n) => n.kind === 'VISIT_UPDATE'), 'visit schedule/cancel above notified VISIT_UPDATE');
        for (const n of hits) {
          const href = notificationHref(n.kind, n.data);
          const d = n.data as { visit_id?: string };
          assert(href, `${n.kind} ${n.id} has a link`);
          if (n.kind === 'VISIT_UPDATE' && d.visit_id) assert(href === `/visits?visit=${d.visit_id}`, `VISIT_UPDATE opens its visit (${href})`);
        }
        console.log(`   ${hits.length} REQ-11 notifications checked`);
      });

      await step('R2-2: withdraw the test independent property (cleanup)', async () => {
        await api.POST('/api/v1/listings/{id}/withdraw', { params: { path: { id: ind.id } }, body: { reason: 'integration cleanup' } as never });
      });
    }
  }

  await step('R2-16/17: leave needs a reason; with one it is Pending and can be cancelled', async () => {
    const day = new Date(Date.now() + (400 + Math.floor(Math.random() * 300)) * 86400_000).toISOString().slice(0, 10);
    const bad = await api.POST('/api/v1/me/leave', { body: { leave_type: 'LEAVE', start_date: day, end_date: day, reason: '' } });
    assert(bad.response.status === 400 && JSON.stringify(bad.error).includes('reason'), `reason required (got ${bad.response.status})`);
    const ok = await unwrap(api.POST('/api/v1/me/leave', { body: { leave_type: 'LEAVE', start_date: day, end_date: day, reason: 'Integration check' } }));
    assert(ok.status === 'PENDING' && ok.can_cancel, 'pending + cancellable');
    const list = await unwrap(api.GET('/api/v1/me/leave', { params: { query: { page_size: 50 } } }));
    assert(list.results.some((l) => l.id === ok.id), 'persists in my requests');
    await unwrap(api.POST('/api/v1/me/leave/{id}/cancel', { params: { path: { id: ok.id } } }));
  });

  await step('R2-18: every OPS_REMINDER notification opens a record in the app', async () => {
    const { notificationHref } = await import('../src/lib/deeplink');
    const ns = await unwrap(priya.GET('/api/v1/notifications', { params: { query: { page_size: 100 } } }));
    const rem = ns.results.filter((n) => n.kind === 'OPS_REMINDER');
    for (const n of rem) assert(notificationHref(n.kind, n.data) && notificationHref(n.kind, n.data) !== '/more/reminders', `reminder ${n.id} deep-links`);
    console.log(`   ${rem.length} reminder notifications checked`);
  });

  void ApiError;
  return summary();
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

/** Revision 1 screens bound to the new contract: FB-03, 04, 07, 08, 13, 23 (+ FB-10 payload). */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Share } from 'react-native';
import type { ReactNode } from 'react';
import '@/i18n';
import config from './fixtures/config.json';
import me from './fixtures/me.json';
import listing from './fixtures/listing.json';
import matches from './fixtures/matches.json';
import shortlist from './fixtures/shortlist.json';
import relationship from './fixtures/relationship.json';
import homeP2 from './fixtures/home_p2.json';
import keys from './fixtures/keys.json';
import visitsCompleted from './fixtures/visits_completed.json';

let mockPickDate = new Date();
jest.mock('@react-native-community/datetimepicker', () => {
  // Indirect lookup so NativeWind's babel transform leaves createElement alone inside the factory.
  const ce = require('react')['create' + 'Element'];
  const { Pressable } = require('react-native');
  return { __esModule: true, default: (p: { onChange: (e: { type: string }, d: Date) => void }) => ce(Pressable, { testID: 'dtp', onPress: () => p.onChange({ type: 'set' }, mockPickDate) }) };
});
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockPush = jest.fn();
const mockNavigate = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

const sellReq = { ...relationship.requirements[0], allowed_visit_types: ['INSPECTION', 'PHOTOGRAPHY', 'AGREEMENT_SIGNING', 'KEY_HANDOVER', 'OTHER'], properties: [] as unknown[] };
const buyReq = { ...relationship.requirements[2], allowed_visit_types: ['VIEWING', 'AGREEMENT_SIGNING', 'KEY_HANDOVER', 'OTHER'], properties: [] };
const m0 = matches[0];
const slShortlisted = { ...shortlist[0], id: 'sl-short', status: 'SHORTLISTED', listing: m0.listing, shared_at: null, shared_channel: '' };
const slShared = { ...shortlist[0], id: 'sl-shared', status: 'SHARED', listing: { ...m0.listing, id: 'other-listing' }, shared_at: new Date(2026, 9, 26, 10, 42).toISOString(), shared_channel: 'WHATSAPP' };
const visit = { ...visitsCompleted[0], id: '22222222-2222-4222-8222-222222222222', status: 'SCHEDULED', outcome: null, feedback: null, completed_at: null, scheduled_at: new Date(Date.now() + 3 * 3600_000).toISOString(), visit_type: 'VIEWING', key_tasks: [{ id: 'kt1', kind: 'KEY_COLLECT', status: 'OPEN', priority: 'NORMAL', title: 'Collect key from Owner', notes: '', due_at: new Date(2026, 9, 27, 17, 30).toISOString() }] };
const keyTask = { id: 'task-key', kind: 'KEY_COLLECT', status: 'OPEN', title: 'Collect key from Owner (Mr Gupta)', notes: '', due_at: new Date(Date.now() + 3600_000).toISOString(), priority: 'NORMAL', unit_id: keys[0].unit_id, unit_label: keys[0].unit_label, listing_id: null, visit_id: visit.id, key_id: null, key_context: { key_party: 'OWNER', contact_name: 'Mr Gupta', contact_phone: '+919800000000', collection_location: 'Security office', mode: 'PER_VISIT' }, completed_at: null, completion_notes: '' };
const returnTask = { ...keyTask, id: 'task-return', kind: 'KEY_RETURN', title: 'Owner wants the key back', priority: 'URGENT', key_id: keys[0].id, key_context: null };
const reminder = { id: 'rem-1', title: 'Call Rahul today', message: 'He asked twice', sender_name: 'Rohan', screen: 'requirement', label: 'Open lead', target: { relationship_id: relationship.id, requirement_id: sellReq.id, visit_id: null, listing_id: null, unit_id: null, key_id: null, field_task_id: null, field_flag_id: null, ticket_id: null }, is_read: false, read_at: null, created_at: new Date().toISOString() };
const tgt = { ...homeP2.sections[0].items[0].target, follow_up_id: null, key_id: null, reminder_id: null, field_flag_id: null, ticket_id: null, screen: null };
const home = {
  ...homeP2,
  counters: { ...homeP2.counters, unread_reminders: 1 },
  sections: [
    { key: 'from_ops', total: 1, view_all: { screen: 'reminders', focus: null, count: 1 }, items: [{ ...homeP2.sections[0].items[0], id: 'OPS_REMINDER:rem-1', kind: 'OPS_REMINDER', title: reminder.title, subtitle: 'From Rohan', customer_name: null, customer_phone: null, sla_state: null, breach_at: null, next_action: 'OPEN_REMINDER', target: { ...tgt, relationship_id: relationship.id, requirement_id: sellReq.id, reminder_id: 'rem-1', screen: 'requirement' } }] },
    { key: 'keys', total: 1, view_all: { screen: 'keys', focus: null, count: 1 }, items: [{ ...homeP2.sections[0].items[0], id: 'KEY_RETURN:task-return', kind: 'KEY_RETURN', title: 'Owner wants the key back', subtitle: keys[0].unit_label, customer_name: null, customer_phone: null, sla_state: null, breach_at: null, is_overdue: true, next_action: 'RETURN_KEY', target: { ...tgt, relationship_id: null, requirement_id: null, field_task_id: 'task-return', key_id: keys[0].id } }] },
  ],
};

let mockListing: Record<string, unknown> = listing;
const mockGet: Record<string, (q?: Record<string, string>) => unknown> = {
  '/api/v1/config/app': () => config,
  '/api/v1/me': () => me,
  '/api/v1/me/home': () => home,
  '/api/v1/requirements/{id}': () => (mockParams.rid === sellReq.id ? sellReq : buyReq),
  '/api/v1/requirements/{id}/matches': () => matches,
  '/api/v1/requirements/{id}/shortlist': () => [slShortlisted, slShared],
  '/api/v1/listings/{id}': () => mockListing,
  '/api/v1/me/visits': (q) => (q?.bucket === 'today' ? [visit] : []),
  '/api/v1/me/field-tasks': () => [keyTask, returnTask],
  '/api/v1/me/keys': () => keys,
  '/api/v1/me/reminders': () => [reminder],
  '/api/v1/mapping/societies/{id}': () => ({ id: 's', towers: [] }),
};
const mockPost = jest.fn(async (path: string, opts?: { body?: Record<string, unknown> }) => {
  let data: unknown = {};
  if (path === '/api/v1/requirements/{id}/shortlist') data = { ...slShortlisted, id: 'sl-new' };
  if (path === '/api/v1/requirements/{id}/shares') data = { share: { id: 'sh1', channel: opts?.body?.channel, shared_at: new Date(2026, 9, 26, 10, 42).toISOString() }, items: [] };
  if (path === '/api/v1/requirements/{id}/visits') data = { ...visit, visit_type: opts?.body?.visit_type, scheduled_at: opts?.body?.scheduled_at };
  if (path === '/api/v1/requirements/{id}/listings') data = { ...listing, id: 'new-listing', requirement_id: sellReq.id, unit: { ...listing.unit, tower_name: 'Tower 9', number: '904' }, expected_price: 9500000 };
  return { data, response: { ok: true, status: 200 } };
});
const mockPut = jest.fn(async (_path: string, opts?: { body?: Record<string, unknown> }) => ({ data: { ...listing, access: { ...opts?.body, version: 1 } }, response: { ok: true, status: 200 } }));
jest.mock('@/api/instance', () => ({
  api: {
    GET: async (path: string, opts?: { params?: { query?: Record<string, string> } }) => {
      if (!(path in mockGet)) throw new Error(`unmocked GET ${path}`);
      return { data: mockGet[path](opts?.params?.query), response: { ok: true, status: 200 } };
    },
    POST: (path: string, opts: { body?: Record<string, unknown> }) => mockPost(path, opts),
    PUT: (path: string, opts: { body?: Record<string, unknown> }) => mockPut(path, opts),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
  tokens: { get: jest.fn(), set: jest.fn(), clear: jest.fn() },
  onSessionExpired: jest.fn(),
}));

import { SuccessHost } from '@/components/shell/SuccessHost';
import { useActions } from '@/state/actions';
import { RequirementCard } from '@/components/lead/RequirementCard';
import { VisitCard } from '@/components/visits/VisitCard';

let qc: QueryClient;
const wrap = (ui: ReactNode) => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return (
    <QueryClientProvider client={qc}>
      {ui}
      <SuccessHost />
    </QueryClientProvider>
  );
};
const queued = async () => (await require('@/offline').outbox.list()) as { type: string; payload: Record<string, unknown> }[];
beforeEach(async () => {
  mockPush.mockClear();
  mockNavigate.mockClear();
  mockBack.mockClear();
  mockPost.mockClear();
  mockPut.mockClear();
  mockListing = listing;
  await require('@/offline').outbox.clearAll();
});
afterEach(() => {
  qc?.clear();
  jest.restoreAllMocks();
  useActions.setState({ toast: null, success: null });
});

describe('FB-04 Matched vs Shortlisted + share', () => {
  it('shortlisting shows a success sheet whose next action shares through the phone and records it', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction } as never);
    mockParams = { rid: buyReq.id, title: 'Rahul · Buy', customer: 'Rahul Sharma' };
    const Matches = require('@/app/(app)/lead/matches/[rid]').default;
    await render(wrap(<Matches />));
    await fireEvent.press(await screen.findByTestId(`shortlist-${m0.listing.id}`));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/requirements/{id}/shortlist', expect.objectContaining({ body: { listing_id: m0.listing.id, status: 'SHORTLISTED' } })));
    await waitFor(() => expect(screen.getByTestId('success-sheet')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('success-share'));
    expect(screen.getByTestId('share-preview').props.children).toContain(m0.listing.society_name);
    await fireEvent.press(screen.getByTestId('share-go'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/requirements/{id}/shares', expect.objectContaining({ body: expect.objectContaining({ channel: 'WHATSAPP', shortlist_item_ids: ['sl-new'] }) })));
    expect(share).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Shared with Client')).toBeTruthy());
    expect(screen.getByText(/WhatsApp · 10:42 AM/i)).toBeTruthy();
  });

  it('a dismissed share sheet records nothing', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction } as never);
    mockParams = { rid: buyReq.id, customer: 'Rahul Sharma' };
    const Matches = require('@/app/(app)/lead/matches/[rid]').default;
    await render(wrap(<Matches />));
    await fireEvent.press(await screen.findByTestId('matches-tab-shortlist'));
    await fireEvent.press(await screen.findByTestId(`share-${m0.listing.id}`));
    await fireEvent.press(screen.getByTestId('share-go'));
    await waitFor(() => expect(screen.getByText('Not shared. Try again when ready.')).toBeTruthy());
    expect(mockPost).not.toHaveBeenCalledWith('/api/v1/requirements/{id}/shares', expect.anything());
  });

  it('Shortlisted tab separates picked items and shows "Shared · WhatsApp · time"', async () => {
    mockParams = { rid: buyReq.id, customer: 'Rahul Sharma' };
    const Matches = require('@/app/(app)/lead/matches/[rid]').default;
    await render(wrap(<Matches />));
    await waitFor(() => expect(screen.getByText('Shortlisted (2)')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('matches-tab-shortlist'));
    expect(screen.getByTestId('shared-other-listing').props.children).toMatch(/^Shared · WhatsApp · .*10:42 AM$/i);
    expect(screen.getByTestId(`share-${m0.listing.id}`)).toBeTruthy();
  });
});

describe('FB-07 visit types', () => {
  it('the scheduler offers the requirement types and posts the chosen one; cards show the type', async () => {
    mockParams = { rid: sellReq.id, customer: 'Rahul Sharma' };
    const { ScheduleVisitSheet } = require('@/components/visits/ScheduleVisitSheet');
    await render(wrap(<ScheduleVisitSheet rid={sellReq.id} listing={{ id: listing.id, title: 'My flat' }} visitTypes={sellReq.allowed_visit_types} onClose={jest.fn()} />));
    await waitFor(() => expect(screen.getByTestId('visit-type-INSPECTION')).toBeTruthy());
    expect(screen.queryByTestId('visit-type-VIEWING')).toBeNull();
    await fireEvent.press(screen.getByTestId('visit-type-PHOTOGRAPHY'));
    await fireEvent.press(screen.getByTestId('visit-at'));
    mockPickDate = new Date(Date.now() + 2 * 86400_000);
    await fireEvent.press(screen.getByTestId('dtp'));
    await fireEvent.press(screen.getByTestId('schedule-visit-save'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/requirements/{id}/visits', expect.objectContaining({ body: expect.objectContaining({ visit_type: 'PHOTOGRAPHY', listing_id: listing.id }) })));
    await waitFor(() => expect(screen.getByText('Visit Scheduled')).toBeTruthy());
  });

  it('visit card shows the type and the key reminder in 12-hour time', async () => {
    await render(<VisitCard id="v1" customerName="Rahul" property="Paras Tierea" scheduledAt={visit.scheduled_at} status="SCHEDULED" statusLabel="Scheduled" typeLabel="Viewing" keyNotes={[{ text: 'Collect key from Owner · before 5:30 PM' }]} />);
    expect(screen.getByText('Viewing')).toBeTruthy();
    expect(screen.getByTestId('visit-key-v1-0')).toBeTruthy();
    expect(screen.getByText(/Collect key from Owner · before 5:30 PM/)).toBeTruthy();
  });
});

describe('FB-03 Add Property', () => {
  it('SELL requirement card shows its properties and the Add Property CTA', async () => {
    const onAdd = jest.fn();
    const onOpen = jest.fn();
    const prop = { id: 'p1', title: '3 BHK · Tower 9-904', type: 'SELL', status: 'DRAFT', configuration: '3BHK', expected_price: 9500000, expected_rent: null, unit_id: 'u', unit_label: 'Tower 9-904', society_name: 'Paras Tierea', structure_status: 'PENDING_VERIFICATION', has_access_arrangement: false };
    await render(wrap(<RequirementCard req={{ ...sellReq, properties: [prop] } as never} dnc={false} onCall={jest.fn()} onFollowUp={jest.fn()} onCompleteFollowUp={jest.fn()} onMessage={jest.fn()} onTransfer={jest.fn()} onAddProperty={onAdd} onOpenProperty={onOpen} onVisitProperty={jest.fn()} />));
    expect(screen.getByText('Properties (1)')).toBeTruthy();
    expect(screen.getByText('New flat · Ops will check it')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('req-property-p1'));
    expect(onOpen).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('req-add-property-SELL'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('quick add posts the new flat with Not sure facts, goes back and offers Add photos', async () => {
    mockParams = { rid: sellReq.id, relationshipId: relationship.id };
    const AddProperty = require('@/app/(app)/lead/add-property/[rid]').default;
    await render(wrap(<AddProperty />));
    await screen.findByText(`For: ${sellReq.title}`);
    // R2-2: nothing is assumed; the AA first says where the property is.
    await fireEvent.press(screen.getByTestId('add-property-save'));
    expect(screen.getByText('Choose where the property is')).toBeTruthy();
    expect(screen.getByTestId('toast-error')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('source-SOCIETY'));
    await fireEvent.press(screen.getByTestId('add-property-save'));
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0);
    expect(mockPost).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('qa-tower'), 'Tower 9');
    await fireEvent.changeText(screen.getByTestId('qa-floor'), '9');
    await fireEvent.changeText(screen.getByTestId('qa-unit'), '904');
    await fireEvent.changeText(screen.getByTestId('qa-price'), '9500000');
    await fireEvent.press(screen.getByTestId('unsure-carpet_area_sqft'));
    await fireEvent.press(screen.getByTestId('add-property-save'));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/v1/requirements/{id}/listings',
        expect.objectContaining({ body: expect.objectContaining({ new_unit: expect.objectContaining({ tower_name: 'Tower 9', floor_label: '9', unit_label: '904' }), expected_price: 9500000, unsure_fields: [{ field: 'carpet_area_sqft' }] }) }),
      ),
    );
    expect(mockBack).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Property Added')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('success-add-photos'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/listing/[id]', params: { id: 'new-listing' } });
  });
});

describe('FB-08 keys', () => {
  it('property screen saves the key access arrangement', async () => {
    mockListing = { ...listing, is_mine: true, access: null, field_flags: [] };
    mockParams = { id: listing.id };
    const Listing = require('@/app/(app)/listing/[id]').default;
    await render(wrap(<Listing />));
    await fireEvent.press(await screen.findByTestId('access-edit'));
    await fireEvent.press(screen.getByTestId('access-save'));
    expect(mockPut).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('access-party-OWNER'));
    await fireEvent.press(screen.getByTestId('access-mode-PER_VISIT'));
    await fireEvent.press(screen.getByTestId('access-save'));
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/api/v1/listings/{id}/access', expect.objectContaining({ body: expect.objectContaining({ key_party: 'OWNER', mode: 'PER_VISIT' }) })));
    await waitFor(() => expect(screen.getByText('Key Access Saved')).toBeTruthy());
  });

  it('key tasks: urgent return first; Collect key records the key taken from the arranged party', async () => {
    mockParams = { kind: 'keys' };
    const Tasks = require('@/app/(app)/more/field-tasks').default;
    await render(wrap(<Tasks />));
    await screen.findByTestId('task-collect-task-key');
    expect(screen.getAllByTestId(/^task-KEY_/)[0].props.testID).toBe('task-KEY_RETURN');
    expect(screen.getByText('Urgent')).toBeTruthy();
    expect(screen.getByTestId('task-key-context-task-key').props.children).toMatch(/Mr Gupta/);
    await fireEvent.press(screen.getByTestId('task-collect-task-key'));
    await fireEvent.press(screen.getByTestId('take-key-save'));
    await waitFor(async () => expect((await queued()).map((i) => [i.type, i.payload.taken_from])).toContainEqual(['key.taken', 'OWNER']));
    await waitFor(() => expect(screen.getByText('Key Collected')).toBeTruthy());
  });
});

describe('FB-13 Not sure', () => {
  it('a pending fact shows Verification pending; a new Not sure goes with the draft save', async () => {
    mockListing = { ...listing, is_mine: true, access: null, field_flags: [{ id: 'f1', target_type: 'LISTING', unit_id: 'u', unit_label: 'x', listing_id: listing.id, field: 'super_area_sqft', status: 'PENDING', flagged_by_name: 'Priya' }] };
    mockParams = { id: listing.id };
    const Listing = require('@/app/(app)/listing/[id]').default;
    await render(wrap(<Listing />));
    await screen.findByTestId('pending-super_area_sqft');
    expect(screen.getByText('Verification pending')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('unsure-facing'));
    await fireEvent.press(screen.getByTestId('listing-save'));
    await waitFor(async () => expect((await queued()).find((i) => i.type === 'listing_draft.update')?.payload.unsure_fields).toEqual([{ field: 'facing' }]));
  });
});

describe('FB-23 reminders from Ops', () => {
  it('Home shows From Ops and Keys sections; tapping a reminder marks it read and opens the record', async () => {
    const Home = require('@/app/(app)/(tabs)/index').default;
    await render(wrap(<Home />));
    await screen.findByTestId('home-section-from_ops');
    expect(screen.getByTestId('home-section-keys')).toBeTruthy();
    await fireEvent.press(within(screen.getByTestId('home-item-OPS_REMINDER')).getByText('Open'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/me/reminders/{id}/read', expect.objectContaining({ params: { path: { id: 'rem-1' } } })));
    expect(mockPush).toHaveBeenCalledWith(`/lead/${relationship.id}?requirement=${sellReq.id}`);
    await fireEvent.press(within(screen.getByTestId('home-item-KEY_RETURN')).getByText('Return key'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/more/field-tasks', params: { kind: 'keys' } });
  });

  it('reminders inbox opens the exact record', async () => {
    const Reminders = require('@/app/(app)/more/reminders').default;
    await render(wrap(<Reminders />));
    await fireEvent.press(await screen.findByTestId('reminder-rem-1'));
    expect(screen.getByText('He asked twice')).toBeTruthy();
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/me/reminders/{id}/read', expect.anything()));
    expect(mockPush).toHaveBeenCalledWith(`/lead/${relationship.id}?requirement=${sellReq.id}`);
  });
});

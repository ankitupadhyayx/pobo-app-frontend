/** REQ-11: keys for independent properties, new notification kinds, requirement communications status. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Linking } from 'react-native';
import type { ReactNode } from 'react';
import '@/i18n';
import config from './fixtures/config.json';
import me from './fixtures/me.json';
import listing from './fixtures/listing.json';
import keys from './fixtures/keys.json';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

const LID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const independent = { ...listing, id: LID, unit: null, title: 'Independent house, Sector 41', is_mine: true, status: 'DRAFT', access: null };
const indKey = { ...keys[0], id: 'kkkkkkkk-1111-4111-8111-kkkkkkkkkkkk', unit_id: null, unit_label: 'Independent house, Sector 41', listing_id: LID, listing_title: 'Independent house, Sector 41', key_count: 2, taken_from: 'OWNER' };
const collectTask = {
  id: 'tttttttt-1111-4111-8111-tttttttttttt', kind: 'KEY_COLLECT', status: 'OPEN', title: 'Collect key before visit', notes: '', due_at: null, priority: 'NORMAL',
  unit_id: null, unit_label: 'Independent house, Sector 41', listing_id: LID, visit_id: null, key_id: null, key_context: null, completed_at: null, completion_notes: '', created_at: '2026-11-02T05:00:00Z',
};
let mockKeys: unknown[] = keys;
let mockComms: unknown[] = [];
const mockGet: Record<string, () => unknown> = {
  '/api/v1/config/app': () => config,
  '/api/v1/me': () => me,
  '/api/v1/listings/{id}': () => independent,
  '/api/v1/me/keys': () => mockKeys,
  '/api/v1/me/field-tasks': () => [collectTask],
  '/api/v1/requirements/{id}/communications': () => ({ results: mockComms, next: null, previous: null }),
};
jest.mock('@/api/instance', () => ({
  api: {
    GET: async (path: string) => {
      if (!(path in mockGet)) throw new Error(`unmocked GET ${path}`);
      return { data: mockGet[path](), response: { ok: true, status: 200 } };
    },
    POST: jest.fn(async () => ({ data: { results: [] }, response: { ok: true, status: 200 } })),
    PUT: jest.fn(),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
  tokens: { get: jest.fn(), set: jest.fn(), clear: jest.fn() },
  onSessionExpired: jest.fn(),
}));

let qc: QueryClient;
const wrap = (ui: ReactNode) => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};
const queued = async () => (await require('@/offline').outbox.list()) as { type: string; entity: string; payload: Record<string, unknown> }[];
afterEach(() => qc?.clear());
beforeEach(async () => {
  mockPush.mockClear();
  mockKeys = keys;
  await require('@/offline').outbox.clearAll();
});

describe('REQ-11 keys for an independent property', () => {
  it('the property page records a key by listing (listing_id, no unit_id) through the outbox', async () => {
    mockParams = { id: LID };
    const Listing = require('@/app/(app)/listing/[id]').default;
    await render(wrap(<Listing />));
    await waitFor(() => expect(screen.getByTestId('listing-key-take')).toBeTruthy());
    expect(screen.getByText('No key with you for this property')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('listing-key-take'));
    await fireEvent.press(screen.getByTestId('key-from-OWNER'));
    await fireEvent.press(screen.getByTestId('take-key-save'));
    await waitFor(async () => expect((await queued()).find((i) => i.type === 'key.taken')).toBeTruthy());
    const item = (await queued()).find((i) => i.type === 'key.taken')!;
    expect(item.payload).toMatchObject({ listing_id: LID, taken_from: 'OWNER', key_count: 1 });
    expect('unit_id' in item.payload).toBe(false);
    expect(item.entity).toBe('listing_key');
  });

  it('a held key shows on the property page with Mark returned', async () => {
    mockKeys = [indKey];
    mockParams = { id: LID };
    const Listing = require('@/app/(app)/listing/[id]').default;
    await render(wrap(<Listing />));
    await waitFor(() => expect(screen.getByTestId('listing-key-return')).toBeTruthy());
    expect(screen.getByTestId('listing-key-status').props.children).toContain('2');
  });

  it('a collect task with no flat opens the property and records by listing', async () => {
    mockParams = { kind: 'keys' };
    const Tasks = require('@/app/(app)/more/field-tasks').default;
    await render(wrap(<Tasks />));
    await waitFor(() => expect(screen.getByTestId(`task-collect-${collectTask.id}`)).toBeTruthy());
    await fireEvent.press(screen.getByTestId(`task-open-listing-${collectTask.id}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/listing/[id]', params: { id: LID } });
    await fireEvent.press(screen.getByTestId(`task-collect-${collectTask.id}`));
    await fireEvent.press(screen.getByTestId('key-from-OWNER'));
    await fireEvent.press(screen.getByTestId('take-key-save'));
    await waitFor(async () => expect((await queued()).find((i) => i.type === 'key.taken')?.payload).toMatchObject({ listing_id: LID }));
    expect('unit_id' in (await queued()).find((i) => i.type === 'key.taken')!.payload).toBe(false);
  });

  it('Keys list shows the property title for a key with no flat; ?key= puts that key first', async () => {
    mockKeys = [...keys, indKey];
    mockParams = { key: indKey.id };
    const Keys = require('@/app/(app)/more/keys').default;
    await render(wrap(<Keys />));
    await waitFor(() => expect(screen.getByTestId(`key-${indKey.id}`)).toBeTruthy());
    expect(screen.getAllByText('Independent house, Sector 41').length).toBeGreaterThan(0);
    expect(screen.getByText(/Independent property/)).toBeTruthy();
    const cards = screen.getAllByTestId(/^key-[0-9a-z]{8}-/);
    expect(cards[0].props.testID).toBe(`key-${indKey.id}`);
  });

  it('keyTakenPayload keeps unit_id for a flat', () => {
    const { keyTakenPayload } = require('@/lib/keys');
    const v = { taken_from: 'OWNER', key_count: 1, taken_at: 'x' };
    expect(keyTakenPayload('u1', 'l1', v)).toMatchObject({ unit_id: 'u1', listing_id: 'l1' });
    expect(keyTakenPayload(null, 'l1', v)).toEqual({ listing_id: 'l1', ...v });
  });
});

describe('REQ-11 notification kinds', () => {
  const { notificationHref } = require('@/lib/deeplink');
  it('VISIT_UPDATE opens the exact visit', () => {
    expect(notificationHref('VISIT_UPDATE', { visit_id: 'v1', requirement_id: 'q1', relationship_id: 'r1', action: 'VISIT_CANCELLED' })).toBe('/visits?visit=v1');
    expect(notificationHref('VISIT_UPDATE', { relationship_id: 'r1', requirement_id: 'q1' })).toBe('/lead/r1?requirement=q1');
    expect(notificationHref('VISIT_UPDATE', {})).toBe('/visits');
  });
  it('CUSTOMER_RESPONSE opens the requirement, or the visit for visit replies', () => {
    expect(notificationHref('CUSTOMER_RESPONSE', { requirement_id: 'q1', relationship_id: 'r1', visit_id: null, response: 'INTERESTED' })).toBe('/lead/r1?requirement=q1');
    expect(notificationHref('CUSTOMER_RESPONSE', { requirement_id: 'q1', relationship_id: 'r1', visit_id: 'v9', response: 'VISIT_RESCHEDULE' })).toBe('/visits?visit=v9');
    expect(notificationHref('CUSTOMER_RESPONSE', { listing_id: 'l1', response: 'MORE_INFO' })).toBe('/listing/l1');
    expect(notificationHref('CUSTOMER_RESPONSE', {})).toBe('/leads');
  });
  it('KEY_TASK: collected/returned open the key; owner-wants-it-back opens key tasks', () => {
    expect(notificationHref('KEY_TASK', { action: 'KEY_COLLECTED', key_id: 'k1', unit_id: null, listing_id: 'l1' })).toBe('/more/keys?key=k1');
    expect(notificationHref('KEY_TASK', { action: 'KEY_RETURNED', key_id: 'k1' })).toBe('/more/keys?key=k1');
    expect(notificationHref('KEY_TASK', { action: 'KEY_RETURN_REQUESTED', key_id: 'k1', field_task_id: 't1', priority: 'URGENT' })).toBe('/more/field-tasks?kind=keys');
  });
  it('every kind has an icon (unknown kinds get the bell); no dead taps for the new kinds', () => {
    const { notificationIcon } = require('@/components/shell/notificationIcons');
    const { Bell, CalendarDays, KeyRound, MessageSquareReply } = require('lucide-react-native');
    expect(notificationIcon('VISIT_UPDATE')).toBe(CalendarDays);
    expect(notificationIcon('CUSTOMER_RESPONSE')).toBe(MessageSquareReply);
    expect(notificationIcon('KEY_TASK')).toBe(KeyRound);
    expect(notificationIcon('SOMETHING_NEW')).toBe(Bell);
    for (const k of ['VISIT_UPDATE', 'CUSTOMER_RESPONSE', 'KEY_TASK']) expect(notificationHref(k, {})).not.toBeNull();
  });
});

describe('REQ-11 requirement communications', () => {
  it('shows status + recipient in plain words and hides Open without a link', async () => {
    const { CommunicationList } = require('@/components/lead/CommunicationList');
    const base = { channel: 'WHATSAPP', template_code: 'AUTO_VISIT_SCHEDULED', body: 'Hello', to_phone: '+919800000000', provider: 'NONE', event: 'VISIT_SCHEDULED', created_at: '2026-11-02T08:30:00Z' };
    const items = [
      { ...base, id: 'c1', deep_link: '', status: 'QUEUED_NO_PROVIDER', recipient_kind: 'OWNER' },
      { ...base, id: 'c2', deep_link: '', status: 'SKIPPED', recipient_kind: 'CUSTOMER' },
      { ...base, id: 'c3', deep_link: 'https://wa.me/919800000000?text=Hi', status: 'DEEP_LINK', recipient_kind: 'PRIMARY_CONTACT', template_code: 'INTRO' },
    ];
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(wrap(<CommunicationList items={items} />));
    expect(screen.getByText('Queued, not sent: no provider yet')).toBeTruthy();
    expect(screen.getByText('Skipped (DNC)')).toBeTruthy();
    expect(screen.getByText('Opened on your phone')).toBeTruthy();
    expect(screen.getByText('To owner')).toBeTruthy();
    expect(screen.getByText('To main contact')).toBeTruthy();
    expect(screen.queryByTestId('comm-open-c1')).toBeNull();
    expect(screen.queryByTestId('comm-open-c2')).toBeNull();
    await fireEvent.press(screen.getByTestId('comm-open-c3'));
    expect(open).toHaveBeenCalledWith(items[2].deep_link);
    expect(screen.getAllByText(/PM/).length).toBe(3);
  });
});

describe('REQ-12 requirement communications on the card', () => {
  const RID = 'rrrrrrrr-1111-4111-8111-rrrrrrrrrrrr';
  it('loads on demand, lists newest first and shows an empty state', async () => {
    const { RequirementCommunications } = require('@/components/lead/CommunicationList');
    mockComms = [];
    await render(wrap(<RequirementCommunications requirementId={RID} />));
    expect(screen.queryByTestId(`req-comms-empty-${RID}`)).toBeNull();
    await fireEvent.press(screen.getByTestId(`req-comms-toggle-${RID}`));
    expect(await screen.findByTestId(`req-comms-empty-${RID}`)).toBeTruthy();
    expect(screen.getByText(/No messages yet/)).toBeTruthy();
  });

  it('shows automatic and manual messages', async () => {
    const { RequirementCommunications } = require('@/components/lead/CommunicationList');
    const base = { channel: 'WHATSAPP', body: 'Visit fixed', to_phone: '+919800000000', created_at: '2026-11-02T09:00:00Z' };
    mockComms = [
      { ...base, id: 'm2', template_code: 'INTRO', provider: 'DEEP_LINK', deep_link: 'https://wa.me/1', status: 'DEEP_LINK', recipient_kind: 'CUSTOMER', event: '' },
      { ...base, id: 'm1', template_code: 'AUTO_VISIT_SCHEDULED', provider: 'NONE', deep_link: '', status: 'QUEUED_NO_PROVIDER', recipient_kind: 'CUSTOMER', event: 'VISIT_SCHEDULED' },
    ];
    await render(wrap(<RequirementCommunications requirementId={RID} />));
    await fireEvent.press(screen.getByTestId(`req-comms-toggle-${RID}`));
    expect(await screen.findByTestId('comm-m1')).toBeTruthy();
    expect(screen.getByTestId('comm-open-m2')).toBeTruthy();
    expect(screen.queryByTestId('comm-open-m1')).toBeNull();
    expect(screen.getByText('Queued, not sent: no provider yet')).toBeTruthy();
    expect(screen.queryByTestId(`req-comms-empty-${RID}`)).toBeNull();
  });
});

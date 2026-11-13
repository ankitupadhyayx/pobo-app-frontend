/** Revision 3 (Round 3 testing): R3-2 required fields + Draft, R3-3 areas on the card, R3-7 no-show. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import '@/i18n';
import config from './fixtures/config.json';
import me from './fixtures/me.json';
import relationship from './fixtures/relationship.json';

let mockPickDate = new Date(Date.now() + 2 * 86400000);
jest.mock('@react-native-community/datetimepicker', () => {
  const ce = require('react')['create' + 'Element'];
  const { Pressable } = require('react-native');
  return { __esModule: true, default: (p: { onChange: (e: { type: string }, d: Date) => void }) => ce(Pressable, { testID: 'dtp', onPress: () => p.onChange({ type: 'set' }, mockPickDate) }) };
});
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
const visitBase = {
  id: 'v1', relationship_id: 'rel1', requirement_id: 'req1', customer_name: 'Sujata', customer_phone: '+919800000000', is_mine: true,
  scheduled_at: '2026-11-12T05:30:00Z', status: 'SCHEDULED', visit_type: 'VIEWING', meeting_point: '', outcome: null, cancel_reason: '',
  listing: { id: 'l1', title: '3 BHK', society_name: 'ATS', tower_name: 'T1', unit_number: '101' }, key_tasks: [], allowed_outcomes: [], media: null,
  no_show: null, rescheduled_from_id: null, rescheduled_visit: null,
};
let mockVisits: unknown[] = [];
const mockGet: Record<string, (q?: Record<string, unknown>) => unknown> = {
  '/api/v1/config/app': () => config,
  '/api/v1/me': () => me,
  '/api/v1/me/visits': () => mockVisits,
  '/api/v1/geo/localities': () => [],
  '/api/v1/geo/societies': () => ({ results: [], next: null, previous: null }),
  '/api/v1/requirements/{id}/communications': () => ({ results: [], next: null, previous: null }),
};
let mockPostImpl: (path: string, body: Record<string, unknown>) => { data?: unknown; error?: unknown; status: number } = () => ({ data: {}, status: 201 });
const mockPost = jest.fn(async (path: string, opts: { body: Record<string, unknown> }) => {
  const r = mockPostImpl(path, opts?.body);
  return { data: r.data, error: r.error, response: { ok: r.status < 300, status: r.status } };
});
let mockPatchImpl: (body: Record<string, unknown>) => { data?: unknown; error?: unknown; status: number } = (b) => ({ data: b, status: 200 });
const mockPatch = jest.fn(async (_path: string, opts: { body: Record<string, unknown> }) => {
  const r = mockPatchImpl(opts.body);
  return { data: r.data, error: r.error, response: { ok: r.status < 300, status: r.status } };
});
jest.mock('@/api/instance', () => ({
  api: {
    GET: async (path: string, opts?: { params?: { query?: Record<string, unknown> } }) => {
      if (!(path in mockGet)) throw new Error(`unmocked GET ${path}`);
      return { data: mockGet[path](opts?.params?.query), response: { ok: true, status: 200 } };
    },
    POST: (path: string, opts: { body: Record<string, unknown> }) => mockPost(path, opts),
    PUT: jest.fn(),
    PATCH: (path: string, opts: { body: Record<string, unknown> }) => mockPatch(path, opts),
    DELETE: jest.fn(),
  },
  tokens: { get: jest.fn(), set: jest.fn(), clear: jest.fn() },
  onSessionExpired: jest.fn(),
}));

import { SuccessHost } from '@/components/shell/SuccessHost';
import { emptyDraft, missingRequired, validateDraft } from '@/components/leadForm/types';

const wrap = (ui: ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return (
    <QueryClientProvider client={qc}>
      {ui}
      <SuccessHost />
    </QueryClientProvider>
  );
};
const t = (k: string) => k;

beforeEach(() => {
  mockPost.mockClear();
  mockPatch.mockClear();
  mockPostImpl = () => ({ data: {}, status: 201 });
  mockPatchImpl = (b) => ({ data: b, status: 200 });
});

describe('R3-2 required fields', () => {
  it('BUY / RENT need an area (or Open), a budget and the configuration', () => {
    expect(Object.keys(missingRequired(emptyDraft('BUY'), t)).sort()).toEqual(['budgetMin', 'configuration', 'preferredLocalities']);
    expect(Object.keys(missingRequired(emptyDraft('RENT'), t)).sort()).toEqual(['configuration', 'expectedRent', 'preferredLocalities']);
    const ok = { ...emptyDraft('BUY'), areaOpen: true, budgetMax: '9000000', configuration: '3BHK' };
    expect(missingRequired(ok, t)).toEqual({});
    // A single society is never forced: a sector alone is enough.
    expect(missingRequired({ ...ok, areaOpen: false, preferredLocalities: { items: [{ id: 'l', name: 'Sector 150' }], other: '' } }, t)).toEqual({});
  });
  it('SELL / RENT OUT need type, location (sector, society or address) and the price / rent', () => {
    expect(Object.keys(missingRequired(emptyDraft('SELL'), t)).sort()).toEqual(['configuration', 'expectedPrice', 'locality']);
    expect(Object.keys(missingRequired(emptyDraft('RENT_OUT'), t, { hasProperty: true })).sort()).toEqual(['expectedRent', 'locality']);
    const sell = { ...emptyDraft('SELL'), configuration: '2BHK', expectedPrice: '8000000', location: { addressText: 'B-12, Sector 50', paste: '' } };
    expect(missingRequired(sell, t)).toEqual({});
  });
  it('a draft save only checks what was typed', () => {
    expect(validateDraft(emptyDraft('BUY'), t)).toEqual({});
    expect(validateDraft(emptyDraft('BUY'), t, { complete: true })).toHaveProperty('budgetMin');
  });
});

describe('R3-2 Add Requirement: required inline, then Save as draft', () => {
  it('shows the missing fields and offers Save as draft', async () => {
    const { AddRequirementSheet } = require('@/components/sheets/AddRequirementSheet');
    const onSubmit = jest.fn(async () => undefined);
    await render(wrap(<AddRequirementSheet visible onClose={jest.fn()} customerName="Sujata" types={[{ value: 'BUY', label: 'Buy' }]} configurations={[{ value: '3BHK', label: '3 BHK' }]} timelines={[]} onSubmit={onSubmit} />));
    await fireEvent.press(screen.getByTestId('addreq-type-BUY'));
    await fireEvent.press(screen.getByTestId('add-requirement-submit'));
    expect(screen.getByText('Enter a budget (from or up to)')).toBeTruthy();
    expect(screen.getByText('Choose the configuration')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('add-requirement-draft'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([{ type: 'BUY', save_as_draft: true }]));
  });
});

describe('R3-2 / R3-3 requirement card', () => {
  const { RequirementCard } = require('@/components/lead/RequirementCard');
  const noop = jest.fn();
  const base = relationship.requirements[0];
  const draft = {
    ...base,
    type: 'BUY',
    is_draft: true,
    missing_fields: [{ field: 'budget_min', message: 'Add a budget' }],
    preferred_localities: [{ id: 'l150', name: 'Sector 150' }, { id: 'lgn', name: 'Greater Noida' }],
    preferred_societies: [],
    configuration: '3BHK',
    properties: [],
    next_action: { type: 'COMPLETE_REQUIREMENT', title: 'Complete requirement', due_at: null, is_overdue: false, follow_up_id: null },
    routing: {
      territory: { id: 't150', name: 'Sector 150' }, territory_aa: { id: 'a', name: 'Anita Verma' }, servicing_aa: { id: 'p', name: 'Priya Sharma' }, relationship_owner: { id: 'p', name: 'Priya Sharma' },
      kind: 'AA_SELF', reason: 'Added by Priya Sharma; stays with them until transferred', assigned_at: null, servicing_differs_from_territory: true,
      areas: [
        { locality: { id: 'lgn', name: 'Greater Noida' }, society: null, territory: null, territory_aa: null },
        { locality: { id: 'l150', name: 'Sector 150' }, society: null, territory: { id: 't150', name: 'Sector 150' }, territory_aa: { id: 'a', name: 'Anita Verma' } },
      ],
    },
  };
  const card = (req: unknown) => <RequirementCard req={req as never} dnc={false} onCall={noop} onFollowUp={noop} onCompleteFollowUp={noop} onMessage={noop} onTransfer={noop} />;

  it('lists every preferred area with its territory AA', async () => {
    await render(wrap(card(draft)));
    expect(screen.getByTestId('req-routing-areas-BUY')).toBeTruthy();
    expect(screen.getAllByText('Anita Verma · Sector 150').length).toBe(2); // territory AA row + the Sector 150 area
    expect(screen.getByText('No AA for this area')).toBeTruthy();
  });

  it('Draft badge + missing fields; Complete requirement submits with save_as_draft false', async () => {
    await render(wrap(card(draft)));
    expect(screen.getByTestId('req-draft-BUY')).toBeTruthy();
    expect(screen.getByText('• Add a budget')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('req-next-BUY'));
    expect(await screen.findByTestId('complete-req-sheet')).toBeTruthy();
    // Still missing → inline error, nothing sent.
    await fireEvent.press(screen.getByTestId('complete-req-save'));
    expect(screen.getByText('Enter a budget (from or up to)')).toBeTruthy();
    expect(mockPatch).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Budget up to (₹)'), '9000000');
    mockPatchImpl = (b) => ({ data: { ...draft, ...b, is_draft: false, missing_fields: [] }, status: 200 });
    await fireEvent.press(screen.getByTestId('complete-req-save'));
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/api/v1/requirements/{id}',
        expect.objectContaining({ body: expect.objectContaining({ save_as_draft: false, budget_max: 9000000, configuration: '3BHK', preferred_locality_ids: ['l150', 'lgn'], version: base.version }) }),
      ),
    );
  });
});

describe('R3-7 no-show', () => {
  it('asks who, reason and next step; reschedule books the new visit', async () => {
    mockParams = {};
    mockVisits = [visitBase];
    mockPostImpl = () => ({ data: { ...visitBase, status: 'NO_SHOW', rescheduled_visit: { id: 'v2', scheduled_at: mockPickDate.toISOString(), status: 'SCHEDULED' } }, status: 200 });
    const Visits = require('@/app/(app)/(tabs)/visits').default;
    await render(wrap(<Visits />));
    await fireEvent.press(await screen.findByTestId('visit-noshow-btn-v1', {}, { timeout: 3000 }));
    await fireEvent.press(screen.getByTestId('no-show-save'));
    expect(screen.getByText("Choose who didn't come")).toBeTruthy();
    expect(screen.getByText('Choose what happens next')).toBeTruthy();
    expect(mockPost).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('no-show-who-CUSTOMER'));
    await fireEvent.press(screen.getByTestId('no-show-step-RESCHEDULE'));
    await fireEvent.press(screen.getByTestId('no-show-save'));
    expect(mockPost).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('no-show-at'));
    await fireEvent.press(screen.getByTestId('dtp'));
    await fireEvent.press(screen.getByTestId('no-show-save'));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/v1/visits/{id}/no-show', expect.objectContaining({ body: expect.objectContaining({ who_absent: 'CUSTOMER', next_step: 'RESCHEDULE', reschedule_at: expect.any(String), follow_up: null }) })),
    );
  });

  it('a no-show stays visible with its badge, reason and the new visit; Past is a tab', async () => {
    mockParams = { bucket: 'past' };
    mockVisits = [
      {
        ...visitBase,
        status: 'NO_SHOW',
        no_show: { who_absent: 'CUSTOMER', who_absent_label: 'Customer', reason: 'CHANGED_PLANS', reason_label: 'Changed plans', note: 'Will call back', next_step: 'RESCHEDULE', next_step_label: 'Reschedule', marked_at: null, follow_up_id: null },
        rescheduled_visit: { id: 'v2', scheduled_at: '2026-11-14T05:30:00Z', status: 'SCHEDULED' },
      },
    ];
    const Visits = require('@/app/(app)/(tabs)/visits').default;
    await render(wrap(<Visits />));
    expect(await screen.findByTestId('visit-noshow-v1', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText("Customer didn't come · Changed plans · Next: Reschedule")).toBeTruthy();
    expect(screen.getByText('Will call back')).toBeTruthy();
    expect(screen.getByTestId('visit-rescheduled-v1')).toBeTruthy();
    expect(screen.getByTestId('visits-bucket-past')).toBeTruthy();
    expect(screen.queryByTestId('visit-noshow-btn-v1')).toBeNull();
  });
});

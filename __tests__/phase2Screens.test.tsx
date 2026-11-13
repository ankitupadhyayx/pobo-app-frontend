/** Phase 2 part 2 screens (listings, keys, matches, visits, Home territory) with live payloads. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import '@/i18n';
import config from './fixtures/config.json';
import me from './fixtures/me.json';
import homeP2 from './fixtures/home_p2.json';
import listing from './fixtures/listing.json';
import listings from './fixtures/listings.json';
import keys from './fixtures/keys.json';
import matches from './fixtures/matches.json';
import shortlist from './fixtures/shortlist.json';
import visitsCompleted from './fixtures/visits_completed.json';
import unit from './fixtures/unit.json';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

// A scheduled visit today, derived from a live completed visit.
const scheduled = { ...visitsCompleted[0], id: '11111111-1111-4111-8111-111111111111', status: 'SCHEDULED', outcome: null, feedback: null, completed_at: null, scheduled_at: new Date(Date.now() + 3600_000).toISOString() };
const visitsHome = {
  ...homeP2,
  sections: [
    {
      key: 'visits',
      total: 4,
      view_all: { screen: 'visits', focus: 'today', count: 4 },
      items: [
        { ...homeP2.sections[0].items[0], id: `VISIT_TODAY:${scheduled.id}`, kind: 'VISIT_TODAY', next_action: 'OPEN_VISIT', sla_state: null, breach_at: null, target: { ...homeP2.sections[0].items[0].target, follow_up_id: null, visit_id: scheduled.id } },
      ],
    },
    ...homeP2.sections,
  ],
};

let mockHome: unknown = homeP2;
const mockGet: Record<string, (q?: Record<string, string>) => unknown> = {
  '/api/v1/config/app': () => config,
  '/api/v1/me': () => me,
  '/api/v1/me/home': () => mockHome,
  '/api/v1/listings': () => listings,
  '/api/v1/listings/{id}': () => listing,
  '/api/v1/me/keys': () => keys,
  '/api/v1/requirements/{id}/matches': () => matches,
  '/api/v1/requirements/{id}/shortlist': () => shortlist,
  '/api/v1/me/visits': (q) => (q?.bucket === 'past' ? visitsCompleted : q?.bucket === 'today' ? [scheduled] : []),
  '/api/v1/units/{id}': () => unit,
  '/api/v1/units/{id}/surveys': () => [],
};
const mockPost = jest.fn(async (path: string, _opts?: unknown) => ({ data: path.endsWith('/shortlist') ? { id: 'sl-1' } : {}, response: { ok: true, status: 200 } }));
jest.mock('@/api/instance', () => ({
  api: {
    GET: async (path: string, opts?: { params?: { query?: Record<string, string> } }) => {
      if (!(path in mockGet)) throw new Error(`unmocked GET ${path}`);
      return { data: mockGet[path](opts?.params?.query), response: { ok: true, status: 200 } };
    },
    POST: (path: string, opts: unknown) => mockPost(path, opts),
    PUT: jest.fn(),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
  tokens: { get: jest.fn(), set: jest.fn(), clear: jest.fn() },
  onSessionExpired: jest.fn(),
}));

let qc: QueryClient;
afterEach(() => {
  qc?.clear();
  onlineManager.setOnline(true);
});
const wrap = (ui: ReactNode) => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};
const queued = async () => {
  const { outbox } = require('@/offline');
  return (await outbox.list()) as { type: string; payload: Record<string, unknown> }[];
};

beforeEach(async () => {
  mockPush.mockClear();
  mockNavigate.mockClear();
  mockPost.mockClear();
  await require('@/offline').outbox.clearAll();
});

describe('Home Phase 2 sections', () => {
  it('territory shows a listing change request that opens the listing; View all goes to field tasks', async () => {
    mockHome = homeP2;
    const Home = require('@/app/(app)/(tabs)/index').default;
    await render(wrap(<Home />));
    await waitFor(() => expect(screen.getByTestId('home-section-territory')).toBeTruthy());
    expect(screen.getByText('Listing changes requested')).toBeTruthy();
    await fireEvent.press(screen.getByText('Open listing'));
    const item = homeP2.sections.find((s) => s.key === 'territory')!.items.find((i) => i.kind === 'LISTING_CORRECTION')!;
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/listing/[id]', params: { id: (item.target as { listing_id: string }).listing_id } });
    await fireEvent.press(screen.getByTestId('home-view-all-territory'));
    expect(mockPush).toHaveBeenCalledWith('/more/field-tasks');
  });

  it('visits section links View all to the Visits tab with the bucket', async () => {
    mockHome = visitsHome;
    const Home = require('@/app/(app)/(tabs)/index').default;
    await render(wrap(<Home />));
    await waitFor(() => expect(screen.getByTestId('home-section-visits')).toBeTruthy());
    expect(screen.getByText('Site visit today')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('home-view-all-visits'));
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/visits', params: { bucket: 'today' } });
  });
});

describe('Visits tab', () => {
  it('opens on the bucket from the link (old ?bucket=completed → Past, R3-7) and shows the outcome', async () => {
    mockParams = { bucket: 'completed' };
    const Visits = require('@/app/(app)/(tabs)/visits').default;
    await render(wrap(<Visits />));
    await waitFor(() => expect(screen.getByTestId(`visit-${visitsCompleted[0].id}`)).toBeTruthy());
    expect(screen.getByText(/Negotiate/)).toBeTruthy();
  });

  it('completing needs an outcome and feedback, then posts the outcome', async () => {
    mockParams = {};
    const Visits = require('@/app/(app)/(tabs)/visits').default;
    await render(wrap(<Visits />));
    await screen.findByTestId(`visit-complete-${scheduled.id}`, {}, { timeout: 3000 });
    await fireEvent.press(screen.getByTestId(`visit-complete-${scheduled.id}`));
    await fireEvent.press(screen.getByTestId('complete-visit-save'));
    expect(screen.getByText('Add a line of feedback')).toBeTruthy();
    expect(mockPost).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('visit-outcome-NOT_INTERESTED'));
    await fireEvent.changeText(screen.getByTestId('visit-feedback'), 'Too far from metro');
    await fireEvent.press(screen.getByTestId('complete-visit-save'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/visits/{id}/complete', expect.objectContaining({ body: expect.objectContaining({ outcome: 'NOT_INTERESTED', feedback: expect.objectContaining({ notes: 'Too far from metro' }), next_action: null }) })));
  });
});

describe('Matches', () => {
  it('shows score and reasons, and shortlists a match', async () => {
    mockParams = { rid: matches[0].listing.id, title: 'Buyer' };
    const Matches = require('@/app/(app)/lead/matches/[rid]').default;
    await render(wrap(<Matches />));
    await waitFor(() => expect(screen.getByTestId(`match-${matches[0].listing.id}`)).toBeTruthy());
    expect(screen.getByText(String(matches[0].score))).toBeTruthy();
    expect(screen.getByText(matches[0].reasons[0])).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`shortlist-${matches[0].listing.id}`));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/requirements/{id}/shortlist', expect.objectContaining({ body: { listing_id: matches[0].listing.id, status: 'SHORTLISTED' } })));
  });
});

describe('Listings', () => {
  it('My listings puts change requests first', async () => {
    const Mine = require('@/app/(app)/more/listings').default;
    await render(wrap(<Mine />));
    await waitFor(() => expect(screen.getAllByTestId(/^listing-/).length).toBe(listings.results.length));
    expect(screen.getAllByTestId(/^listing-/)[0].props.testID).toBe(`listing-${listing.id}`);
  });

  it('a draft edit offline goes to the outbox and submit is disabled', async () => {
    mockParams = { id: listing.id };
    const Listing = require('@/app/(app)/listing/[id]').default;
    await render(wrap(<Listing />));
    await waitFor(() => expect(screen.getByText(/Add kitchen and balcony photos/)).toBeTruthy());
    await act(async () => onlineManager.setOnline(false));
    expect(screen.getByTestId('listing-submit').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('listing-save'));
    await waitFor(async () => expect((await queued()).map((i) => i.type)).toContain('listing_draft.update'));
  });

  it('the unit screen creates a listing draft offline', async () => {
    mockParams = { id: unit.id };
    const Unit = require('@/app/(app)/field/unit/[id]').default;
    await render(wrap(<Unit />));
    await waitFor(() => expect(screen.getByTestId('unit-create-listing')).toBeTruthy());
    await act(async () => onlineManager.setOnline(false));
    await fireEvent.press(screen.getByTestId('unit-create-listing'));
    await fireEvent.press(screen.getByTestId('listing-type-RENT_OUT'));
    await fireEvent.press(screen.getByTestId('create-listing-save'));
    await waitFor(async () => {
      const item = (await queued()).find((i) => i.type === 'listing_draft.create');
      expect(item?.payload).toMatchObject({ type: 'RENT_OUT' });
    });
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe('Keys', () => {
  it('the unit screen records keys taken (validated, queued as key.taken)', async () => {
    mockParams = { id: unit.id };
    const Unit = require('@/app/(app)/field/unit/[id]').default;
    await render(wrap(<Unit />));
    await waitFor(() => expect(screen.getByTestId('unit-take-key')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('unit-take-key'));
    await fireEvent.press(screen.getByTestId('take-key-save'));
    expect(screen.getByText('Required')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('key-from-OWNER'));
    await fireEvent.changeText(screen.getByTestId('key-count'), '2');
    await fireEvent.press(screen.getByTestId('take-key-save'));
    await waitFor(async () => expect((await queued()).find((i) => i.type === 'key.taken')?.payload).toMatchObject({ unit_id: unit.id, taken_from: 'OWNER', key_count: 2 }));
  });

  it('Keys screen lists held keys and queues a return', async () => {
    const Keys = require('@/app/(app)/more/keys').default;
    await render(wrap(<Keys />));
    await waitFor(() => expect(screen.getByTestId(`key-${keys[0].id}`)).toBeTruthy());
    await fireEvent.press(screen.getByTestId(`key-return-${keys[0].id}`));
    await fireEvent.press(screen.getByTestId('key-return-save'));
    await waitFor(async () => expect((await queued()).find((i) => i.type === 'key.returned')?.payload).toMatchObject({ returned_to: keys[0].taken_from }));
  });
});

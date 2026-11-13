/** Revision 1 (founder QA): shared success feedback, FB-06 visits, FB-10 12-hour time + callbacks, FB-12, FB-14. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import '@/i18n';
import config from './fixtures/config.json';
import me from './fixtures/me.json';
import listing from './fixtures/listing.json';
import matches from './fixtures/matches.json';
import shortlist from './fixtures/shortlist.json';
import visitsCompleted from './fixtures/visits_completed.json';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

// The native picker is replaced by a button that "picks" mockPickDate.
let mockPickDate = new Date();
jest.mock('@react-native-community/datetimepicker', () => {
  // Indirect lookup so NativeWind's babel transform leaves createElement alone inside the factory.
  const ce = require('react')['create' + 'Element'];
  const { Pressable } = require('react-native');
  return {
    __esModule: true,
    default: (p: { onChange: (e: { type: string }, d: Date) => void }) => ce(Pressable, { testID: 'dtp', onPress: () => p.onChange({ type: 'set' }, mockPickDate) }),
  };
});

const tomorrowAt = (h: number, m: number) => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(h, m, 0, 0);
  return d;
};
const scheduled = { ...visitsCompleted[0], id: '11111111-1111-4111-8111-111111111111', status: 'SCHEDULED', outcome: null, feedback: null, completed_at: null, scheduled_at: new Date(Date.now() + 3600_000).toISOString() };

let mockListing: unknown = listing;
const mockGet: Record<string, (q?: Record<string, string>) => unknown> = {
  '/api/v1/config/app': () => config,
  '/api/v1/me': () => me,
  '/api/v1/listings/{id}': () => mockListing,
  '/api/v1/requirements/{id}/matches': () => matches,
  '/api/v1/requirements/{id}/shortlist': () => shortlist,
  '/api/v1/me/visits': (q) => (q?.bucket === 'today' ? [scheduled] : []),
};
const mockPost = jest.fn(async (path: string, opts?: { body?: Record<string, unknown> }) => {
  let data: unknown = {};
  if (path === '/api/v1/requirements/{id}/visits' || path === '/api/v1/visits/{id}/reschedule') data = { ...scheduled, scheduled_at: opts?.body?.scheduled_at };
  if (path === '/api/v1/visits/{id}/cancel') data = { visit: { ...scheduled, status: 'CANCELLED' }, replacement: null };
  if (path === '/api/v1/listings/{id}/withdraw') data = { ...listing, status: 'WITHDRAWN', allowed_actions: [] };
  return { data, response: { ok: true, status: 200 } };
});
jest.mock('@/api/instance', () => ({
  api: {
    GET: async (path: string, opts?: { params?: { query?: Record<string, string> } }) => {
      if (!(path in mockGet)) throw new Error(`unmocked GET ${path}`);
      return { data: mockGet[path](opts?.params?.query), response: { ok: true, status: 200 } };
    },
    POST: (path: string, opts: { body?: Record<string, unknown> }) => mockPost(path, opts),
    PUT: jest.fn(),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
  tokens: { get: jest.fn(), set: jest.fn(), clear: jest.fn() },
  onSessionExpired: jest.fn(),
}));

import { SuccessHost } from '@/components/shell/SuccessHost';
import { useActions } from '@/state/actions';
import { callbackError, callbackSlots, isAfterHours } from '@/components/ui/CallbackPicker';
import { FollowUpSheet } from '@/components/sheets/FollowUpSheet';
import { GenerateSheet } from '@/components/survey/GenerateSheet';
import { formatTime, formatWhen } from '@/lib/time';

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
afterEach(() => {
  qc?.clear();
  useActions.setState({ toast: null, success: null });
});
beforeEach(() => {
  mockPush.mockClear();
  mockNavigate.mockClear();
  mockPost.mockClear();
  mockListing = listing;
});

describe('FB-10 12-hour time', () => {
  it('formats AM/PM by hand, never 24-hour', () => {
    expect(formatTime(new Date(2026, 9, 26, 0, 5))).toBe('12:05 AM');
    expect(formatTime(new Date(2026, 9, 26, 12, 0))).toBe('12:00 PM');
    expect(formatTime(new Date(2026, 9, 26, 18, 30))).toBe('6:30 PM');
    expect(formatWhen(new Date(2026, 9, 12, 15, 15).toISOString(), new Date(2026, 9, 26).getTime())).toBe('12 Oct 3:15 PM');
  });

  it('callback slots stop at 6:00 PM; later needs the explicit exception with a reason', () => {
    const day = new Date(2026, 9, 27);
    const now = new Date(2026, 9, 27, 17, 10).getTime();
    expect(callbackSlots(day, { start: '09:00', end: '18:00' }, now).map(formatTime)).toEqual(['5:30 PM', '6:00 PM']);
    expect(callbackSlots(day, { start: '09:00', end: '18:00' }, 0)).toHaveLength(19);
    const late = new Date(2026, 9, 27, 19, 0);
    expect(isAfterHours(late)).toBe(true);
    expect(callbackError({ at: late, afterHours: false, reason: '' }, true, undefined, now)).toBe('callback.afterSix');
    expect(callbackError({ at: late, afterHours: true, reason: '' }, true, undefined, now)).toBe('callback.reasonRequired');
    expect(callbackError({ at: late, afterHours: true, reason: 'At work till 7' }, true, undefined, now)).toBeNull();
    expect(callbackError({ at: null, afterHours: false, reason: '' }, true, undefined, now)).toBe('errors.required');
  });

  it('follow-up sheet offers no time after 6 PM and sends the later-time exception', async () => {
    const onSubmit = jest.fn(async () => {});
    await render(<FollowUpSheet visible onClose={jest.fn()} customerName="Rajesh" requirements={[{ value: 'r1', label: 'Buy' }]} types={[{ value: 'CALL', label: 'Call' }]} onSubmit={onSubmit} />);
    await fireEvent.press(screen.getByText('Tomorrow'));
    expect(screen.getByText('6:00 PM')).toBeTruthy();
    expect(screen.queryByText('6:30 PM')).toBeNull();
    expect(screen.queryByText(/^18:/)).toBeNull();
    await fireEvent.press(screen.getByTestId('followup-due-after-hours'));
    mockPickDate = tomorrowAt(20, 0);
    await fireEvent.press(screen.getByTestId('followup-due-late'));
    await fireEvent.press(screen.getByTestId('dtp'));
    await fireEvent.press(screen.getByTestId('followup-save'));
    expect(screen.getByText('Write why the customer wants a later time')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('followup-due-reason'), 'At work till 7');
    await fireEvent.press(screen.getByTestId('followup-save'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dueAt: mockPickDate.toISOString(), afterHours: { reason: 'At work till 7' } })));
  });
});

describe('shared success feedback', () => {
  it('a title alone is a toast; details make a success sheet whose actions close it', async () => {
    await render(wrap(null));
    await act(async () => useActions.getState().showSuccess({ title: 'Call saved' }));
    expect(screen.getByTestId('toast')).toBeTruthy();
    const view = jest.fn();
    await act(async () => useActions.getState().showSuccess({ title: 'Done it', lines: [{ label: 'When', value: 'Today 4:30 PM' }], actions: [{ label: 'View', testID: 'v', onPress: view }] }));
    expect(screen.getByTestId('success-sheet')).toBeTruthy();
    expect(screen.getByText('Today 4:30 PM')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('v'));
    expect(view).toHaveBeenCalled();
    expect(screen.queryByTestId('success-sheet')).toBeNull();
  });
});

describe('FB-06 visit feedback', () => {
  it('scheduling closes the sheet and shows Visit Scheduled with 12-hour time, property, customer and View visit', async () => {
    mockParams = { rid: matches[0].listing.id, title: 'Buyer' };
    const Matches = require('@/app/(app)/lead/matches/[rid]').default;
    await render(wrap(<Matches />));
    await waitFor(() => expect(screen.getByTestId(`visit-${matches[0].listing.id}`)).toBeTruthy());
    await fireEvent.press(screen.getByTestId(`visit-${matches[0].listing.id}`));
    mockPickDate = tomorrowAt(16, 30);
    await fireEvent.press(screen.getByTestId('visit-at'));
    await fireEvent.press(screen.getByTestId('dtp'));
    await fireEvent.press(screen.getByTestId('schedule-visit-save'));
    await waitFor(() => expect(screen.getByTestId('success-sheet')).toBeTruthy());
    expect(screen.queryByTestId('schedule-visit-sheet')).toBeNull();
    expect(screen.getByText('Visit Scheduled')).toBeTruthy();
    expect(screen.getByText('4:30 PM')).toBeTruthy();
    expect(screen.getByText(scheduled.customer_name)).toBeTruthy();
    expect(screen.getByText(/Paras Tierea · Tower 1-102/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('success-view-visit'));
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/visits', params: { bucket: 'upcoming', visit: scheduled.id } });
  });

  it('reschedule and cancel show their own success sheets', async () => {
    mockParams = {};
    const Visits = require('@/app/(app)/(tabs)/visits').default;
    await render(wrap(<Visits />));
    await screen.findByTestId(`visit-${scheduled.id}`, {}, { timeout: 3000 });
    await fireEvent.press(screen.getByText('Reschedule'));
    mockPickDate = tomorrowAt(11, 0);
    await fireEvent.press(screen.getByTestId('reschedule-at'));
    await fireEvent.press(screen.getByTestId('dtp'));
    await fireEvent.press(screen.getByTestId('reschedule-save'));
    await waitFor(() => expect(screen.getByText('Visit Rescheduled')).toBeTruthy());
    expect(screen.getByText('11:00 AM')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('success-done'));

    await fireEvent.press(screen.getByTestId(`visit-cancel-${scheduled.id}`));
    await fireEvent.press(screen.getByTestId('cancel-reason'));
    await fireEvent.press(screen.getByText('Customer unavailable'));
    await fireEvent.press(screen.getByTestId('cancel-visit-save'));
    await waitFor(() => expect(screen.getByText('Visit Cancelled')).toBeTruthy());
    expect(mockPost).toHaveBeenCalledWith('/api/v1/visits/{id}/cancel', expect.anything());
  });
});

describe('FB-14 withdraw', () => {
  it('withdrawing closes the sheet and shows Property Withdrawn', async () => {
    mockParams = { id: listing.id };
    const Listing = require('@/app/(app)/listing/[id]').default;
    await render(wrap(<Listing />));
    await fireEvent.press(await screen.findByTestId('listing-withdraw'));
    await fireEvent.changeText(screen.getByTestId('withdraw-reason'), 'Owner sold it');
    await fireEvent.press(screen.getByTestId('withdraw-save'));
    await waitFor(() => expect(screen.getByText('Property Withdrawn')).toBeTruthy());
    expect(screen.queryByTestId('withdraw-reason')).toBeNull();
    expect(mockPost).toHaveBeenCalledWith('/api/v1/listings/{id}/withdraw', expect.objectContaining({ body: { reason: 'Owner sold it' } }));
  });

  it('a withdrawn property shows the Withdrawn banner and no edit form', async () => {
    mockListing = { ...listing, status: 'WITHDRAWN', allowed_actions: [], withdrawn_reason: 'Owner sold it' };
    mockParams = { id: listing.id };
    const Listing = require('@/app/(app)/listing/[id]').default;
    await render(wrap(<Listing />));
    await screen.findByTestId('listing-withdrawn');
    expect(screen.getByText('Owner sold it')).toBeTruthy();
    expect(screen.queryByTestId('listing-save')).toBeNull();
    expect(screen.queryByTestId('listing-withdraw')).toBeNull();
  });
});

describe('FB-12 floor plan boxes', () => {
  it('uses plain names with helper text and each tick adds its floor row', async () => {
    await render(wrap(<GenerateSheet towerId="t1" towerName="Tower 1" defaults={{ topFloor: 2, perFloor: 2 }} configurations={[]} onClose={jest.fn()} onDone={jest.fn()} />));
    expect(screen.getByText('Floors below floor 1')).toBeTruthy();
    expect(screen.getByText('Lower ground (LG) has flats')).toBeTruthy();
    expect(screen.getByText(/only parking or lobby/)).toBeTruthy();
    expect(screen.getByText('Preview: 2 floors · 4 flats')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('gen-lg'));
    expect(screen.getByText('Preview: 3 floors · 6 flats')).toBeTruthy();
  });
});

describe('FB-15 owner intent', () => {
  it('shows only property intents for this flat, with the Add Lead hint for buy/rent', async () => {
    const { SurveyFormBody } = require('@/components/survey/SurveyFormBody');
    const { emptySurvey } = require('@/components/survey/forms');
    const o = (codes: string[]) => codes.map((c) => ({ value: c, label: c }));
    const onAddLead = jest.fn();
    await render(
      <SurveyFormBody
        value={emptySurvey()}
        onChange={jest.fn()}
        errors={{}}
        onAddLead={onAddLead}
        options={{ occupancy: [], doorstepOutcomes: [], dataSources: [], verification: [], timelines: [], configurations: [], intents: o(['SELL', 'RENT_OUT', 'BUY', 'RENT', 'NO_INTENT', 'UNSURE', 'DECLINED']) }}
      />,
    );
    for (const c of ['SELL', 'RENT_OUT', 'NO_INTENT', 'UNSURE', 'DECLINED']) expect(screen.getByTestId(`owner-intent-${c}`)).toBeTruthy();
    expect(screen.queryByTestId('owner-intent-BUY')).toBeNull();
    expect(screen.queryByTestId('owner-intent-RENT')).toBeNull();
    expect(screen.getByText('Wants to buy or rent another home? Add a lead for them.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('survey-add-lead'));
    expect(onAddLead).toHaveBeenCalled();
  });
});

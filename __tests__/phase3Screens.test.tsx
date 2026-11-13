/** Phase 3 screens: profile (from /me), earnings, My Week, Learn & Help. */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import '@/i18n';
import config from './fixtures/config.json';
import me from './fixtures/me.json';
import earnings from './fixtures/earnings.json';
import earningItem from './fixtures/earning_item.json';
import week from './fixtures/week.json';
import articles from './fixtures/help_articles.json';
import article from './fixtures/help_article.json';
import tickets from './fixtures/tickets.json';
import ticket from './fixtures/ticket.json';
import relationship from './fixtures/relationship.json';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

let mockMe: unknown = me;
let mockEarnings: unknown = earnings;
let mockTicket: unknown = ticket;
let mockParams: Record<string, string> = {};
const weekCalls: (Record<string, string> | undefined)[] = [];
const mockGet: Record<string, (q?: Record<string, string>) => unknown> = {
  '/api/v1/config/app': () => config,
  '/api/v1/me': () => mockMe,
  '/api/v1/me/earnings': () => mockEarnings,
  '/api/v1/me/earnings/{item_id}': () => earningItem,
  '/api/v1/me/week': (q) => {
    weekCalls.push(q);
    return week;
  },
  '/api/v1/help/articles': () => articles,
  '/api/v1/help/articles/{id}': () => article,
  '/api/v1/me/support-tickets': () => tickets,
  '/api/v1/me/support-tickets/{id}': () => mockTicket,
};
const mockPost = jest.fn(async (_path: string, _opts?: unknown) => ({ data: ticket, response: { ok: true, status: 201 } }));
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
  // Mutations write to the app's global client (setQueryData starts a gc timer); clear it so Jest can exit.
  require('@/api/queryClient').queryClient.clear();
});
beforeEach(() => {
  mockPush.mockClear();
  mockPost.mockClear();
  mockParams = {};
  weekCalls.length = 0;
});
const wrap = (ui: ReactNode) => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe('Profile', () => {
  it('shows KYC, agreement, deposit and training from /me', async () => {
    mockMe = me;
    const Profile = require('@/app/(app)/more/profile').default;
    await render(wrap(<Profile />));
    await waitFor(() => expect(screen.getByText('Priya Sharma')).toBeTruthy());
    expect(screen.getByText('92% of training modules done')).toBeTruthy();
    expect(screen.getByText('In progress')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('Signed')).toBeTruthy();
    expect(screen.getByText('Received')).toBeTruthy();
  });

  it('explains pending steps in plain words', async () => {
    mockMe = { ...me, aa_profile: { ...me.aa_profile, kyc_status: 'SUBMITTED', agreement_status: 'SENT', deposit_status: 'PENDING', training_progress: 0 } };
    const Profile = require('@/app/(app)/more/profile').default;
    await render(wrap(<Profile />));
    await waitFor(() => expect(screen.getByText('Documents received. Ops is checking them.')).toBeTruthy());
    expect(screen.getByText('Your agreement has been sent. Read and sign it.')).toBeTruthy();
    expect(screen.getByText('Not started')).toBeTruthy();
  });
});

type E = typeof earnings;
const noRules = (e: E): unknown => ({
  ...e,
  rule_set: null,
  interim: false,
  amounts_available: false,
  summary: e.summary.map((x) => ({ ...x, amount: null, interim: false })),
  items: e.items.map((i) => ({ ...i, amount: null, interim: false })),
});

describe('Earnings (APP-31)', () => {
  it('labels interim amounts, explains each gate and lists payouts with UTR', async () => {
    mockEarnings = earnings;
    const Earnings = require('@/app/(app)/(tabs)/earnings').default;
    await render(wrap(<Earnings />));
    await waitFor(() => expect(screen.getByTestId('earnings-summary-PAID')).toBeTruthy());
    expect(screen.getByTestId('earnings-interim')).toBeTruthy();
    for (const i of earnings.items) expect(screen.getByTestId(`earning-gate-${i.id}`).props.children).toBe(i.gate.message);
    const paid = earnings.payouts.find((p) => p.status === 'PAID')!;
    expect(screen.getByText(`UTR ${paid.utrs.join(', ')}`)).toBeTruthy();
    // Interim tag next to every amount
    expect(screen.getAllByText('Estimate · not final policy').length).toBeGreaterThan(earnings.items.length);
  });

  it('filters by state and opens an item', async () => {
    mockEarnings = earnings;
    const Earnings = require('@/app/(app)/(tabs)/earnings').default;
    await render(wrap(<Earnings />));
    await waitFor(() => expect(screen.getByTestId('earnings-summary-PAID')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('earnings-filter-AWAITING_FEE'));
    const awaiting = earnings.items.filter((i) => i.state === 'AWAITING_FEE');
    const other = earnings.items.find((i) => i.state === 'PAID')!;
    expect(screen.getByTestId(`earning-${awaiting[0].id}`)).toBeTruthy();
    expect(screen.queryByTestId(`earning-${other.id}`)).toBeNull();
    await fireEvent.press(screen.getByTestId(`earning-${awaiting[0].id}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/earnings/[id]', params: { id: awaiting[0].id } });
  });

  it('hides amounts and shows only gated states without a rule set', async () => {
    mockEarnings = noRules(earnings);
    const Earnings = require('@/app/(app)/(tabs)/earnings').default;
    await render(wrap(<Earnings />));
    await waitFor(() => expect(screen.getByTestId('earnings-no-rules')).toBeTruthy());
    expect(screen.queryByTestId('earnings-interim')).toBeNull();
    expect(screen.queryByText('Estimate · not final policy')).toBeNull();
    for (const i of earnings.items) expect(screen.queryByTestId(`earning-amount-${i.id}`)).toBeNull();
    const potential = earnings.summary.find((x) => x.state === 'POTENTIAL')!;
    expect(within(screen.getByTestId('earnings-summary-POTENTIAL')).getByText(String(potential.count))).toBeTruthy();
  });

  it('item detail shows the step timeline, deal and payout UTR', async () => {
    mockParams = { id: earningItem.id };
    const Detail = require('@/app/(app)/earnings/[id]').default;
    await render(wrap(<Detail />));
    await waitFor(() => expect(screen.getByTestId('earning-steps')).toBeTruthy());
    expect(screen.getByText('Fee reconciled by Finance')).toBeTruthy();
    expect(screen.getByTestId('earning-deal')).toBeTruthy();
    expect(screen.getAllByText(earningItem.payout!.utr!).length).toBeGreaterThan(0);
  });
});

describe('My Week (APP-32)', () => {
  it('headline is first-contact SLA, with streak and wins; calling comes last', async () => {
    const MyWeek = require('@/app/(app)/more/my-week').default;
    await render(wrap(<MyWeek />));
    await waitFor(() => expect(screen.getByTestId('week-headline')).toBeTruthy());
    expect(week.headline.key).toBe('first_contact_sla_pct');
    expect(within(screen.getByTestId('week-headline')).getByText(week.headline.label)).toBeTruthy();
    expect(screen.getByTestId('week-streak')).toBeTruthy();
    for (const w of week.todays_wins) expect(screen.getByText(`✓ ${w.text}`)).toBeTruthy();
    const order = screen.getAllByTestId(/^week-group-/).map((n) => n.props.testID);
    expect(order[order.length - 1]).toBe('week-group-calling');
  });

  it('steps back a week', async () => {
    const MyWeek = require('@/app/(app)/more/my-week').default;
    await render(wrap(<MyWeek />));
    await waitFor(() => expect(screen.getByTestId('week-prev')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('week-prev'));
    await waitFor(() => expect(weekCalls.some((q) => q?.week_start)).toBe(true));
    const prev = weekCalls.find((q) => q?.week_start)!.week_start;
    expect(new Date(`${prev}T00:00:00Z`).getTime()).toBe(new Date(`${week.week_start}T00:00:00Z`).getTime() - 7 * 86400000);
  });
});

describe('Learn & Help (APP-33)', () => {
  it('lists guides and opens one', async () => {
    const Learn = require('@/app/(app)/more/learn').default;
    await render(wrap(<Learn />));
    await waitFor(() => expect(screen.getByTestId(`article-${articles[0].slug}`)).toBeTruthy());
    await fireEvent.press(screen.getByTestId(`article-${articles[0].slug}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/more/article/[id]', params: { id: articles[0].id } });
  });

  it('article screen renders the body', async () => {
    mockParams = { id: article.id };
    const Article = require('@/app/(app)/more/article/[id]').default;
    await render(wrap(<Article />));
    await waitFor(() => expect(screen.getByTestId('article-title').props.children).toBe(article.title));
  });

  it('raises a ticket with category, message and the linked requirement', async () => {
    mockParams = { tab: 'tickets', category: 'EARNINGS', requirement_id: earningItem.requirement_id };
    const Learn = require('@/app/(app)/more/learn').default;
    await render(wrap(<Learn />));
    await waitFor(() => expect(screen.getByTestId(`ticket-${tickets[0].reference}`)).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('ticket-message')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('ticket-message'), 'Payout not received');
    await fireEvent.press(screen.getByTestId('ticket-submit'));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const [path, opts] = mockPost.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(path).toBe('/api/v1/support-tickets');
    expect(opts.body).toMatchObject({ category: 'EARNINGS', message: 'Payout not received', requirement_id: earningItem.requirement_id });
    expect(typeof opts.body.client_id).toBe('string');
  });

  it('requires a category and message before sending', async () => {
    mockParams = { tab: 'tickets' };
    const Learn = require('@/app/(app)/more/learn').default;
    await render(wrap(<Learn />));
    await waitFor(() => expect(screen.getByTestId('ticket-raise')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('ticket-raise'));
    await fireEvent.press(screen.getByTestId('ticket-submit'));
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('ticket screen shows staff replies and sends my reply', async () => {
    mockTicket = { ...ticket, reply_count: 1, replies: [{ id: 'r1', body: 'Payouts run on the 5th.', from_staff: true, author_name: 'Ops', created_at: ticket.created_at }] };
    mockParams = { id: ticket.id };
    const Ticket = require('@/app/(app)/more/ticket/[id]').default;
    await render(wrap(<Ticket />));
    await waitFor(() => expect(screen.getByText('Payouts run on the 5th.')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('reply-body'), 'Thanks');
    await fireEvent.press(screen.getByTestId('reply-send'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/v1/support-tickets/{id}/replies', { params: { path: { id: ticket.id } }, body: { body: 'Thanks' } }));
  });
});

describe('Requirement deal status (read-only)', () => {
  it('shows the negotiation stage on the requirement card', async () => {
    const { RequirementCard } = require('@/components/lead/RequirementCard');
    const req = { ...relationship.requirements[0], deal: { stage: 'NEGOTIATION', label: 'In negotiation', label_hi: 'बातचीत जारी', negotiation_id: 'n1', negotiation_status: 'OPEN', transaction_id: null, transaction_status: null, fee_status: null, updated_at: '2026-10-24T14:08:07Z' } };
    const noop = () => {};
    await render(wrap(<RequirementCard req={req} dnc={false} onCall={noop} onFollowUp={noop} onCompleteFollowUp={noop} onMessage={noop} onTransfer={noop} />));
    await waitFor(() => expect(screen.getByTestId('req-deal-NEGOTIATION')).toBeTruthy());
    expect(screen.getByText('Deal: In negotiation')).toBeTruthy();
  });
});

describe('i18n', () => {
  it('hi.json has every key in en.json', () => {
    const flat = (o: object, p = '', r: Record<string, unknown> = {}) => {
      for (const [k, v] of Object.entries(o)) {
        const key = p ? `${p}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, r);
        else r[key] = v;
      }
      return r;
    };
    const en = flat(require('@/i18n/en.json'));
    const hi = flat(require('@/i18n/hi.json'));
    expect(Object.keys(en).filter((k) => !(k in hi))).toEqual([]);
  });
});

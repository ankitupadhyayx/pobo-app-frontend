/**
 * Screen smoke tests: render the real screens with payloads captured from the live backend
 * (__tests__/fixtures, refreshed via curl) to catch runtime errors we can't see without a device.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import '@/i18n';
import home from './fixtures/home.json';
import me from './fixtures/me.json';
import config from './fixtures/config.json';
import relationships from './fixtures/relationships.json';
import relationship from './fixtures/relationship.json';
import timeline from './fixtures/timeline.json';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, back: jest.fn(), replace: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({ id: (require('./fixtures/relationship.json') as { id: string }).id }),
}));

const mockRoutes: Record<string, unknown> = {
  '/api/v1/me': me,
  '/api/v1/me/home': home,
  '/api/v1/config/app': config,
  '/api/v1/relationships': relationships,
  '/api/v1/relationships/{id}': relationship,
  '/api/v1/relationships/{id}/timeline': timeline,
  '/api/v1/me/follow-ups': { next: null, previous: null, results: [] },
  '/api/v1/templates': [],
};
const mockGet = jest.fn(async (path: string) => {
  if (!(path in mockRoutes)) throw new Error(`unmocked GET ${path}`);
  return { data: mockRoutes[path], response: { ok: true, status: 200 } };
});
jest.mock('@/api/instance', () => ({
  api: { GET: (...a: unknown[]) => mockGet(...(a as [string])), POST: jest.fn(), PATCH: jest.fn(), DELETE: jest.fn() },
  tokens: { get: jest.fn(), set: jest.fn(), clear: jest.fn() },
  onSessionExpired: jest.fn(),
}));

let qc: QueryClient;
afterEach(() => qc?.clear());

function wrap(ui: ReactNode) {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, refetchInterval: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe('screens render live payloads', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockNavigate.mockClear();
  });

  it('Home shows glossary counters, capped sections with View all, and four quick actions', async () => {
    const Home = require('@/app/(app)/(tabs)/index').default;
    await render(wrap(<Home />));
    await waitFor(() => expect(screen.getByText('Active Leads')).toBeTruthy());
    expect(screen.getByText(String(home.counters.active_leads))).toBeTruthy();

    // Each section renders at most its top items, never the whole backlog.
    const sla = home.sections.find((s) => s.key === 'sla')!;
    expect(screen.getByTestId('home-section-sla')).toBeTruthy();
    expect(screen.getAllByTestId('home-item-SLA_FIRST_CONTACT')).toHaveLength(sla.items.length);
    expect(screen.getAllByText(sla.items[0].customer_name!).length).toBeGreaterThan(0);
    if (sla.total > sla.items.length) {
      await fireEvent.press(screen.getByTestId('home-view-all-sla'));
      expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/leads', params: { focus: 'sla' } });
    }

    await fireEvent.press(screen.getByTestId('qa-add-lead'));
    expect(mockPush).toHaveBeenCalledWith('/lead/new');
    await fireEvent.press(screen.getByTestId('qa-survey'));
    expect(mockNavigate).toHaveBeenCalledWith('/survey');
    await fireEvent.press(screen.getByTestId('qa-visits'));
    expect(mockNavigate).toHaveBeenCalledWith('/visits');
  });

  it('Home labels an interim potential earning as an estimate', async () => {
    mockRoutes['/api/v1/me/home'] = { ...home, counters: { ...home.counters, potential_earning: 12500, potential_earning_interim: true } };
    try {
      const Home = require('@/app/(app)/(tabs)/index').default;
      await render(wrap(<Home />));
      await waitFor(() => expect(screen.getByTestId('counter-potential-note')).toBeTruthy());
      expect(screen.getByText('Estimate · not final policy')).toBeTruthy();
    } finally {
      mockRoutes['/api/v1/me/home'] = home;
    }
  });

  it('Home puts territory floats right under Quick actions, above the ranked sections', async () => {
    const float = {
      ...home.sections[0].items[0],
      id: 'FLOAT:f1',
      kind: 'FLOAT_OPPORTUNITY',
      title: 'Float: Sell · Uncovered Heights',
      customer_name: 'Neha',
      next_action: 'CLAIM_FLOAT',
      target: { ...home.sections[0].items[0].target, relationship_id: null, requirement_id: null, float_id: 'f1' },
    };
    const floats = { key: 'floats', total: 1, items: [float], view_all: { screen: 'floats', focus: null, count: 1 } };
    // Even if the server sent it last, the app shows it directly under Quick actions.
    mockRoutes['/api/v1/me/home'] = { ...home, sections: [...home.sections, floats] };
    try {
      const Home = require('@/app/(app)/(tabs)/index').default;
      const tree = await render(wrap(<Home />));
      await waitFor(() => expect(screen.getByTestId('home-section-floats')).toBeTruthy());
      const ids: string[] = [];
      const walk = (n: unknown) => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach(walk);
        const node = n as { props?: { testID?: string }; children?: unknown };
        if (node.props?.testID) ids.push(node.props.testID);
        walk(node.children);
      };
      walk(tree.toJSON());
      const at = (id: string) => ids.indexOf(id);
      expect(at('qa-visits')).toBeLessThan(at('home-section-floats'));
      expect(at('home-section-floats')).toBeLessThan(at('home-section-sla'));
      expect(screen.getByTestId('home-float-f1')).toBeTruthy();
      expect(screen.getByText(/Territory floats · claim first/)).toBeTruthy();
      expect(screen.queryByText(/home\.section/)).toBeNull();
    } finally {
      mockRoutes['/api/v1/me/home'] = home;
    }
  });

  it('Leads list renders rows from /relationships', async () => {
    const Leads = require('@/app/(app)/(tabs)/leads').default;
    await render(wrap(<Leads />));
    await waitFor(() => expect(screen.getByText(relationships.results[0].customer.name)).toBeTruthy());
    await fireEvent.press(screen.getByTestId(`lead-card-${relationships.results[0].id}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/lead/[id]', params: { id: relationships.results[0].id } });
  });

  it('Lead detail shows one card per requirement, contacts and timeline', async () => {
    const Detail = require('@/app/(app)/lead/[id]').default;
    await render(wrap(<Detail />));
    await waitFor(() => expect(screen.getByTestId('lead-name')).toBeTruthy());
    for (const r of relationship.requirements) expect(screen.getByTestId(`req-card-${r.type}`)).toBeTruthy();
    expect(screen.getByText('Primary contact')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Activity')).toBeTruthy());
  });
});

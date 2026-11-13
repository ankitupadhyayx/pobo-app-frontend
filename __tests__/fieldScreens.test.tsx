/** Survey flow screens rendered with payloads captured from the live backend. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import '@/i18n';
import societies from './fixtures/mapping_societies.json';
import tower from './fixtures/tower.json';
import unit from './fixtures/unit.json';
import config from './fixtures/config.json';
import me from './fixtures/me.json';
import home from './fixtures/home.json';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
const mockRoutes: Record<string, unknown> = {
  '/api/v1/mapping/societies': societies,
  '/api/v1/mapping/towers/{id}': tower,
  '/api/v1/units/{id}': unit,
  '/api/v1/units/{id}/surveys': [],
  '/api/v1/me/field-tasks': [],
  '/api/v1/config/app': config,
  '/api/v1/me': me,
  '/api/v1/me/home': home,
};
jest.mock('@/api/instance', () => ({
  api: {
    GET: async (path: string) => {
      if (!(path in mockRoutes)) throw new Error(`unmocked GET ${path}`);
      return { data: mockRoutes[path], response: { ok: true, status: 200 } };
    },
    POST: jest.fn(),
    PUT: jest.fn(),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
  tokens: { get: jest.fn(), set: jest.fn(), clear: jest.fn() },
  onSessionExpired: jest.fn(),
}));

let qc: QueryClient;
afterEach(() => qc?.clear());
const wrap = (ui: ReactNode) => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe('survey screens', () => {
  beforeEach(() => mockPush.mockClear());

  it('Survey home lists societies with separate mapping and survey progress', async () => {
    const Survey = require('@/app/(app)/(tabs)/survey').default;
    await render(wrap(<Survey />));
    await waitFor(() => expect(screen.getByText('Paras Tierea')).toBeTruthy());
    expect(screen.getAllByText('Structure mapped').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Survey coverage').length).toBeGreaterThan(1);
  });

  it('Tower matrix colours a verified-listing flat differently and opens the unit', async () => {
    mockParams = { id: tower.id };
    const Tower = require('@/app/(app)/field/tower/[id]').default;
    await render(wrap(<Tower />));
    await waitFor(() => expect(screen.getByTestId('unit-102')).toBeTruthy());
    expect(screen.getByLabelText(/102 listing VERIFIED/)).toBeTruthy();
    expect(screen.getByLabelText(/101 mapped/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('unit-102'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/field/unit/[id]', params: { id: unit.id } });
  });

  it('Unit screen prefills the three contact slots and tenancy, and saves to the outbox', async () => {
    mockParams = { id: unit.id };
    const Unit = require('@/app/(app)/field/unit/[id]').default;
    const { outbox } = require('@/offline');
    await outbox.clearAll();
    await render(wrap(<Unit />));
    await waitFor(() => expect(screen.getByTestId('slot-OWNER')).toBeTruthy());
    expect(screen.getByDisplayValue('Ravi Gupta')).toBeTruthy();
    expect(screen.getByDisplayValue('Asha')).toBeTruthy();
    expect(screen.getByText(/Lease ends in 23 days/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('unit-save'));
    await waitFor(async () => expect((await outbox.list()).map((i: { type: string }) => i.type)).toContain('survey.create'));
  });
});

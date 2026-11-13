import { render, screen, act } from '@testing-library/react-native';
import '@/i18n';
import i18n from '@/i18n';
import { SlaChip, slaState } from '@/components/ui/SlaChip';

describe('slaState', () => {
  const now = Date.parse('2026-10-23T10:00:00Z');
  it('classifies the countdown', () => {
    expect(slaState(now, { dueAt: '2026-10-23T10:10:00Z' }).state).toBe('ok');
    expect(slaState(now, { dueAt: '2026-10-23T10:03:00Z' }).state).toBe('warn');
    expect(slaState(now, { dueAt: '2026-10-23T09:55:00Z', breachAt: '2026-10-23T10:10:00Z' }).state).toBe('overdue');
    expect(slaState(now, { dueAt: '2026-10-23T09:30:00Z', breachAt: '2026-10-23T09:45:00Z' }).state).toBe('breached');
    expect(slaState(now, { dueAt: '2026-10-23T09:30:00Z', paused: true }).state).toBe('paused');
  });
});

describe('<SlaChip />', () => {
  beforeAll(() => i18n.changeLanguage('en'));
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('ticks down live every second', async () => {
    jest.setSystemTime(new Date('2026-10-23T10:00:00Z'));
    await render(<SlaChip dueAt="2026-10-23T10:15:00Z" breachAt="2026-10-23T10:30:00Z" />);
    expect(screen.getByText('Contact in 15m 00s')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Contact in 14m 57s')).toBeTruthy();
  });

  it('shows paused state outside service hours', async () => {
    await render(<SlaChip paused dueAt="2026-10-23T10:15:00Z" />);
    expect(screen.getByText('SLA paused')).toBeTruthy();
  });
});

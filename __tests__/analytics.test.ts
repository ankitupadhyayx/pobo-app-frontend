import { scrub, analytics, setAnalyticsSink } from '@/lib/analytics';

describe('analytics PII scrubbing', () => {
  it('drops names, phones, emails, addresses and notes', () => {
    const out = scrub({
      customer_name: 'Rahul Sharma',
      phone: '+919876543210',
      email: 'r@x.com',
      address: 'Tower 2, 1204',
      notes: 'call after 6',
      requirement_id: 'req_123',
      requirement_type: 'BUY',
      count: 2,
      is_dnc: false,
    });
    expect(out).toEqual({ requirement_id: 'req_123', requirement_type: 'BUY', count: 2, is_dnc: false });
  });

  it('drops PII smuggled into an allowed key', () => {
    expect(scrub({ outcome: '+91 98765 43210', status: 'a@b.co', source: 'Rahul Kumar Sharma here' })).toEqual({});
  });

  it('sends scrubbed props to the sink', () => {
    const sink = jest.fn();
    setAnalyticsSink(sink);
    analytics.track('call_completed', { outcome: 'CONNECTED', name: 'X' });
    expect(sink).toHaveBeenCalledWith('call_completed', { outcome: 'CONNECTED' });
  });
});

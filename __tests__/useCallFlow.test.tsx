import { act, renderHook } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';
import { useCallFlow } from '@/hooks/useCallFlow';

describe('useCallFlow', () => {
  let listener: ((s: string) => void) | undefined;
  beforeEach(() => {
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
      listener = fn as (s: string) => void;
      return { remove: jest.fn() } as never;
    });
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  it('opens the dialer and reports back when the app returns to foreground', async () => {
    const onReturn = jest.fn();
    const { result } = await renderHook(() => useCallFlow(onReturn));
    await act(async () => {
      await result.current.dial({ customerId: 'c1', requirementId: 'r1', phone: '+91 98765-43210' });
    });
    expect(Linking.openURL).toHaveBeenCalledWith('tel:+919876543210');
    await act(async () => listener?.('active'));
    expect(onReturn).not.toHaveBeenCalled(); // never left the app yet
    await act(async () => listener?.('background'));
    await act(async () => listener?.('active'));
    expect(onReturn).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'c1', requirementId: 'r1' }));
    await act(async () => listener?.('background'));
    await act(async () => listener?.('active'));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('surfaces an inline error when the dialer cannot open', async () => {
    (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('no handler'));
    const { result } = await renderHook(() => useCallFlow(jest.fn()));
    await act(async () => {
      await result.current.dial({ customerId: 'c1', phone: '9876543210' });
    });
    expect(result.current.dialError).toMatch(/dialer/);
  });
});

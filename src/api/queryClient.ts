import { AppState, Platform } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, err) => {
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
        return count < 2;
      },
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
});

let wired = false;
/** Refetch active queries when the app returns to the foreground. */
export function wireFocusManager() {
  if (wired || Platform.OS === 'web') return;
  wired = true;
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (s) => handleFocus(s === 'active'));
    return () => sub.remove();
  });
}

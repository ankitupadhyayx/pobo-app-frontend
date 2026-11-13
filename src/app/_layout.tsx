import '../../global.css';
import '@/i18n';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { queryClient, wireFocusManager } from '@/api/queryClient';
import { onSessionExpired, tokens } from '@/api/instance';
import { useSession } from '@/state/session';
import { wireOnlineManager } from '@/hooks/useOnline';
import { needsOnboarding, useMe } from '@/api/hooks/me';
import { logout } from '@/api/hooks/auth';
import { BootScreen } from '@/components/shell/BootScreen';

wireOnlineManager();
wireFocusManager();

onSessionExpired(() => {
  queryClient.clear();
  useSession.getState().setStatus('signedOut', { expired: true });
});

function RootNavigator() {
  const status = useSession((s) => s.status);
  const signedIn = status === 'signedIn';
  const me = useMe({ enabled: signedIn });
  const onboarded = !!me.data && !needsOnboarding(me.data);

  if (status === 'booting' || (signedIn && me.isPending)) return <BootScreen />;
  if (signedIn && !me.data) return <BootScreen error={me.error} onRetry={() => me.refetch()} onLogout={() => void logout()} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const setStatus = useSession((s) => s.setStatus);
  useEffect(() => {
    tokens.get().then((t) => setStatus(t ? 'signedIn' : 'signedOut'));
  }, [setStatus]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

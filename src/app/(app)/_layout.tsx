import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { ActionHost } from '@/components/shell/ActionHost';
import { NotificationDrawer } from '@/components/shell/NotificationDrawer';
import { ProfileDrawer } from '@/components/shell/ProfileDrawer';
import { SuccessHost } from '@/components/shell/SuccessHost';
import { useConfig } from '@/api/hooks/config';
import { registerDevice } from '@/api/hooks/me';
import { onNotificationOpened, registerForPush } from '@/lib/push';
import { notificationHref } from '@/lib/deeplink';
import { analytics } from '@/lib/analytics';
import { onSynced, startOutbox } from '@/offline';
import { invalidateField } from '@/api/hooks/field';
import { invalidateAfterSync } from '@/api/hooks/listings';
import { syncTransport } from '@/offline/appTransport';

export default function AppLayout() {
  const router = useRouter();
  useConfig(); // warm master lists/labels for every screen

  useEffect(() => {
    startOutbox(syncTransport); // APP-24: durable offline queue + auto sync
    return onSynced((items) => {
      for (const i of items) if (i.entity === 'unit') invalidateField({ unitId: i.entityId });
      invalidateAfterSync(items);
    });
  }, []);

  useEffect(() => {
    // APP-19: register push token (skipped in Expo Go; drawer still works) and route taps.
    void registerForPush((token, platform) => registerDevice(token, platform, Constants.expoConfig?.version));
    return onNotificationOpened((data) => {
      analytics.track('notification_opened', { source: 'push', kind: typeof data.kind === 'string' ? data.kind : undefined });
      const href = notificationHref(typeof data.kind === 'string' ? data.kind : undefined, data);
      if (href) router.push(href as never);
    });
  }, [router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="lead/[id]" />
        <Stack.Screen name="lead/new" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="more/leave" />
        <Stack.Screen name="more/profile" />
        <Stack.Screen name="more/my-week" />
        <Stack.Screen name="more/learn" />
        <Stack.Screen name="more/article/[id]" />
        <Stack.Screen name="more/ticket/[id]" />
        <Stack.Screen name="earnings/[id]" />
        <Stack.Screen name="more/glossary" />
        <Stack.Screen name="more/sync" />
        <Stack.Screen name="more/field-tasks" />
        <Stack.Screen name="more/keys" />
        <Stack.Screen name="more/reminders" />
        <Stack.Screen name="more/listings" />
        <Stack.Screen name="listing/[id]" />
        <Stack.Screen name="lead/matches/[rid]" />
        <Stack.Screen name="lead/add-property/[rid]" />
        <Stack.Screen name="field/society/[id]" />
        <Stack.Screen name="field/tower/[id]" />
        <Stack.Screen name="field/unit/[id]" />
      </Stack>
      <ActionHost />
      <NotificationDrawer />
      <ProfileDrawer />
      <SuccessHost />
    </>
  );
}

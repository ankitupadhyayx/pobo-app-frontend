import { requireOptionalNativeModule } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * APP-19 push token registration.
 * Remote push is NOT available in Expo Go on Android since SDK 53, so in Expo Go we skip
 * registration (the in-app notification drawer still works off the API). In a development or
 * production build this obtains an Expo push token and hands it to `register` (POST to backend).
 */
export type PushAvailability = 'available' | 'expo_go' | 'simulator' | 'denied' | 'error';

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Constants.appOwnership === 'expo';

// Expo Go on Android ships without this native module, and expo-notifications throws while
// loading if it is missing. Probe for it instead of trusting environment detection alone.
const hasNotificationsNative =
  Platform.OS !== 'android' || requireOptionalNativeModule('ExpoTopicSubscriptionModule') != null;

type NotificationsModule = typeof import('expo-notifications');

function loadNotifications(): NotificationsModule | null {
  if (!hasNotificationsNative || (isExpoGo && Platform.OS === 'android')) return null;
  try {
    // Required lazily: importing expo-notifications in Expo Go on Android logs a hard error.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

export async function registerForPush(
  register: (token: string, platform: 'android' | 'ios') => Promise<unknown>,
): Promise<PushAvailability> {
  if (isExpoGo || !hasNotificationsNative) return 'expo_go';
  if (!Device.isDevice) return 'simulator';
  const N = loadNotifications();
  if (!N) return 'expo_go';
  try {
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'POBO alerts',
        importance: N.AndroidImportance.HIGH,
        lightColor: '#0d9488',
      });
    }
    let { status } = await N.getPermissionsAsync();
    if (status !== 'granted') status = (await N.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await register(data, Platform.OS === 'ios' ? 'ios' : 'android');
    return 'available';
  } catch {
    return 'error';
  }
}

/**
 * Subscribe to taps on push notifications; `onOpen` receives the payload `data`
 * (expected to carry a deep link such as `{ "link": "/lead/<id>" }`).
 */
export function onNotificationOpened(onOpen: (data: Record<string, unknown>) => void): () => void {
  const N = loadNotifications();
  if (!N) return () => {};
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  const sub = N.addNotificationResponseReceivedListener((r) => {
    onOpen((r.notification.request.content.data ?? {}) as Record<string, unknown>);
  });
  return () => sub.remove();
}

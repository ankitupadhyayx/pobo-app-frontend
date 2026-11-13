import * as SecureStore from 'expo-secure-store';
import { api } from '@/api/instance';
import { makeSyncTransport } from './transport';

const KEY = 'pobo.device_id';
let cached: string | null = null;

/** Stable per-install id sent with every sync batch (server-side audit of offline writes). */
async function deviceId(): Promise<string> {
  if (cached) return cached;
  try {
    cached = await SecureStore.getItemAsync(KEY);
  } catch {
    cached = null;
  }
  if (!cached) {
    cached = `aa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      await SecureStore.setItemAsync(KEY, cached);
    } catch {
      /* keep in memory */
    }
  }
  return cached;
}

export const syncTransport = makeSyncTransport(api, deviceId);

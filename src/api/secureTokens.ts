import * as SecureStore from 'expo-secure-store';
import type { TokenStore, Tokens } from './tokens';

/** Access + refresh tokens live only in the OS keystore (expo-secure-store), cached in memory. */
const KEY = 'pobo.aa.tokens.v1';

let cache: Tokens | null | undefined;

export const secureTokenStore: TokenStore = {
  async get() {
    if (cache !== undefined) return cache;
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      cache = raw ? (JSON.parse(raw) as Tokens) : null;
    } catch {
      cache = null;
    }
    return cache;
  },
  async set(tokens) {
    cache = tokens;
    await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
  },
  async clear() {
    cache = null;
    await SecureStore.deleteItemAsync(KEY);
  },
};


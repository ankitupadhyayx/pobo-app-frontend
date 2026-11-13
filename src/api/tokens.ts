/** Access + refresh tokens live only in the OS keystore (expo-secure-store), cached in memory. */
export interface Tokens {
  access: string;
  refresh: string;
}

export interface TokenStore {
  get(): Promise<Tokens | null>;
  set(tokens: Tokens): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory store for tests and the integration script. */
export function memoryTokenStore(initial: Tokens | null = null): TokenStore {
  let t = initial;
  return {
    async get() {
      return t;
    },
    async set(v) {
      t = v;
    },
    async clear() {
      t = null;
    },
  };
}

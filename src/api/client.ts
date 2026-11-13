import createClient from 'openapi-fetch';
import type { components, paths } from './schema';
import { createAuthFetch } from './http';
import { toApiError, networkError } from './errors';
import type { TokenStore, Tokens } from './tokens';
import { API_ORIGIN } from '@/lib/env';

/**
 * Typed API client generated from ../shared/openapi.yaml (`npm run api:gen` → schema.d.ts).
 * Every call goes through authFetch (bearer + refresh rotation).
 */
export interface ClientOptions {
  baseUrl?: string;
  tokenStore: TokenStore;
  onSessionExpired?: () => void;
  fetchImpl?: typeof fetch;
}

export const REFRESH_PATH = '/api/v1/auth/token/refresh';

export function createApi(opts: ClientOptions) {
  const baseUrl = opts.baseUrl ?? API_ORIGIN;
  const tokenStore = opts.tokenStore;
  const rawFetch = opts.fetchImpl ?? ((r: Request) => fetch(r));

  async function refresh(refreshToken: string): Promise<Tokens> {
    let res: Response;
    try {
      res = await rawFetch(
        new Request(`${baseUrl}${REFRESH_PATH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        }),
      );
    } catch (e) {
      throw networkError(e);
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw toApiError(res.status, body);
    const pair = body as components['schemas']['TokenPair'];
    return { access: pair.access, refresh: pair.refresh ?? refreshToken };
  }

  const authFetch = createAuthFetch({
    tokenStore,
    refresh,
    onSessionExpired: () => opts.onSessionExpired?.(),
    fetchImpl: rawFetch as typeof fetch,
  });

  const client = createClient<paths>({
    baseUrl,
    fetch: authFetch,
    headers: { Accept: 'application/json' },
  });

  return { client, tokenStore, baseUrl };
}

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Throws ApiError for non-2xx so TanStack Query treats it as an error. */
export async function unwrap<T>(p: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await p;
  if (!response.ok || error !== undefined) throw toApiError(response.status, error);
  return data as T;
}


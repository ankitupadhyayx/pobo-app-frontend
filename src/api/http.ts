import { ApiError, networkError } from './errors';
import type { TokenStore, Tokens } from './tokens';

/**
 * fetch wrapper used by the generated client:
 *  - attaches `Authorization: Bearer <access>`
 *  - on 401 runs ONE refresh for all concurrent callers (refresh tokens rotate, so a second
 *    parallel refresh with the old token would fail and log the user out)
 *  - retries the original request once with the new access token
 *  - if refresh is rejected, clears tokens and calls onSessionExpired (→ login screen)
 *  - network failures surface as ApiError(code: network_error) and never log the user out
 */
export interface AuthFetchOptions {
  tokenStore: TokenStore;
  /** Exchanges a refresh token for a new pair. Must throw ApiError on rejection. */
  refresh: (refreshToken: string) => Promise<Tokens>;
  onSessionExpired: () => void;
  fetchImpl?: typeof fetch;
}

export function createAuthFetch(opts: AuthFetchOptions) {
  const doFetch = (input: Request) => (opts.fetchImpl ?? fetch)(input);
  let inflight: Promise<Tokens | null> | null = null;

  async function refreshOnce(): Promise<Tokens | null> {
    if (!inflight) {
      inflight = (async () => {
        const current = await opts.tokenStore.get();
        if (!current?.refresh) return null;
        try {
          const next = await opts.refresh(current.refresh);
          await opts.tokenStore.set(next);
          return next;
        } catch (err) {
          if (err instanceof ApiError && err.isNetwork) throw err;
          await opts.tokenStore.clear();
          opts.onSessionExpired();
          return null;
        }
      })().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  }

  function withToken(req: Request, access: string | undefined): Request {
    const r = req.clone();
    if (access) r.headers.set('Authorization', `Bearer ${access}`);
    return r;
  }

  return async function authFetch(input: Request): Promise<Response> {
    // Keep a pristine copy so the body can be re-sent after a refresh.
    const original = input.clone();
    const tokens = await opts.tokenStore.get();
    const usedAccess = tokens?.access;

    let res: Response;
    try {
      res = await doFetch(withToken(original, usedAccess));
    } catch (e) {
      throw networkError(e);
    }
    if (res.status !== 401 || !tokens?.refresh) return res;

    // Another caller may already have rotated the tokens while we were in flight.
    const latest = await opts.tokenStore.get();
    let next: Tokens | null = latest && latest.access !== usedAccess ? latest : null;
    if (!next) next = await refreshOnce();
    if (!next) return res;

    try {
      return await doFetch(withToken(original, next.access));
    } catch (e) {
      throw networkError(e);
    }
  };
}

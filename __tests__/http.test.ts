import { createAuthFetch } from '@/api/http';
import { ApiError, networkError } from '@/api/errors';
import { memoryTokenStore } from '@/api/tokens';

const URL_ = 'http://api.test/api/v1/me/';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('createAuthFetch', () => {
  it('attaches the bearer token', async () => {
    const store = memoryTokenStore({ access: 'a1', refresh: 'r1' });
    const fetchImpl = jest.fn(async (req: Request) => json(200, { auth: req.headers.get('Authorization') }));
    const f = createAuthFetch({ tokenStore: store, refresh: jest.fn(), onSessionExpired: jest.fn(), fetchImpl: fetchImpl as never });
    const res = await f(new Request(URL_));
    expect(await res.json()).toEqual({ auth: 'Bearer a1' });
  });

  it('refreshes once for concurrent 401s, rotates tokens, and retries with the body intact', async () => {
    const store = memoryTokenStore({ access: 'old', refresh: 'r1' });
    const refresh = jest.fn(async (r: string) => {
      expect(r).toBe('r1');
      await new Promise((ok) => setTimeout(ok, 10));
      return { access: 'new', refresh: 'r2' };
    });
    const fetchImpl = jest.fn(async (req: Request) => {
      if (req.headers.get('Authorization') === 'Bearer old') return json(401, { error: { code: 'token_not_valid', message: 'expired' } });
      return json(200, { body: req.method === 'POST' ? await req.text() : null });
    });
    const onSessionExpired = jest.fn();
    const f = createAuthFetch({ tokenStore: store, refresh, onSessionExpired, fetchImpl: fetchImpl as never });

    const [a, b, c] = await Promise.all([
      f(new Request(URL_)),
      f(new Request(URL_)),
      f(new Request(URL_, { method: 'POST', body: '{"x":1}', headers: { 'Content-Type': 'application/json' } })),
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await c.json()).toEqual({ body: '{"x":1}' });
    expect(await store.get()).toEqual({ access: 'new', refresh: 'r2' });
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('clears the session when refresh is rejected', async () => {
    const store = memoryTokenStore({ access: 'old', refresh: 'bad' });
    const refresh = jest.fn(async () => {
      throw new ApiError(401, 'token_not_valid', 'Token is invalid');
    });
    const fetchImpl = jest.fn(async () => json(401, { error: { code: 'token_not_valid', message: 'x' } }));
    const onSessionExpired = jest.fn();
    const f = createAuthFetch({ tokenStore: store, refresh, onSessionExpired, fetchImpl: fetchImpl as never });
    const res = await f(new Request(URL_));
    expect(res.status).toBe(401);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(await store.get()).toBeNull();
  });

  it('keeps the session when refresh fails because the network is down', async () => {
    const store = memoryTokenStore({ access: 'old', refresh: 'r1' });
    const refresh = jest.fn(async () => {
      throw networkError();
    });
    const fetchImpl = jest.fn(async () => json(401, {}));
    const onSessionExpired = jest.fn();
    const f = createAuthFetch({ tokenStore: store, refresh, onSessionExpired, fetchImpl: fetchImpl as never });
    await expect(f(new Request(URL_))).rejects.toMatchObject({ code: 'network_error' });
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(await store.get()).toEqual({ access: 'old', refresh: 'r1' });
  });

  it('maps fetch exceptions to network_error', async () => {
    const f = createAuthFetch({
      tokenStore: memoryTokenStore(null),
      refresh: jest.fn(),
      onSessionExpired: jest.fn(),
      fetchImpl: (async () => {
        throw new TypeError('Network request failed');
      }) as never,
    });
    await expect(f(new Request(URL_))).rejects.toBeInstanceOf(ApiError);
  });
});

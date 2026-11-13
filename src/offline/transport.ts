import type { SyncResult, SyncTransport } from './types';
import { toApiError } from '@/api/errors';
import type { createApi } from '@/api/client';

type Client = ReturnType<typeof createApi>['client'];

/**
 * `POST /sync/batch` (BE-27). The server applies mutations in order, idempotent on client_id,
 * and never overwrites a newer record: stale `base_version` comes back as `conflict` with the
 * server `record`. Network errors / 5xx throw so the whole batch stays pending.
 */
export const makeSyncTransport =
  (api: Client, deviceId: () => Promise<string> | string): SyncTransport =>
  async (batch) => {
    const r = await api.POST('/api/v1/sync/batch', {
      body: {
        device_id: await deviceId(),
        mutations: batch.map((m) => ({
          client_id: m.client_id,
          type: m.type,
          entity_id: m.entity_id || null,
          base_version: m.base_version,
          payload: m.payload,
          queued_at: m.queued_at,
        })),
      },
    });
    if (!r.response.ok || !r.data) throw toApiError(r.response.status, r.error);
    return r.data.results.map((x): SyncResult => {
      if (x.status === 'applied' || x.status === 'duplicate') {
        return { client_id: x.client_id, status: x.status, version: x.server_version, entity_id: x.entity_id };
      }
      if (x.status === 'conflict') {
        return { client_id: x.client_id, status: 'conflict', server: (x.record ?? {}) as Record<string, unknown>, server_version: x.server_version };
      }
      const e = (x.error ?? {}) as { code?: string; message?: string; error?: { code?: string; message?: string } };
      const inner = e.error ?? e;
      return { client_id: x.client_id, status: 'rejected', error: { code: inner.code ?? 'rejected', message: inner.message ?? 'Rejected by server' } };
    });
  };

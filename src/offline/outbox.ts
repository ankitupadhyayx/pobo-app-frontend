import { ApiError } from '@/api/errors';
import type { NewOutboxItem, OutboxItem, OutboxStore, SyncMutation, SyncTransport } from './types';

export interface OutboxSnapshot {
  pending: number;
  syncing: boolean;
  conflicts: number;
  rejected: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  /** entity key (`unit:<id>`) → most relevant local state, for per-record chips. */
  byEntity: Record<string, 'pending' | 'conflict' | 'rejected'>;
}

const EMPTY: OutboxSnapshot = { pending: 0, syncing: false, conflicts: 0, rejected: 0, lastSyncedAt: null, lastError: null, byEntity: {} };
const BATCH = 50;

function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Ordered, durable mutation queue.
 *  - enqueue() saves locally first ("Saved locally"), then tries to sync.
 *  - flush() sends pending items in seq order; `applied`/`duplicate` are removed, `conflict`
 *    keeps both versions for the conflict screen, `rejected` keeps the error for the AA to fix.
 *  - A network failure leaves everything pending (no data loss, retried later).
 *  - Items for an entity that already has a conflict wait behind it, so a later edit never
 *    jumps over an unresolved conflict.
 */
export class Outbox {
  private snapshot: OutboxSnapshot = EMPTY;
  private listeners = new Set<(s: OutboxSnapshot) => void>();
  private flushing: Promise<void> | null = null;

  constructor(
    private store: OutboxStore,
    private transport: SyncTransport,
    private onApplied?: (items: OutboxItem[]) => void,
  ) {}

  setTransport(t: SyncTransport) {
    this.transport = t;
  }

  subscribe(fn: (s: OutboxSnapshot) => void) {
    this.listeners.add(fn);
    fn(this.snapshot);
    return () => {
      this.listeners.delete(fn);
    };
  }

  get state() {
    return this.snapshot;
  }

  private async refresh(patch: Partial<OutboxSnapshot> = {}) {
    const all = await this.store.list();
    const byEntity: OutboxSnapshot['byEntity'] = {};
    for (const i of all) {
      const k = `${i.entity}:${i.entityId}`;
      const cur = byEntity[k];
      const s = i.status === 'syncing' ? 'pending' : i.status;
      if (s === 'conflict' || (s === 'rejected' && cur !== 'conflict') || !cur) byEntity[k] = s;
    }
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      pending: all.filter((i) => i.status === 'pending' || i.status === 'syncing').length,
      conflicts: all.filter((i) => i.status === 'conflict').length,
      rejected: all.filter((i) => i.status === 'rejected').length,
      byEntity,
    };
    this.listeners.forEach((l) => l(this.snapshot));
  }

  async init() {
    await this.store.init();
    // Items stuck in "syncing" after a crash go back to pending; the client_id makes replay safe.
    for (const i of await this.store.list(['syncing'])) await this.store.update(i.clientId, { status: 'pending' });
    await this.refresh();
  }

  async enqueue(n: NewOutboxItem): Promise<OutboxItem> {
    const item: OutboxItem = {
      clientId: n.clientId ?? uuid(),
      seq: await this.store.nextSeq(),
      type: n.type,
      entity: n.entity,
      entityId: n.entityId,
      baseVersion: n.baseVersion,
      payload: n.payload,
      queuedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
      error: null,
      server: null,
      serverVersion: null,
      label: n.label,
    };
    await this.store.add(item);
    await this.refresh();
    return item;
  }

  async list() {
    return this.store.list();
  }

  /** Send everything pending. Safe to call often; concurrent calls share one run. */
  flush(): Promise<void> {
    if (!this.flushing) {
      this.flushing = this.run().finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async run() {
    for (;;) {
      const all = await this.store.list();
      const blocked = new Set(all.filter((i) => i.status === 'conflict' || i.status === 'rejected').map((i) => `${i.entity}:${i.entityId}`));
      // One item per record per round: local edits chain, so the next one is rebased onto the
      // version the server returns for this one.
      const seen = new Set<string>();
      const ready = all
        .filter((i) => {
          const k = `${i.entity}:${i.entityId}`;
          if (i.status !== 'pending' || blocked.has(k) || seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, BATCH);
      if (!ready.length) {
        await this.refresh({ syncing: false });
        return;
      }
      for (const i of ready) await this.store.update(i.clientId, { status: 'syncing', attempts: i.attempts + 1 });
      await this.refresh({ syncing: true, lastError: null });

      const batch: SyncMutation[] = ready.map((i) => ({
        client_id: i.clientId,
        type: i.type,
        entity: i.entity,
        entity_id: i.entityId,
        base_version: i.baseVersion,
        payload: i.payload,
        queued_at: i.queuedAt,
      }));
      let results;
      try {
        results = await this.transport(batch);
      } catch (e) {
        for (const i of ready) await this.store.update(i.clientId, { status: 'pending' });
        await this.refresh({ syncing: false, lastError: e instanceof ApiError ? e.message : 'Sync failed. Will retry.' });
        return;
      }
      const applied: OutboxItem[] = [];
      const byId = new Map(results.map((r) => [r.client_id, r]));
      for (const i of ready) {
        const r = byId.get(i.clientId);
        if (!r) {
          await this.store.update(i.clientId, { status: 'pending' });
        } else if (r.status === 'applied' || r.status === 'duplicate') {
          await this.store.remove(i.clientId);
          applied.push(i);
          if (typeof r.version === 'number') await this.rebase(i, i.baseVersion, r.version);
        } else if (r.status === 'conflict') {
          await this.store.update(i.clientId, { status: 'conflict', server: r.server, serverVersion: r.server_version });
        } else {
          await this.store.update(i.clientId, { status: 'rejected', error: r.status === 'rejected' ? r.error?.message ?? 'Rejected by server' : 'Rejected by server' });
        }
      }
      if (applied.length) this.onApplied?.(applied);
      await this.refresh({ lastSyncedAt: new Date().toISOString() });
      // Items missing from the response stay pending; stop to avoid a tight loop.
      if (ready.some((i) => !byId.has(i.clientId))) {
        await this.refresh({ syncing: false });
        return;
      }
    }
  }

  /** Later local edits of the same record that were based on `from` now sit on top of `to`. */
  private async rebase(after: OutboxItem, from: number | null, to: number) {
    for (const o of await this.store.list(['pending'])) {
      if (o.entity === after.entity && o.entityId === after.entityId && o.seq > after.seq && o.baseVersion === from) {
        await this.store.update(o.clientId, { baseVersion: to });
      }
    }
  }

  /** Conflict: drop my change and keep what's on the server. */
  async keepServer(clientId: string) {
    await this.store.remove(clientId);
    await this.refresh();
  }

  /** Conflict: I reviewed the server version and still want mine; resend on top of it. */
  async applyMineOnTop(clientId: string) {
    const [item] = (await this.store.list()).filter((i) => i.clientId === clientId);
    if (!item) return;
    await this.store.remove(clientId);
    await this.store.add({ ...item, clientId: uuid(), status: 'pending', baseVersion: item.serverVersion, server: null, serverVersion: null, error: null });
    if (item.serverVersion !== null) await this.rebase(item, item.baseVersion, item.serverVersion);
    await this.refresh();
    void this.flush();
  }

  /** Rejected: discard (the AA re-enters it from the form with the error shown). */
  async discard(clientId: string) {
    await this.store.remove(clientId);
    await this.refresh();
  }

  async clearAll() {
    await this.store.clear();
    await this.refresh();
  }
}

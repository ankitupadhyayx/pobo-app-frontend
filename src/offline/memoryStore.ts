import type { OutboxItem, OutboxStatus, OutboxStore } from './types';

/** In-memory outbox for tests and for platforms without SQLite. */
export function memoryOutboxStore(): OutboxStore {
  const rows = new Map<string, OutboxItem>();
  let seq = 0;
  return {
    async init() {},
    async add(item) {
      rows.set(item.clientId, { ...item });
    },
    async list(statuses?: OutboxStatus[]) {
      return [...rows.values()].filter((r) => !statuses || statuses.includes(r.status)).sort((a, b) => a.seq - b.seq);
    },
    async update(clientId, patch) {
      const r = rows.get(clientId);
      if (r) rows.set(clientId, { ...r, ...patch });
    },
    async remove(clientId) {
      rows.delete(clientId);
    },
    async nextSeq() {
      return ++seq;
    },
    async clear() {
      rows.clear();
    },
  };
}

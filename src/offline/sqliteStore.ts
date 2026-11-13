import * as SQLite from 'expo-sqlite';
import type { OutboxItem, OutboxStatus, OutboxStore } from './types';

/**
 * Durable outbox in expo-sqlite (works in Expo Go). Survives app restarts and phone reboots.
 * One row per queued mutation; payload/server are JSON text.
 */
type Row = {
  client_id: string;
  seq: number;
  type: string;
  entity: string;
  entity_id: string;
  base_version: number | null;
  payload: string;
  queued_at: string;
  status: string;
  attempts: number;
  error: string | null;
  server: string | null;
  server_version: number | null;
  label: string;
};

const toItem = (r: Row): OutboxItem => ({
  clientId: r.client_id,
  seq: r.seq,
  type: r.type as OutboxItem['type'],
  entity: r.entity,
  entityId: r.entity_id,
  baseVersion: r.base_version,
  payload: JSON.parse(r.payload),
  queuedAt: r.queued_at,
  status: r.status as OutboxStatus,
  attempts: r.attempts,
  error: r.error,
  server: r.server ? JSON.parse(r.server) : null,
  serverVersion: r.server_version,
  label: r.label,
});

const COLS: Record<string, string> = {
  status: 'status',
  attempts: 'attempts',
  error: 'error',
  server: 'server',
  serverVersion: 'server_version',
  baseVersion: 'base_version',
  payload: 'payload',
};

export function sqliteOutboxStore(name = 'pobo-outbox.db'): OutboxStore {
  let db: SQLite.SQLiteDatabase | null = null;
  const get = async () => {
    if (!db) {
      db = await SQLite.openDatabaseAsync(name);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS outbox (
          client_id TEXT PRIMARY KEY NOT NULL,
          seq INTEGER NOT NULL,
          type TEXT NOT NULL,
          entity TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          base_version INTEGER,
          payload TEXT NOT NULL,
          queued_at TEXT NOT NULL,
          status TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          error TEXT,
          server TEXT,
          server_version INTEGER,
          label TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS outbox_seq ON outbox(seq);
        CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL);
      `);
    }
    return db;
  };
  return {
    async init() {
      await get();
    },
    async add(i) {
      const d = await get();
      await d.runAsync(
        `INSERT OR REPLACE INTO outbox (client_id, seq, type, entity, entity_id, base_version, payload, queued_at, status, attempts, error, server, server_version, label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [i.clientId, i.seq, i.type, i.entity, i.entityId, i.baseVersion, JSON.stringify(i.payload), i.queuedAt, i.status, i.attempts, i.error, i.server ? JSON.stringify(i.server) : null, i.serverVersion, i.label],
      );
    },
    async list(statuses) {
      const d = await get();
      const rows = statuses?.length
        ? await d.getAllAsync<Row>(`SELECT * FROM outbox WHERE status IN (${statuses.map(() => '?').join(',')}) ORDER BY seq`, statuses)
        : await d.getAllAsync<Row>('SELECT * FROM outbox ORDER BY seq');
      return rows.map(toItem);
    },
    async update(clientId, patch) {
      const d = await get();
      const sets: string[] = [];
      const vals: (string | number | null)[] = [];
      for (const [k, v] of Object.entries(patch)) {
        const col = COLS[k];
        if (!col) continue;
        sets.push(`${col} = ?`);
        vals.push(v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : (v as string | number));
      }
      if (!sets.length) return;
      await d.runAsync(`UPDATE outbox SET ${sets.join(', ')} WHERE client_id = ?`, [...vals, clientId]);
    },
    async remove(clientId) {
      const d = await get();
      await d.runAsync('DELETE FROM outbox WHERE client_id = ?', [clientId]);
    },
    async nextSeq() {
      const d = await get();
      const r = await d.getFirstAsync<{ m: number | null }>('SELECT MAX(seq) AS m FROM outbox');
      const meta = await d.getFirstAsync<{ v: string }>("SELECT v FROM meta WHERE k = 'seq'");
      const next = Math.max(r?.m ?? 0, Number(meta?.v ?? 0)) + 1;
      await d.runAsync("INSERT OR REPLACE INTO meta (k, v) VALUES ('seq', ?)", [String(next)]);
      return next;
    },
    async clear() {
      const d = await get();
      await d.execAsync('DELETE FROM outbox;');
    },
  };
}

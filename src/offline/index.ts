import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Outbox, type OutboxSnapshot } from './outbox';
import { memoryOutboxStore } from './memoryStore';
import type { OutboxItem, SyncTransport } from './types';
import { ApiError } from '@/api/errors';

/**
 * App-wide outbox. Transport is bound in src/offline/transport.ts once `/sync/batch` exists in
 * openapi.yaml; until then items stay "Saved locally" and nothing is lost.
 */
const notBound: SyncTransport = async () => {
  throw new ApiError(0, 'sync_unavailable', 'Saved on this phone. Sync starts when the server is ready.');
};

function makeStore() {
  if (Platform.OS === 'web' || process.env.JEST_WORKER_ID) return memoryOutboxStore();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sqliteOutboxStore } = require('./sqliteStore') as typeof import('./sqliteStore');
    return sqliteOutboxStore();
  } catch (e) {
    // Some Expo Go builds ship without the ExpoSQLite native module. Keep the app usable with an in-memory
    // outbox (queued edits still sync, but don't survive an app restart) instead of crashing at startup.
    console.warn('[offline] SQLite unavailable, using in-memory outbox:', (e as Error).message);
    return memoryOutboxStore();
  }
}

const appliedListeners = new Set<(items: OutboxItem[]) => void>();
export const outbox = new Outbox(makeStore(), notBound, (items) => appliedListeners.forEach((l) => l(items)));

/** Called after server-confirmed sync, e.g. to refetch the affected queries. */
export function onSynced(fn: (items: OutboxItem[]) => void) {
  appliedListeners.add(fn);
  return () => {
    appliedListeners.delete(fn);
  };
}

let started = false;
/** Init + automatic sync triggers: reconnect, app foreground, every 60 s. */
export function startOutbox(transport: SyncTransport) {
  outbox.setTransport(transport);
  if (started) return;
  started = true;
  void outbox.init().then(() => outbox.flush());
  NetInfo.addEventListener((s) => {
    if (s.isConnected && s.isInternetReachable !== false) void outbox.flush();
  });
  AppState.addEventListener('change', (st) => {
    if (st === 'active') void outbox.flush();
  });
  setInterval(() => {
    if (outbox.state.pending > 0) void outbox.flush();
  }, 60_000);
}

export function useOutbox(): OutboxSnapshot {
  return useSyncExternalStore(
    (cb) => outbox.subscribe(cb),
    () => outbox.state,
    () => outbox.state,
  );
}

export type SyncChipState = 'saved_local' | 'syncing' | 'synced' | 'conflict' | 'rejected';

/** Per-record state for the "Saved locally / Syncing / Synced / Conflict" chip. */
export function useEntitySync(entity: string, id: string | null | undefined): SyncChipState {
  const s = useOutbox();
  if (!id) return 'synced';
  const st = s.byEntity[`${entity}:${id}`];
  if (st === 'conflict') return 'conflict';
  if (st === 'rejected') return 'rejected';
  if (st === 'pending') return s.syncing ? 'syncing' : 'saved_local';
  return 'synced';
}

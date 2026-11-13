/**
 * Offline outbox (APP-24, PHASE2 DEC-06). Only these mutation types may be queued offline;
 * everything else (listing submit, transfers, claims, visit scheduling, money) needs a connection.
 */
export const OFFLINE_TYPES = [
  'survey.create',
  'unit_contacts.save',
  'unit_details.save',
  'listing_draft.create',
  'listing_draft.update',
  'note.create',
  'follow_up.create',
  'follow_up.complete',
  'key.taken',
  'key.returned',
] as const;
export type OfflineType = (typeof OFFLINE_TYPES)[number];

export type OutboxStatus = 'pending' | 'syncing' | 'conflict' | 'rejected';

export interface OutboxItem {
  /** Idempotency key sent to the server; replaying the same item applies once. */
  clientId: string;
  /** Monotonic order: mutations are replayed in the order they were made. */
  seq: number;
  type: OfflineType;
  /** Entity kind + id the mutation targets (e.g. `unit` / uuid), for per-record sync chips. */
  entity: string;
  entityId: string;
  /** Server version the edit was based on; the server reports a conflict if it moved on. */
  baseVersion: number | null;
  payload: Record<string, unknown>;
  queuedAt: string;
  status: OutboxStatus;
  attempts: number;
  /** Human message for rejected items (from the API error envelope). */
  error: string | null;
  /** Server copy returned with a conflict, shown side by side with ours. Never applied silently. */
  server: Record<string, unknown> | null;
  serverVersion: number | null;
  /** Short label for the sync screen ("Survey · T2-1204"). Never sent to analytics. */
  label: string;
}

export type NewOutboxItem = Pick<OutboxItem, 'type' | 'entity' | 'entityId' | 'baseVersion' | 'payload' | 'label'> & { clientId?: string };

export interface OutboxStore {
  init(): Promise<void>;
  add(item: OutboxItem): Promise<void>;
  list(statuses?: OutboxStatus[]): Promise<OutboxItem[]>;
  update(clientId: string, patch: Partial<OutboxItem>): Promise<void>;
  remove(clientId: string): Promise<void>;
  nextSeq(): Promise<number>;
  clear(): Promise<void>;
}

/** One result per submitted item, as returned by the sync endpoint. */
export type SyncResult =
  | { client_id: string; status: 'applied' | 'duplicate'; version?: number | null; entity_id?: string | null }
  | { client_id: string; status: 'conflict'; server: Record<string, unknown>; server_version: number | null }
  | { client_id: string; status: 'rejected'; error: { code: string; message: string; fields?: Record<string, string[]> } };

export interface SyncMutation {
  client_id: string;
  type: OfflineType;
  entity: string;
  entity_id: string;
  base_version: number | null;
  payload: Record<string, unknown>;
  queued_at: string;
}

export type SyncTransport = (batch: SyncMutation[]) => Promise<SyncResult[]>;

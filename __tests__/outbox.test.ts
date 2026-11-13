import { Outbox } from '@/offline/outbox';
import { memoryOutboxStore } from '@/offline/memoryStore';
import { networkError } from '@/api/errors';
import type { SyncMutation, SyncResult } from '@/offline/types';

const survey = (unit: string, v: number | null = 1) => ({ type: 'survey.create' as const, entity: 'unit', entityId: unit, baseVersion: v, payload: { occupancy: 'VACANT' }, label: `Survey ${unit}` });

describe('Outbox', () => {
  it('saves locally, syncs in order, removes applied/duplicate items', async () => {
    const seen: string[][] = [];
    const ob = new Outbox(memoryOutboxStore(), async (batch: SyncMutation[]) => {
      seen.push(batch.map((b) => b.entity_id));
      return batch.map((b, i): SyncResult => ({ client_id: b.client_id, status: i === 0 ? 'applied' : 'duplicate' }));
    });
    await ob.init();
    await ob.enqueue(survey('u1'));
    await ob.enqueue(survey('u2'));
    expect(ob.state.pending).toBe(2);
    expect(ob.state.byEntity['unit:u1']).toBe('pending');
    await ob.flush();
    expect(seen).toEqual([['u1', 'u2']]);
    expect(ob.state.pending).toBe(0);
    expect(ob.state.lastSyncedAt).toBeTruthy();
  });

  it('keeps everything pending when offline, then syncs the same client_ids later (idempotent replay)', async () => {
    let online = false;
    const sent: string[] = [];
    const ob = new Outbox(memoryOutboxStore(), async (batch) => {
      if (!online) throw networkError();
      batch.forEach((b) => sent.push(b.client_id));
      return batch.map((b) => ({ client_id: b.client_id, status: 'applied' as const }));
    });
    await ob.init();
    const a = await ob.enqueue(survey('u1'));
    await ob.flush();
    expect(ob.state.pending).toBe(1);
    expect(ob.state.lastError).toBeTruthy();
    online = true;
    await ob.flush();
    expect(sent).toEqual([a.clientId]);
    expect(ob.state.pending).toBe(0);
  });

  it('surfaces conflicts with the server copy and blocks later edits to the same record', async () => {
    const calls: SyncMutation[][] = [];
    const ob = new Outbox(memoryOutboxStore(), async (batch) => {
      calls.push(batch);
      return batch.map((b) =>
        b.entity_id === 'u1' && b.base_version === 1
          ? { client_id: b.client_id, status: 'conflict' as const, server: { occupancy: 'TENANT_OCCUPIED' }, server_version: 3 }
          : { client_id: b.client_id, status: 'applied' as const, version: (b.base_version ?? 0) + 1 },
      );
    });
    await ob.init();
    const first = await ob.enqueue(survey('u1', 1));
    await ob.flush();
    expect(ob.state.conflicts).toBe(1);
    const [c] = (await ob.list()).filter((i) => i.status === 'conflict');
    expect(c.server).toEqual({ occupancy: 'TENANT_OCCUPIED' });

    await ob.enqueue(survey('u1', 1)); // later edit to the same unit waits behind the conflict
    await ob.enqueue(survey('u2', 1));
    await ob.flush();
    expect(calls[1].map((b) => b.entity_id)).toEqual(['u2']);
    expect(ob.state.pending).toBe(1);

    await ob.applyMineOnTop(first.clientId); // resend on top of server version 3
    await ob.flush();
    // resent on top of v3, then the queued second edit is rebased onto v4 (chained, no new conflict)
    const sentU1 = calls.slice(2).flat().filter((b) => b.entity_id === 'u1').map((b) => b.base_version);
    expect(sentU1).toEqual([3, 4]);
    expect(ob.state.conflicts).toBe(0);
    expect(ob.state.pending).toBe(0);
  });

  it('keeps rejected items with the server message until discarded', async () => {
    const ob = new Outbox(memoryOutboxStore(), async (batch) =>
      batch.map((b) => ({ client_id: b.client_id, status: 'rejected' as const, error: { code: 'forbidden', message: 'Unit is outside your territory.' } })),
    );
    await ob.init();
    const i = await ob.enqueue(survey('u9'));
    await ob.flush();
    expect(ob.state.rejected).toBe(1);
    expect((await ob.list())[0].error).toMatch(/territory/);
    await ob.discard(i.clientId);
    expect(ob.state.rejected).toBe(0);
  });

  it('recovers items left "syncing" by a crash', async () => {
    const store = memoryOutboxStore();
    const ob1 = new Outbox(store, async () => new Promise(() => {}));
    await ob1.init();
    await ob1.enqueue(survey('u1'));
    void ob1.flush();
    await new Promise((r) => setTimeout(r, 0));
    const ob2 = new Outbox(store, async (b) => b.map((x) => ({ client_id: x.client_id, status: 'applied' as const })));
    await ob2.init();
    expect((await store.list())[0].status).toBe('pending');
    await ob2.flush();
    expect(ob2.state.pending).toBe(0);
  });
});

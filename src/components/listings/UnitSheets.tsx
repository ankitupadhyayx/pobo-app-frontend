import { useState } from 'react';
import { BottomSheet, Button, Chips, InlineBanner, TextField, type Option } from '@/components/ui';
import { outbox } from '@/offline';
import { useCreateListing, type Key } from '@/api/hooks/listings';
import { useOnline } from '@/hooks/useOnline';
import { useSubmit } from '@/hooks/useSubmit';
import { analytics } from '@/lib/analytics';
import { useT } from '@/i18n';
import { keyTakenPayload } from '@/lib/keys';

export type ListingType = 'SELL' | 'RENT_OUT';

interface CreateProps {
  unitId: string;
  unitLabel: string;
  /** An open SELL / RENT_OUT opportunity on this flat, if any: the draft is created from it. */
  opportunity?: { id: string; type: ListingType } | null;
  types: Option[];
  onClose: () => void;
  /** Online: the new listing id. Offline: null (queued as listing_draft.create). */
  onDone: (listingId: string | null) => void;
}

/** APP-26: start a listing draft for a flat. Works offline (DEC-06); the draft syncs later. */
export function CreateListingSheet({ unitId, unitLabel, opportunity, types, onClose, onDone }: CreateProps) {
  const t = useT();
  const online = useOnline();
  const create = useCreateListing();
  const [type, setType] = useState<ListingType | null>(opportunity?.type ?? null);
  const [title, setTitle] = useState('');
  const [err, setErr] = useState<string>();
  const s = useSubmit(async () => {
    const body = { type: type!, title: title.trim() || undefined, ...(opportunity && opportunity.type === type ? { opportunity_id: opportunity.id } : { unit_id: unitId }) };
    if (online) {
      const l = await create.mutateAsync(body);
      analytics.track('property_added', { kind: type!, source: 'online' });
      onDone(l.id);
      return;
    }
    // Creates carry no server id yet; the unit is the record the AA sees as "Saved locally".
    await outbox.enqueue({ type: 'listing_draft.create', entity: 'unit', entityId: unitId, baseVersion: null, payload: body, label: `${t('listings.draft')} · ${unitLabel}` });
    analytics.track('property_added', { kind: type!, source: 'offline' });
    onDone(null);
  }, onClose);
  return (
    <BottomSheet
      testID="create-listing-sheet"
      visible
      onClose={onClose}
      dismissable={!s.busy}
      title={t('listings.create')}
      subtitle={unitLabel}
      footer={<Button testID="create-listing-save" className="flex-1" label={t('listings.create')} loading={s.busy} onPress={() => (type ? void s.run(undefined) : setErr(t('errors.required')))} />}
    >
      <Chips testIDPrefix="listing-type" label={t('listings.type')} required options={types} value={type} allowDeselect={false} onChange={(v) => { setType(v as ListingType); setErr(undefined); }} error={err ?? s.apiField('type')} />
      <TextField label={t('listings.title')} value={title} onChangeText={setTitle} error={s.apiField('title')} />
      {s.banner(['type', 'title', 'unit_id', 'opportunity_id']) ? <InlineBanner>{s.banner(['type', 'title', 'unit_id', 'opportunity_id'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}

export interface TakeKeyValues {
  taken_from: string;
  key_count: number;
  tag?: string;
  notes?: string;
}

/**
 * APP-28: record keys taken for a flat. Queued offline as key.taken.
 * REQ-11: an independent property has no flat, so it is keyed by the listing (listing_id, no unit_id).
 */
export function TakeKeySheet({ unitId, unitLabel, listingId, parties, defaultFrom, onClose, onDone }: { unitId?: string | null; unitLabel: string; listingId?: string | null; parties: Option[]; defaultFrom?: string | null; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [from, setFrom] = useState<string | null>(defaultFrom || null);
  const [count, setCount] = useState('1');
  const [tag, setTag] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const save = async () => {
    const n = Number(count);
    const e: Record<string, string> = {};
    if (!from) e.from = t('errors.required');
    if (!Number.isInteger(n) || n < 1 || n > 20) e.count = t('keys.countRange');
    setErr(e);
    if (Object.keys(e).length) return;
    if (!unitId && !listingId) return;
    const payload = keyTakenPayload(unitId, listingId, { taken_from: from!, key_count: n, tag: tag.trim() || undefined, notes: notes.trim() || undefined, taken_at: new Date().toISOString() });
    await outbox.enqueue({ type: 'key.taken', entity: unitId ? 'unit' : 'listing_key', entityId: (unitId ?? listingId)!, baseVersion: null, payload, label: `${t('keys.title')} · ${unitLabel}` });
    analytics.track('key_recorded', { kind: 'taken' });
    void outbox.flush();
    onDone();
    onClose();
  };
  return (
    <BottomSheet testID="take-key-sheet" visible onClose={onClose} title={t('keys.record')} subtitle={unitLabel} footer={<Button testID="take-key-save" className="flex-1" label={t('keys.record')} onPress={save} />}>
      <Chips testIDPrefix="key-from" label={t('keys.takenFrom')} required options={parties} value={from} onChange={(v) => { setFrom(v as string | null); setErr((x) => ({ ...x, from: '' })); }} error={err.from || undefined} />
      <TextField testID="key-count" label={t('keys.count')} keyboardType="number-pad" value={count} onChangeText={(v) => setCount(v.replace(/\D/g, ''))} error={err.count} />
      <TextField label={t('keys.tag')} placeholder="PT-T2-704" value={tag} onChangeText={setTag} />
      <TextField label={t('call.notes')} multiline value={notes} onChangeText={setNotes} />
    </BottomSheet>
  );
}

/** APP-28 / FB-08: return keys (to the owner or whoever they came from). Queued offline as key.returned. */
export function ReturnKeySheet({ k, parties, onClose, onDone }: { k: Key; parties: Option[]; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [to, setTo] = useState<string | null>(k.taken_from || null);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string>();
  const save = async () => {
    if (!to) return setErr(t('errors.required'));
    await outbox.enqueue({ type: 'key.returned', entity: 'key', entityId: k.id, baseVersion: k.version ?? null, payload: { returned_to: to, returned_at: new Date().toISOString(), notes: notes.trim() || undefined }, label: `${t('keys.title')} · ${k.unit_label}` });
    analytics.track('key_recorded', { kind: 'returned' });
    void outbox.flush();
    onDone();
    onClose();
  };
  return (
    <BottomSheet visible onClose={onClose} title={t('keys.markReturned')} subtitle={k.unit_label} footer={<Button testID="key-return-save" className="flex-1" label={t('keys.markReturned')} onPress={save} />}>
      <Chips label={t('keys.returnedTo')} required options={parties} value={to} onChange={(v) => { setTo(v as string | null); setErr(undefined); }} error={err} />
      <TextField label={t('call.notes')} multiline value={notes} onChangeText={setNotes} />
    </BottomSheet>
  );
}

import { useState } from 'react';
import { BottomSheet, Button, Chips, InlineBanner, TextField } from '@/components/ui';
import { useSaveAccess, type Listing } from '@/api/hooks/listings';
import { useLabels } from '@/api/hooks/config';
import { useSubmit } from '@/hooks/useSubmit';
import { useActions } from '@/state/actions';
import { placeShort } from '@/lib/property';
import { useT } from '@/i18n';

/**
 * FB-08: how the key for this property is arranged — who gives it (and their phone), where to
 * collect it, and whether it is collected for each visit or kept by POBO.
 */
export function AccessSheet({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const t = useT();
  const L = useLabels();
  const save = useSaveAccess(listing.id);
  const showSuccess = useActions((s) => s.showSuccess);
  const a = listing.access;
  const [party, setParty] = useState<string | null>(a?.key_party || null);
  const [name, setName] = useState(a?.contact_name ?? '');
  const [phone, setPhone] = useState(a?.contact_phone ?? '');
  const [where, setWhere] = useState(a?.collection_location ?? '');
  const [mode, setMode] = useState<string | null>(a?.mode ?? null);
  const [notes, setNotes] = useState(a?.notes ?? '');
  const [err, setErr] = useState<Record<string, string>>({});
  const s = useSubmit(async () => {
    await save.mutateAsync({
      key_party: party!,
      contact_name: name.trim() || undefined,
      contact_phone: phone.trim() || undefined,
      collection_location: where.trim() || undefined,
      mode: mode as 'PER_VISIT' | 'RETAINED',
      notes: notes.trim() || undefined,
      base_version: a?.version ?? null,
    });
    showSuccess({
      title: t('access.savedTitle'),
      lines: [
        { label: t('access.keyFrom'), value: [L.master('KEY_PARTY', party!), name.trim()].filter(Boolean).join(' · ') },
        { label: t('access.mode'), value: L.enumLabel('access_mode', mode!) },
      ],
    });
  }, onClose);
  const submit = () => {
    const e: Record<string, string> = {};
    if (!party) e.party = t('errors.required');
    if (!mode) e.mode = t('errors.required');
    setErr(e);
    if (!Object.keys(e).length) void s.run(undefined);
  };
  const shown = ['key_party', 'contact_name', 'contact_phone', 'collection_location', 'mode', 'notes'];
  return (
    <BottomSheet testID="access-sheet" visible onClose={onClose} dismissable={!s.busy} title={t('access.title')} subtitle={listing.title || placeShort(listing)} footer={<Button testID="access-save" className="flex-1" label={t('common.save')} loading={s.busy} onPress={submit} />}>
      <Chips testIDPrefix="access-party" label={t('access.keyFrom')} required options={L.options('KEY_PARTY')} value={party} onChange={(v) => setParty(v as string | null)} error={err.party ?? s.apiField('key_party')} />
      <TextField label={t('access.contactName')} value={name} onChangeText={setName} error={s.apiField('contact_name')} />
      <TextField label={t('access.contactPhone')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} error={s.apiField('contact_phone')} />
      <TextField label={t('access.where')} placeholder={t('access.wherePlaceholder')} value={where} onChangeText={setWhere} error={s.apiField('collection_location')} />
      <Chips
        testIDPrefix="access-mode"
        label={t('access.mode')}
        required
        options={L.enumOptions('access_mode', ['PER_VISIT', 'RETAINED'])}
        value={mode}
        onChange={(v) => setMode(v as string | null)}
        error={err.mode ?? s.apiField('mode')}
      />
      {mode ? <InlineBanner tone="info">{mode === 'PER_VISIT' ? t('access.perVisitHint') : t('access.retainedHint')}</InlineBanner> : null}
      <TextField label={t('call.notes')} multiline value={notes} onChangeText={setNotes} />
      {s.banner(shown) ? <InlineBanner>{s.banner(shown)!}</InlineBanner> : null}
    </BottomSheet>
  );
}

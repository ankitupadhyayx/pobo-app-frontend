import { useState } from 'react';
import { BottomSheet, Button, Checkbox, Chips, InlineBanner, TextField, type Option } from '@/components/ui';
import { useConvertOpportunity, useDeleteUnit, useEditUnit, useRequestCorrection, type Opportunity, type UnitDetail } from '@/api/hooks/field';
import { useSubmit } from '@/hooks/useSubmit';
import { useT } from '@/i18n';

/**
 * Structure edits (APP-22 governance): a unit with no history can be edited/deleted directly;
 * one with survey/listing/key/lead history goes through a supervisor-approved correction.
 */
export function StructureSheet({ unit, configurations, onClose, onDone }: { unit: UnitDetail; configurations: Option[]; onClose: () => void; onDone: (msg: string, deleted?: boolean) => void }) {
  const t = useT();
  const edit = useEditUnit(unit.tower_id);
  const del = useDeleteUnit(unit.tower_id);
  const corr = useRequestCorrection();
  const governed = unit.has_history;
  const [number, setNumber] = useState(unit.number);
  const [config, setConfig] = useState<string | null>(unit.configuration || null);
  const [action, setAction] = useState<string>('RENAME');
  const [reason, setReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState<string>();

  const s = useSubmit(async () => {
    if (governed) {
      await corr.mutateAsync({
        target_type: 'UNIT',
        target_id: unit.id,
        action: action as 'RENAME',
        proposed: action === 'RENAME' ? { number: number.trim() } : action === 'CHANGE_CONFIGURATION' ? { configuration: config } : {},
        reason: reason.trim(),
      });
      onDone(t('structure.correctionSent'));
    } else {
      await edit.mutateAsync({ id: unit.id, body: { number: number.trim(), configuration: config ?? '', base_version: unit.version } });
      onDone(t('structure.saved'));
    }
  }, onClose);

  const delS = useSubmit(async () => {
    await del.mutateAsync(unit.id);
    onDone(t('structure.deleted'), true);
  }, onClose);

  return (
    <BottomSheet
      testID="structure-sheet"
      visible
      onClose={onClose}
      dismissable={!s.busy}
      title={governed ? t('structure.correctionTitle') : t('structure.editTitle')}
      subtitle={governed ? t('structure.governedHint') : t('structure.freeHint')}
      footer={
        <Button
          testID="structure-save"
          className="flex-1"
          label={governed ? t('structure.sendCorrection') : t('common.save')}
          loading={s.busy}
          onPress={() => (governed && !reason.trim() ? setErr(t('errors.required')) : void s.run(undefined))}
        />
      }
    >
      {governed ? (
        <Chips
          label={t('structure.action')}
          options={['RENAME', 'CHANGE_CONFIGURATION', 'ARCHIVE'].map((a) => ({ value: a, label: t(`structure.actions.${a}`) }))}
          value={action}
          allowDeselect={false}
          onChange={(v) => setAction(v as string)}
        />
      ) : null}
      {!governed || action === 'RENAME' ? <TextField label={t('tower.unitNumber')} value={number} onChangeText={setNumber} error={s.apiField('number')} /> : null}
      {!governed || action === 'CHANGE_CONFIGURATION' ? <Chips label={t('unitSurvey.configuration')} options={configurations} value={config} onChange={(v) => setConfig(v as string | null)} /> : null}
      {governed ? <TextField label={t('structure.reason')} required multiline value={reason} onChangeText={(v) => { setReason(v); setErr(undefined); }} error={err ?? s.apiField('reason')} /> : null}
      {s.banner(['number', 'configuration', 'reason']) ? <InlineBanner>{s.banner(['number', 'configuration', 'reason'])!}</InlineBanner> : null}
      {!governed ? (
        confirmDelete ? (
          <InlineBanner tone="error">
            <Button testID="unit-delete-confirm" size="sm" variant="danger" label={t('structure.confirmDelete', { unit: unit.number })} loading={delS.busy} onPress={() => void delS.run(undefined)} />
          </InlineBanner>
        ) : (
          <Button size="sm" variant="ghost" label={t('structure.delete')} onPress={() => setConfirmDelete(true)} />
        )
      ) : null}
      {delS.error ? <InlineBanner>{delS.banner([])!}</InlineBanner> : null}
    </BottomSheet>
  );
}

/** Opportunity → lead (data set 3). Uses one of the unit's contact slots, with consent. */
export function ConvertSheet({ opp, slots, onClose, onDone }: { opp: Opportunity; slots: Option[]; onClose: () => void; onDone: (r: { relationship_id: string | null; duplicate_review_id: string | null }) => void }) {
  const t = useT();
  const conv = useConvertOpportunity();
  const [slot, setSlot] = useState<string | null>(slots[0]?.value ?? null);
  const [consent, setConsent] = useState(false);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const s = useSubmit(async () => {
    const r = await conv.mutateAsync({ id: opp.id, body: { slot: slot as 'OWNER', consent_confirmed: consent, notes: notes.trim() || undefined } });
    onDone(r);
  }, onClose);
  const submit = () => {
    const e: Record<string, string> = {};
    if (!slot) e.slot = t('opps.needContact');
    if (!consent) e.consent = t('addLead.consentRequired');
    setErr(e);
    if (!Object.keys(e).length) void s.run(undefined);
  };
  return (
    <BottomSheet
      testID="convert-sheet"
      visible
      onClose={onClose}
      dismissable={!s.busy}
      title={t('opps.convertTitle')}
      subtitle={opp.unit_label}
      footer={<Button testID="convert-save" className="flex-1" label={t('opps.convert')} loading={s.busy} onPress={submit} />}
    >
      {slots.length ? (
        <Chips label={t('opps.whichContact')} options={slots} value={slot} allowDeselect={false} onChange={(v) => setSlot(v as string)} error={err.slot ?? s.apiField('slot')} />
      ) : (
        <InlineBanner tone="warn">{t('opps.noContacts')}</InlineBanner>
      )}
      <TextField label={t('addLead.notes')} multiline value={notes} onChangeText={setNotes} />
      <Checkbox checked={consent} onChange={setConsent} label={t('addLead.consent')} error={err.consent ?? s.apiField('consent_confirmed')} />
      {s.banner(['slot', 'consent_confirmed', 'notes']) ? <InlineBanner>{s.banner(['slot', 'consent_confirmed', 'notes'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}

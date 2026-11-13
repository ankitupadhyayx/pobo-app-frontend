import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { BottomSheet, Button, CallbackPicker, Checkbox, Chips, InlineBanner, Select, TextField, callbackError, emptyCallback, type CallbackValue, type Option, type ServiceHours } from '@/components/ui';
import { useSubmit } from '@/hooks/useSubmit';
import { useFormFocus } from '@/hooks/useFormFocus';
import { useT } from '@/i18n';
import type { MetaOption, SheetBaseProps } from './types';

export interface CallOutcomeValues {
  requirementId: string;
  outcome: string;
  notes: string;
  lostReason?: string;
  dncConfirmed: boolean;
  nextAction?: { type: string; dueAt: string; notes: string; afterHours?: { reason: string } };
  durationSeconds?: number;
}

interface Props extends SheetBaseProps<CallOutcomeValues> {
  customerName: string;
  requirements: Option[];
  defaultRequirementId?: string;
  /** CALL_OUTCOME master list with metadata: requires_next_action, dnc, closes_lost. */
  outcomes: MetaOption[];
  followUpTypes: Option[];
  lostReasons: Option[];
  durationSeconds?: number;
  serviceHours?: ServiceHours;
}

/** APP-13 outcome sheet. Opens automatically when the AA returns from the dialer. */
export function CallOutcomeSheet(p: Props) {
  return p.visible ? <CallOutcomeSheetBody {...p} /> : null;
}

function CallOutcomeSheetBody(p: Props) {
  const t = useT();
  const [reqId, setReqId] = useState<string | null>(p.defaultRequirementId ?? p.requirements[0]?.value ?? null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [lostReason, setLostReason] = useState<string | null>(null);
  const [dnc, setDnc] = useState(false);
  const [nextType, setNextType] = useState<string | null>(p.followUpTypes[0]?.value ?? null);
  const [next, setNext] = useState<CallbackValue>(emptyCallback);
  const nextAt = next.at;
  const [nextNotes, setNextNotes] = useState('');
  const [clientErr, setClientErr] = useState<Record<string, string>>({});
  const form = useFormFocus({ toast: false });
  const s = useSubmit(p.onSubmit, p.onClose, form);


  const meta = useMemo(() => p.outcomes.find((o) => o.value === outcome)?.meta ?? {}, [outcome, p.outcomes]);
  const isDnc = !!meta.dnc;
  const needsNext = !!meta.requires_next_action;
  const closesLost = !!meta.closes_lost;
  const showNext = !isDnc && !closesLost;

  const submit = () => {
    const e: Record<string, string> = {};
    if (!reqId) e.requirement = t('errors.required');
    if (!outcome) e.outcome = t('errors.required');
    if (isDnc && !dnc) e.dnc = t('call.dncConfirmRequired');
    if (closesLost && !lostReason && p.lostReasons.length) e.lost = t('errors.required');
    if (showNext) {
      const ne = callbackError(next, needsNext, p.serviceHours);
      if (ne) e.nextAt = ne === 'errors.required' ? t('call.nextActionRequired') : t(ne);
    }
    setClientErr(e);
    if (Object.keys(e).length) return void form.fail(e);
    form.clear();
    void s.run({
      requirementId: reqId!,
      outcome: outcome!,
      notes: notes.trim(),
      lostReason: closesLost ? lostReason ?? undefined : undefined,
      dncConfirmed: dnc,
      nextAction: showNext && nextAt && nextType ? { type: nextType, dueAt: nextAt.toISOString(), notes: nextNotes.trim(), afterHours: next.afterHours ? { reason: next.reason.trim() } : undefined } : undefined,
      durationSeconds: p.durationSeconds,
    });
  };

  const shown = ['requirement', 'outcome', 'notes', 'lost_reason', 'dnc_confirmed', 'next_action', 'next_action.due_at', 'due_at', 'type'];

  return (
    <BottomSheet
      form={form}
      testID="call-outcome-sheet"
      visible
      onClose={p.onClose}
      dismissable={!s.busy}
      title={t('call.outcomeTitle')}
      subtitle={p.customerName}
      footer={
        <>
          <Button variant="secondary" label={t('call.skip')} onPress={p.onClose} disabled={s.busy} />
          <Button testID="call-outcome-save" className="flex-1" label={t('call.save')} variant={isDnc ? 'danger' : 'primary'} loading={s.busy} onPress={submit} />
        </>
      }
    >
      {p.requirements.length > 1 ? (
        <Chips
          label={t('call.requirement')}
          options={p.requirements}
          value={reqId}
          onChange={(v) => setReqId(v as string)}
          allowDeselect={false}
          error={clientErr.requirement ?? s.apiField('requirement', 'requirement_id')}
        />
      ) : null}
      <Chips
        testIDPrefix="outcome"
        label={t('call.outcome')}
        required
        options={p.outcomes}
        value={outcome}
        onChange={(v) => {
          setOutcome(v as string | null);
          setClientErr({});
        }}
        error={clientErr.outcome ?? s.apiField('outcome')}
      />
      {isDnc ? (
        <Checkbox testID="call-dnc-confirm" tone="danger" checked={dnc} onChange={setDnc} label={t('call.dncConfirm')} error={clientErr.dnc ?? s.apiField('dnc_confirmed', 'confirm_dnc')} />
      ) : null}
      {closesLost && p.lostReasons.length ? (
        <Select label={t('call.lostReason')} options={p.lostReasons} value={lostReason} onChange={setLostReason} required error={clientErr.lost ?? s.apiField('lost_reason')} />
      ) : null}
      <TextField
        label={t('call.notes')}
        placeholder={t('call.notesPlaceholder')}
        value={notes}
        onChangeText={setNotes}
        multiline
        error={s.apiField('notes')}
      />
      {showNext ? (
        <>
          <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            {t('call.nextAction')}
            {needsNext ? <Text className="text-rose-600"> *</Text> : null}
          </Text>
          <Chips label={t('call.nextType')} options={p.followUpTypes} value={nextType} onChange={(v) => setNextType(v as string)} allowDeselect={false} />
          <CallbackPicker
            testID="call-next-at"
            label={t('call.nextAt')}
            value={next}
            onChange={setNext}
            hours={p.serviceHours}
            required={needsNext}
            error={clientErr.nextAt ?? s.apiField('due_at', 'next_action.due_at', 'next_action')}
          />
          <TextField label={t('followUp.notes')} value={nextNotes} onChangeText={setNextNotes} />
        </>
      ) : null}
      {s.banner(shown) ? <InlineBanner>{s.banner(shown)!}</InlineBanner> : null}
    </BottomSheet>
  );
}

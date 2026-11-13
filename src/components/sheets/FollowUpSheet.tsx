import { useState } from 'react';
import { BottomSheet, Button, CallbackPicker, Chips, InlineBanner, TextField, callbackError, emptyCallback, type CallbackValue, type Option, type ServiceHours } from '@/components/ui';
import { useSubmit } from '@/hooks/useSubmit';
import { useFormFocus } from '@/hooks/useFormFocus';
import { useT } from '@/i18n';
import type { SheetBaseProps } from './types';

export interface FollowUpValues {
  requirementId: string;
  type: string;
  dueAt: string;
  notes: string;
  /** FB-10: set when the customer asked for a time after service hours. */
  afterHours?: { reason: string };
}

interface Props extends SheetBaseProps<FollowUpValues> {
  customerName: string;
  requirements: Option[];
  defaultRequirementId?: string;
  types: Option[];
  serviceHours?: ServiceHours;
}

/** APP-14 schedule a follow-up on one requirement. */
export function FollowUpSheet(p: Props) {
  return p.visible ? <FollowUpSheetBody {...p} /> : null;
}

function FollowUpSheetBody(p: Props) {
  const t = useT();
  const [reqId, setReqId] = useState<string | null>(p.defaultRequirementId ?? p.requirements[0]?.value ?? null);
  const [type, setType] = useState<string | null>(p.types[0]?.value ?? null);
  const [due, setDue] = useState<CallbackValue>(emptyCallback);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const form = useFormFocus({ toast: false });
  const s = useSubmit(p.onSubmit, p.onClose, form);


  const submit = () => {
    const e: Record<string, string> = {};
    if (!reqId) e.req = t('errors.required');
    if (!type) e.type = t('errors.required');
    const de = callbackError(due, true, p.serviceHours);
    if (de) e.due = t(de);
    setErr(e);
    if (Object.keys(e).length) return void form.fail(e);
    form.clear();
    void s.run({ requirementId: reqId!, type: type!, dueAt: due.at!.toISOString(), notes: notes.trim(), afterHours: due.afterHours ? { reason: due.reason.trim() } : undefined });
  };
  const shown = ['requirement', 'type', 'due_at', 'notes'];
  return (
    <BottomSheet
      form={form}
      testID="followup-sheet"
      visible
      onClose={p.onClose}
      dismissable={!s.busy}
      title={t('followUp.title')}
      subtitle={p.customerName}
      footer={<Button testID="followup-save" className="flex-1" label={t('followUp.save')} loading={s.busy} onPress={submit} />}
    >
      {p.requirements.length > 1 ? (
        <Chips label={t('call.requirement')} options={p.requirements} value={reqId} onChange={(v) => setReqId(v as string)} allowDeselect={false} error={err.req ?? s.apiField('requirement')} />
      ) : null}
      <Chips label={t('followUp.type')} required options={p.types} value={type} onChange={(v) => setType(v as string)} allowDeselect={false} error={err.type ?? s.apiField('type')} />
      <CallbackPicker testID="followup-due" label={t('followUp.dueAt')} required value={due} onChange={setDue} hours={p.serviceHours} error={err.due ?? s.apiField('due_at', 'after_hours', 'after_hours_reason')} />
      <TextField label={t('followUp.notes')} value={notes} onChangeText={setNotes} multiline error={s.apiField('notes')} />
      {s.banner(shown) ? <InlineBanner>{s.banner(shown)!}</InlineBanner> : null}
    </BottomSheet>
  );
}

export interface CompleteValues {
  outcome: string;
  notes: string;
}

interface CompleteProps extends SheetBaseProps<CompleteValues> {
  title?: string;
  subtitle?: string;
  outcomes: Option[];
}

/** APP-14 complete a follow-up with an outcome. */
export function CompleteFollowUpSheet(p: CompleteProps) {
  return p.visible ? <CompleteFollowUpSheetBody {...p} /> : null;
}

function CompleteFollowUpSheetBody(p: CompleteProps) {
  const t = useT();
  const [outcome, setOutcome] = useState<string | null>(p.outcomes[0]?.value ?? null);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | undefined>();
  const form = useFormFocus({ toast: false });
  const s = useSubmit(p.onSubmit, p.onClose, form);
  return (
    <BottomSheet
      form={form}
      testID="complete-sheet"
      visible
      onClose={p.onClose}
      dismissable={!s.busy}
      title={p.title ?? t('followUp.completeTitle')}
      subtitle={p.subtitle}
      footer={
        <Button
          testID="complete-save"
          className="flex-1"
          label={t('followUp.completeSave')}
          loading={s.busy}
          onPress={() => {
            if (!outcome) {
              setErr(t('errors.required'));
              form.fail({ outcome: 'x' });
              return;
            }
            void s.run({ outcome, notes: notes.trim() });
          }}
        />
      }
    >
      <Chips label={t('followUp.outcome')} required options={p.outcomes} value={outcome} onChange={(v) => setOutcome(v as string)} allowDeselect={false} error={err ?? s.apiField('outcome')} />
      <TextField label={t('call.notes')} value={notes} onChangeText={setNotes} multiline error={s.apiField('notes', 'completion_notes')} />
      {s.banner(['outcome', 'notes', 'completion_notes']) ? <InlineBanner>{s.banner(['outcome', 'notes', 'completion_notes'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}

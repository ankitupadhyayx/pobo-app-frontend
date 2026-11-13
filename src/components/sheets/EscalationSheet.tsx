import { useState } from 'react';
import { BottomSheet, Button, Chips, InlineBanner, Select, TextField, type Option } from '@/components/ui';
import { useSubmit } from '@/hooks/useSubmit';
import { useFormFocus } from '@/hooks/useFormFocus';
import { useT } from '@/i18n';
import type { SheetBaseProps } from './types';

export interface EscalationValues {
  category: string;
  priority: string;
  notes: string;
  requirementId?: string;
}

interface Props extends SheetBaseProps<EscalationValues> {
  customerName?: string;
  categories: Option[];
  priorities: Option[];
  requirements: Option[];
  defaultRequirementId?: string;
}

/** APP-16 escalate to supervisor. */
export function EscalationSheet(p: Props) {
  return p.visible ? <EscalationSheetBody {...p} /> : null;
}

function EscalationSheetBody(p: Props) {
  const t = useT();
  const [category, setCategory] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(p.priorities[0]?.value ?? null);
  const [reqId, setReqId] = useState<string | null>(p.defaultRequirementId ?? p.requirements[0]?.value ?? null);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const form = useFormFocus({ toast: false });
  const s = useSubmit(p.onSubmit, p.onClose, form);
  const submit = () => {
    const e: Record<string, string> = {};
    if (!category) e.category = t('errors.required');
    if (!notes.trim()) e.notes = t('errors.required');
    setErr(e);
    if (Object.keys(e).length) return void form.fail(e);
    form.clear();
    void s.run({ category: category!, priority: priority ?? 'NORMAL', notes: notes.trim(), requirementId: reqId ?? undefined });
  };
  const shown = ['category', 'priority', 'notes', 'requirement'];
  return (
    <BottomSheet
      form={form}
      testID="escalation-sheet"
      visible
      onClose={p.onClose}
      dismissable={!s.busy}
      title={t('escalation.title')}
      subtitle={p.customerName}
      footer={<Button testID="escalation-submit" className="flex-1" variant="danger" label={t('escalation.submit')} loading={s.busy} onPress={submit} />}
    >
      <Select label={t('escalation.category')} required options={p.categories} value={category} onChange={setCategory} error={err.category ?? s.apiField('category')} />
      {p.priorities.length ? (
        <Chips label={t('escalation.priority')} options={p.priorities} value={priority} onChange={(v) => setPriority(v as string)} allowDeselect={false} error={s.apiField('priority')} />
      ) : null}
      {p.requirements.length > 1 ? (
        <Chips label={t('call.requirement')} options={p.requirements} value={reqId} onChange={(v) => setReqId(v as string)} error={s.apiField('requirement')} />
      ) : null}
      <TextField label={t('escalation.description')} required value={notes} onChangeText={setNotes} multiline error={err.notes ?? s.apiField('notes')} />
      {s.banner(shown) ? <InlineBanner>{s.banner(shown)!}</InlineBanner> : null}
    </BottomSheet>
  );
}

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BottomSheet, Button, Chips, InlineBanner, Select, TextField, type Option } from '@/components/ui';
import { useSubmit } from '@/hooks/useSubmit';
import { useFormFocus } from '@/hooks/useFormFocus';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n';
import type { SheetBaseProps } from './types';

export type TransferKind = 'REQUIREMENT' | 'RELATIONSHIP';

export interface TransferValues {
  kind: TransferKind;
  requirementId?: string;
  reason: string;
  destinationArea: string;
  note: string;
}

interface Props extends SheetBaseProps<TransferValues> {
  customerName: string;
  initialKind?: TransferKind;
  /** Requirements this AA services (only those can be requirement-transferred). */
  requirements: Option[];
  defaultRequirementId?: string;
  reasons: Option[];
  /** Relationship transfer only allowed for the Relationship Owner. */
  canTransferRelationship: boolean;
}

function KindCard({ value, title, hint, disabled, current, onSelect }: { value: TransferKind; title: string; hint: string; disabled?: boolean; current: TransferKind; onSelect: (k: TransferKind) => void }) {
  const on = current === value;
  return (
    <Pressable
      testID={`transfer-kind-${value}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled }}
      disabled={disabled}
      onPress={() => onSelect(value)}
      className={cn('rounded-2xl border p-3', on ? 'border-teal-600 bg-teal-50' : 'border-slate-200 bg-white', disabled && 'opacity-40')}
    >
      <Text className={cn('text-sm font-bold', on ? 'text-teal-900' : 'text-slate-800')}>{title}</Text>
      <Text className="mt-0.5 text-xs text-slate-600">{hint}</Text>
    </Pressable>
  );
}

/** APP-15: requirement transfer vs relationship transfer, explained in plain words (blueprint §5.2). */
export function TransferSheet(p: Props) {
  return p.visible ? <TransferSheetBody {...p} /> : null;
}

function TransferSheetBody(p: Props) {
  const t = useT();
  const [kind, setKind] = useState<TransferKind>(p.initialKind === 'RELATIONSHIP' && p.canTransferRelationship ? 'RELATIONSHIP' : 'REQUIREMENT');
  const [reqId, setReqId] = useState<string | null>(p.defaultRequirementId ?? p.requirements[0]?.value ?? null);
  const [reason, setReason] = useState<string | null>(null);
  const [area, setArea] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const form = useFormFocus({ toast: false });
  const s = useSubmit(p.onSubmit, p.onClose, form);


  const submit = () => {
    const e: Record<string, string> = {};
    if (kind === 'REQUIREMENT' && !reqId) e.req = t('errors.required');
    if (!reason) e.reason = t('errors.required');
    setErr(e);
    if (Object.keys(e).length) return void form.fail(e);
    form.clear();
    void s.run({ kind, requirementId: kind === 'REQUIREMENT' ? reqId! : undefined, reason: reason!, destinationArea: area.trim(), note: note.trim() });
  };


  const shown = ['type', 'requirement', 'reason', 'destination_area', 'note'];
  return (
    <BottomSheet
      form={form}
      testID="transfer-sheet"
      visible
      onClose={p.onClose}
      dismissable={!s.busy}
      title={t('transfer.title')}
      subtitle={p.customerName}
      footer={<Button testID="transfer-submit" className="flex-1" label={t('transfer.submit')} loading={s.busy} onPress={submit} />}
    >
      <View className="gap-2">
        <Text className="text-xs font-bold text-slate-700">{t('transfer.kind')}</Text>
        <KindCard current={kind} onSelect={setKind} value="REQUIREMENT" title={t('transfer.requirement')} hint={t('transfer.requirementHint')} disabled={!p.requirements.length} />
        <KindCard current={kind} onSelect={setKind} value="RELATIONSHIP" title={t('transfer.relationship')} hint={t('transfer.relationshipHint')} disabled={!p.canTransferRelationship} />
      </View>
      {kind === 'REQUIREMENT' && p.requirements.length > 1 ? (
        <Chips label={t('transfer.pickRequirement')} options={p.requirements} value={reqId} onChange={(v) => setReqId(v as string)} allowDeselect={false} error={err.req ?? s.apiField('requirement')} />
      ) : null}
      <Select label={t('transfer.reason')} required options={p.reasons} value={reason} onChange={setReason} error={err.reason ?? s.apiField('reason')} />
      <TextField label={t('transfer.destination')} placeholder="e.g. Sector 150" value={area} onChangeText={setArea} error={s.apiField('destination_area')} />
      <TextField label={t('transfer.notes')} value={note} onChangeText={setNote} multiline error={s.apiField('note')} />
      {s.banner(shown) ? <InlineBanner>{s.banner(shown)!}</InlineBanner> : null}
    </BottomSheet>
  );
}

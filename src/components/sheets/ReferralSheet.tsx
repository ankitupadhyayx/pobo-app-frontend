import { useState } from 'react';
import { Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { BottomSheet, Button, Checkbox, Chips, InlineBanner, TextField, type Option } from '@/components/ui';
import { AssignmentResult } from '@/components/leadForm/AssignmentResult';
import type { Referral } from '@/api/types';
import { useSubmit } from '@/hooks/useSubmit';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';
import type { SheetBaseProps } from './types';

export interface ReferralValues {
  name: string;
  phone: string;
  types: string[];
  configuration: string | null;
  location: string;
  relation: string | null;
  callback: string | null;
  notes: string;
  consent: boolean;
}

interface Props extends Omit<SheetBaseProps<ReferralValues>, 'onSubmit'> {
  onSubmit: (values: ReferralValues) => Promise<Referral>;
  types: Option[];
  configurations: Option[];
  relations: Option[];
  callbacks: Option[];
  typeLabel: (type: string) => string;
}

const PHONE_RE = /^[6-9]\d{9}$/;

/** APP-16 refer an opportunity (source credit; servicing comes from the assignment engine). */
export function ReferralSheet(p: Props) {
  return p.visible ? <ReferralSheetBody {...p} /> : null;
}

function ReferralSheetBody(p: Props) {
  const t = useT();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [configuration, setConfiguration] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [relation, setRelation] = useState<string | null>(null);
  const [callback, setCallback] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Referral | null>(null);
  const s = useSubmit(async (v: ReferralValues) => setResult(await p.onSubmit(v)));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('errors.required');
    if (!PHONE_RE.test(phone)) e.phone = t('errors.phone');
    if (!types.length) e.types = t('addLead.intentRequired');
    if (!location.trim()) e.location = t('errors.required');
    if (!consent) e.consent = t('addLead.consentRequired');
    setErr(e);
    if (Object.keys(e).length) return;
    void s.run({ name: name.trim(), phone, types, configuration, location: location.trim(), relation, callback, notes: notes.trim(), consent });
  };

  if (result) {
    const review = result.status === 'DUPLICATE_REVIEW';
    return (
      <BottomSheet
        testID="referral-sheet"
        visible
        onClose={p.onClose}
        title={t('referral.title')}
        footer={<Button testID="referral-done" className="flex-1" label={t('referral.done')} onPress={p.onClose} />}
      >
        <AssignmentResult
          title={review ? t('referral.reviewTitle') : t('referral.successTitle')}
          body={review ? t('referral.reviewBody', { name: result.referred_name }) : t('referral.successBody', { name: result.referred_name })}
          rows={result.requirements.map((r) => ({
            id: r.id,
            type: r.type,
            typeLabel: p.typeLabel(r.type),
            assignmentState: r.assignment_state,
            servicingName: r.servicing_aa_name,
            isMine: false,
            reason: r.assignment_reason,
          }))}
        />
      </BottomSheet>
    );
  }

  const shown = ['name', 'phone', 'types', 'requirements', 'configuration', 'locality_name', 'referrer_relation', 'preferred_callback', 'notes', 'consent', 'consent_confirmed'];
  return (
    <BottomSheet
      testID="referral-sheet"
      visible
      onClose={p.onClose}
      dismissable={!s.busy}
      title={t('referral.title')}
      subtitle={t('referral.subtitle')}
      footer={<Button testID="referral-submit" className="flex-1" label={t('referral.submit')} loading={s.busy} onPress={submit} />}
    >
      <View className="flex-row items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
        <ShieldCheck size={16} color={colors.info} />
        <Text className="flex-1 text-xs leading-4 text-blue-950">{t('referral.protection')}</Text>
      </View>
      <TextField testID="referral-name" label={t('referral.name')} required value={name} onChangeText={setName} autoCapitalize="words" error={err.name ?? s.apiField('name')} />
      <TextField
        testID="referral-phone"
        label={t('referral.phone')}
        required
        prefix="+91"
        keyboardType="number-pad"
        maxLength={10}
        value={phone}
        onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
        error={err.phone ?? s.apiField('phone')}
      />
      <Chips testIDPrefix="referral-type" label={t('referral.types')} required multiple options={p.types} value={types} onChange={(v) => setTypes((v as string[]) ?? [])} error={err.types ?? s.apiField('requirements')} />
      <Chips testIDPrefix="referral-config" label={t('referral.configuration')} options={p.configurations} value={configuration} onChange={(v) => setConfiguration((v as string | null) ?? null)} error={s.apiField('configuration')} />
      <TextField
        testID="referral-location"
        label={t('referral.location')}
        required
        hint={t('referral.locationHint')}
        value={location}
        onChangeText={setLocation}
        error={err.location ?? s.apiField('locality_name')}
      />
      <Chips testIDPrefix="referral-relation" label={t('referral.relation')} options={p.relations} value={relation} onChange={(v) => setRelation((v as string | null) ?? null)} error={s.apiField('referrer_relation')} />
      <Chips testIDPrefix="referral-callback" label={t('addLead.callback')} options={p.callbacks} value={callback} onChange={(v) => setCallback((v as string | null) ?? null)} error={s.apiField('preferred_callback')} />
      <TextField label={t('referral.notes')} value={notes} onChangeText={setNotes} multiline error={s.apiField('notes')} />
      <Checkbox testID="referral-consent" checked={consent} onChange={setConsent} label={t('referral.consent')} error={err.consent ?? s.apiField('consent_confirmed')} />
      {s.banner(shown) ? <InlineBanner>{s.banner(shown)!}</InlineBanner> : null}
    </BottomSheet>
  );
}

import { Switch, Text, View } from 'react-native';
import { Phone, User, UserCheck, Users } from 'lucide-react-native';
import { Chips, TextField, type Option } from '@/components/ui';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';
import { type SlotDraft, type SlotKey } from './forms';

export type { SlotDraft, SlotKey } from './forms';
export { emptySlot } from './forms';

const ICON = { OWNER: UserCheck, ADDITIONAL: Users, TENANT: User };

/**
 * One of the three fixed contact slots on a unit (Owner / Additional / Tenant). Contact is only
 * recorded with the person's permission; call/WhatsApp permissions are explicit toggles.
 */
export function ContactSlotEditor({ slot, value, onChange, sources, errors }: { slot: SlotKey; value: SlotDraft; onChange: (v: SlotDraft) => void; sources: Option[]; errors?: Record<string, string | undefined> }) {
  const t = useT();
  const Icon = ICON[slot];
  const set = <K extends keyof SlotDraft>(k: K, v: SlotDraft[K]) => onChange({ ...value, [k]: v });
  const hasPhone = value.phone.length > 0;
  return (
    <View testID={`slot-${slot}`} className="gap-2.5 rounded-2xl border border-slate-200 bg-white p-3">
      <View className="flex-row items-center gap-2">
        <Icon size={16} color={colors.brandDark} />
        <Text className="text-sm font-bold text-slate-900">{t(`unitSurvey.slot.${slot}`)}</Text>
      </View>
      <TextField label={t('unitSurvey.contactName')} value={value.name} onChangeText={(v) => set('name', v)} autoCapitalize="words" error={errors?.name} />
      <TextField
        label={t('unitSurvey.contactPhone')}
        prefix="+91"
        keyboardType="number-pad"
        maxLength={10}
        value={value.phone}
        onChangeText={(v) => set('phone', v.replace(/\D/g, '').slice(0, 10))}
        error={errors?.phone}
      />
      {slot === 'ADDITIONAL' ? <TextField label={t('unitSurvey.relation')} placeholder={t('unitSurvey.relationHint')} value={value.relation} onChangeText={(v) => set('relation', v)} /> : null}
      {hasPhone ? (
        <View className="gap-2 rounded-xl bg-slate-50 p-2.5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Phone size={13} color={colors.slate600} />
              <Text className="text-xs font-semibold text-slate-700">{t('unitSurvey.callAllowed')}</Text>
            </View>
            <Switch value={value.call_allowed} onValueChange={(v) => set('call_allowed', v)} trackColor={{ true: colors.ok, false: colors.line }} />
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-slate-700">{t('unitSurvey.whatsappAllowed')}</Text>
            <Switch value={value.whatsapp_allowed} onValueChange={(v) => set('whatsapp_allowed', v)} trackColor={{ true: colors.ok, false: colors.line }} />
          </View>
          <Text className="text-[10px] text-slate-500">{t('unitSurvey.permissionHint')}</Text>
        </View>
      ) : null}
      {value.name || hasPhone ? <Chips label={t('unitSurvey.source')} options={sources} value={value.source} onChange={(v) => set('source', v as string | null)} /> : null}
    </View>
  );
}

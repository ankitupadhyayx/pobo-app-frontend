import { Text, View } from 'react-native';
import { Button, Chips, DateTimeField, MoneyField, TextField, type Option } from '@/components/ui';
import { ContactSlotEditor, type SlotKey } from './ContactSlotEditor';
import type { SurveyDraft } from './forms';
import { useT } from '@/i18n';

export interface SurveyOptions {
  occupancy: Option[];
  doorstepOutcomes: Option[];
  dataSources: Option[];
  verification: Option[];
  intents: Option[];
  timelines: Option[];
  configurations: Option[];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{title}</Text>
      {children}
    </View>
  );
}

/** APP-23 data set 1: survey snapshot + the three contact slots. */
/** FB-15: a unit owner's property intent is about THIS flat only; buying/renting another home is a lead. */
export const OWNER_INTENT_EXCLUDED = ['BUY', 'RENT'];
export const ownerIntents = (opts: Option[]) => opts.filter((o) => !OWNER_INTENT_EXCLUDED.includes(o.value));

export function SurveyFormBody({ value, onChange, options, errors, onAddLead }: { value: SurveyDraft; onChange: (d: SurveyDraft) => void; options: SurveyOptions; errors: Record<string, string>; onAddLead?: () => void }) {
  const t = useT();
  const set = <K extends keyof SurveyDraft>(k: K, v: SurveyDraft[K]) => onChange({ ...value, [k]: v });
  const tenant = value.occupancy === 'TENANT_OCCUPIED';
  const slots: SlotKey[] = ['OWNER', 'ADDITIONAL', 'TENANT'];
  return (
    <View className="gap-4">
      <Section title={t('unitSurvey.sectionDoorstep')}>
        <Chips testIDPrefix="occupancy" label={t('unitSurvey.occupancy')} required options={options.occupancy} value={value.occupancy} onChange={(v) => set('occupancy', v as string | null)} error={errors.occupancy} />
        <Chips label={t('unitSurvey.doorstep')} options={options.doorstepOutcomes} value={value.doorstep_outcome} onChange={(v) => set('doorstep_outcome', v as string | null)} />
        <Chips label={t('unitSurvey.configuration')} options={options.configurations} value={value.configuration} onChange={(v) => set('configuration', v as string | null)} />
        <Chips label={t('unitSurvey.dataSource')} options={options.dataSources} value={value.data_source} onChange={(v) => set('data_source', v as string | null)} />
        <Chips label={t('unitSurvey.verification')} options={options.verification} value={value.verification} onChange={(v) => set('verification', v as string | null)} />
      </Section>

      <Section title={t('unitSurvey.sectionIntent')}>
        <Chips testIDPrefix="owner-intent" label={t('unitSurvey.intent')} options={ownerIntents(options.intents)} value={value.intent} onChange={(v) => set('intent', v as string | null)} />
        {value.intent === 'SELL' || value.intent === 'RENT_OUT' ? <Chips label={t('unitSurvey.timeline')} options={options.timelines} value={value.intent_timeline} onChange={(v) => set('intent_timeline', v as string | null)} /> : null}
        <Text className="text-[11px] text-slate-500">{t('unitSurvey.intentHint')}</Text>
        <View className="flex-row flex-wrap items-center gap-2 rounded-xl bg-teal-50 p-2.5">
          <Text className="flex-1 text-xs text-teal-900">{t('unitSurvey.buyRentHint')}</Text>
          {onAddLead ? <Button testID="survey-add-lead" size="sm" variant="ghost" label={t('home.addLead')} onPress={onAddLead} /> : null}
        </View>
      </Section>

      {tenant ? (
        <Section title={t('unitSurvey.sectionTenancy')}>
          <DateTimeField mode="date" label={t('unitSurvey.leaseEnd')} value={value.lease_end ? new Date(`${value.lease_end}T00:00:00`) : null} onChange={(d) => set('lease_end', d.toISOString().slice(0, 10))} />
          <MoneyField label={t('unitSurvey.monthlyRent')} value={value.monthly_rent} onChangeText={(v) => set('monthly_rent', v)} error={errors.monthly_rent} />
          <Text className="text-[11px] text-slate-500">{t('unitSurvey.tenancyHint')}</Text>
        </Section>
      ) : null}

      <Section title={t('unitSurvey.sectionContacts')}>
        {slots.map((slot) => (
          <ContactSlotEditor
            key={slot}
            slot={slot}
            value={value.contacts[slot]}
            sources={options.dataSources}
            onChange={(c) => onChange({ ...value, contacts: { ...value.contacts, [slot]: c } })}
            errors={{ phone: errors[`${slot}.phone`] }}
          />
        ))}
      </Section>

      <Section title={t('unitSurvey.notes')}>
        <TextField multiline placeholder={t('unitSurvey.notesHint')} value={value.notes} onChangeText={(v) => set('notes', v)} />
      </Section>
    </View>
  );
}

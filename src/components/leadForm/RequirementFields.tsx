import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { Checkbox, Chips, IntentTag, LocationField, MoneyField, TextField, type Option } from '@/components/ui';
import { colors } from '@/theme/colors';
import { LocalityPicker } from './LocalityPicker';
import { SocietyPicker } from './SocietyPicker';
import { useT } from '@/i18n';
import { FieldAnchor, type FormFocus } from '@/hooks/useFormFocus';
import { fieldsFor, requiredFields, type RequirementDraft } from './types';

interface Props {
  draft: RequirementDraft;
  typeLabel: string;
  onChange: (next: RequirementDraft) => void;
  configurations: Option[];
  timelines: Option[];
  /** Society search/picker (needs the API); receives current draft + setter. */
  renderSociety: (draft: RequirementDraft, onChange: (d: RequirementDraft) => void, error?: string) => ReactNode;
  error: (field: string) => string | undefined;
  /** R2-8: anchors are named `${anchorPrefix}${field}` so a failed save scrolls here. */
  form?: FormFocus;
  anchorPrefix?: string;
  /** R3-2: a SELL/RENT OUT with a property added doesn't need the configuration. */
  hasProperty?: boolean;
}

/** One requirement card's inputs; which ones show depends on the type (progressive disclosure). */
export function RequirementFields({ draft, typeLabel, onChange, configurations, timelines, renderSociety, error, form, anchorPrefix = '', hasProperty }: Props) {
  const t = useT();
  const f = fieldsFor(draft.type);
  const req = new Set<string>(requiredFields(draft.type, { hasProperty }));
  const set = <K extends keyof RequirementDraft>(k: K, v: RequirementDraft[K]) => onChange({ ...draft, [k]: v });
  const money = (k: keyof RequirementDraft) => (v: string) => set(k, v.replace(/[^\d]/g, '') as never);
  // A plain function (not a component defined in render) so inputs keep focus across renders.
  const a = (name: string, node: ReactNode) => (form ? <FieldAnchor form={form} name={`${anchorPrefix}${name}`}>{node}</FieldAnchor> : node);

  return (
    <View testID={`req-fields-${draft.type}`} className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <View className="flex-row items-center gap-2">
        <IntentTag type={draft.type} label={typeLabel} />
        <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('addLead.section', { label: typeLabel })}</Text>
      </View>

      {f.configuration
        ? a('configuration', <Chips label={t('addLead.configuration')} required={req.has('configuration')} options={configurations} value={draft.configuration} onChange={(v) => set('configuration', v as string | null)} error={error('configuration')} />)
        : null}

      {f.location ? (
        <>
          {a(
            'locality',
            <LocalityPicker testID={`req-${draft.type}-locality`} label={t('addLead.propertySector')} required={req.has('locality')} hint={req.has('locality') ? t('draftReq.locationHint') : undefined} value={draft.locality} onChange={(v) => set('locality', v)} error={error('locality')} />,
          )}
          {a('society', renderSociety(draft, onChange, error('society')))}
          {draft.societyId || draft.societyName.trim()
            ? a(
                'towerName|flatNumber',
                <View className="flex-row gap-2">
                  <TextField containerClassName="flex-1" label={t('addLead.tower')} placeholder="T2" value={draft.towerName} onChangeText={(v) => set('towerName', v)} error={error('towerName')} />
                  <TextField containerClassName="flex-1" label={t('addLead.flat')} placeholder="1204" value={draft.flatNumber} onChangeText={(v) => set('flatNumber', v)} error={error('flatNumber')} />
                </View>,
              )
            : null}
          {a(
            'location',
            <LocationField
              testID={`req-${draft.type}-location`}
              value={draft.location}
              onChange={(v) => set('location', v)}
              areaHint={[draft.societyName, draft.locality.items[0]?.name, 'Noida'].filter(Boolean).join(', ')}
              error={error('location')}
            />,
          )}
          <Text className="text-[11px] text-slate-500">{t('addLead.propertyLater')}</Text>
        </>
      ) : null}

      {f.preferredAreas ? (
        <>
          <Checkbox testID={`req-${draft.type}-area-open`} checked={draft.areaOpen} onChange={(v) => set('areaOpen', v)} label={t('addLead.areaOpen')} />
          {draft.areaOpen ? (
            <Text className="text-[11px] text-slate-500">{t('addLead.areaOpenHint')}</Text>
          ) : (
            <>
              {a(
                'preferredLocalities',
                <LocalityPicker
                  testID={`req-${draft.type}-pref`}
                  multiple
                  required={req.has('preferredLocalities')}
                  label={t('addLead.preferredSectors')}
                  hint={t('addLead.preferredSectorsHint')}
                  value={draft.preferredLocalities}
                  onChange={(v) => set('preferredLocalities', v)}
                  error={error('preferredLocalities')}
                />,
              )}
              {a(
                'preferredSocieties',
                <View className="gap-1.5">
                  {draft.preferredSocieties.length ? (
                    <View className="flex-row flex-wrap gap-1.5">
                      {draft.preferredSocieties.map((x) => (
                        <Pressable
                          key={x.id}
                          testID={`req-${draft.type}-pref-society-${x.id}`}
                          accessibilityRole="button"
                          accessibilityLabel={t('locality.remove', { name: x.name })}
                          onPress={() => set('preferredSocieties', draft.preferredSocieties.filter((y) => y.id !== x.id))}
                          className="flex-row items-center gap-1 rounded-full border border-slate-300 bg-slate-50 py-1 pl-2.5 pr-2"
                        >
                          <Text className="text-xs font-bold text-slate-800">{x.name}</Text>
                          <X size={12} color={colors.muted} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  <SocietyPicker
                    testID={`req-${draft.type}-pref-society`}
                    label={t('addLead.preferredSocieties')}
                    value={null}
                    onChange={(x) => (x && !draft.preferredSocieties.some((y) => y.id === x.id) ? set('preferredSocieties', [...draft.preferredSocieties, { id: x.id, name: x.name }]) : undefined)}
                  />
                </View>,
              )}
              {!draft.preferredLocalities.items.length && !draft.preferredLocalities.other.trim() && !draft.preferredSocieties.length ? (
                <Text testID={`req-${draft.type}-no-location`} className="text-[11px] font-semibold text-amber-700">{t('addLead.noLocationYet')}</Text>
              ) : null}
            </>
          )}
        </>
      ) : null}

      {f.budget ? a('budgetMin|budgetMax',
        <View className="flex-row gap-2">
          <MoneyField containerClassName="flex-1" label={t('addLead.budgetMin')} required={req.has('budgetMin')} value={draft.budgetMin} onChangeText={money('budgetMin')} error={error('budgetMin')} />
          <MoneyField containerClassName="flex-1" label={t('addLead.budgetMax')} value={draft.budgetMax} onChangeText={money('budgetMax')} error={error('budgetMax')} />
        </View>,
      ) : null}
      {f.expectedPrice ? a('expectedPrice',
        <MoneyField label={t('addLead.expectedPrice')} required={req.has('expectedPrice')} value={draft.expectedPrice} onChangeText={money('expectedPrice')} error={error('expectedPrice')} />,
      ) : null}
      {f.expectedRent || f.leaseTerm ? a('expectedRent|leaseTermMonths',
        <View className="flex-row gap-2">
          <MoneyField containerClassName="flex-1" label={t('addLead.expectedRent')} required={req.has('expectedRent')} value={draft.expectedRent} onChangeText={money('expectedRent')} error={error('expectedRent')} />
          <TextField containerClassName="flex-1" label={t('addLead.leaseTerm')} keyboardType="number-pad" value={draft.leaseTermMonths} onChangeText={money('leaseTermMonths')} error={error('leaseTermMonths')} />
        </View>,
      ) : null}

      <Chips label={t('addLead.timeline')} options={timelines} value={draft.timeline} onChange={(v) => set('timeline', v as string | null)} error={error('timeline')} />
      <TextField label={t('addLead.notes')} multiline value={draft.notes} onChangeText={(v) => set('notes', v)} error={error('notes')} />
    </View>
  );
}

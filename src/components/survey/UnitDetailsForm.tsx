import { Text, View } from 'react-native';
import { Chips, NotSure, TextField, toggleIn, type Option } from '@/components/ui';
import type { DetailsDraft } from './forms';
import { useT } from '@/i18n';

export interface DetailsOptions {
  kitchenSizes: Option[];
  facing: Option[];
  furnishing: Option[];
  parking: Option[];
}

/** APP-23 data set 2: optional unit details, filled progressively. */
export function UnitDetailsForm({ value, onChange, options, unsure, onUnsure, pending }: { value: DetailsDraft; onChange: (d: DetailsDraft) => void; options: DetailsOptions; unsure?: Set<string>; onUnsure?: (s: Set<string>) => void; pending?: Set<string> }) {
  const t = useT();
  const set = <K extends keyof DetailsDraft>(k: K, v: DetailsDraft[K]) => onChange({ ...value, [k]: v });
  const n = (k: keyof DetailsDraft) => (v: string) => set(k, v.replace(/\D/g, '') as never);
  // FB-13: "Not sure" next to each fact; facts waiting for Ops show "Verification pending".
  const fact = (field: string) =>
    onUnsure ? <NotSure field={field} on={!!unsure?.has(field)} pending={pending?.has(field)} onToggle={(on) => onUnsure(toggleIn(unsure ?? new Set(), field, on))} /> : null;
  return (
    <View className="gap-4">
      <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{t('unitDetails.sectionSize')}</Text>
        <View className="flex-row gap-2">
          <View className="flex-1 gap-1">
            <TextField label={t('unitDetails.superArea')} keyboardType="number-pad" value={value.super_area_sqft} onChangeText={n('super_area_sqft')} />
            {fact('super_area_sqft')}
          </View>
          <View className="flex-1 gap-1">
            <TextField label={t('unitDetails.carpetArea')} keyboardType="number-pad" value={value.carpet_area_sqft} onChangeText={n('carpet_area_sqft')} />
            {fact('carpet_area_sqft')}
          </View>
        </View>
        <View className="gap-1">
          <Chips label={t('unitDetails.kitchen')} options={options.kitchenSizes} value={value.kitchen_size} onChange={(v) => set('kitchen_size', v as string | null)} />
          {fact('kitchen_size')}
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1 gap-1">
            <TextField label={t('unitDetails.balconies')} keyboardType="number-pad" value={value.balcony_count} onChangeText={n('balcony_count')} />
            {fact('balcony_count')}
          </View>
          <TextField containerClassName="flex-1" label={t('unitDetails.balconySize')} keyboardType="number-pad" value={value.balcony_size_sqft} onChangeText={n('balcony_size_sqft')} />
          <View className="flex-1 gap-1">
            <TextField label={t('unitDetails.bathrooms')} keyboardType="number-pad" value={value.bathrooms} onChangeText={n('bathrooms')} />
            {fact('bathrooms')}
          </View>
        </View>
      </View>
      <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{t('unitDetails.sectionHome')}</Text>
        <View className="gap-1">
          <Chips label={t('unitDetails.facing')} options={options.facing} value={value.facing} onChange={(v) => set('facing', v as string | null)} />
          {fact('facing')}
        </View>
        <View className="gap-1">
          <Chips label={t('unitDetails.furnishing')} options={options.furnishing} value={value.furnishing} onChange={(v) => set('furnishing', v as string | null)} />
          {fact('furnishing')}
        </View>
        <View className="gap-1">
          <Chips label={t('unitDetails.parking')} options={options.parking} value={value.parking} onChange={(v) => set('parking', v as string | null)} />
          {fact('parking')}
        </View>
      </View>
      <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{t('unitDetails.sectionNearby')}</Text>
        <TextField label={t('unitDetails.school')} value={value.nearby_school} onChangeText={(v) => set('nearby_school', v)} />
        <TextField label={t('unitDetails.market')} value={value.nearby_market} onChangeText={(v) => set('nearby_market', v)} />
        <TextField label={t('unitDetails.transport')} value={value.nearby_transport} onChangeText={(v) => set('nearby_transport', v)} />
        <TextField label={t('unitSurvey.notes')} multiline value={value.notes} onChangeText={(v) => set('notes', v)} />
      </View>
    </View>
  );
}

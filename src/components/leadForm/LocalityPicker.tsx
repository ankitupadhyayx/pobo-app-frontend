import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MapPin, Plus, X } from 'lucide-react-native';
import { TextField } from '@/components/ui';
import { useLocalities } from '@/api/hooks/leads';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

export interface PickedLocality {
  id: string;
  name: string;
}

export interface LocalityValue {
  items: PickedLocality[];
  /** "Other / not listed" text (Ops reviews it). */
  other: string;
}

export const emptyLocality = (): LocalityValue => ({ items: [], other: '' });

interface Props {
  value: LocalityValue;
  onChange: (v: LocalityValue) => void;
  label: string;
  /** Several sectors (BUY/RENT preferences) or exactly one (a property's sector). */
  multiple?: boolean;
  required?: boolean;
  hint?: string;
  error?: string;
  testID?: string;
}

/**
 * R2-10: controlled, searchable sector / locality picker (Locality Master). Free text is only the
 * "Other / not listed" fallback, which goes to Ops for review.
 */
export function LocalityPicker({ value, onChange, label, multiple, required, hint, error, testID = 'locality' }: Props) {
  const t = useT();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [otherMode, setOtherMode] = useState(!!value.other);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(h);
  }, [q]);
  const full = !multiple && value.items.length >= 1;
  const search = useLocalities(full ? '' : debounced);
  const chosen = new Set(value.items.map((i) => i.id));
  const results = (search.data ?? []).filter((l) => !chosen.has(l.id)).slice(0, 8);

  const add = (l: PickedLocality) => {
    setQ('');
    onChange({ items: multiple ? [...value.items, l] : [l], other: '' });
    setOtherMode(false);
  };
  const remove = (id: string) => onChange({ ...value, items: value.items.filter((i) => i.id !== id) });

  return (
    <View className="gap-1.5">
      {value.items.length ? (
        <>
          <Text className="text-xs font-bold text-slate-700">
            {label}
            {required ? <Text className="text-rose-600"> *</Text> : null}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {value.items.map((i) => (
              <View key={i.id} testID={`${testID}-picked-${i.id}`} className="flex-row items-center gap-1 rounded-full border border-teal-300 bg-teal-50 py-1 pl-2.5 pr-1.5">
                <MapPin size={12} color={colors.brandDark} />
                <Text className="text-xs font-bold text-teal-900">{i.name}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t('locality.remove', { name: i.name })} hitSlop={8} onPress={() => remove(i.id)}>
                  <X size={14} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        </>
      ) : null}
      {!full && !otherMode ? (
        <TextField
          testID={`${testID}-search`}
          label={value.items.length ? undefined : label}
          required={required && !value.items.length}
          placeholder={multiple && value.items.length ? t('locality.addAnother') : t('locality.search')}
          value={q}
          onChangeText={setQ}
          error={value.items.length ? undefined : error}
          hint={!q ? hint : undefined}
        />
      ) : null}
      {search.isFetching ? <ActivityIndicator size="small" color={colors.brand} /> : null}
      {!full && !otherMode && q.trim() ? (
        <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {results.map((l) => (
            <Pressable
              key={l.id}
              testID={`${testID}-option-${l.id}`}
              accessibilityRole="button"
              onPress={() => add({ id: l.id, name: l.name })}
              className="min-h-[44px] justify-center border-b border-slate-100 px-3 py-2 active:bg-slate-50"
            >
              <Text className="text-sm font-semibold text-slate-900">{l.name}</Text>
              <Text className="text-[11px] text-slate-500">{[l.city, l.territory].filter(Boolean).join(' · ')}</Text>
            </Pressable>
          ))}
          {!search.isFetching ? (
            <Pressable
              testID={`${testID}-other`}
              accessibilityRole="button"
              onPress={() => {
                setOtherMode(true);
                onChange({ ...value, other: q.trim() });
                setQ('');
              }}
              className="min-h-[44px] flex-row items-center gap-2 px-3 py-2 active:bg-slate-50"
            >
              <Plus size={14} color={colors.muted} />
              <Text className="flex-1 text-xs font-semibold text-slate-600">{t('locality.other', { text: q.trim() })}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {otherMode ? (
        <View className="gap-1">
          <TextField
            testID={`${testID}-other-text`}
            label={value.items.length ? t('locality.otherLabel') : label}
            value={value.other}
            onChangeText={(other) => onChange({ ...value, other })}
            hint={t('locality.otherHint')}
          />
          <Pressable
            testID={`${testID}-other-cancel`}
            accessibilityRole="button"
            onPress={() => {
              setOtherMode(false);
              onChange({ ...value, other: '' });
            }}
          >
            <Text className="text-xs font-bold text-teal-700">{t('locality.backToList')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

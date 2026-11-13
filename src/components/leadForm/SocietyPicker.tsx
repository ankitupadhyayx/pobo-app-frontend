import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Building2, X } from 'lucide-react-native';
import { TextField } from '@/components/ui';
import { useSocietySearch } from '@/api/hooks/leads';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

export interface PickedSociety {
  id: string;
  name: string;
  locality?: string | null;
}

interface Props {
  value: PickedSociety | null;
  onChange: (s: PickedSociety | null) => void;
  label?: string;
  required?: boolean;
  error?: string;
  testID?: string;
}

/** Society Master search (pick only; no free text). Used by Add Property (R2-2). */
export function SocietyPicker({ value, onChange, label, required, error, testID = 'society-picker' }: Props) {
  const t = useT();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const h = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(h);
  }, [q]);
  const search = useSocietySearch(value ? '' : debounced);
  const results = search.data?.results ?? [];

  if (value) {
    return (
      <View className="gap-1">
        <Text className="text-xs font-bold text-slate-700">{label ?? t('addLead.society')}</Text>
        <View testID={`${testID}-picked`} className="min-h-[46px] flex-row items-center justify-between rounded-xl border border-teal-300 bg-teal-50 px-3">
          <View className="flex-1 flex-row items-center gap-2">
            <Building2 size={16} color={colors.brandDark} />
            <Text className="flex-1 text-sm font-bold text-teal-900" numberOfLines={1}>
              {value.name}
              {value.locality ? <Text className="font-normal text-teal-800">{` · ${value.locality}`}</Text> : null}
            </Text>
          </View>
          <Pressable testID={`${testID}-clear`} accessibilityRole="button" accessibilityLabel={t('addProperty.changeSociety')} hitSlop={10} onPress={() => onChange(null)}>
            <X size={16} color={colors.muted} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-1">
      <TextField
        testID={testID}
        label={label ?? t('addLead.society')}
        required={required}
        placeholder={t('addLead.searchSociety')}
        value={q}
        onChangeText={setQ}
        error={error}
        hint={q.trim().length >= 2 && !search.isFetching && results.length === 0 ? t('addProperty.societyNotListed') : undefined}
      />
      {search.isFetching ? <ActivityIndicator size="small" color={colors.brand} /> : null}
      {results.length > 0 ? (
        <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {results.map((s) => (
            <Pressable
              key={s.id}
              testID={`${testID}-option-${s.id}`}
              accessibilityRole="button"
              onPress={() => {
                setQ('');
                onChange({ id: s.id, name: s.name, locality: s.locality?.name ?? null });
              }}
              className="min-h-[44px] justify-center border-b border-slate-100 px-3 py-2 active:bg-slate-50"
            >
              <Text className="text-sm font-semibold text-slate-900">{s.name}</Text>
              <Text className="text-[11px] text-slate-500">
                {s.locality?.name}
                {s.locality?.city ? `, ${s.locality.city}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

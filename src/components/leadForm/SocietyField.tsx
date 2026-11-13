import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Building2, X } from 'lucide-react-native';
import { TextField } from '@/components/ui';
import { useSocietySearch } from '@/api/hooks/leads';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';
import type { RequirementDraft } from './types';

interface Props {
  draft: RequirementDraft;
  onChange: (d: RequirementDraft) => void;
  error?: string;
}

/**
 * Society Master search. Picking a result sends `society_id`; if the society isn't listed the
 * typed name is sent as `society_name` and Ops reviews it (blueprint §21: unknown society).
 */
export function SocietyField({ draft, onChange, error }: Props) {
  const t = useT();
  const [q, setQ] = useState(draft.societyName);
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(h);
  }, [q]);
  const search = useSocietySearch(draft.societyId ? '' : debounced);
  const results = search.data?.results ?? [];

  if (draft.societyId) {
    return (
      <View className="gap-1">
        <Text className="text-xs font-bold text-slate-700">{t('addLead.society')}</Text>
        <View className="min-h-[46px] flex-row items-center justify-between rounded-xl border border-teal-300 bg-teal-50 px-3">
          <View className="flex-1 flex-row items-center gap-2">
            <Building2 size={16} color={colors.brandDark} />
            <Text className="flex-1 text-sm font-bold text-teal-900" numberOfLines={1}>
              {draft.societyName}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Change society" hitSlop={10} onPress={() => onChange({ ...draft, societyId: null })}>
            <X size={16} color={colors.muted} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-1">
      <TextField
        testID="society-search"
        label={t('addLead.society')}
        placeholder={t('addLead.searchSociety')}
        value={q}
        onChangeText={(v) => {
          setQ(v);
          onChange({ ...draft, societyId: null, societyName: v });
        }}
        error={error}
        hint={q.trim().length >= 2 && !search.isFetching && results.length === 0 ? t('addLead.societyNotFound') : undefined}
      />
      {search.isFetching ? <ActivityIndicator size="small" color={colors.brand} /> : null}
      {results.length > 0 ? (
        <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {results.map((s) => (
            <Pressable
              key={s.id}
              testID={`society-option-${s.id}`}
              accessibilityRole="button"
              onPress={() => {
                setQ(s.name);
                onChange({ ...draft, societyId: s.id, societyName: s.name });
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

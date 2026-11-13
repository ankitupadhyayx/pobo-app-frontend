import { Pressable, Text, View } from 'react-native';
import { ChevronRight, Info } from 'lucide-react-native';
import { useState } from 'react';
import { cn } from '@/lib/cn';

export interface Counter {
  key: string;
  /** Glossary label from config (e.g. "Active Leads"). */
  label: string;
  value: number | string;
  /** Glossary definition, revealed on long-press. */
  definition?: string;
  onPress?: () => void;
  alert?: boolean;
  /** Small caption under the value, e.g. "Estimate · not final policy" for interim earnings. */
  note?: string;
}

/** Hero banner counters (2×2) with glossary labels. */
export function HeroCounters({ items }: { items: Counter[] }) {
  const [explain, setExplain] = useState<string | null>(null);
  const explained = items.find((i) => i.key === explain);
  return (
    <View>
      <View className="mt-5 flex-row flex-wrap gap-2.5">
        {items.map((c) => (
          <Pressable
            key={c.key}
            testID={`counter-${c.key}`}
            accessibilityRole="button"
            accessibilityLabel={`${c.label}: ${c.value}`}
            accessibilityHint={c.definition}
            onPress={c.onPress}
            onLongPress={() => setExplain(explain === c.key ? null : c.key)}
            className="min-w-[46%] flex-1 rounded-2xl border border-white/10 bg-white/10 p-3 active:bg-white/15"
          >
            <Text className="text-[11px] font-medium text-teal-200">{c.label}</Text>
            <View className="mt-0.5 flex-row items-center gap-2">
              <Text className={cn('text-xl font-bold', c.alert ? 'text-rose-200' : 'text-white')} style={{ fontVariant: ['tabular-nums'] }}>
                {c.value}
              </Text>
            </View>
            {c.note ? <Text testID={`counter-${c.key}-note`} className="mt-0.5 text-[10px] font-medium text-amber-200">{c.note}</Text> : null}
            {c.onPress ? (
              <View className="mt-1 flex-row items-center">
                <ChevronRight size={12} color="#5eead4" />
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
      {explained?.definition ? (
        <View className="mt-2 flex-row items-start gap-1.5 rounded-xl bg-black/20 p-2.5">
          <Info size={12} color="#99f6e4" />
          <Text className="flex-1 text-[11px] text-teal-100">
            <Text className="font-bold">{explained.label}: </Text>
            {explained.definition}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** "Today" activity strip: New Leads / Calls / Followups / Visits / Flats Surveyed. */
export function TodayStrip({ items }: { items: Counter[] }) {
  return (
    <View className="flex-row gap-2">
      {items.map((c) => (
        <View key={c.key} accessibilityLabel={`${c.label}: ${c.value}`} className="flex-1 items-center rounded-xl bg-slate-50 px-1 py-2">
          <Text className="text-lg font-bold text-slate-900" style={{ fontVariant: ['tabular-nums'] }}>
            {c.value}
          </Text>
          <Text className="mt-0.5 text-center text-[10px] font-medium leading-tight text-slate-500" numberOfLines={2}>
            {c.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

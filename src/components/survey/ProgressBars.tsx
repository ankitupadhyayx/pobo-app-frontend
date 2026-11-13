import { Text, View } from 'react-native';
import { useT } from '@/i18n';

function Bar({ label, done, total, tone, testID }: { label: string; done: number; total: number; tone: 'slate' | 'teal'; testID?: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <View testID={testID} className="gap-1">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-semibold text-slate-600">{label}</Text>
        <Text className="text-[11px] font-bold text-slate-800" style={{ fontVariant: ['tabular-nums'] }}>
          {done.toLocaleString('en-IN')} / {total.toLocaleString('en-IN')} · {pct}%
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-slate-100">
        <View className={tone === 'teal' ? 'h-full rounded-full bg-teal-600' : 'h-full rounded-full bg-slate-500'} style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}

/**
 * Mapping progress and survey coverage are always reported separately (PHASE2 governance):
 *  - structure: mapped units vs the society's expected units
 *  - survey: surveyed units vs mapped units
 */
export function ProgressBars({ mapped, expected, surveyed }: { mapped: number; expected: number | null; surveyed: number }) {
  const t = useT();
  return (
    <View className="gap-2.5">
      <Bar testID="progress-mapping" label={t('survey.mappingProgress')} done={mapped} total={Math.max(expected ?? mapped, mapped)} tone="slate" />
      <Bar testID="progress-survey" label={t('survey.surveyCoverage')} done={surveyed} total={mapped} tone="teal" />
    </View>
  );
}

import { Pressable, Text, View } from 'react-native';
import { HelpCircle, ShieldQuestion } from 'lucide-react-native';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

/**
 * FB-13: a small "Not sure" toggle shown under a fact (area, configuration, floor, facing…), so the
 * AA never has to guess. A fact already waiting for Ops shows "Verification pending" instead.
 */
export function NotSure({ field, on, pending, onToggle, disabled }: { field: string; on: boolean; pending?: boolean; onToggle: (on: boolean) => void; disabled?: boolean }) {
  const t = useT();
  if (pending) {
    return (
      <View testID={`pending-${field}`} className="flex-row items-center gap-1 self-start rounded-full bg-amber-100 px-2 py-0.5">
        <ShieldQuestion size={11} color={colors.warn} />
        <Text className="text-[10px] font-bold text-amber-900">{t('notSure.pending')}</Text>
      </View>
    );
  }
  return (
    <Pressable
      testID={`unsure-${field}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled }}
      disabled={disabled}
      onPress={() => onToggle(!on)}
      hitSlop={6}
      className={cn('flex-row items-center gap-1 self-start rounded-full border px-2 py-0.5', on ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white')}
    >
      <HelpCircle size={11} color={on ? colors.warn : colors.muted} />
      <Text className={cn('text-[10px] font-bold', on ? 'text-amber-900' : 'text-slate-500')}>{on ? t('notSure.marked') : t('notSure.label')}</Text>
    </Pressable>
  );
}

/** Toggle helper for a Set of field names. */
export const toggleIn = (set: Set<string>, field: string, on: boolean) => {
  const next = new Set(set);
  if (on) next.add(field);
  else next.delete(field);
  return next;
};

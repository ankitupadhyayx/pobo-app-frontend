import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  /** Helper text under the label: what ticking this changes. */
  hint?: string;
  error?: string;
  tone?: 'default' | 'danger';
  testID?: string;
}

export function Checkbox({ checked, onChange, label, hint, error, tone = 'default', testID }: Props) {
  const on = tone === 'danger' ? 'border-rose-600 bg-rose-600' : 'border-teal-600 bg-teal-600';
  return (
    <View className="gap-1">
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => onChange(!checked)}
        className={cn(
          'flex-row items-start gap-3 rounded-xl border p-3',
          error ? 'border-rose-400 bg-rose-50' : tone === 'danger' ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200 bg-slate-50',
        )}
      >
        <View className={cn('mt-0.5 h-5 w-5 items-center justify-center rounded border', checked ? on : 'border-slate-400 bg-white')}>
          {checked ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}
        </View>
        <View className="flex-1">
          <Text className={cn('text-xs leading-5', tone === 'danger' ? 'font-semibold text-rose-900' : hint ? 'font-bold text-slate-800' : 'text-slate-800')}>{label}</Text>
          {hint ? <Text className="text-[11px] leading-4 text-slate-500">{hint}</Text> : null}
        </View>
      </Pressable>
      {error ? <Text className="text-xs font-semibold text-rose-600">{error}</Text> : null}
    </View>
  );
}

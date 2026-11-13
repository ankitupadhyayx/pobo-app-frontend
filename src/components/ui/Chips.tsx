import { Pressable, ScrollView, Text, View } from 'react-native';
import { cn } from '@/lib/cn';

export interface Option<V extends string = string> {
  value: V;
  label: string;
  disabled?: boolean;
}

interface ChipsProps<V extends string> {
  label?: string;
  options: Option<V>[];
  /** Single select: string | null. Multi select: string[]. */
  value: V | V[] | null;
  onChange: (next: V | V[] | null) => void;
  multiple?: boolean;
  /** Horizontal scroll row (filters) instead of wrapping grid (forms). */
  scroll?: boolean;
  error?: string;
  required?: boolean;
  allowDeselect?: boolean;
  testIDPrefix?: string;
}

/** Single/multi choice chips. Options always come from config master lists. */
export function Chips<V extends string>({
  label,
  options,
  value,
  onChange,
  multiple,
  scroll,
  error,
  required,
  allowDeselect = true,
  testIDPrefix,
}: ChipsProps<V>) {
  const selected = new Set<V>(Array.isArray(value) ? value : value ? [value] : []);
  const toggle = (v: V) => {
    if (multiple) {
      const next = new Set(selected);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      onChange([...next]);
    } else {
      onChange(selected.has(v) ? (allowDeselect ? null : v) : v);
    }
  };
  const chips = options.map((o) => {
    const on = selected.has(o.value);
    return (
      <Pressable
        key={o.value}
        testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
        accessibilityRole={multiple ? 'checkbox' : 'radio'}
        accessibilityState={{ checked: on, disabled: o.disabled }}
        disabled={o.disabled}
        onPress={() => toggle(o.value)}
        className={cn(
          'min-h-[36px] justify-center rounded-xl border px-3',
          on ? 'border-teal-700 bg-teal-700' : 'border-slate-200 bg-white',
          o.disabled && 'opacity-40',
        )}
      >
        <Text className={cn('text-xs font-bold', on ? 'text-white' : 'text-slate-700')}>{o.label}</Text>
      </Pressable>
    );
  });
  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="text-xs font-bold text-slate-700">
          {label}
          {required ? <Text className="text-rose-600"> *</Text> : null}
        </Text>
      ) : null}
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-4">
          {chips}
        </ScrollView>
      ) : (
        <View className="flex-row flex-wrap gap-2">{chips}</View>
      )}
      {error ? <Text className="text-xs font-semibold text-rose-600">{error}</Text> : null}
    </View>
  );
}

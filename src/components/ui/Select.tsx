import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import type { Option } from './Chips';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';

interface SelectProps<V extends string> {
  label: string;
  placeholder?: string;
  options: Option<V>[];
  value: V | null;
  onChange: (v: V) => void;
  error?: string;
  required?: boolean;
  testID?: string;
}

/** Dropdown that opens a bottom-sheet list (long master lists: societies, outcomes, reasons). */
export function Select<V extends string>({ label, placeholder, options, value, onChange, error, required, testID }: SelectProps<V>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View className="gap-1">
      <Text className="text-xs font-bold text-slate-700">
        {label}
        {required ? <Text className="text-rose-600"> *</Text> : null}
      </Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder ?? ''}`}
        onPress={() => setOpen(true)}
        className={cn(
          'min-h-[46px] flex-row items-center justify-between rounded-xl border bg-slate-50 px-3',
          error ? 'border-rose-400' : 'border-slate-200',
        )}
      >
        <Text className={cn('flex-1 text-sm', current ? 'font-semibold text-slate-900' : 'text-slate-400')} numberOfLines={1}>
          {current?.label ?? placeholder ?? 'Select'}
        </Text>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>
      {error ? <Text className="text-xs font-semibold text-rose-600">{error}</Text> : null}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View className="gap-1">
          {options.map((o) => {
            const on = o.value === value;
            return (
              <Pressable
                key={o.value}
                disabled={o.disabled}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn('min-h-[48px] flex-row items-center justify-between rounded-xl px-3', on ? 'bg-teal-50' : 'active:bg-slate-50', o.disabled && 'opacity-40')}
              >
                <Text className={cn('text-sm', on ? 'font-bold text-teal-800' : 'font-medium text-slate-800')}>{o.label}</Text>
                {on ? <Check size={18} color={colors.brandDark} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

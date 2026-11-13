import type { Ref } from 'react';
import { Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';

interface TextFieldProps extends TextInputProps {
  label?: string;
  /** Inline error from client validation or the API `fields` map. */
  error?: string;
  hint?: string;
  required?: boolean;
  prefix?: string;
  containerClassName?: string;
  ref?: Ref<TextInputInstance>;
}

export function TextField({ label, error, hint, required, prefix, containerClassName, multiline, ref, ...rest }: TextFieldProps) {
  return (
    <View className={cn('gap-1', containerClassName)}>
      {label ? (
        <Text className="text-xs font-bold text-slate-700">
          {label}
          {required ? <Text className="text-rose-600"> *</Text> : null}
        </Text>
      ) : null}
      <View
        className={cn(
          'flex-row items-center rounded-xl border bg-slate-50 px-3',
          error ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200',
          multiline ? 'min-h-[88px] items-start py-2' : 'min-h-[46px]',
        )}
      >
        {prefix ? <Text className="mr-2 text-sm font-semibold text-slate-500">{prefix}</Text> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.slate400}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          accessibilityLabel={label}
          className="flex-1 py-2 text-sm font-medium text-slate-900"
          {...rest}
        />
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" className="text-xs font-semibold text-rose-600">
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-[11px] text-slate-500">{hint}</Text>
      ) : null}
    </View>
  );
}

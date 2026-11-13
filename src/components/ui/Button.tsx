import type { ComponentType } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';

type Variant = 'primary' | 'danger' | 'secondary' | 'outline' | 'ghost' | 'info' | 'float';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  iconRight?: boolean;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  testID?: string;
  accessibilityHint?: string;
}

const box: Record<Variant, string> = {
  primary: 'bg-teal-600 active:bg-teal-700',
  danger: 'bg-rose-600 active:bg-rose-700',
  secondary: 'bg-slate-100 active:bg-slate-200',
  outline: 'bg-white border border-slate-300 active:bg-slate-50',
  ghost: 'bg-transparent active:bg-slate-100',
  info: 'bg-blue-700 active:bg-blue-800',
  float: 'bg-amber-500 active:bg-amber-400',
};
const text: Record<Variant, string> = {
  primary: 'text-white',
  danger: 'text-white',
  secondary: 'text-slate-700',
  outline: 'text-slate-800',
  ghost: 'text-teal-700',
  info: 'text-white',
  float: 'text-slate-950',
};
const iconColor: Record<Variant, string> = {
  primary: colors.white,
  danger: colors.white,
  secondary: colors.slate700,
  outline: colors.ink,
  ghost: colors.brandDark,
  info: colors.white,
  float: '#020617',
};
// md/lg keep a ≥44pt touch target for one-handed field use.
const sizes: Record<Size, { box: string; text: string; icon: number }> = {
  sm: { box: 'min-h-[36px] px-3 rounded-xl', text: 'text-xs', icon: 14 },
  md: { box: 'min-h-[44px] px-4 rounded-xl', text: 'text-sm', icon: 16 },
  lg: { box: 'min-h-[52px] px-5 rounded-2xl', text: 'text-base', icon: 18 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight,
  loading,
  disabled,
  fullWidth,
  className,
  testID,
  accessibilityHint,
}: ButtonProps) {
  const inactive = disabled || loading;
  const s = sizes[size];
  const iconEl = Icon ? <Icon size={s.icon} color={iconColor[variant]} strokeWidth={2.5} /> : null;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label || accessibilityHint}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-center',
        s.box,
        box[variant],
        fullWidth && 'w-full',
        inactive && 'opacity-50',
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor[variant]} />
      ) : (
        <View className="flex-row items-center gap-1.5">
          {!iconRight && iconEl}
          {label ? (
            <Text className={cn('font-bold', s.text, text[variant])} numberOfLines={1}>
              {label}
            </Text>
          ) : null}
          {iconRight && iconEl}
        </View>
      )}
    </Pressable>
  );
}

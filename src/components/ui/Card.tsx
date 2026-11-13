import { Pressable, View, type ViewProps } from 'react-native';
import { cn } from '@/lib/cn';

interface CardProps extends ViewProps {
  tone?: 'default' | 'alert' | 'warn' | 'muted';
  onPress?: () => void;
  className?: string;
}

const tones = {
  default: 'bg-white border border-slate-200',
  alert: 'bg-white border-2 border-rose-300',
  warn: 'bg-amber-50 border border-amber-200',
  muted: 'bg-slate-50 border border-slate-200',
};

/** The prototype's rounded-2xl white card. Pass onPress to make the whole card tappable. */
export function Card({ tone = 'default', onPress, className, children, ...rest }: CardProps) {
  const cls = cn('rounded-2xl p-4', tones[tone], className);
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} className={cn(cls, 'active:opacity-90')} {...rest}>
        {children}
      </Pressable>
    );
  }
  return (
    <View className={cls} {...rest}>
      {children}
    </View>
  );
}

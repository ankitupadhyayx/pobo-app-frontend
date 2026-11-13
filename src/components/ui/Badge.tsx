import { Text, View } from 'react-native';
import { cn } from '@/lib/cn';

export type BadgeTone = 'teal' | 'blue' | 'amber' | 'emerald' | 'indigo' | 'purple' | 'rose' | 'slate' | 'dark';

const tones: Record<BadgeTone, string> = {
  teal: 'bg-teal-100 border-teal-300',
  blue: 'bg-blue-100 border-blue-300',
  amber: 'bg-amber-100 border-amber-300',
  emerald: 'bg-emerald-100 border-emerald-300',
  indigo: 'bg-indigo-100 border-indigo-300',
  purple: 'bg-purple-100 border-purple-300',
  rose: 'bg-rose-100 border-rose-300',
  slate: 'bg-slate-100 border-slate-300',
  dark: 'bg-slate-800 border-slate-700',
};
const textTones: Record<BadgeTone, string> = {
  teal: 'text-teal-900',
  blue: 'text-blue-900',
  amber: 'text-amber-900',
  emerald: 'text-emerald-900',
  indigo: 'text-indigo-900',
  purple: 'text-purple-900',
  rose: 'text-rose-800',
  slate: 'text-slate-700',
  dark: 'text-white',
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  shape?: 'pill' | 'tag';
  className?: string;
  testID?: string;
}

/** Small status label. `pill` = stage pill (rounded-full), `tag` = intent/type tag (rounded). */
export function Badge({ label, tone = 'slate', shape = 'pill', className, testID }: BadgeProps) {
  return (
    <View
      testID={testID}
      className={cn(
        'self-start border px-2 py-0.5',
        shape === 'pill' ? 'rounded-full' : 'rounded-md',
        tones[tone],
        className,
      )}
    >
      <Text className={cn('text-[11px] font-bold', textTones[tone])} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

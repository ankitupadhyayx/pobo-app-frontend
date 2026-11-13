import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarClock } from 'lucide-react-native';
import { formatDay, formatWhen } from '@/lib/time';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

interface Props {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  error?: string;
  required?: boolean;
  mode?: 'datetime' | 'date';
  testID?: string;
}

/** Date (+ time) picker. Android shows date then time dialogs in sequence. */
export function DateTimeField({ label, value, onChange, minimumDate, error, required, mode = 'datetime', testID }: Props) {
  const t = useT();
  const [step, setStep] = useState<null | 'date' | 'time'>(null);
  const [draft, setDraft] = useState<Date | null>(null);

  const onPicked = (e: DateTimePickerEvent, d?: Date) => {
    if (e.type === 'dismissed' || !d) {
      setStep(null);
      return;
    }
    if (step === 'date' && mode === 'datetime' && Platform.OS === 'android') {
      const base = value ?? new Date();
      const next = new Date(d);
      next.setHours(base.getHours(), base.getMinutes(), 0, 0);
      setDraft(next);
      setStep('time');
      return;
    }
    setStep(Platform.OS === 'ios' ? step : null);
    onChange(d);
  };

  return (
    <View className="gap-1">
      <Text className="text-xs font-bold text-slate-700">
        {label}
        {required ? <Text className="text-rose-600"> *</Text> : null}
      </Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={() => setStep('date')}
        className={cn('min-h-[46px] flex-row items-center gap-2 rounded-xl border bg-slate-50 px-3', error ? 'border-rose-400' : 'border-slate-200')}
      >
        <CalendarClock size={16} color={colors.muted} />
        <Text className={cn('text-sm', value ? 'font-semibold text-slate-900' : 'text-slate-400')}>
          {value ? (mode === 'date' ? formatDay(value, true) : formatWhen(value.toISOString())) : t('common.pickDateTime')}
        </Text>
      </Pressable>
      {error ? <Text className="text-xs font-semibold text-rose-600">{error}</Text> : null}
      {step ? (
        <DateTimePicker
          value={(step === 'time' ? draft : value) ?? minimumDate ?? new Date()}
          mode={Platform.OS === 'ios' && mode === 'datetime' ? 'datetime' : step === 'time' ? 'time' : 'date'}
          minimumDate={step === 'date' ? minimumDate : undefined}
          is24Hour={false}
          onChange={onPicked}
        />
      ) : null}
    </View>
  );
}

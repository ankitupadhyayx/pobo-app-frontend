import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Checkbox } from './Checkbox';
import { Chips } from './Chips';
import { DateTimeField } from './DateTimeField';
import { TextField } from './TextField';
import { formatDay, formatTime } from '@/lib/time';
import { useT } from '@/i18n';

export interface ServiceHours {
  /** "09:00" */
  start: string;
  /** "18:00" — the last slot offered. */
  end: string;
}
export const DEFAULT_SERVICE_HOURS: ServiceHours = { start: '09:00', end: '18:00' };

export interface CallbackValue {
  at: Date | null;
  /** FB-10 exception: the customer asked for a time after service hours. */
  afterHours: boolean;
  reason: string;
}
export const emptyCallback: CallbackValue = { at: null, afterHours: false, reason: '' };

const hm = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return { h: h || 0, m: m || 0 };
};

/** Slots from service start to end (inclusive) every `step` minutes; past slots are dropped. */
export function callbackSlots(day: Date, hours: ServiceHours = DEFAULT_SERVICE_HOURS, now = Date.now(), step = 30): Date[] {
  const s = hm(hours.start);
  const e = hm(hours.end);
  const out: Date[] = [];
  const cur = new Date(day);
  cur.setHours(s.h, s.m, 0, 0);
  const end = new Date(day);
  end.setHours(e.h, e.m, 0, 0);
  while (cur.getTime() <= end.getTime()) {
    if (cur.getTime() > now) out.push(new Date(cur));
    cur.setMinutes(cur.getMinutes() + step);
  }
  return out;
}

/** True when `d` falls after the service end on its day (or before the start). */
export function isAfterHours(d: Date, hours: ServiceHours = DEFAULT_SERVICE_HOURS) {
  const s = hm(hours.start);
  const e = hm(hours.end);
  const mins = d.getHours() * 60 + d.getMinutes();
  return mins > e.h * 60 + e.m || mins < s.h * 60 + s.m;
}

/** Validation shared by every sheet that uses the picker. Returns an i18n key or null. */
export function callbackError(v: CallbackValue, required: boolean, hours: ServiceHours = DEFAULT_SERVICE_HOURS, now = Date.now()): string | null {
  if (!v.at) return required ? 'errors.required' : null;
  if (v.at.getTime() < now) return 'followUp.dueInPast';
  if (v.afterHours) return v.reason.trim() ? null : 'callback.reasonRequired';
  return isAfterHours(v.at, hours) ? 'callback.afterSix' : null;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

interface Props {
  label: string;
  value: CallbackValue;
  onChange: (v: CallbackValue) => void;
  hours?: ServiceHours;
  required?: boolean;
  error?: string;
  testID?: string;
}

/**
 * FB-10 callback / follow-up time. Normal slots run from service start to 6:00 PM (service end) in
 * 12-hour time; nothing later is offered. "Customer asked for a later time" is a separate, explicit
 * exception with a reason.
 */
export function CallbackPicker({ label, value, onChange, hours = DEFAULT_SERVICE_HOURS, required, error, testID = 'callback' }: Props) {
  const t = useT();
  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return [0, 1, 2].map((i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);
  const initialDay = value.at ? new Date(value.at) : (callbackSlots(days[0], hours).length ? days[0] : days[1]);
  const [day, setDay] = useState<Date>(() => {
    const d = new Date(initialDay);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [otherDay, setOtherDay] = useState(!days.some((d) => dayKey(d) === dayKey(day)));
  const slots = callbackSlots(day, hours);
  const dayOptions = [
    ...days.map((d, i) => ({ value: dayKey(d), label: i === 0 ? t('callback.today') : i === 1 ? t('callback.tomorrow') : formatDay(d) })),
    { value: 'other', label: t('callback.otherDate') },
  ];
  const endLabel = formatTime(new Date(2000, 0, 1, hm(hours.end).h, hm(hours.end).m));

  return (
    <View className="gap-3">
      <Text className="text-xs font-bold text-slate-700">
        {label}
        {required ? <Text className="text-rose-600"> *</Text> : null}
      </Text>
      {!value.afterHours ? (
        <>
          <Chips
            testIDPrefix={`${testID}-day`}
            options={dayOptions}
            value={otherDay ? 'other' : dayKey(day)}
            allowDeselect={false}
            onChange={(v) => {
              if (v === 'other') {
                setOtherDay(true);
                return;
              }
              setOtherDay(false);
              const d = days.find((x) => dayKey(x) === v)!;
              setDay(d);
              onChange({ ...value, at: null });
            }}
          />
          {otherDay ? (
            <DateTimeField
              testID={`${testID}-date`}
              mode="date"
              label={t('callback.pickDate')}
              value={day}
              minimumDate={days[0]}
              onChange={(d) => {
                const x = new Date(d);
                x.setHours(0, 0, 0, 0);
                setDay(x);
                onChange({ ...value, at: null });
              }}
            />
          ) : null}
          {slots.length ? (
            <Chips
              testIDPrefix={`${testID}-slot`}
              options={slots.map((s) => ({ value: s.toISOString(), label: formatTime(s) }))}
              value={value.at ? value.at.toISOString() : null}
              onChange={(v) => onChange({ ...value, at: v ? new Date(v as string) : null })}
            />
          ) : (
            <Text className="text-xs text-slate-500">{t('callback.noSlots', { end: endLabel })}</Text>
          )}
          <Text className="text-[11px] text-slate-500">{t('callback.hint', { end: endLabel })}</Text>
        </>
      ) : (
        <>
          <DateTimeField testID={`${testID}-late`} label={t('callback.laterTime')} value={value.at} minimumDate={new Date()} onChange={(d) => onChange({ ...value, at: d })} />
          <TextField testID={`${testID}-reason`} label={t('callback.reason')} required placeholder={t('callback.reasonPlaceholder')} value={value.reason} onChangeText={(reason) => onChange({ ...value, reason })} />
        </>
      )}
      <Checkbox
        testID={`${testID}-after-hours`}
        checked={value.afterHours}
        label={t('callback.customerAskedLater', { end: endLabel })}
        onChange={(afterHours) => onChange({ at: null, afterHours, reason: '' })}
      />
      {error ? <Text className="text-xs font-semibold text-rose-600">{error}</Text> : null}
    </View>
  );
}

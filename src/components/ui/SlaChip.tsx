import { Text, View } from 'react-native';
import { Clock, PauseCircle, AlertTriangle } from 'lucide-react-native';
import { useNow } from '@/hooks/useNow';
import { formatDuration } from '@/lib/time';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

export interface SlaChipProps {
  /** Target time for the first meaningful contact (or task due time). */
  dueAt?: string | null;
  /** Compliance breach time; after this the chip turns solid red. */
  breachAt?: string | null;
  /** True while SLA is legitimately stopped (outside hours, Ops hold, duplicate review). */
  paused?: boolean;
  /** Minutes before due at which the chip turns amber. */
  warnMinutes?: number;
  compact?: boolean;
}

export type SlaState = 'paused' | 'ok' | 'warn' | 'overdue' | 'breached';

export function slaState(now: number, p: SlaChipProps): { state: SlaState; ms: number } {
  if (p.paused || !p.dueAt) return { state: 'paused', ms: 0 };
  const due = Date.parse(p.dueAt);
  const breach = p.breachAt ? Date.parse(p.breachAt) : null;
  const ms = due - now;
  if (breach !== null && now >= breach) return { state: 'breached', ms: now - breach };
  if (ms <= 0) return { state: 'overdue', ms: -ms };
  if (ms <= (p.warnMinutes ?? 5) * 60000) return { state: 'warn', ms };
  return { state: 'ok', ms };
}

const styles: Record<SlaState, { box: string; text: string; icon: string }> = {
  paused: { box: 'bg-slate-100 border-slate-200', text: 'text-slate-600', icon: colors.muted },
  ok: { box: 'bg-teal-50 border-teal-200', text: 'text-teal-800', icon: colors.brandDark },
  warn: { box: 'bg-amber-50 border-amber-300', text: 'text-amber-900', icon: colors.warn },
  overdue: { box: 'bg-rose-50 border-rose-300', text: 'text-rose-700', icon: colors.danger },
  breached: { box: 'bg-rose-600 border-rose-700', text: 'text-white', icon: colors.white },
};

/** Live SLA countdown chip. Ticks every second off the shared ticker. */
export function SlaChip(props: SlaChipProps) {
  const now = useNow();
  const t = useT();
  const { state, ms } = slaState(now, props);
  if (!props.dueAt && !props.paused) return null;
  const s = styles[state];
  const Icon = state === 'paused' ? PauseCircle : state === 'breached' || state === 'overdue' ? AlertTriangle : Clock;
  const text =
    state === 'paused'
      ? t('sla.paused')
      : state === 'breached'
        ? t('sla.breached', { time: formatDuration(ms) })
        : state === 'overdue'
          ? t('sla.overdue', { time: formatDuration(ms) })
          : t('sla.dueIn', { time: formatDuration(ms) });
  return (
    <View
      accessibilityLabel={text}
      className={cn('flex-row items-center gap-1 self-start rounded-full border px-2 py-0.5', s.box)}
    >
      <Icon size={props.compact ? 11 : 12} color={s.icon} strokeWidth={2.5} />
      <Text className={cn('font-bold', props.compact ? 'text-[10px]' : 'text-[11px]', s.text)} style={{ fontVariant: ['tabular-nums'] }}>
        {text}
      </Text>
    </View>
  );
}

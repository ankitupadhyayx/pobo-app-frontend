import { Text, View } from 'react-native';
import { CalendarClock, CheckCircle2, KeyRound, MapPin, PhoneCall, XCircle, Ban, UserX, CalendarPlus } from 'lucide-react-native';
import { Badge, Button, Card } from '@/components/ui';
import { formatWhen } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';
import { useNow } from '@/hooks/useNow';

export interface VisitCardProps {
  id: string;
  customerName: string;
  property: string;
  scheduledAt: string;
  meetingPoint?: string | null;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | string;
  statusLabel: string;
  outcomeLabel?: string | null;
  cancelReason?: string | null;
  /** FB-07: Viewing / Property inspection / Photography… */
  typeLabel?: string | null;
  /** FB-08: open key tasks for this visit, e.g. "Collect key from Owner · before 5:30 PM". */
  keyNotes?: { text: string; urgent?: boolean; onPress?: () => void }[];
  highlight?: boolean;
  dnc?: boolean;
  /** R3-7: "Customer didn't come · Changed plans · Next: Reschedule" + the note. */
  noShow?: { line: string; note?: string } | null;
  /** R3-7: the visit booked after this no-show (tap to open it). */
  rescheduled?: { when: string; statusLabel: string; onPress?: () => void } | null;
  onCall?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
  onOpen?: () => void;
}

/** One visit: today/upcoming show Call · Complete · Cancel; completed shows its outcome. */
export function VisitCard(p: VisitCardProps) {
  const t = useT();
  const open = p.status === 'SCHEDULED';
  const now = useNow();
  const overdue = open && Date.parse(p.scheduledAt) < now - 30 * 60_000;
  return (
    <Card tone={overdue ? 'alert' : 'default'} onPress={p.onOpen} testID={`visit-${p.id}`} className={p.highlight ? 'border-2 border-teal-500' : undefined}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-base font-bold text-slate-900">{p.customerName}</Text>
          <View className="mt-1 flex-row items-center gap-1">
            <CalendarClock size={12} color={overdue ? colors.danger : colors.muted} />
            <Text className={overdue ? 'text-xs font-bold text-rose-600' : 'text-xs font-semibold text-slate-700'}>{formatWhen(p.scheduledAt)}</Text>
          </View>
        </View>
        <View className="items-end gap-1">
          <Badge testID={`visit-status-${p.id}`} label={p.statusLabel} tone={p.status === 'COMPLETED' ? 'emerald' : p.status === 'CANCELLED' ? 'slate' : p.status === 'NO_SHOW' ? 'rose' : 'indigo'} />
          {p.typeLabel ? <Badge testID={`visit-type-${p.id}`} label={p.typeLabel} tone="teal" /> : null}
        </View>
      </View>
      <View className="mt-2.5 gap-1 rounded-xl bg-slate-50 p-2.5">
        <Text className="text-xs font-semibold text-slate-800">{p.property}</Text>
        {p.meetingPoint ? (
          <View className="flex-row items-center gap-1">
            <MapPin size={11} color={colors.muted} />
            <Text className="text-[11px] text-slate-600">{p.meetingPoint}</Text>
          </View>
        ) : null}
        {(p.keyNotes ?? []).map((k, i) => (
          <Text key={i} testID={`visit-key-${p.id}-${i}`} onPress={k.onPress} className={k.urgent ? 'text-[11px] font-bold text-rose-700' : 'text-[11px] font-semibold text-amber-800'}>
            <KeyRound size={11} color={k.urgent ? colors.danger : colors.warn} /> {k.text}
          </Text>
        ))}
        {p.outcomeLabel ? (
          <View className="flex-row items-center gap-1">
            <CheckCircle2 size={11} color={colors.ok} />
            <Text className="text-[11px] font-bold text-emerald-800">{p.outcomeLabel}</Text>
          </View>
        ) : null}
        {p.noShow ? (
          <View testID={`visit-noshow-${p.id}`} className="gap-0.5">
            <View className="flex-row items-center gap-1">
              <UserX size={11} color={colors.danger} />
              <Text className="flex-1 text-[11px] font-bold text-rose-800">{p.noShow.line}</Text>
            </View>
            {p.noShow.note ? <Text className="text-[11px] text-slate-600">{p.noShow.note}</Text> : null}
          </View>
        ) : null}
        {p.rescheduled ? (
          <Text testID={`visit-rescheduled-${p.id}`} onPress={p.rescheduled.onPress} className="text-[11px] font-bold text-teal-800">
            <CalendarPlus size={11} color={colors.brandDark} /> {t('visits.rescheduledTo', { when: p.rescheduled.when, status: p.rescheduled.statusLabel })}
          </Text>
        ) : null}
        {p.cancelReason ? (
          <View className="flex-row items-center gap-1">
            <XCircle size={11} color={colors.muted} />
            <Text className="text-[11px] text-slate-600">{p.cancelReason}</Text>
          </View>
        ) : null}
      </View>
      {open ? (
        <View className="mt-3 flex-row gap-2 border-t border-slate-100 pt-3">
          {p.dnc ? (
            <View className="flex-row items-center gap-1">
              <Ban size={12} color={colors.danger} />
              <Text className="text-xs italic text-rose-600">{t('leads.dncSuppressed')}</Text>
            </View>
          ) : p.onCall ? (
            <Button size="sm" variant="secondary" icon={PhoneCall} label={t('common.call')} onPress={p.onCall} />
          ) : null}
          <Button testID={`visit-complete-${p.id}`} size="sm" className="flex-1" icon={CheckCircle2} label={t('visits.complete')} onPress={p.onComplete} />
          <Button testID={`visit-cancel-${p.id}`} size="sm" variant="ghost" label={t('visits.cancel')} onPress={p.onCancel} />
        </View>
      ) : null}
    </Card>
  );
}

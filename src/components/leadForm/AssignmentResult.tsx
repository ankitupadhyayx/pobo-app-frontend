import { Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { Badge, IntentTag } from '@/components/ui';
import { formatWhen } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

export interface AssignmentRow {
  id: string;
  type: string;
  typeLabel: string;
  assignmentState: string;
  servicingName: string | null;
  isMine: boolean;
  /** R3-2: saved as Draft (incomplete requirement). */
  isDraft?: boolean;
  reason: string | null;
  firstCallDueAt?: string | null;
}

/** Outcome of the assignment engine for each new requirement: who got it, why, and the SLA clock. */
export function AssignmentResult({ title, body, rows }: { title: string; body?: string; rows: AssignmentRow[] }) {
  const t = useT();
  const who = (r: AssignmentRow) => {
    if (r.assignmentState === 'FLOATING') return t('addLead.floating');
    if (r.assignmentState === 'PENDING_REVIEW') return t('addLead.opsReview');
    if (r.assignmentState === 'UNASSIGNED' || !r.servicingName) return t('addLead.unassigned');
    return r.isMine ? t('addLead.assignedYou') : t('addLead.assignedTo', { name: r.servicingName });
  };
  return (
    <View testID="assignment-result" className="gap-4">
      <View className="items-center gap-2 pt-2">
        <CheckCircle2 size={48} color={colors.ok} />
        <Text className="text-center text-lg font-extrabold text-slate-900">{title}</Text>
        {body ? <Text className="text-center text-xs leading-5 text-slate-600">{body}</Text> : null}
      </View>
      {rows.map((r) => (
        <View key={r.id} testID={`assignment-row-${r.type}`} className="gap-1.5 rounded-2xl border border-teal-200 bg-teal-50 p-3.5">
          <View className="flex-row items-center gap-2">
            <IntentTag type={r.type} label={r.typeLabel} />
            <Text className="flex-1 text-sm font-bold text-teal-950">{who(r)}</Text>
            {r.isDraft ? <Badge testID={`assignment-draft-${r.type}`} label={t('draftReq.badge')} tone="amber" /> : null}
          </View>
          {r.isDraft ? <Text className="text-[11px] font-semibold text-amber-800">{t('draftReq.incompleteHint')}</Text> : null}
          {r.reason ? <Text className="text-[11px] leading-4 text-slate-600">{r.reason}</Text> : null}
          {r.firstCallDueAt ? (
            <Text className="text-[11px] font-semibold text-teal-800">{t('addLead.firstCallBy', { time: formatWhen(r.firstCallDueAt) })}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

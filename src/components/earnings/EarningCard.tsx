import { Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { Badge, Card, type BadgeTone } from '@/components/ui';
import { pickHi, type EarningItem, type EarningState, type PayoutHistory } from '@/api/hooks/phase3';
import { formatINR, formatWhen } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useLabels } from '@/api/hooks/config';
import { useT } from '@/i18n';

export const STATE_TONE: Record<EarningState, BadgeTone> = {
  POTENTIAL: 'slate',
  AWAITING_FEE: 'amber',
  ELIGIBLE: 'blue',
  APPROVED: 'indigo',
  SCHEDULED: 'purple',
  PAID: 'emerald',
};

/** "Estimate · not final policy" chip shown wherever an interim amount appears. */
export function EstimateTag({ testID }: { testID?: string }) {
  const t = useT();
  return (
    <View testID={testID}>
      <Badge label={t('earnings.estimate')} tone="amber" shape="tag" />
    </View>
  );
}

/** One earnings item: state, plain-words gate, contribution and amount (hidden when null). */
export function EarningCard({ item, hi, onPress }: { item: EarningItem; hi: boolean; onPress?: () => void }) {
  const t = useT();
  const L = useLabels();
  const gated = item.gate.code !== 'PAID';
  return (
    <Card testID={`earning-${item.id}`} onPress={onPress}>
      <View className="flex-row items-start justify-between gap-2">
        <Badge label={pickHi(hi, item.state_label, item.state_label_hi)} tone={STATE_TONE[item.state] ?? 'slate'} />
        {item.amount != null ? (
          <View className="items-end">
            <Text testID={`earning-amount-${item.id}`} className="text-base font-extrabold text-slate-900" style={{ fontVariant: ['tabular-nums'] }}>
              {formatINR(item.amount)}
            </Text>
            {item.interim ? <EstimateTag /> : null}
          </View>
        ) : null}
      </View>
      <Text className="mt-2 text-sm font-bold text-slate-900">{item.title}</Text>
      {item.contribution_types.length ? (
        <Text className="mt-0.5 text-xs text-slate-500">
          {t('earnings.yourRole')}: {item.contribution_types.map((c) => L.enumLabel('contribution_type', c)).join(' · ')}
        </Text>
      ) : null}
      <View className={gated ? 'mt-2 flex-row items-start gap-1.5 rounded-xl bg-amber-50 p-2.5' : 'mt-2 flex-row items-start gap-1.5 rounded-xl bg-emerald-50 p-2.5'}>
        {gated ? <Lock size={12} color={colors.warn} /> : null}
        <Text testID={`earning-gate-${item.id}`} className={gated ? 'flex-1 text-xs text-amber-900' : 'flex-1 text-xs text-emerald-900'}>
          {pickHi(hi, item.gate.message, item.gate.message_hi)}
        </Text>
      </View>
      {item.payout?.utr ? (
        <Text className="mt-2 text-xs font-semibold text-slate-700">
          {t('earnings.utr', { utr: item.payout.utr })}
          {item.payout.paid_at ? ` · ${formatWhen(item.payout.paid_at)}` : ''}
        </Text>
      ) : null}
    </Card>
  );
}

export function PayoutRow({ p }: { p: PayoutHistory }) {
  const t = useT();
  return (
    <View testID={`payout-${p.batch_id}`} className="border-b border-slate-100 py-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-sm font-bold text-slate-900">{p.label}</Text>
        <Text className="text-sm font-extrabold text-slate-900" style={{ fontVariant: ['tabular-nums'] }}>
          {formatINR(p.amount)}
        </Text>
      </View>
      <View className="mt-1 flex-row flex-wrap items-center gap-2">
        <Badge label={t(`earnings.batch.${p.status}`, { defaultValue: p.status })} tone={p.status === 'PAID' ? 'emerald' : 'slate'} />
        <Text className="text-xs text-slate-500">{t('earnings.items', { count: p.item_count })}</Text>
        {p.paid_at ? <Text className="text-xs text-slate-500">{formatWhen(p.paid_at)}</Text> : null}
      </View>
      {p.utrs.length ? <Text className="mt-1 text-xs font-semibold text-slate-700">{t('earnings.utr', { utr: p.utrs.join(', ') })}</Text> : null}
    </View>
  );
}

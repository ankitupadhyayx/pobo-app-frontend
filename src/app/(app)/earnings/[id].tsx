import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Circle } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Badge, Button, Card, ErrorState, ListSkeleton } from '@/components/ui';
import { EarningCard } from '@/components/earnings/EarningCard';
import { useEarningItem } from '@/api/hooks/phase3';
import { useLabels } from '@/api/hooks/config';
import { formatINR, formatWhen } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-[36px] flex-row items-center justify-between border-b border-slate-100 py-1.5">
      <Text className="text-xs text-slate-600">{label}</Text>
      <Text className="text-xs font-semibold text-slate-900">{value}</Text>
    </View>
  );
}

/** APP-31 item detail: gate, step timeline, contributions, deal (read-only). */
export default function EarningDetailScreen() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useEarningItem(id ?? '');
  const d = q.data;
  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('earnings.detailTitle')} />
      <ScrollView contentContainerClassName="p-4 gap-4 pb-12">
        {q.isPending ? (
          <ListSkeleton count={2} />
        ) : !d ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <>
            <EarningCard item={d} hi={L.hi} />
            {d.steps.length ? (
              <Card testID="earning-steps">
                <Text className="mb-2 text-sm font-bold text-slate-900">{t('earnings.steps')}</Text>
                {d.steps.map((s) => (
                  <View key={s.key} className="min-h-[32px] flex-row items-center gap-2.5">
                    {s.done ? <Check size={16} color={colors.ok} strokeWidth={3} /> : <Circle size={14} color={colors.muted} />}
                    <Text className={s.done ? 'flex-1 text-sm text-slate-900' : 'flex-1 text-sm text-slate-500'}>{t(`earnings.step.${s.key}`, { defaultValue: s.label })}</Text>
                    {s.at ? <Text className="text-[11px] text-slate-500">{formatWhen(s.at)}</Text> : null}
                  </View>
                ))}
              </Card>
            ) : null}
            {d.deal ? (
              <Card testID="earning-deal">
                <Text className="mb-1 text-sm font-bold text-slate-900">{t('earnings.deal')}</Text>
                <Row label={t('earnings.dealType')} value={t(`earnings.dealTypes.${d.deal.deal_type}`, { defaultValue: d.deal.deal_type })} />
                <Row label={t('earnings.dealValue')} value={formatINR(d.deal.deal_value)} />
                <Row label={t('earnings.expectedFee')} value={formatINR(d.deal.expected_fee)} />
                <Row label={t('earnings.bookedOn')} value={d.deal.booked_on} />
                <Row label={t('earnings.dealStatus')} value={L.enumLabel('transaction_status', d.deal.transaction_status)} />
                <Row label={t('earnings.feeStatus')} value={d.deal.fee_status ? L.enumLabel('fee_status', d.deal.fee_status) : t('earnings.feeNone')} />
              </Card>
            ) : null}
            {d.contributions.length ? (
              <Card testID="earning-contributions">
                <Text className="mb-1 text-sm font-bold text-slate-900">{t('earnings.contributions')}</Text>
                {d.contributions.map((c, i) => (
                  <View key={`${c.type}-${i}`} className="border-b border-slate-100 py-2">
                    <Badge label={L.enumLabel('contribution_type', c.type)} tone="teal" />
                    {c.reason ? <Text className="mt-1 text-xs text-slate-600">{c.reason}</Text> : null}
                    <Text className="mt-0.5 text-[11px] text-slate-500">{formatWhen(c.started_at)}</Text>
                  </View>
                ))}
                <Text className="mt-2 text-[11px] text-slate-500">{t('earnings.contributionsFoot')}</Text>
              </Card>
            ) : null}
            {d.payout ? (
              <Card>
                <Text className="mb-1 text-sm font-bold text-slate-900">{t('earnings.payout')}</Text>
                <Row label={t('earnings.batchLabel')} value={d.payout.batch_label} />
                <Row label={t('earnings.batchStatus')} value={t(`earnings.batch.${d.payout.batch_status}`, { defaultValue: d.payout.batch_status })} />
                {d.payout.utr ? <Row label="UTR" value={d.payout.utr} /> : null}
                {d.payout.paid_at ? <Row label={t('earnings.paidOn')} value={formatWhen(d.payout.paid_at)} /> : null}
              </Card>
            ) : null}
            <Button variant="secondary" label={t('earnings.question')} onPress={() => router.push({ pathname: '/more/learn', params: { tab: 'tickets', category: 'EARNINGS', requirement_id: d.requirement_id } })} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

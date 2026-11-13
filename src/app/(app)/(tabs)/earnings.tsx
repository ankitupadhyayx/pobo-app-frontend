import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, IndianRupee } from 'lucide-react-native';
import { Card, Chips, EmptyState, ErrorState, InlineBanner, ListSkeleton, SectionTitle } from '@/components/ui';
import { EarningCard, EstimateTag, PayoutRow } from '@/components/earnings/EarningCard';
import { pickHi, useEarnings, type EarningState } from '@/api/hooks/phase3';
import { useLabels } from '@/api/hooks/config';
import { formatINR } from '@/lib/time';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

const STATES: EarningState[] = ['POTENTIAL', 'AWAITING_FEE', 'ELIGIBLE', 'APPROVED', 'SCHEDULED', 'PAID'];

/** Plain explanation of each gate, in the order money unlocks (blueprint §16.1). */
function HowItUnlocks() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Pressable testID="earnings-how" accessibilityRole="button" className="min-h-[44px] flex-row items-center justify-between" onPress={() => setOpen(!open)}>
        <Text className="text-sm font-bold text-slate-900">{t('earnings.howTitle')}</Text>
        {open ? <ChevronUp size={18} color={colors.muted} /> : <ChevronDown size={18} color={colors.muted} />}
      </Pressable>
      {open ? (
        <View className="mt-2 gap-2.5">
          {STATES.map((s, i) => (
            <View key={s} className="flex-row gap-2.5">
              <Text className="w-5 text-xs font-bold text-teal-700">{i + 1}.</Text>
              <View className="flex-1">
                <Text className="text-xs font-bold text-slate-800">{t(`earnings.state.${s}`)}</Text>
                <Text className="text-xs text-slate-600">{t(`earnings.how.${s}`)}</Text>
              </View>
            </View>
          ))}
          <Text className="text-[11px] text-slate-500">{t('earnings.howFoot')}</Text>
        </View>
      ) : null}
    </Card>
  );
}

/** APP-31: earnings by gated state, items with their gate, payout history with UTR. */
export default function EarningsTab() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const [state, setState] = useState<EarningState | null>(null);
  const q = useEarnings();
  const e = q.data;
  const items = (e?.items ?? []).filter((i) => !state || i.state === state);
  const interim = !!e && (e.interim || !!e.rule_set?.interim);

  return (
    <ScrollView
      className="flex-1 bg-slate-100"
      contentContainerClassName="p-4 pb-28 gap-4"
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.brand} />}
    >
      {q.isPending ? (
        <ListSkeleton count={3} />
      ) : !e ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <View className="rounded-3xl bg-teal-900 p-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <IndianRupee size={18} color={colors.white} />
                <Text className="text-lg font-extrabold text-white">{t('earnings.title')}</Text>
              </View>
              {interim && e.amounts_available ? <EstimateTag testID="earnings-interim" /> : null}
            </View>
            <View className="mt-4 flex-row flex-wrap gap-2.5">
              {e.summary.map((s) => (
                <Pressable
                  key={s.state}
                  testID={`earnings-summary-${s.state}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: state === s.state }}
                  onPress={() => setState(state === s.state ? null : s.state)}
                  className={cn('min-w-[30%] flex-1 rounded-2xl border p-3', state === s.state ? 'border-white bg-white/25' : 'border-white/10 bg-white/10')}
                >
                  <Text className="text-[11px] font-medium text-teal-200" numberOfLines={1}>
                    {pickHi(L.hi, s.label, s.label_hi)}
                  </Text>
                  <Text className="mt-0.5 text-lg font-bold text-white" style={{ fontVariant: ['tabular-nums'] }}>
                    {s.amount != null && e.amounts_available ? formatINR(s.amount) : s.count}
                  </Text>
                  {s.amount != null && e.amounts_available ? <Text className="text-[10px] text-teal-200">{t('earnings.items', { count: s.count })}</Text> : null}
                </Pressable>
              ))}
            </View>
          </View>

          {!e.amounts_available ? (
            <InlineBanner tone="info" testID="earnings-no-rules">
              {t('earnings.noRules')}
            </InlineBanner>
          ) : interim ? (
            <InlineBanner tone="warn">{t('earnings.interimBody', { name: e.rule_set?.name ?? '' })}</InlineBanner>
          ) : null}

          <HowItUnlocks />

          <View className="gap-3">
            <SectionTitle title={t('earnings.itemsTitle')} />
            <Chips
              scroll
              testIDPrefix="earnings-filter"
              options={[{ value: 'ALL', label: t('leads.all') }, ...e.summary.map((s) => ({ value: s.state, label: `${pickHi(L.hi, s.label, s.label_hi)} (${s.count})` }))]}
              value={state ?? 'ALL'}
              allowDeselect={false}
              onChange={(v) => setState(v === 'ALL' ? null : (v as EarningState))}
            />
            {items.length === 0 ? (
              <EmptyState icon={IndianRupee} title={t('earnings.emptyTitle')} body={t('earnings.emptyBody')} />
            ) : (
              items.map((item) => <EarningCard key={item.id} item={item} hi={L.hi} onPress={() => router.push({ pathname: '/earnings/[id]', params: { id: item.id } })} />)
            )}
          </View>

          <Card>
            <Text className="text-sm font-bold text-slate-900">{t('earnings.payoutsTitle')}</Text>
            {e.payouts.length === 0 ? (
              <Text className="mt-1 text-xs text-slate-500">{t('earnings.payoutsEmpty')}</Text>
            ) : (
              e.payouts.map((p) => <PayoutRow key={p.batch_id} p={p} />)
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

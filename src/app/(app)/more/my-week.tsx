import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Flame, Trophy } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Card, ErrorState, ListSkeleton } from '@/components/ui';
import { pickHi, useMyWeek, type MyWeek } from '@/api/hooks/phase3';
import { formatMetric, localToday, shiftDate } from '@/lib/week';
import { useLabels } from '@/api/hooks/config';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

const dayLabel = (iso: string, lang: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', timeZone: 'UTC' });
};

/** Work done per day: first contacts, follow-ups, visits and surveys. Calls are not counted here on purpose. */
const dayWork = (d: MyWeek['days'][number]) => (d.first_contacts === null ? null : (d.first_contacts ?? 0) + (d.follow_ups_done ?? 0) + (d.visits_done ?? 0) + (d.surveys ?? 0));

/** APP-32: weekly summary, Today's Wins and SLA streak. Helpful, not surveillance; call volume is never the headline. */
export default function MyWeekScreen() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const [weekStart, setWeekStart] = useState<string | undefined>();
  const q = useMyWeek(weekStart);
  const w = q.data;
  const isCurrent = !weekStart;
  const groups = w ? [...w.groups].sort((a, b) => Number(a.key === 'calling') - Number(b.key === 'calling')) : [];
  const maxWork = w ? Math.max(1, ...w.days.map((d) => dayWork(d) ?? 0)) : 1;
  const today = localToday();

  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('profile.myWeek')} />
      <ScrollView contentContainerClassName="p-4 gap-4 pb-12" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.brand} />}>
        {q.isPending ? (
          <ListSkeleton count={3} />
        ) : !w ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <>
            <View className="flex-row items-center justify-between">
              <Pressable testID="week-prev" accessibilityRole="button" accessibilityLabel={t('week.prev')} hitSlop={8} className="h-11 w-11 items-center justify-center" onPress={() => setWeekStart(shiftDate(w.week_start, -7))}>
                <ChevronLeft size={22} color={colors.brandDark} />
              </Pressable>
              <Text className="text-sm font-bold text-slate-800">{isCurrent ? t('week.thisWeek') : t('week.range', { from: w.week_start, to: w.week_end })}</Text>
              <Pressable testID="week-next" accessibilityRole="button" accessibilityLabel={t('week.next')} hitSlop={8} disabled={isCurrent} className="h-11 w-11 items-center justify-center" onPress={() => {
                const next = shiftDate(w.week_start, 7);
                setWeekStart(next > today ? undefined : next);
              }}>
                <ChevronRight size={22} color={isCurrent ? colors.line : colors.brandDark} />
              </Pressable>
            </View>

            <View testID="week-headline" className="rounded-3xl bg-teal-900 p-5">
              <Text className="text-xs font-bold uppercase tracking-wider text-teal-200">{pickHi(L.hi, w.headline.label, w.headline.label_hi)}</Text>
              <Text className="mt-1 text-4xl font-extrabold text-white" style={{ fontVariant: ['tabular-nums'] }}>
                {formatMetric(w.headline, w.headline.value)}
              </Text>
              {w.headline.previous !== null ? <Text className="text-xs text-teal-100">{t('week.lastWeek', { value: formatMetric(w.headline, w.headline.previous) })}</Text> : null}
              {w.message ? <Text className="mt-3 text-sm text-teal-50">{pickHi(L.hi, w.message, w.message_hi)}</Text> : null}
              <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-white/10 p-3">
                <Flame size={18} color="#fdba74" />
                <Text testID="week-streak" className="flex-1 text-sm font-semibold text-white">
                  {t('week.streak', { count: w.sla_streak_days })}
                </Text>
              </View>
            </View>

            {isCurrent ? (
              <Card testID="week-wins">
                <View className="flex-row items-center gap-2">
                  <Trophy size={16} color={colors.warn} />
                  <Text className="text-sm font-bold text-slate-900">{t('week.wins')}</Text>
                </View>
                {w.todays_wins.length === 0 ? (
                  <Text className="mt-1 text-xs text-slate-500">{t('week.noWins')}</Text>
                ) : (
                  w.todays_wins.map((win) => (
                    <Text key={win.key} className="mt-1.5 text-sm text-slate-800">
                      ✓ {pickHi(L.hi, win.text, win.text_hi)}
                    </Text>
                  ))
                )}
              </Card>
            ) : null}

            <Card testID="week-days">
              <Text className="text-sm font-bold text-slate-900">{t('week.daily')}</Text>
              <Text className="text-[11px] text-slate-500">{t('week.dailyHint')}</Text>
              <View className="mt-3 h-28 flex-row items-end justify-between gap-1.5">
                {w.days.map((d) => {
                  const v = dayWork(d);
                  return (
                    <View key={d.date} className="flex-1 items-center" accessibilityLabel={`${dayLabel(d.date, L.hi ? 'hi' : 'en')}: ${v ?? '—'}`}>
                      <Text className="text-[10px] font-bold text-slate-700">{v ?? ''}</Text>
                      <View className={d.date === today ? 'w-full rounded-md bg-teal-600' : 'w-full rounded-md bg-teal-300'} style={{ height: v ? Math.max(4, (v / maxWork) * 72) : 2 }} />
                      <Text className="mt-1 text-[10px] text-slate-500">{dayLabel(d.date, L.hi ? 'hi' : 'en')}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            {groups.map((g) => (
              <Card key={g.key} testID={`week-group-${g.key}`}>
                <Text className="mb-1 text-sm font-bold text-slate-900">{pickHi(L.hi, g.label, g.label_hi)}</Text>
                {g.metrics.map((m) => (
                  <View key={m.key} className="min-h-[40px] flex-row items-center justify-between border-b border-slate-100 py-1.5">
                    <Text className="flex-1 text-sm text-slate-600">{pickHi(L.hi, m.label, m.label_hi)}</Text>
                    <View className="items-end">
                      <Text className="text-sm font-bold text-slate-900" style={{ fontVariant: ['tabular-nums'] }}>
                        {formatMetric(m, m.value)}
                      </Text>
                      {m.previous !== null ? <Text className="text-[10px] text-slate-500">{t('week.lastWeek', { value: formatMetric(m, m.previous) })}</Text> : null}
                    </View>
                  </View>
                ))}
              </Card>
            ))}
            <Text className="text-center text-[11px] text-slate-500">{t('week.foot')}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

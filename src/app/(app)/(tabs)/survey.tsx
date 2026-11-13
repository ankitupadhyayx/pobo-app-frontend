import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2, ChevronRight, ClipboardList, KeyRound, MapPin, RefreshCw } from 'lucide-react-native';
import { Badge, EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { ProgressBars } from '@/components/survey/ProgressBars';
import { MatrixLegend } from '@/components/survey/UnitMatrix';
import { useFieldTasks, useMappingSocieties } from '@/api/hooks/field';
import { useLabels } from '@/api/hooks/config';
import { useMe } from '@/api/hooks/me';
import { useOutbox } from '@/offline';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

function Shortcut({ icon: Icon, label, count, onPress, testID, tone = 'slate' }: { icon: typeof MapPin; label: string; count?: number; onPress: () => void; testID: string; tone?: 'slate' | 'rose' | 'amber' }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} className="flex-1 items-center gap-1 rounded-2xl border border-slate-200 bg-white p-3 active:bg-slate-50">
      <Icon size={18} color={colors.slate700} />
      <Text numberOfLines={1} className="text-xs font-bold text-slate-800">{label}</Text>
      {count ? (
        <View className={tone === 'rose' ? 'rounded-full bg-rose-600 px-1.5' : tone === 'amber' ? 'rounded-full bg-amber-500 px-1.5' : 'rounded-full bg-slate-700 px-1.5'}>
          <Text className="text-[10px] font-bold text-white">{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** APP-21 survey home: my societies with mapping and survey progress kept separate. */
export default function SurveyTab() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const me = useMe();
  const q = useMappingSocieties();
  const tasks = useFieldTasks('OPEN');
  const sync = useOutbox();
  const list = q.data ?? [];
  const totals = list.reduce(
    (a, s) => ({ mapped: a.mapped + s.progress.units_mapped, approx: a.approx + (s.progress.approx_units ?? 0), surveyed: a.surveyed + s.progress.units_surveyed }),
    { mapped: 0, approx: 0, surveyed: 0 },
  );
  return (
    <ScrollView
      className="flex-1 bg-slate-100"
      contentContainerClassName="p-4 pb-12 gap-4"
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); void tasks.refetch(); }} tintColor={colors.brand} />}
    >
      <View className="gap-3 rounded-3xl bg-slate-900 p-5">
        <View className="flex-row items-center gap-2">
          <MapPin size={14} color="#2dd4bf" />
          <Text className="text-xs font-bold uppercase tracking-wider text-teal-300">{t('surveyHome.territory')}</Text>
        </View>
        <Text className="text-lg font-bold text-white">{me.data?.aa_profile?.territory?.name ?? ''}</Text>
        <Text className="text-xs text-teal-200/80">{t('surveyHome.societies', { count: list.length })}</Text>
        <View className="rounded-2xl bg-white p-3">
          <ProgressBars mapped={totals.mapped} expected={totals.approx || null} surveyed={totals.surveyed} />
        </View>
      </View>

      <View className="flex-row gap-2">
        <Shortcut testID="survey-tasks" icon={ClipboardList} label={t('fieldTasks.title')} count={tasks.data?.length} tone="amber" onPress={() => router.push('/more/field-tasks')} />
        <Shortcut testID="survey-listings" icon={Building2} label={t('listings.mine')} onPress={() => router.push('/more/listings')} />
        <Shortcut testID="survey-keys" icon={KeyRound} label={t('keys.title')} onPress={() => router.push('/more/keys')} />
        <Shortcut
          testID="survey-sync"
          icon={RefreshCw}
          label={t('sync.title')}
          count={sync.pending + sync.conflicts + sync.rejected}
          tone={sync.conflicts + sync.rejected ? 'rose' : 'slate'}
          onPress={() => router.push('/more/sync')}
        />
      </View>

      <View className="gap-1 rounded-2xl border border-slate-200 bg-white p-3">
        <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{t('surveyHome.legend')}</Text>
        <MatrixLegend />
      </View>

      <Text className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">{t('surveyHome.mySocieties')}</Text>
      {q.isPending ? (
        <ListSkeleton count={3} />
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={Building2} title={t('surveyHome.emptyTitle')} body={t('surveyHome.emptyBody')} />
      ) : (
        list.map((s) => (
          <Pressable
            key={s.id}
            testID={`society-${s.id}`}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/field/society/[id]', params: { id: s.id } })}
            className="gap-3 rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50"
          >
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1 flex-row items-center gap-2.5">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
                  <Building2 size={20} color={colors.brandDark} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900">{s.name}</Text>
                  <Text className="text-xs text-slate-500">
                    {s.locality} · {t('surveyHome.towers', { count: s.progress.towers })}
                    {s.my_zones.length ? ` · ${s.my_zones.join(', ')}` : ''}
                  </Text>
                </View>
              </View>
              {s.my_role ? <Badge label={L.glossary(s.my_role === 'COVER' ? 'COVER_AA' : 'PRIMARY_AA', s.my_role).label} tone={s.my_role === 'COVER' ? 'amber' : 'teal'} /> : null}
            </View>
            <ProgressBars mapped={s.progress.units_mapped} expected={s.progress.approx_units} surveyed={s.progress.units_surveyed} />
            <View className="flex-row items-center justify-end gap-1">
              <Text className="text-xs font-bold text-teal-700">{s.progress.units_mapped ? t('surveyHome.continue') : t('surveyHome.startMapping')}</Text>
              <ChevronRight size={14} color={colors.brandDark} />
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Focus, Search, SlidersHorizontal, UserPlus, X, Users } from 'lucide-react-native';
import { BottomSheet, Button, Checkbox, Chips, EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { LeadCard } from '@/components/leads/LeadCard';
import { useRelationships, type RelationshipFilters } from '@/api/hooks/leads';
import { useLabels } from '@/api/hooks/config';
import type { RelationshipList } from '@/api/types';
import { useActions } from '@/state/actions';
import { analytics } from '@/lib/analytics';
import { formatWhen } from '@/lib/time';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n';

type StageKey = 'ALL' | 'NEW' | 'CONTACT_ATTEMPTED' | 'CONNECTED' | 'QUALIFIED' | 'VISIT_SCHEDULED' | 'NEGOTIATION' | 'ON_HOLD' | 'CLOSED';
const STAGES: StageKey[] = ['ALL', 'NEW', 'CONTACT_ATTEMPTED', 'CONNECTED', 'QUALIFIED', 'VISIT_SCHEDULED', 'NEGOTIATION', 'ON_HOLD', 'CLOSED'];
type FocusKey = NonNullable<RelationshipFilters['focus']>;
const FOCUS_KEYS: FocusKey[] = ['sla', 'new', 'follow_ups'];
const asFocus = (v: unknown): FocusKey | null => (FOCUS_KEYS.includes(v as FocusKey) ? (v as FocusKey) : null);

export default function LeadsScreen() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string }>();
  const L = useLabels();
  const dial = useActions((s) => s.dial);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [stage, setStage] = useState<StageKey>('ALL');
  const [types, setTypes] = useState<string[]>([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [scope, setScope] = useState<'all' | 'owned' | 'servicing'>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  // Set by Home "View all" via the route param: same rules and order as that Home section.
  const focus = asFocus(params.focus);
  const clearFocus = () => router.setParams({ focus: undefined });

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(h);
  }, [search]);

  const filters = useMemo(() => {
    const f: Omit<RelationshipFilters, 'cursor'> = { scope };
    if (focus) f.focus = focus;
    if (debounced) f.search = debounced;
    if (stage === 'CLOSED') f.stage = ['CLOSED_WON', 'CLOSED_LOST'];
    else if (stage !== 'ALL') f.stage = [stage];
    if (types.length) f.type = types as RelationshipFilters['type'];
    if (overdueOnly) f.sla_state = ['TARGET_MISSED', 'BREACHED'];
    return f;
  }, [debounced, stage, types, overdueOnly, scope, focus]);

  const q = useRelationships(filters);
  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.results) ?? [], [q.data]);
  const deepFilters = types.length > 0 || overdueOnly || scope !== 'all';
  const anyFilter = deepFilters || stage !== 'ALL' || !!debounced || !!focus;

  const stageOptions = STAGES.map((s) => ({
    value: s,
    label: s === 'ALL' ? t('leads.all') : s === 'CLOSED' ? t('leads.closed') : L.enumLabel('requirement_status', s),
  }));

  const clear = () => {
    setStage('ALL');
    setTypes([]);
    setOverdueOnly(false);
    setScope('all');
    setSearch('');
    clearFocus();
  };

  const open = useCallback(
    (r: RelationshipList) => {
      analytics.track('lead_opened', { screen: 'leads' });
      router.push({ pathname: '/lead/[id]', params: { id: r.id } });
    },
    [router],
  );

  const renderItem = ({ item: r }: { item: RelationshipList }) => {
    const mine = r.requirements.filter((x) => x.is_mine);
    const callReq = r.next_action?.requirement_id ?? r.sla?.requirement_id ?? mine[0]?.id;
    const first = r.requirements[0];
    const meta = [first?.title.split(' · ').slice(1).join(' · '), first?.configuration ? L.master('CONFIGURATION', first.configuration) : null]
      .filter(Boolean)
      .join(' · ');
    const dnc = !!r.customer.dnc;
    return (
      <LeadCard
        id={r.id}
        name={r.customer.name}
        intents={r.requirements.map((x) => ({ type: x.type, label: x.is_draft ? `${L.enumLabel('requirement_type', x.type)} · ${t('draftReq.badge')}` : L.enumLabel('requirement_type', x.type) }))}
        stage={{ status: r.stage, label: dnc ? L.glossary('DNC', 'Do Not Contact').label : L.enumLabel('requirement_status', r.stage) }}
        meta={meta}
        sla={r.sla && r.sla.due_at ? { dueAt: r.sla.due_at, breachAt: r.sla.breach_at, paused: r.sla.state === 'PAUSED' } : undefined}
        nextAction={
          r.next_action && r.next_action.type !== 'NONE'
            ? { title: r.next_action.title, dueText: r.next_action.due_at ? formatWhen(r.next_action.due_at) : undefined, overdue: r.next_action.is_overdue }
            : null
        }
        dnc={dnc}
        canCall={!dnc && mine.length > 0 && !!r.customer.phone}
        onCall={() => callReq && dial({ relationshipId: r.id, requirementId: callReq, phone: r.customer.phone })}
        onOpen={() => open(r)}
      />
    );
  };

  return (
    <View className="flex-1 bg-slate-100">
      <View className="gap-3 px-4 pb-2 pt-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-extrabold tracking-tight text-slate-900">{t('leads.title')}</Text>
            {q.data ? <Text className="text-xs font-medium text-slate-500">{t('leads.count', { count: rows.length })}{q.hasNextPage ? '+' : ''}</Text> : null}
          </View>
          <Button testID="leads-add" size="sm" icon={UserPlus} label={L.glossary('ADD_LEAD', 'Add Lead').label} onPress={() => router.push('/lead/new')} />
        </View>
        <View className="flex-row items-center gap-2">
          <View className="h-11 flex-1 flex-row items-center rounded-xl border border-slate-200 bg-white px-3">
            <Search size={16} color={colors.slate400} />
            <TextInput
              testID="leads-search"
              value={search}
              onChangeText={setSearch}
              placeholder={t('leads.searchPlaceholder')}
              placeholderTextColor={colors.slate400}
              returnKeyType="search"
              className="flex-1 px-2 text-sm text-slate-900"
            />
            {search ? (
              <Pressable accessibilityLabel="Clear search" hitSlop={10} onPress={() => setSearch('')}>
                <X size={16} color={colors.slate400} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            testID="leads-filters"
            accessibilityRole="button"
            accessibilityLabel={t('leads.filters')}
            onPress={() => setSheetOpen(true)}
            className={cn('h-11 w-11 items-center justify-center rounded-xl border', deepFilters ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white')}
          >
            <SlidersHorizontal size={18} color={deepFilters ? colors.brandDark : colors.slate700} />
            {deepFilters ? <View className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-teal-600" /> : null}
          </Pressable>
        </View>
        {focus ? (
          <View testID="leads-focus" className="flex-row items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2">
            <Focus size={14} color={colors.brandDark} />
            <Text className="flex-1 text-xs font-semibold text-teal-900">{t(`leads.focus.${focus}`)}</Text>
            <Pressable testID="leads-focus-clear" accessibilityRole="button" accessibilityLabel={t('leads.focusClear')} hitSlop={10} onPress={clearFocus}>
              <X size={16} color={colors.brandDark} />
            </Pressable>
          </View>
        ) : null}
        <Chips scroll options={stageOptions} value={stage} allowDeselect={false} onChange={(v) => setStage(v as StageKey)} testIDPrefix="stage" />
      </View>

      {q.isPending ? (
        <View className="px-4">
          <ListSkeleton count={4} />
        </View>
      ) : q.error && !q.data ? (
        <View className="px-4">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerClassName="px-4 pb-10 gap-3"
          onEndReachedThreshold={0.4}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => void q.refetch()} tintColor={colors.brand} colors={[colors.brand]} />}
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator className="py-4" color={colors.brand} /> : undefined}
          ListEmptyComponent={
            anyFilter ? (
              <EmptyState icon={Search} title={t('leads.emptyTitle')} body={t('leads.emptyBody')} action={{ label: t('leads.clear'), onPress: clear }} />
            ) : (
              <EmptyState icon={Users} title={t('leads.emptyNoneTitle')} body={t('leads.emptyNoneBody')} action={{ label: L.glossary('ADD_LEAD', 'Add Lead').label, onPress: () => router.push('/lead/new') }} />
            )
          }
        />
      )}

      <BottomSheet
        testID="leads-filter-sheet"
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('leads.filters')}
        footer={
          <>
            <Button variant="secondary" label={t('leads.clear')} onPress={clear} />
            <Button className="flex-1" label={t('common.done')} onPress={() => setSheetOpen(false)} />
          </>
        }
      >
        <Checkbox tone="danger" checked={overdueOnly} onChange={setOverdueOnly} label={t('leads.overdueOnly')} />
        <Chips
          label={t('leads.intent')}
          multiple
          options={L.enumOptions('requirement_type', ['BUY', 'SELL', 'RENT', 'RENT_OUT', 'GENERAL'])}
          value={types}
          onChange={(v) => setTypes((v as string[]) ?? [])}
        />
        <Chips
          label={t('leads.scope')}
          options={[
            { value: 'all', label: t('leads.scopeAll') },
            { value: 'owned', label: L.glossary('RELATIONSHIP_OWNER', 'Relationship Owner').label },
            { value: 'servicing', label: L.glossary('SERVICING_AA', 'Servicing AA').label },
          ]}
          value={scope}
          allowDeselect={false}
          onChange={(v) => setScope(v as typeof scope)}
        />
      </BottomSheet>
    </View>
  );
}

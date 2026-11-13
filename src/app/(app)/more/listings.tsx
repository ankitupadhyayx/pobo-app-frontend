import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2 } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Chips, EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { ListingCard } from '@/components/listings/ListingCard';
import { useListings } from '@/api/hooks/listings';
import { useLabels } from '@/api/hooks/config';
import { useOutbox } from '@/offline';
import type { ListingState } from '@/components/survey/unitStyle';
import { colors } from '@/theme/colors';
import { placeTitle } from '@/lib/property';
import { useT } from '@/i18n';

const FILTERS = ['ALL', 'DRAFT', 'CHANGES_REQUESTED', 'SUBMITTED', 'VERIFIED'] as const;

/** APP-26 My listings, filterable by state; change requests first. */
export default function MyListingsScreen() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const sync = useOutbox();
  const [f, setF] = useState<(typeof FILTERS)[number]>('ALL');
  const q = useListings({ scope: 'mine', ...(f === 'ALL' ? {} : { status: f }) });
  const rows = [...(q.data?.results ?? [])].sort((a, b) => Number(b.status === 'CHANGES_REQUESTED') - Number(a.status === 'CHANGES_REQUESTED'));
  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('listings.mine')} />
      <View className="px-4 pt-4">
        <Chips scroll options={FILTERS.map((x) => ({ value: x, label: x === 'ALL' ? t('leads.all') : L.enumLabel('listing_status', x) }))} value={f} allowDeselect={false} onChange={(v) => setF(v as typeof f)} />
      </View>
      <ScrollView contentContainerClassName="p-4 gap-3 pb-12" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.brand} />}>
        {q.isPending ? (
          <ListSkeleton count={2} />
        ) : q.error && !q.data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Building2} title={t('listings.empty')} body={t('listings.emptyBody')} />
        ) : (
          rows.map((l) => {
            const st = sync.byEntity[`listing:${l.id}`];
            return (
              <ListingCard
                key={l.id}
                id={l.id}
                title={placeTitle(l, (c) => L.enumLabel('property_kind', c))}
                subtitle={[L.enumLabel('listing_type', l.type), l.configuration ? L.master('CONFIGURATION', l.configuration) : null].filter(Boolean).join(' · ')}
                state={l.status as ListingState}
                stateLabel={L.enumLabel('listing_status', l.status)}
                price={l.expected_price}
                rent={l.expected_rent}
                photos={l.photos.length}
                changeRequest={l.status === 'CHANGES_REQUESTED' ? l.review_note || t('listings.changesRequested') : null}
                sync={st === 'conflict' ? 'conflict' : st === 'rejected' ? 'rejected' : st === 'pending' ? 'saved_local' : undefined}
                onPress={() => router.push({ pathname: '/listing/[id]', params: { id: l.id } })}
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

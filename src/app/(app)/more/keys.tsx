import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyRound } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Chips, EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { KeyCard } from '@/components/listings/KeyCard';
import { ReturnKeySheet } from '@/components/listings/UnitSheets';
import { useMyKeys, type Key } from '@/api/hooks/listings';
import { useLabels } from '@/api/hooks/config';
import { useOutbox } from '@/offline';
import { useActions } from '@/state/actions';
import { useOnline } from '@/hooks/useOnline';
import { formatWhen } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

/** APP-28 Keys tab: what I hold now; returning works offline. */
export default function KeysScreen() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const sync = useOutbox();
  // REQ-11: a "key collected / returned" notification opens here with ?key=<id>; that key shows first.
  const { key: focusKey } = useLocalSearchParams<{ key?: string }>();
  const [scope, setScope] = useState<'HELD' | 'all'>(focusKey ? 'all' : 'HELD');
  const q = useMyKeys(scope);
  const [ret, setRet] = useState<Key | null>(null);
  const online = useOnline();
  const showToast = useActions((s) => s.showToast);
  const keys = [...(q.data ?? [])].sort((a, b) => Number(b.id === focusKey) - Number(a.id === focusKey));
  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('keys.title')} />
      <View className="px-4 pt-4">
        <Chips testIDPrefix="keys-scope" options={[{ value: 'HELD', label: t('keys.held') }, { value: 'all', label: t('keys.all') }]} value={scope} allowDeselect={false} onChange={(v) => setScope(v as 'HELD' | 'all')} />
      </View>
      <ScrollView contentContainerClassName="p-4 gap-3 pb-12" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.brand} />}>
        {q.isPending ? (
          <ListSkeleton count={2} />
        ) : q.error && !q.data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : keys.length === 0 ? (
          <EmptyState icon={KeyRound} title={t('keys.emptyTitle')} body={`${t('keys.emptyBody')} ${t('keys.recordHint')}`} />
        ) : (
          keys.map((k) => {
            const st = sync.byEntity[`key:${k.id}`];
            return (
              <KeyCard
                key={k.id}
                id={k.id}
                unitLabel={k.unit_label || k.listing_title || t('keys.property')}
                society={[k.unit_id && k.listing_title && k.listing_title !== k.unit_label ? k.listing_title : '', !k.unit_id ? t('keys.independent') : '', k.tag ? `${t('keys.tag')}: ${k.tag}` : '', k.status !== 'HELD' && k.returned_at ? t('keys.returnedOn', { when: formatWhen(k.returned_at) }) : ''].filter(Boolean).join(' · ')}
                takenAt={k.taken_at}
                from={L.master('KEY_PARTY', k.taken_from)}
                purpose={k.notes}
                sync={st === 'pending' ? 'saved_local' : st === 'conflict' ? 'conflict' : st === 'rejected' ? 'rejected' : undefined}
                onReturn={st || k.status !== 'HELD' ? undefined : () => setRet(k)}
              />
            );
          })
        )}
      </ScrollView>
      {ret ? <ReturnKeySheet k={ret} parties={L.options('KEY_PARTY')} onClose={() => setRet(null)} onDone={() => showToast(online ? t('keys.returned') : t('unitSurvey.savedLocal'))} /> : null}
    </View>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CloudOff } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Button, Card, EmptyState, InlineBanner, SyncChip } from '@/components/ui';
import { outbox, useOutbox } from '@/offline';
import type { OutboxItem } from '@/offline/types';
import { useOnline } from '@/hooks/useOnline';
import { formatAgo, formatWhen } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

function humanKey(k: string) {
  const s = k.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Field-by-field comparison of my queued change against the server's current record. */
export function ConflictDiff({ mine, server }: { mine: Record<string, unknown>; server: Record<string, unknown> }) {
  const t = useT();
  const keys = Object.keys(mine).filter((k) => JSON.stringify(mine[k]) !== JSON.stringify(server[k]));
  return (
    <View className="gap-1.5">
      <View className="flex-row">
        <Text className="flex-1 text-[10px] font-bold uppercase text-slate-400"> </Text>
        <Text className="flex-1 text-[10px] font-bold uppercase text-amber-700">{t('sync.mine')}</Text>
        <Text className="flex-1 text-[10px] font-bold uppercase text-slate-600">{t('sync.server')}</Text>
      </View>
      {keys.map((k) => (
        <View key={k} className="flex-row gap-2 rounded-lg bg-slate-50 p-2">
          <Text className="flex-1 text-[11px] font-semibold text-slate-600">{humanKey(k)}</Text>
          <Text className="flex-1 text-[11px] font-bold text-amber-900">{show(mine[k])}</Text>
          <Text className="flex-1 text-[11px] font-bold text-slate-800">{show(server[k])}</Text>
        </View>
      ))}
      {!keys.length ? <Text className="text-[11px] text-slate-500">{t('sync.sameValues')}</Text> : null}
    </View>
  );
}

/** APP-24 sync status + conflict screen. */
export default function SyncScreen() {
  const t = useT();
  const router = useRouter();
  const online = useOnline();
  const snap = useOutbox();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const load = useCallback(() => void outbox.list().then(setItems), []);
  useEffect(load, [load, snap]);

  const state = (i: OutboxItem) => (i.status === 'conflict' ? 'conflict' : i.status === 'rejected' ? 'rejected' : snap.syncing ? 'syncing' : 'saved_local');

  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('sync.title')} />
      <ScrollView contentContainerClassName="p-4 gap-3 pb-12" refreshControl={<RefreshControl refreshing={snap.syncing} onRefresh={() => void outbox.flush()} tintColor={colors.brand} />}>
        <Card>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-bold text-slate-900">{t('sync.bannerPending', { count: snap.pending })}</Text>
              <Text className="text-[11px] text-slate-500">{snap.lastSyncedAt ? t('sync.lastSynced', { when: formatAgo(snap.lastSyncedAt) }) : t('sync.never')}</Text>
            </View>
            <Button testID="sync-now" size="sm" label={t('sync.syncNow')} loading={snap.syncing} disabled={!online || snap.pending === 0} onPress={() => void outbox.flush()} />
          </View>
          {snap.lastError ? <View className="mt-2"><InlineBanner tone="warn">{snap.lastError}</InlineBanner></View> : null}
        </Card>

        {items.length === 0 ? (
          <EmptyState icon={CloudOff} title={t('sync.emptyTitle')} body={t('sync.emptyBody')} />
        ) : (
          items.map((i) => (
            <Card key={i.clientId} tone={i.status === 'conflict' || i.status === 'rejected' ? 'alert' : 'default'} testID={`outbox-${i.status}`}>
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900">{i.label}</Text>
                  <Text className="text-[11px] text-slate-500">{formatWhen(i.queuedAt)}</Text>
                </View>
                <SyncChip state={state(i)} />
              </View>
              {i.status === 'conflict' && i.server ? (
                <View className="mt-3 gap-2">
                  <Text className="text-xs font-bold text-rose-800">{t('sync.conflictTitle')}</Text>
                  <Text className="text-xs text-slate-600">{t('sync.conflictBody')}</Text>
                  <ConflictDiff mine={i.payload} server={i.server} />
                  <View className="flex-row gap-2">
                    <Button testID="conflict-keep-server" size="sm" variant="secondary" label={t('sync.keepServer')} onPress={() => void outbox.keepServer(i.clientId)} />
                    <Button testID="conflict-apply-mine" size="sm" className="flex-1" label={t('sync.applyMine')} disabled={!online} onPress={() => void outbox.applyMineOnTop(i.clientId)} />
                  </View>
                </View>
              ) : null}
              {i.status === 'rejected' ? (
                <View className="mt-3 gap-2">
                  <InlineBanner>{i.error ?? ''}</InlineBanner>
                  <Button size="sm" variant="outline" label={t('sync.discard')} onPress={() => void outbox.discard(i.clientId)} />
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

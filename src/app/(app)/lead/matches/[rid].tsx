import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Share2, Sparkles } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { BottomSheet, Button, Chips, EmptyState, ErrorState, InlineBanner, ListSkeleton, Select, TextField } from '@/components/ui';
import { MatchCard, type ShortlistState } from '@/components/listings/MatchCard';
import { ScheduleVisitSheet } from '@/components/visits/ScheduleVisitSheet';
import { useAddToShortlist, useMatches, useRecordShare, useShortlist, useUpdateShortlist, type Match, type ShareChannel, type ShortlistItem } from '@/api/hooks/listings';
import { useRequirement, uuid as newClientId } from '@/api/hooks/leads';
import { shareSummary } from '@/components/listings/share';
import { formatTime, formatWhen } from '@/lib/time';
import { useLabels } from '@/api/hooks/config';
import { useSubmit } from '@/hooks/useSubmit';
import { useOnline } from '@/hooks/useOnline';
import { useActions } from '@/state/actions';
import { analytics } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { placeTitle } from '@/lib/property';
import { useT } from '@/i18n';

type Brief = Match['listing'];
const listingTitle = (l: Brief) => l.title || placeTitle(l);

function NotSuitableSheet({ item, rid, onClose }: { item: { id: string; title: string }; rid: string; onClose: () => void }) {
  const t = useT();
  const L = useLabels();
  const upd = useUpdateShortlist(rid);
  const [reason, setReason] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string>();
  const s = useSubmit(async () => {
    await upd.mutateAsync({ id: item.id, body: { status: 'NOT_SUITABLE', reason: reason!, notes: notes.trim() || undefined } });
    analytics.track('shortlist_updated', { status: 'NOT_SUITABLE', reason_code: reason });
  }, onClose);
  return (
    <BottomSheet visible onClose={onClose} dismissable={!s.busy} title={t('matches.notSuitable')} subtitle={item.title} footer={<Button className="flex-1" label={t('common.save')} loading={s.busy} onPress={() => (reason ? void s.run(undefined) : setErr(t('errors.required')))} />}>
      <Select label={t('matches.reason')} required options={L.options('NOT_SUITABLE_REASON')} value={reason} onChange={setReason} error={err ?? s.apiField('reason')} />
      <TextField label={t('call.notes')} multiline value={notes} onChangeText={setNotes} />
      {s.banner(['reason', 'status']) ? <InlineBanner>{s.banner(['reason', 'status'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}

/** FB-04: share shortlisted properties through the phone's share sheet, then record the share. */
function ShareSheet({ rid, items, customer, onClose }: { rid: string; items: { id: string; listing: Brief }[]; customer: string; onClose: () => void }) {
  const t = useT();
  const L = useLabels();
  const record = useRecordShare(rid);
  const showSuccess = useActions((s) => s.showSuccess);
  const channels = L.enumOptions('share_channel', ['WHATSAPP', 'SMS', 'OTHER']);
  const [channel, setChannel] = useState<string>('WHATSAPP');
  const message = shareSummary(items.map((i) => i.listing), (c) => L.master('CONFIGURATION', c), t('share.intro'));
  const s = useSubmit(async () => {
    const res = await Share.share({ message });
    if (res.action === Share.dismissedAction) throw new Error(t('share.notShared'));
    const out = await record.mutateAsync({ channel: channel as ShareChannel, shortlist_item_ids: items.map((i) => i.id), message, client_id: newClientId() });
    analytics.track('shortlist_updated', { status: 'SHARED', count: items.length });
    showSuccess({
      title: t('share.doneTitle'),
      lines: [
        { label: t('visits.customer'), value: customer },
        { label: t('share.how'), value: `${L.enumLabel('share_channel', channel)} · ${formatTime(out.share.shared_at)}` },
        { label: t('share.what'), value: t('share.count', { count: items.length }) },
      ],
    });
  }, onClose);
  return (
    <BottomSheet testID="share-sheet" visible onClose={onClose} dismissable={!s.busy} title={t('share.title')} subtitle={customer} footer={<Button testID="share-go" className="flex-1" label={t('share.go')} loading={s.busy} onPress={() => void s.run(undefined)} />}>
      <Chips testIDPrefix="share-channel" label={t('share.channel')} required options={channels} value={channel} allowDeselect={false} onChange={(v) => setChannel(v as string)} />
      <View className="rounded-xl bg-slate-50 p-3">
        <Text className="mb-1 text-[11px] font-bold text-slate-500">{t('share.preview')}</Text>
        <Text testID="share-preview" className="text-xs text-slate-800">{message}</Text>
      </View>
      <Text className="text-[11px] text-slate-500">{t('share.hint')}</Text>
      {s.banner(['channel', 'shortlist_item_ids']) ? <InlineBanner>{s.banner(['channel', 'shortlist_item_ids'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}

/** APP-29 + FB-04: Matched (system options that fit) vs Shortlisted (picked by the AA for this customer), then share. */
export default function MatchesScreen() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const online = useOnline();
  const { showToast, showSuccess } = useActions();
  const { rid, title, customer: customerParam } = useLocalSearchParams<{ rid: string; title?: string; customer?: string }>();
  const [tab, setTab] = useState<'matches' | 'shortlist'>('matches');
  const req = useRequirement(rid);
  const matches = useMatches(rid);
  const shortlist = useShortlist(rid);
  const add = useAddToShortlist(rid);
  const upd = useUpdateShortlist(rid);
  const [sheet, setSheet] = useState<null | { kind: 'notSuitable'; id: string; title: string } | { kind: 'visit'; listing: Brief } | { kind: 'share'; items: { id: string; listing: Brief }[] }>(null);
  const customer = customerParam ?? title ?? '';
  const visitTypes = req.data?.allowed_visit_types ?? [];

  const picked = (shortlist.data ?? []).filter((x) => x.status !== 'SUGGESTED' && x.status !== 'NOT_SUITABLE');
  const matched = (matches.data ?? []).filter((m) => !m.shortlist_status || m.shortlist_status === 'SUGGESTED' || m.shortlist_status === 'NOT_SUITABLE');
  const toShare = picked.filter((x) => x.status === 'SHORTLISTED');

  const setStatus = (id: string, status: 'INTERESTED') =>
    upd.mutate(
      { id, body: { status } },
      {
        onSuccess: () => {
          analytics.track('shortlist_updated', { status });
          showToast(t('matches.updated'));
        },
        onError: (e) => showToast((e as Error).message),
      },
    );

  const shortlistIt = (listing: Brief) =>
    add.mutate(listing.id, {
      onSuccess: (item: ShortlistItem) => {
        analytics.track('shortlist_updated', { status: 'SHORTLISTED' });
        // FB-04: the obvious next action after shortlisting is sharing it with the customer.
        showSuccess({
          title: t('matches.shortlistedTitle'),
          lines: [
            { label: t('visits.property'), value: listingTitle(listing) },
            { label: t('visits.customer'), value: customer },
          ],
          actions: [{ label: t('matches.shareWithClient'), testID: 'success-share', onPress: () => setSheet({ kind: 'share', items: [{ id: item.id, listing }] }) }],
        });
      },
      onError: (e) => showToast((e as Error).message),
    });

  const actionsFor = (listing: Brief, itemId: string | null, status: string | null) => {
    if (!online) return [];
    const a: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost'; testID?: string }[] = [];
    if (!status || status === 'SUGGESTED' || status === 'NOT_SUITABLE') a.push({ label: t('matches.shortlist'), testID: `shortlist-${listing.id}`, variant: 'primary', onPress: () => shortlistIt(listing) });
    if (itemId && status === 'SHORTLISTED') a.push({ label: t('matches.shareWithClient'), testID: `share-${listing.id}`, variant: 'primary', onPress: () => setSheet({ kind: 'share', items: [{ id: itemId, listing }] }) });
    if (itemId && status === 'SHARED') a.push({ label: t('matches.interested'), onPress: () => setStatus(itemId, 'INTERESTED') });
    if (itemId && status !== 'NOT_SUITABLE' && status !== 'VISITED') a.push({ label: t('matches.notSuitable'), variant: 'ghost', onPress: () => setSheet({ kind: 'notSuitable', id: itemId, title: listingTitle(listing) }) });
    if (status !== 'NOT_SUITABLE') a.push({ label: t('matches.scheduleVisit'), testID: `visit-${listing.id}`, variant: itemId && status !== 'SUGGESTED' ? 'primary' : 'secondary', onPress: () => setSheet({ kind: 'visit', listing }) });
    return a;
  };

  const sharedLine = (s: { shared_at?: string | null; shared_channel?: string | null }) =>
    s.shared_at ? [t('matches.sharedPrefix'), s.shared_channel ? L.enumLabel('share_channel', s.shared_channel) : null, formatWhen(s.shared_at)].filter(Boolean).join(' · ') : null;

  const card = (m: { listing: Brief; score: number; reasons: string[]; differences: string[]; itemId: string | null; status: string | null; shared?: string | null }) => (
    <MatchCard
      key={m.listing.id}
      id={m.listing.id}
      title={listingTitle(m.listing)}
      subtitle={[m.listing.locality_name, m.listing.configuration ? L.master('CONFIGURATION', m.listing.configuration) : null, t('visits.listingAa', { name: m.listing.aa_name })].filter(Boolean).join(' · ')}
      price={m.listing.expected_price}
      rent={m.listing.expected_rent}
      score={m.score}
      reasons={m.reasons}
      differences={m.differences}
      state={(m.status as ShortlistState) ?? null}
      stateLabel={m.status ? L.enumLabel('shortlist_status', m.status) : undefined}
      sharedLine={m.shared}
      actions={actionsFor(m.listing, m.itemId, m.status)}
    />
  );

  const q = tab === 'matches' ? matches : shortlist;
  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={title ?? t('matches.title')} />
      <View className="px-4 pt-4">
        <View className="flex-row rounded-xl bg-slate-200 p-1">
          {(['matches', 'shortlist'] as const).map((k) => (
            <Pressable key={k} testID={`matches-tab-${k}`} onPress={() => setTab(k)} className={cn('flex-1 items-center rounded-lg py-2', tab === k && 'bg-white')}>
              <Text className={cn('text-xs font-bold', tab === k ? 'text-slate-900' : 'text-slate-500')}>
                {k === 'matches' ? `${t('matches.matchedTab')} (${matched.length})` : `${t('matches.shortlistedTab')} (${picked.length})`}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text className="mt-2 px-1 text-[11px] text-slate-500">{tab === 'matches' ? t('matches.matchedHelp') : t('matches.shortlistedHelp')}</Text>
      </View>
      <ScrollView contentContainerClassName="p-4 pb-12 gap-3" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.brand} />}>
        {tab === 'matches' ? <InlineBanner tone="info">{t('matches.onlyVerified')}</InlineBanner> : null}
        {tab === 'matches' && req.data?.location_status === 'NOT_CAPTURED' ? (
          <InlineBanner testID="matches-no-location">{t('matches.noLocation')}</InlineBanner>
        ) : tab === 'matches' && req.data?.location_status === 'OPEN' ? (
          <InlineBanner tone="info">{t('matches.areaOpen')}</InlineBanner>
        ) : null}
        {tab === 'shortlist' && toShare.length > 1 && online ? (
          <Button testID="share-all" icon={Share2} label={t('matches.shareAll', { count: toShare.length })} onPress={() => setSheet({ kind: 'share', items: toShare.map((x) => ({ id: x.id, listing: x.listing })) })} />
        ) : null}
        {q.isPending ? (
          <ListSkeleton count={2} />
        ) : q.error && !q.data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : tab === 'matches' ? (
          matched.length === 0 ? (
            <EmptyState icon={Sparkles} title={t('matches.emptyTitle')} body={t('matches.emptyBody')} />
          ) : (
            matched.map((m) => card({ listing: m.listing, score: m.score, reasons: m.reasons, differences: m.differences, itemId: m.shortlist_item_id, status: m.shortlist_status }))
          )
        ) : picked.length === 0 ? (
          <EmptyState icon={Sparkles} title={t('matches.shortlistEmpty')} body={t('matches.shortlistEmptyBody')} />
        ) : (
          picked.map((x: ShortlistItem) =>
            card({ listing: x.listing, score: x.score, reasons: (x.reasons as string[]) ?? [], differences: (x.differences as string[]) ?? [], itemId: x.id, status: x.status, shared: sharedLine(x) }),
          )
        )}
      </ScrollView>
      {sheet?.kind === 'notSuitable' ? <NotSuitableSheet item={sheet} rid={rid} onClose={() => setSheet(null)} /> : null}
      {sheet?.kind === 'visit' ? <ScheduleVisitSheet rid={rid} listing={{ id: sheet.listing.id, title: listingTitle(sheet.listing), aaName: sheet.listing.aa_name }} visitTypes={visitTypes} onClose={() => setSheet(null)} /> : null}
      {sheet?.kind === 'share' ? <ShareSheet rid={rid} items={sheet.items} customer={customer} onClose={() => setSheet(null)} /> : null}
    </View>
  );
}

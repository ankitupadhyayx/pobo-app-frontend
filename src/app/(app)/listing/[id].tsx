import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, KeyRound, Lock, Phone, Send } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Badge, BottomSheet, Button, Card, Chips, DateTimeField, ErrorState, InlineBanner, ListSkeleton, MoneyField, NotSure, SyncChip, TextField, toggleIn } from '@/components/ui';
import { AccessSheet } from '@/components/listings/AccessSheet';
import { ReturnKeySheet, TakeKeySheet } from '@/components/listings/UnitSheets';
import { draftFromListing, listingPayload, submitBlockers, type ListingDraft } from '@/components/listings/listingForm';
import { uploadListingPhoto, useListing, useMyKeys, useSubmitListing, useWithdrawListing, type Key, type Listing } from '@/api/hooks/listings';
import { useLabels } from '@/api/hooks/config';
import { errorMessage } from '@/api/errors';
import { outbox, useEntitySync } from '@/offline';
import { useOnline } from '@/hooks/useOnline';
import { useSubmit } from '@/hooks/useSubmit';
import { useActions } from '@/state/actions';
import { MediaPanel } from '@/components/listings/MediaPanel';
import { analytics } from '@/lib/analytics';
import { colors } from '@/theme/colors';
import { placeLocality, placeShort, placeTitle } from '@/lib/property';
import { useT } from '@/i18n';

export default function ListingScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useListing(id);
  if (q.isPending) {
    return (
      <View className="flex-1 bg-slate-100">
        <ConnectedHeader onBack={() => router.back()} title={t('common.loading')} />
        <View className="p-4"><ListSkeleton count={2} /></View>
      </View>
    );
  }
  if (!q.data) {
    return (
      <View className="flex-1 bg-slate-100">
        <ConnectedHeader onBack={() => router.back()} title="" />
        <View className="p-4"><ErrorState error={q.error} onRetry={() => q.refetch()} /></View>
      </View>
    );
  }
  return <ListingBody key={q.data.id} l={q.data} />;
}

function WithdrawSheet({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const t = useT();
  const w = useWithdrawListing();
  const showSuccess = useActions((s) => s.showSuccess);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string>();
  const s = useSubmit(async () => {
    const r = reason.trim();
    await w.mutateAsync({ id: listing.id, reason: r });
    analytics.track('property_withdrawn', { kind: listing.type });
    // FB-14: the sheet closes and a success sheet names what happened.
    showSuccess({
      title: t('listings.withdrawnTitle'),
      lines: [
        { label: t('visits.property'), value: placeTitle(listing) },
        { label: t('listings.withdrawReasonShort'), value: r },
      ],
      body: t('listings.withdrawnBody'),
    });
  }, onClose);
  return (
    <BottomSheet visible onClose={onClose} dismissable={!s.busy} title={t('listings.withdraw')} subtitle={listing.title} footer={<Button testID="withdraw-save" className="flex-1" variant="danger" label={t('listings.withdraw')} loading={s.busy} onPress={() => (reason.trim() ? void s.run(undefined) : setErr(t('errors.required')))} />}>
      <TextField testID="withdraw-reason" label={t('listings.withdrawReason')} required multiline value={reason} onChangeText={(v) => { setReason(v); setErr(undefined); }} error={err ?? s.apiField('reason')} />
      {s.banner(['reason']) ? <InlineBanner>{s.banner(['reason'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}

/** APP-26 listing: draft edits work offline (outbox), submit/photos/withdraw need a connection. */
function ListingBody({ l }: { l: Listing }) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const L = useLabels();
  const kindLabel = (c: string) => L.enumLabel('property_kind', c);
  const online = useOnline();
  const showToast = useActions((s) => s.showToast);
  const sync = useEntitySync('listing', l.id);
  const submit = useSubmitListing();
  const [d, setD] = useState<ListingDraft>(() => draftFromListing(l));
  const [blockers, setBlockers] = useState<string[]>([]);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  // REQ-11: an independent property (no flat) records and returns its key right here.
  const independent = !l.unit;
  const heldKeys = useMyKeys('HELD');
  const myKey = independent ? (heldKeys.data ?? []).find((k) => k.listing_id === l.id && !k.unit_id) : undefined;
  const [keySheet, setKeySheet] = useState<null | 'take' | Key>(null);
  // FB-13: facts the AA marks "Not sure" go to Ops for verification with the next save.
  const [unsure, setUnsure] = useState<Set<string>>(new Set());
  const pendingFields = new Set((l.field_flags ?? []).filter((f) => f.status === 'PENDING').map((f) => f.field));
  const can = (a: string) => l.allowed_actions.includes(a as never);
  const withdrawn = l.status === 'WITHDRAWN';
  const editable = can('EDIT') && !withdrawn;
  const set = <K extends keyof ListingDraft>(k: K, v: ListingDraft[K]) => setD({ ...d, [k]: v });
  const fact = (field: string) => (editable || pendingFields.has(field) ? <NotSure field={field} on={unsure.has(field)} pending={pendingFields.has(field)} disabled={!editable} onToggle={(on) => setUnsure((x) => toggleIn(x, field, on))} /> : null);
  const payload = () => ({ ...listingPayload(d, l.type), ...(unsure.size ? { unsure_fields: [...unsure].map((field) => ({ field })) } : {}) });
  const num = (k: keyof ListingDraft) => (v: string) => set(k, v.replace(/\D/g, '') as never);

  const saveDraft = async () => {
    await outbox.enqueue({ type: 'listing_draft.update', entity: 'listing', entityId: l.id, baseVersion: l.version ?? null, payload: payload(), label: `${t('listings.draft')} · ${placeShort(l)}` });
    setUnsure(new Set());
    showToast(online ? t('unitSurvey.saved') : t('unitSurvey.savedLocal'));
    void outbox.flush();
  };

  const doSubmit = async () => {
    const b = submitBlockers(d, l.type, l.photos.length, t);
    setBlockers(b);
    if (b.length) return;
    try {
      // Make sure the latest edits are on the server before submitting.
      await outbox.enqueue({ type: 'listing_draft.update', entity: 'listing', entityId: l.id, baseVersion: l.version ?? null, payload: payload(), label: `${t('listings.draft')} · ${placeShort(l)}` });
      setUnsure(new Set());
      await outbox.flush();
      await submit.mutateAsync(l.id);
      analytics.track('property_submitted', { kind: l.type });
      showToast(t('listings.submitted'));
    } catch (e) {
      setBlockers([errorMessage(e)]);
    }
  };

  const typeLabel = L.enumLabel('listing_type', l.type);
  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={`${t('listings.listing')} · ${placeShort(l, kindLabel)}`} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="p-4 gap-3" contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
          <View className="gap-2 rounded-2xl border-2 border-violet-300 bg-violet-50 p-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">{t('listings.listing')} · {typeLabel}</Text>
                <Text className="text-base font-extrabold text-slate-900">{placeTitle(l, kindLabel)}</Text>
                <Text className="text-xs text-slate-600">{[placeLocality(l), l.aa_name].filter(Boolean).join(' · ')}</Text>
              </View>
              <View className="items-end gap-1">
                <Badge label={L.enumLabel('listing_status', l.status)} tone={l.status === 'VERIFIED' ? 'purple' : l.status === 'CHANGES_REQUESTED' ? 'rose' : withdrawn ? 'dark' : 'slate'} />
                <SyncChip state={sync} hideSynced />
              </View>
            </View>
            {l.status === 'CHANGES_REQUESTED' && l.review_note ? (
              <View className="flex-row items-start gap-2 rounded-xl border border-rose-200 bg-white p-2.5">
                <AlertTriangle size={14} color={colors.danger} />
                <Text className="flex-1 text-xs text-rose-900"><Text className="font-bold">{t('listings.changesRequested')}: </Text>{l.review_note}</Text>
              </View>
            ) : null}
            {withdrawn ? (
              <View testID="listing-withdrawn" className="rounded-xl bg-slate-900 p-2.5">
                <Text className="text-xs font-bold text-white">{t('listings.withdrawnBanner')}</Text>
                {l.withdrawn_reason ? <Text className="mt-0.5 text-xs text-slate-200">{l.withdrawn_reason}</Text> : null}
              </View>
            ) : null}
            {l.status === 'SUBMITTED' ? <Text className="text-xs text-violet-900">{t('listings.awaitingReview')}</Text> : null}
            {!editable && !withdrawn ? (
              <View className="flex-row items-center gap-1.5">
                <Lock size={12} color={colors.muted} />
                <Text className="text-[11px] text-slate-600">{t('listings.locked')}</Text>
              </View>
            ) : null}
          </View>

          {l.owner_contact ? (
            <Card>
              <View className="flex-row items-center gap-2">
                <Phone size={14} color={colors.slate600} />
                <Text className="flex-1 text-sm font-semibold text-slate-800">{l.owner_contact.name} · {l.owner_contact.phone}</Text>
              </View>
              <Text className="mt-0.5 text-[11px] text-slate-500">{l.owner_contact.call_allowed ? t('unitSurvey.callAllowed') : t('listings.noCall')}</Text>
            </Card>
          ) : null}

          {/* FB-08 key access arrangement (listing AA / supervisor) */}
          {l.is_mine && !withdrawn ? (
            <Card testID="access-card">
              <View className="flex-row items-center gap-2">
                <KeyRound size={14} color={colors.slate600} />
                <Text className="flex-1 text-xs font-extrabold uppercase tracking-wider text-slate-500">{t('access.title')}</Text>
                <Button testID="access-edit" size="sm" variant="ghost" label={l.access ? t('access.change') : t('access.set')} disabled={!online} onPress={() => setAccessOpen(true)} />
              </View>
              {l.access ? (
                <View className="mt-1 gap-0.5">
                  <Text className="text-sm font-semibold text-slate-800">{[L.master('KEY_PARTY', l.access.key_party), l.access.contact_name, l.access.contact_phone].filter(Boolean).join(' · ')}</Text>
                  {l.access.collection_location ? <Text className="text-xs text-slate-600">{l.access.collection_location}</Text> : null}
                  <Text className="text-xs font-semibold text-teal-800">{L.enumLabel('access_mode', l.access.mode)}</Text>
                </View>
              ) : (
                <Text className="mt-1 text-xs text-slate-500">{t('access.missing')}</Text>
              )}
              {independent ? (
                <View className="mt-2 flex-row items-center gap-2 border-t border-slate-100 pt-2">
                  <Text testID="listing-key-status" className="flex-1 text-xs text-slate-600">
                    {myKey ? t('keys.youHold', { count: myKey.key_count, from: L.master('KEY_PARTY', myKey.taken_from) }) : t('keys.noneHeld')}
                  </Text>
                  {myKey ? (
                    <Button testID="listing-key-return" size="sm" variant="secondary" label={t('keys.markReturned')} onPress={() => setKeySheet(myKey)} />
                  ) : (
                    <Button testID="listing-key-take" size="sm" variant="secondary" icon={KeyRound} label={t('keys.record')} onPress={() => setKeySheet('take')} />
                  )}
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* Photos & video (R2-6) */}
          <Card>
            <MediaPanel
              testID="listing-media"
              listingId={l.id}
              photos={l.photos}
              canAdd={can('ADD_PHOTO') && !withdrawn}
              online={online}
              maxVideoBytes={Number(L.setting('uploads.max_video_bytes', '150000000')) || undefined}
              upload={(m, o) => uploadListingPhoto(l.id, m, o)}
            />
          </Card>

          {/* Draft fields (hidden once withdrawn: FB-14 never leaves the old form open) */}
          {withdrawn ? null : (
          <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <TextField label={t('listings.title')} editable={editable} value={d.title} onChangeText={(v) => set('title', v)} />
            <View className="gap-1">
              <Chips label={t('unitSurvey.configuration')} options={L.options('CONFIGURATION')} value={d.configuration} onChange={(v) => editable && set('configuration', v as string | null)} />
              {fact('configuration')}
            </View>
            {l.type === 'SELL' ? (
              <MoneyField label={t('addLead.expectedPrice')} editable={editable} value={d.expected_price} onChangeText={num('expected_price')} />
            ) : (
              <View className="flex-row gap-2">
                <MoneyField containerClassName="flex-1" label={t('addLead.expectedRent')} editable={editable} value={d.expected_rent} onChangeText={num('expected_rent')} />
                <MoneyField containerClassName="flex-1" label={t('listings.deposit')} editable={editable} value={d.security_deposit} onChangeText={num('security_deposit')} />
              </View>
            )}
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <TextField label={t('unitDetails.superArea')} editable={editable} keyboardType="number-pad" value={d.super_area_sqft} onChangeText={num('super_area_sqft')} />
                {fact('super_area_sqft')}
              </View>
              <View className="flex-1 gap-1">
                <TextField label={t('unitDetails.carpetArea')} editable={editable} keyboardType="number-pad" value={d.carpet_area_sqft} onChangeText={num('carpet_area_sqft')} />
                {fact('carpet_area_sqft')}
              </View>
            </View>
            <View className="gap-1">
              <Chips label={t('unitDetails.furnishing')} options={L.options('FURNISHING')} value={d.furnishing} onChange={(v) => editable && set('furnishing', v as string | null)} />
              {fact('furnishing')}
            </View>
            <View className="gap-1">
              <Chips label={t('unitDetails.parking')} options={L.options('PARKING')} value={d.parking} onChange={(v) => editable && set('parking', v as string | null)} />
              {fact('parking')}
            </View>
            <View className="gap-1">
              <Chips label={t('unitDetails.facing')} options={L.options('FACING')} value={d.facing} onChange={(v) => editable && set('facing', v as string | null)} />
              {fact('facing')}
            </View>
            <View className="gap-1">
              <Chips label={t('listings.availability')} options={L.options('AVAILABILITY')} value={d.availability} onChange={(v) => editable && set('availability', v as string | null)} />
              {fact('availability')}
            </View>
            {editable ? <Text className="text-[11px] text-slate-500">{t('notSure.hint')}</Text> : null}
            <DateTimeField mode="date" label={t('listings.availableFrom')} value={d.available_from ? new Date(`${d.available_from}T00:00:00`) : null} onChange={(x) => editable && set('available_from', x.toISOString().slice(0, 10))} />
            <TextField label={t('listings.description')} editable={editable} multiline value={d.description} onChangeText={(v) => set('description', v)} />
          </View>
          )}

          {blockers.length ? <InlineBanner testID="listing-blockers">{blockers.join('\n')}</InlineBanner> : null}
          {can('WITHDRAW') && !withdrawn ? <Button testID="listing-withdraw" variant="ghost" label={t('listings.withdraw')} disabled={!online} onPress={() => setWithdrawOpen(true)} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
      {editable ? (
        <View className="absolute bottom-0 left-0 right-0 gap-1 border-t border-slate-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <View className="flex-row gap-2">
            <Button testID="listing-save" size="lg" variant="outline" label={t('listings.saveDraft')} onPress={saveDraft} />
            {can('SUBMIT') ? <Button testID="listing-submit" className="flex-1" size="lg" icon={Send} label={t('listings.submit')} disabled={!online} loading={submit.isPending} onPress={doSubmit} /> : null}
          </View>
          <Text className="text-center text-[11px] text-slate-500">{online ? t('listings.submitHint') : t('listings.onlineOnly')}</Text>
        </View>
      ) : null}
      {accessOpen ? <AccessSheet listing={l} onClose={() => setAccessOpen(false)} /> : null}
      {keySheet === 'take' ? (
        <TakeKeySheet
          listingId={l.id}
          unitLabel={l.title || placeShort(l)}
          parties={L.options('KEY_PARTY')}
          defaultFrom={l.access?.key_party}
          onClose={() => setKeySheet(null)}
          onDone={() => showToast(online ? t('keys.recorded') : t('unitSurvey.savedLocal'))}
        />
      ) : keySheet ? (
        <ReturnKeySheet k={keySheet} parties={L.options('KEY_PARTY')} onClose={() => setKeySheet(null)} onDone={() => showToast(online ? t('keys.returned') : t('unitSurvey.savedLocal'))} />
      ) : null}
      {withdrawOpen ? <WithdrawSheet listing={l} onClose={() => setWithdrawOpen(false)} /> : null}
    </View>
  );
}

import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarClock, ChevronRight, FilePlus2, KeyRound, PencilRuler, Save, Sparkles } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Badge, Button, Card, ErrorState, InlineBanner, ListSkeleton, SyncChip } from '@/components/ui';
import { SurveyFormBody } from '@/components/survey/SurveyFormBody';
import { UnitDetailsForm } from '@/components/survey/UnitDetailsForm';
import { ConvertSheet, StructureSheet } from '@/components/survey/UnitSheets';
import { CreateListingSheet, TakeKeySheet, type ListingType } from '@/components/listings/UnitSheets';
import { useListings } from '@/api/hooks/listings';
import { detailsPayload, surveyPayload, validateSurvey, type DetailsDraft, type SurveyDraft } from '@/components/survey/forms';
import { detailsFromUnit, surveyFromUnit } from '@/components/survey/prefill';
import { LAYER_STYLE } from '@/components/survey/unitStyle';
import { useSurveyHistory, useUnit, type Opportunity, type UnitDetail } from '@/api/hooks/field';
import { useLabels } from '@/api/hooks/config';
import { outbox, useEntitySync } from '@/offline';
import { useActions } from '@/state/actions';
import { useOnline } from '@/hooks/useOnline';
import { analytics } from '@/lib/analytics';
import { formatINR, formatWhen } from '@/lib/time';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

type Tab = 'survey' | 'details' | 'history';
const OCC = ['OWNER_OCCUPIED', 'TENANT_OCCUPIED', 'VACANT', 'UNKNOWN'];
const VER = ['VERIFIED', 'UNVERIFIED', 'NEEDS_VERIFICATION'];

/** APP-23: one flat. Structure, survey, details, opportunity and listing are separate blocks. */
export default function UnitScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useUnit(id);
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
  // Keyed by unit so the form prefills once; refetches never clobber what the AA is typing.
  return <UnitBody key={q.data.id} u={q.data} />;
}

function UnitBody({ u }: { u: UnitDetail }) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const L = useLabels();
  const online = useOnline();
  const showToast = useActions((s) => s.showToast);
  const id = u.id;
  const sync = useEntitySync('unit', id);
  const [tab, setTab] = useState<Tab>('survey');
  const history = useSurveyHistory(id, tab === 'history');
  const [survey, setSurvey] = useState<SurveyDraft>(() => surveyFromUnit(u));
  const [details, setDetails] = useState<DetailsDraft>(() => detailsFromUnit(u));
  const [unsure, setUnsure] = useState<Set<string>>(new Set());
  const pendingFacts = new Set([...(u.details?.field_flags ?? []), ...(u.field_flags ?? [])].filter((f) => f.status === 'PENDING').map((f) => f.field));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<null | 'structure' | 'listing' | 'key' | { convert: Opportunity }>(null);
  const mine = useListings({ scope: 'mine' });
  const myListings = (mine.data?.results ?? []).filter((l) => l.unit?.id === u.id);
  const [saving, setSaving] = useState(false);

  const label = `${u.tower_name} · ${u.number}`;
  const ml = (list: string) => L.options(list);
  const enumOpts = (name: string, codes: string[]) => codes.map((c) => ({ value: c, label: L.enumLabel(name, c) }));
  const slotsWithContact = useMemo(
    () => u.contacts.filter((c) => c.name || c.phone).map((c) => ({ value: c.slot, label: `${t(`unitSurvey.slot.${c.slot}`)} · ${c.name || c.phone}` })),
    [u, t],
  );

  const saveSurvey = async () => {
    const e = validateSurvey(survey, t);
    setErrs(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    await outbox.enqueue({ type: 'survey.create', entity: 'unit', entityId: u.id, baseVersion: null, payload: surveyPayload(survey), label: `${t('unitSurvey.surveyLabel')} · ${label}` });
    setSaving(false);
    analytics.track('flat_mapping_saved', { kind: 'survey', status: online ? 'online' : 'offline' });
    showToast(online ? t('unitSurvey.saved') : t('unitSurvey.savedLocal'));
    void outbox.flush();
  };

  const saveDetails = async () => {
    setSaving(true);
    await outbox.enqueue({ type: 'unit_details.save', entity: 'unit', entityId: u.id, baseVersion: u.details?.version ?? null, payload: { ...detailsPayload(details), ...(unsure.size ? { unsure_fields: [...unsure].map((field) => ({ field })) } : {}) }, label: `${t('unitSurvey.detailsLabel')} · ${label}` });
    setUnsure(new Set());
    setSaving(false);
    analytics.track('flat_mapping_saved', { kind: 'details', status: online ? 'online' : 'offline' });
    showToast(online ? t('unitSurvey.saved') : t('unitSurvey.savedLocal'));
    void outbox.flush();
  };

  const layer = u.survey_level && u.survey_level !== 'NONE' ? 'surveyed' : 'mapped';
  const openOpps = u.opportunities.filter((o) => o.status === 'OPEN');

  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={`${u.society_name} · ${label}`} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="p-4 gap-3" contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
          {/* Structure (mapping) block */}
          <Card>
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{t('unitScreen.structure')}</Text>
                <Text className="text-lg font-extrabold text-slate-900">{u.number}</Text>
                <Text className="text-xs text-slate-500">
                  {u.tower_name} · {t('tower.floor')} {u.floor_label ?? '—'}
                  {u.configuration ? ` · ${L.master('CONFIGURATION', u.configuration)}` : ''}
                </Text>
              </View>
              <View className="items-end gap-1">
                <View className={cn('rounded-md px-2 py-0.5', LAYER_STYLE[layer].cell)}>
                  <Text className={cn('text-[10px] font-bold', LAYER_STYLE[layer].text)}>{t(`survey.layer.${layer}`)}</Text>
                </View>
                <SyncChip state={sync} hideSynced />
              </View>
            </View>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {u.latest_survey ? <Badge label={t('unitScreen.lastSurvey', { when: formatWhen(u.latest_survey.surveyed_at), by: u.latest_survey.surveyed_by_name })} tone="teal" /> : null}
              {u.tenancy?.days_to_expiry != null ? <Badge label={t('unitScreen.leaseEnds', { count: u.tenancy.days_to_expiry })} tone={u.tenancy.days_to_expiry <= 30 ? 'amber' : 'slate'} /> : null}
              {u.keys.length ? <Badge label={t('unitScreen.keysHeld')} tone="amber" /> : null}
            </View>
            <Button className="mt-3" size="sm" variant="ghost" icon={PencilRuler} label={u.has_history ? t('structure.correctionTitle') : t('structure.editTitle')} disabled={!online} onPress={() => setSheet('structure')} />
          </Card>

          {/* Opportunity block (amber, DEC-01 #4) */}
          {openOpps.map((o) => (
            <View key={o.id} className="gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <View className="flex-row items-center gap-2">
                <Sparkles size={14} color={colors.warn} />
                <Text className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">{t('opps.title')}</Text>
              </View>
              <Text className="text-sm font-bold text-amber-950">
                {L.enumLabel('requirement_type', o.type)}
                {o.expected_price ? ` · ${formatINR(o.expected_price)}` : o.expected_rent ? ` · ${formatINR(o.expected_rent)}/mo` : ''}
              </Text>
              <Text className="text-[11px] text-amber-900">{o.surveyed_by_name ? t('opps.surveyedBy', { name: o.surveyed_by_name }) : ''}</Text>
              {o.requirement_id ? null : <Button testID="opp-convert" size="sm" variant="float" label={t('opps.convertTitle')} disabled={!online} onPress={() => setSheet({ convert: o })} />}
            </View>
          ))}

          {/* Listing block (violet, DEC-01 #5) */}
          <View testID="unit-listing-block" className="gap-2 rounded-2xl border-2 border-violet-300 bg-violet-50 p-4">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-violet-800">{t('listings.listing')}</Text>
            {u.listings.length ? <Text className="text-xs text-violet-900">{t('unitScreen.listingCount', { count: u.listings.length })}</Text> : null}
            {myListings.map((l) => (
              <Pressable key={l.id} testID={`unit-listing-${l.id}`} accessibilityRole="button" onPress={() => router.push({ pathname: '/listing/[id]', params: { id: l.id } })} className="flex-row items-center gap-2 rounded-xl border border-violet-200 bg-white p-2.5 active:bg-violet-100">
                <Text className="flex-1 text-xs font-bold text-violet-950">{L.enumLabel('listing_type', l.type)} · {L.enumLabel('listing_status', l.status)}</Text>
                <ChevronRight size={14} color={colors.slate600} />
              </Pressable>
            ))}
            <Button testID="unit-create-listing" size="sm" variant="secondary" icon={FilePlus2} label={t('listings.create')} onPress={() => setSheet('listing')} />
          </View>

          <View className="gap-2 rounded-2xl border border-amber-200 bg-white p-3">
            <View className="flex-row items-center gap-2">
              <KeyRound size={16} color={colors.warn} />
              <Text className="flex-1 text-xs text-slate-700">{u.keys.length ? t('unitScreen.keysHint') : t('unitScreen.noKeys')}</Text>
            </View>
            <Button testID="unit-take-key" size="sm" variant="ghost" icon={KeyRound} label={t('keys.record')} onPress={() => setSheet('key')} />
          </View>

          {/* Tabs */}
          <View className="flex-row rounded-xl bg-slate-200 p-1">
            {(['survey', 'details', 'history'] as Tab[]).map((k) => (
              <Pressable key={k} testID={`unit-tab-${k}`} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} className={cn('flex-1 items-center rounded-lg py-2', tab === k && 'bg-white')}>
                <Text className={cn('text-xs font-bold', tab === k ? 'text-slate-900' : 'text-slate-500')}>{t(`unitScreen.tab.${k}`)}</Text>
              </Pressable>
            ))}
          </View>

          {tab === 'survey' ? (
            <>
              <InlineBanner tone="info">{t('unitScreen.surveyIsNotListing')}</InlineBanner>
              <SurveyFormBody
                value={survey}
                onChange={setSurvey}
                errors={errs}
                onAddLead={() => router.push('/lead/new')}
                options={{
                  occupancy: enumOpts('occupancy', OCC),
                  doorstepOutcomes: ml('DOORSTEP_OUTCOME'),
                  dataSources: ml('DATA_SOURCE'),
                  verification: enumOpts('verification', VER),
                  intents: ml('PROPERTY_INTENT'),
                  timelines: ml('TIMELINE'),
                  configurations: ml('CONFIGURATION'),
                }}
              />
            </>
          ) : tab === 'details' ? (
            <UnitDetailsForm value={details} onChange={setDetails} unsure={unsure} onUnsure={setUnsure} pending={pendingFacts} options={{ kitchenSizes: ml('KITCHEN_SIZE'), facing: ml('FACING'), furnishing: ml('FURNISHING'), parking: ml('PARKING') }} />
          ) : history.isPending ? (
            <ListSkeleton count={2} />
          ) : (
            (history.data ?? []).map((sv) => (
              <Card key={sv.id}>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-slate-900">{t('unitScreen.version', { v: sv.version })}</Text>
                  <View className="flex-row items-center gap-1">
                    <CalendarClock size={12} color={colors.muted} />
                    <Text className="text-[11px] text-slate-500">{formatWhen(sv.surveyed_at)}</Text>
                  </View>
                </View>
                <Text className="text-xs text-slate-600">
                  {sv.surveyed_by_name} · {L.enumLabel('occupancy', sv.occupancy)}
                  {sv.intent ? ` · ${L.master('PROPERTY_INTENT', sv.intent)}` : ''}
                </Text>
                {sv.notes ? <Text className="mt-1 text-xs italic text-slate-500">{sv.notes}</Text> : null}
              </Card>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {tab !== 'history' ? (
        <View className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <Button testID="unit-save" size="lg" fullWidth icon={Save} loading={saving} label={tab === 'survey' ? t('unitSurvey.save') : t('unitSurvey.saveDetails')} onPress={tab === 'survey' ? saveSurvey : saveDetails} />
          {!online ? <Text className="mt-1 text-center text-[11px] text-slate-500">{t('unitSurvey.offlineOk')}</Text> : null}
        </View>
      ) : null}
      {sheet === 'structure' ? (
        <StructureSheet
          unit={u}
          configurations={ml('CONFIGURATION')}
          onClose={() => setSheet(null)}
          onDone={(msg, deleted) => {
            showToast(msg);
            if (deleted) router.back();
          }}
        />
      ) : null}
      {sheet === 'listing' ? (
        <CreateListingSheet
          unitId={u.id}
          unitLabel={label}
          opportunity={(() => {
            const o = openOpps.find((x) => x.type === 'SELL' || x.type === 'RENT_OUT');
            return o ? { id: o.id, type: o.type as ListingType } : null;
          })()}
          types={['SELL', 'RENT_OUT'].map((c) => ({ value: c, label: L.enumLabel('listing_type', c) }))}
          onClose={() => setSheet(null)}
          onDone={(lid) => {
            showToast(lid ? t('listings.created') : t('listings.createdLocal'));
            if (lid) router.push({ pathname: '/listing/[id]', params: { id: lid } });
          }}
        />
      ) : null}
      {sheet === 'key' ? (
        <TakeKeySheet
          unitId={u.id}
          unitLabel={label}
          listingId={myListings.find((l) => !['WITHDRAWN', 'REJECTED'].includes(l.status))?.id ?? null}
          parties={ml('KEY_PARTY')}
          onClose={() => setSheet(null)}
          onDone={() => showToast(online ? t('keys.recorded') : t('unitSurvey.savedLocal'))}
        />
      ) : null}
      {sheet && typeof sheet === 'object' ? (
        <ConvertSheet
          opp={sheet.convert}
          slots={slotsWithContact}
          onClose={() => setSheet(null)}
          onDone={(r) => {
            showToast(r.relationship_id ? t('opps.created') : t('opps.sentToReview'));
            if (r.relationship_id) router.push({ pathname: '/lead/[id]', params: { id: r.relationship_id } });
          }}
        />
      ) : null}
    </View>
  );
}

import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeftRight, CalendarPlus, CheckCircle2, FileText, MessageCircle, MoreHorizontal, PhoneCall, PhoneIncoming, Plus } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { CustomerHeader } from '@/components/lead/CustomerHeader';
import { RequirementCard } from '@/components/lead/RequirementCard';
import { ScheduleVisitSheet } from '@/components/visits/ScheduleVisitSheet';
import type { RequirementProperty } from '@/api/hooks/listings';
import { Timeline } from '@/components/lead/Timeline';
import { NoteComposer } from '@/components/lead/NoteComposer';
import { BottomSheet, Button, ErrorState, ListSkeleton, SectionTitle } from '@/components/ui';
import { usePendingFollowUps, useRelationship } from '@/api/hooks/leads';
import { useLabels } from '@/api/hooks/config';
import { useActions } from '@/state/actions';
import { formatWhen } from '@/lib/time';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/cn';
import { placeTitle } from '@/lib/property';
import { useT } from '@/i18n';

function MoreRow({ icon: Icon, label, hint, onPress, danger, testID }: { icon: typeof Plus; label: string; hint?: string; onPress: () => void; danger?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} className="min-h-[52px] flex-row items-center gap-3 rounded-xl px-2 active:bg-slate-50">
      <Icon size={18} color={danger ? colors.danger : colors.slate600} />
      <View className="flex-1">
        <Text className={cn('text-sm font-semibold', danger ? 'text-rose-700' : 'text-slate-800')}>{label}</Text>
        {hint ? <Text className="text-[11px] text-slate-500">{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function LeadDetailScreen() {
  const t = useT();
  const router = useRouter();
  const { id, requirement } = useLocalSearchParams<{ id: string; requirement?: string }>();
  const q = useRelationship(id);
  const L = useLabels();
  const { open, dial } = useActions();
  const [visitFor, setVisitFor] = useState<{ rid: string; p: RequirementProperty; types: string[] } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const rel = q.data;

  const mineIds = useMemo(() => (rel?.requirements ?? []).filter((r) => r.can_act).map((r) => r.id), [rel]);
  const followUps = usePendingFollowUps(mineIds);

  if (q.isPending) {
    return (
      <View className="flex-1 bg-slate-100">
        <ConnectedHeader onBack={() => router.back()} title={t('common.loading')} />
        <View className="p-4">
          <ListSkeleton count={2} />
        </View>
      </View>
    );
  }
  if (!rel) {
    return (
      <View className="flex-1 bg-slate-100">
        <ConnectedHeader onBack={() => router.back()} title="" />
        <View className="p-4">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </View>
      </View>
    );
  }

  const dnc = !!rel.customer.dnc;
  const actionable = rel.requirements.filter((r) => r.can_act && r.status !== 'CLOSED_WON' && r.status !== 'CLOSED_LOST');
  const primaryReq = rel.next_action?.requirement_id ?? requirement ?? actionable[0]?.id;
  const pendingFor = (reqId: string) => rel.pending_transfers.some((p) => p.status === 'PENDING' && p.requirement_id === reqId);
  const relTransferPending = rel.pending_transfers.some((p) => p.status === 'PENDING' && p.type === 'RELATIONSHIP');
  const callReq = (reqId: string) => dial({ relationshipId: rel.id, requirementId: reqId, phone: rel.customer.phone });
  const typeLabelFor = (reqId: string | null) => {
    const r = rel.requirements.find((x) => x.id === reqId);
    return r ? L.enumLabel('requirement_type', r.type) : null;
  };
  const canOutbound = !dnc && actionable.length > 0;
  const more = (fn: () => void) => () => {
    setMoreOpen(false);
    fn();
  };

  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={rel.customer.name} />
      <ScrollView
        contentContainerClassName="p-4 pb-32 gap-4"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.brand} colors={[colors.brand]} />}
      >
        <CustomerHeader rel={rel} />
        {relTransferPending ? (
          <View className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <Text className="text-xs font-bold text-amber-900">{t('lead.relTransferPending')}</Text>
          </View>
        ) : null}

        {noteOpen ? <NoteComposer relationshipId={rel.id} onDone={() => setNoteOpen(false)} /> : null}

        <View>
          <SectionTitle
            title={t('lead.requirements', { count: rel.requirements.length })}
            action={actionable.length || rel.is_owner ? { label: `+ ${t('lead.addRequirement')}`, onPress: () => open({ kind: 'addRequirement', relationshipId: rel.id }) } : undefined}
          />
          <View className="gap-3">
            {rel.requirements.map((r) => (
              <RequirementCard
                key={r.id}
                req={r}
                dnc={dnc}
                highlighted={r.id === requirement}
                transferPending={pendingFor(r.id)}
                onCall={() => callReq(r.id)}
                onFollowUp={() => open({ kind: 'followUp', relationshipId: rel.id, requirementId: r.id })}
                onCompleteFollowUp={(fid, title) => open({ kind: 'complete', followUpId: fid, relationshipId: rel.id, title })}
                onMessage={() => open({ kind: 'message', relationshipId: rel.id, requirementId: r.id })}
                onTransfer={() => open({ kind: 'transfer', relationshipId: rel.id, requirementId: r.id, mode: 'REQUIREMENT' })}
                onAddProperty={() => router.push({ pathname: '/lead/add-property/[rid]', params: { rid: r.id, relationshipId: rel.id } })}
                onOpenProperty={(p) => router.push({ pathname: '/listing/[id]', params: { id: p.id } })}
                onVisitProperty={(p) => setVisitFor({ rid: r.id, p, types: r.allowed_visit_types ?? [] })}
                onMatches={() => router.push({ pathname: '/lead/matches/[rid]', params: { rid: r.id, title: `${rel.customer.name} · ${L.enumLabel('requirement_type', r.type)}`, customer: rel.customer.name } })}
              />
            ))}
          </View>
        </View>

        {followUps.data?.length ? (
          <View className="gap-2 rounded-3xl border border-slate-200 bg-white p-5">
            <Text className="text-sm font-extrabold text-slate-900">{t('lead.pendingFollowUps')}</Text>
            {followUps.data.map((f) => (
              <View key={f.id} className={cn('flex-row items-center gap-2 rounded-xl border p-2.5', f.is_overdue ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-slate-50')}>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-slate-900">
                    {L.master('FOLLOW_UP_TYPE', f.type)} · {typeLabelFor(f.requirement_id)}
                  </Text>
                  {f.notes ? <Text className="text-xs text-slate-600">{f.notes}</Text> : null}
                  <Text className={cn('text-[11px] font-bold', f.is_overdue ? 'text-rose-600' : 'text-slate-500')}>{formatWhen(f.due_at)}</Text>
                </View>
                <Button size="sm" variant="secondary" icon={CheckCircle2} label={t('common.complete')} onPress={() => open({ kind: 'complete', followUpId: f.id, relationshipId: rel.id, title: f.requirement_title })} />
              </View>
            ))}
          </View>
        ) : null}

        <Timeline relationshipId={rel.id} typeLabelFor={typeLabelFor} />
      </ScrollView>

      {/* Sticky one-handed action bar */}
      <View className="absolute bottom-0 left-0 right-0 flex-row gap-2 border-t border-slate-200 bg-white px-4 pb-6 pt-3">
        {canOutbound && primaryReq ? (
          <>
            <Button testID="lead-call" className="flex-1" size="lg" icon={PhoneCall} label={t('common.call')} onPress={() => callReq(primaryReq)} />
            <Button testID="lead-message" size="lg" variant="secondary" icon={MessageCircle} label="" accessibilityHint={t('lead.message')} onPress={() => open({ kind: 'message', relationshipId: rel.id, requirementId: primaryReq })} />
            <Button testID="lead-followup" size="lg" variant="secondary" icon={CalendarPlus} label="" accessibilityHint={t('lead.followUp')} onPress={() => open({ kind: 'followUp', relationshipId: rel.id, requirementId: primaryReq })} />
          </>
        ) : (
          <View className="flex-1 justify-center">
            <Text className="text-xs font-semibold text-slate-500">{dnc ? t('leads.dncSuppressed') : t('lead.readOnly')}</Text>
          </View>
        )}
        <Button testID="lead-more" size="lg" variant="outline" icon={MoreHorizontal} label="" accessibilityHint={t('lead.more')} onPress={() => setMoreOpen(true)} />
      </View>

      <BottomSheet visible={moreOpen} onClose={() => setMoreOpen(false)} title={t('lead.more')} subtitle={rel.customer.name}>
        <View>
          {canOutbound && primaryReq ? (
            <MoreRow testID="more-log-call" icon={PhoneIncoming} label={t('lead.logCallNoDial')} onPress={more(() => open({ kind: 'call', relationshipId: rel.id, requirementId: primaryReq }))} />
          ) : null}
          <MoreRow testID="more-note" icon={FileText} label={t('lead.note')} onPress={more(() => setNoteOpen(true))} />
          <MoreRow icon={Plus} label={t('lead.addRequirement')} onPress={more(() => open({ kind: 'addRequirement', relationshipId: rel.id }))} />
          {rel.is_owner ? (
            <MoreRow
              testID="more-transfer-relationship"
              icon={ArrowLeftRight}
              label={t('lead.transferRelationship')}
              hint={t('transfer.relationshipHint')}
              onPress={more(() => open({ kind: 'transfer', relationshipId: rel.id, mode: 'RELATIONSHIP' }))}
            />
          ) : null}
          <MoreRow testID="more-escalate" danger icon={AlertTriangle} label={t('lead.escalate')} hint={t('lead.escalateHint')} onPress={more(() => open({ kind: 'escalate', relationshipId: rel.id, requirementId: primaryReq }))} />
        </View>
      </BottomSheet>
      {visitFor ? (
        <ScheduleVisitSheet rid={visitFor.rid} listing={{ id: visitFor.p.id, title: visitFor.p.title || placeTitle(visitFor.p) }} visitTypes={visitFor.types} onClose={() => setVisitFor(null)} />
      ) : null}
    </View>
  );
}


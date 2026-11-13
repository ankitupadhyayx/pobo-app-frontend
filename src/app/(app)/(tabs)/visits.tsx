import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { BottomSheet, Button, Chips, DateTimeField, EmptyState, ErrorState, InlineBanner, ListSkeleton } from '@/components/ui';
import { VisitCard } from '@/components/visits/VisitCard';
import { visitPropertyLine, visitSuccess } from '@/components/visits/visitSuccess';
import { formatDay, formatTime } from '@/lib/time';
import { CancelVisitSheet, CompleteVisitSheet, NoShowSheet } from '@/components/sheets/VisitSheets';
import { useCancelVisit, useCompleteVisit, useMyVisits, useNoShow, useRescheduleVisit, useVisit, type Visit, type VisitBucket } from '@/api/hooks/listings';
import { useLabels } from '@/api/hooks/config';
import { useActions } from '@/state/actions';
import { useSubmit } from '@/hooks/useSubmit';
import { analytics } from '@/lib/analytics';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';
import { VisitMedia } from '@/components/visits/VisitMedia';

// R3-7: "Past" = completed + no-show (no-shows no longer hide under Cancelled).
const BUCKETS: VisitBucket[] = ['today', 'upcoming', 'past', 'no_show', 'cancelled'];
/** Old links (?bucket=completed) open Past. */
const ALIASES: Record<string, VisitBucket> = { completed: 'past' };

function RescheduleSheet({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const t = useT();
  const L = useLabels();
  const router = useRouter();
  const re = useRescheduleVisit();
  const showSuccess = useActions((s) => s.showSuccess);
  const [at, setAt] = useState<Date | null>(null);
  const [err, setErr] = useState<string>();
  const s = useSubmit(async () => {
    const v = await re.mutateAsync({ id: visit.id, body: { scheduled_at: at!.toISOString() } });
    showSuccess(visitSuccess(v, t('visits.rescheduledTitle'), t, router, (c) => L.enumLabel('visit_type', c)));
  }, onClose);
  return (
    <BottomSheet visible onClose={onClose} dismissable={!s.busy} title={t('visits.reschedule')} subtitle={visit.customer_name} footer={<Button testID="reschedule-save" className="flex-1" label={t('visits.reschedule')} loading={s.busy} onPress={() => (at ? void s.run(undefined) : setErr(t('errors.required')))} />}>
      <DateTimeField testID="reschedule-at" label={t('visits.when')} required value={at} onChange={setAt} minimumDate={new Date()} error={err ?? s.apiField('scheduled_at')} />
      {s.banner(['scheduled_at']) ? <InlineBanner>{s.banner(['scheduled_at'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}

export const propertyLine = visitPropertyLine;

/** APP-30 Visits tab: today, upcoming, completed, cancelled. */
export default function VisitsTab() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const { dial, showToast, showSuccess } = useActions();
  const params = useLocalSearchParams<{ bucket?: string; visit?: string }>();
  // "View visit" and Ops reminders open one exact visit: pinned on top, highlighted.
  const pinned = useVisit(params.visit);
  // Home "View all" passes ?bucket= (view_all.focus); a new param wins over the last chip tap.
  const asked = params.bucket ? (ALIASES[params.bucket] ?? params.bucket) : undefined;
  const fromParam = asked && (BUCKETS as string[]).includes(asked) ? (asked as VisitBucket) : 'today';
  const [picked, setPicked] = useState<{ param?: string; bucket: VisitBucket } | null>(null);
  const bucket = picked && picked.param === params.bucket ? picked.bucket : fromParam;
  const setBucket = (b: VisitBucket) => setPicked({ param: params.bucket, bucket: b });
  const q = useMyVisits(bucket);
  const complete = useCompleteVisit();
  const cancel = useCancelVisit();
  const noShow = useNoShow();
  const [sheet, setSheet] = useState<null | { kind: 'complete' | 'cancel' | 'reschedule' | 'noShow'; visit: Visit }>(null);
  const visits = q.data ?? [];
  const keyNotes = (v: Visit) =>
    (v.key_tasks ?? [])
      .filter((k) => k.status === 'OPEN')
      .map((k) => ({
        text: k.due_at ? `${k.title} · ${t(k.kind === 'KEY_COLLECT' ? 'keyTasks.before' : 'keyTasks.by', { time: formatTime(k.due_at) })}` : k.title,
        urgent: k.priority === 'URGENT',
        onPress: () => router.push({ pathname: '/more/field-tasks', params: { kind: 'keys' } }),
      }));
  // R2-5: outcomes depend on the visit type (server list); old visits fall back to the master.
  const master = L.options('VISIT_OUTCOME');
  const outcomeOptions = (v: Visit) =>
    v.allowed_outcomes?.length
      ? v.allowed_outcomes.map((o) => ({ value: o.code, label: L.pick(o), meta: { ...(master.find((m) => m.value === o.code)?.meta ?? {}), requires_next_action: o.requires_next_action, media_check: o.media_check } }))
      : master;
  const outcomeLabel = (v: Visit, code: string) => {
    const hit = v.allowed_outcomes?.find((o) => o.code === code);
    return hit ? L.pick(hit) : L.master('VISIT_OUTCOME', code);
  };
  const noShowInfo = (v: Visit) => {
    const n = v.no_show;
    const parts = [
      n?.who_absent_label ? t('visits.noShowWhoLine', { who: n.who_absent_label }) : t('visits.noShowBadge'),
      n?.reason_label || null,
      n?.next_step_label ? t('visits.noShowNextLine', { step: n.next_step_label }) : null,
    ].filter(Boolean);
    return { line: parts.join(' · '), note: n?.note || undefined };
  };
  const card = (v: Visit, highlight = false) => (
    <View key={`${highlight ? 'pin-' : ''}${v.id}`} className="gap-1.5">
      <VisitCard
        id={highlight ? `pinned-${v.id}` : v.id}
        highlight={highlight}
        customerName={v.customer_name}
        property={propertyLine(v)}
        scheduledAt={v.scheduled_at}
        meetingPoint={v.meeting_point}
        status={v.status}
        statusLabel={L.enumLabel('visit_status', v.status)}
        typeLabel={v.visit_type ? L.enumLabel('visit_type', v.visit_type) : null}
        keyNotes={v.status === 'SCHEDULED' ? keyNotes(v) : []}
        outcomeLabel={v.outcome ? outcomeLabel(v, v.outcome) : null}
        cancelReason={v.cancel_reason && v.status !== 'NO_SHOW' ? L.master('VISIT_CANCEL_REASON', v.cancel_reason) : null}
        noShow={v.status === 'NO_SHOW' ? noShowInfo(v) : null}
        rescheduled={
          v.rescheduled_visit
            ? {
                when: `${formatDay(v.rescheduled_visit.scheduled_at)} · ${formatTime(v.rescheduled_visit.scheduled_at)}`,
                statusLabel: L.enumLabel('visit_status', v.rescheduled_visit.status),
                onPress: () => router.setParams({ visit: v.rescheduled_visit!.id }),
              }
            : null
        }
        onOpen={v.is_mine ? () => router.push({ pathname: '/lead/[id]', params: { id: v.relationship_id, requirement: v.requirement_id } }) : undefined}
        onCall={v.is_mine && v.customer_phone ? () => dial({ relationshipId: v.relationship_id, requirementId: v.requirement_id, phone: v.customer_phone! }) : undefined}
        onComplete={v.is_mine ? () => setSheet({ kind: 'complete', visit: v }) : undefined}
        onCancel={v.is_mine ? () => setSheet({ kind: 'cancel', visit: v }) : undefined}
      />
      {v.status === 'SCHEDULED' && v.is_mine && v.media?.required && v.media.listing_id ? <VisitMedia visit={v} /> : null}
      {v.status === 'SCHEDULED' && v.is_mine ? (
        <View className="flex-row justify-end gap-2">
          <Button size="sm" variant="ghost" label={t('visits.reschedule')} onPress={() => setSheet({ kind: 'reschedule', visit: v })} />
          <Button testID={`visit-noshow-btn-${v.id}`} size="sm" variant="ghost" label={t('visits.noShow')} onPress={() => setSheet({ kind: 'noShow', visit: v })} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-100">
      <View className="px-4 pt-4">
        <Chips scroll testIDPrefix="visits-bucket" options={BUCKETS.map((b) => ({ value: b, label: t(`visits.${b}`) }))} value={bucket} allowDeselect={false} onChange={(v) => setBucket(v as VisitBucket)} />
      </View>
      <ScrollView contentContainerClassName="p-4 pb-12 gap-3" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.brand} />}>
        {pinned.data && params.visit ? card(pinned.data, true) : null}
        {q.isPending ? (
          <ListSkeleton count={2} />
        ) : q.error && !q.data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : visits.length === 0 ? (
          <EmptyState icon={CalendarDays} title={bucket === 'today' ? t('visits.emptyToday') : t('visits.emptyOther')} body={bucket === 'today' ? t('visits.emptyTodayBody') : t('visits.emptyOtherBody')} />
        ) : (
          visits.map((v) => card(v))
        )}
      </ScrollView>
      <CompleteVisitSheet
        visible={sheet?.kind === 'complete'}
        onClose={() => setSheet(null)}
        subtitle={sheet ? `${sheet.visit.customer_name} · ${propertyLine(sheet.visit)}` : ''}
        outcomes={sheet ? outcomeOptions(sheet.visit) : []}
        buyerFeedback={!sheet || sheet.visit.visit_type === 'VIEWING'}
        media={sheet?.visit.media?.required ? sheet.visit.media : null}
        interestLevels={['HIGH', 'MEDIUM', 'LOW'].map((c) => ({ value: c, label: L.enumLabel('interest', c) }))}
        priceReactions={['COMFORTABLE', 'NEGOTIABLE', 'TOO_HIGH', 'UNKNOWN'].map((c) => ({ value: c, label: L.enumLabel('price_reaction', c) }))}
        followUpTypes={L.options('FOLLOW_UP_TYPE')}
        serviceHours={{ start: L.setting('service_hours.start', '09:00'), end: L.setting('service_hours.end', '18:00') }}
        onSubmit={async (v) => {
          if (sheet?.kind !== 'complete') return;
          await complete.mutateAsync({
            id: sheet.visit.id,
            body: {
              outcome: v.outcome,
              feedback: sheet.visit.visit_type !== 'VIEWING' ? { notes: v.feedback } : { interest: (v.interest ?? undefined) as 'HIGH' | undefined, price_reaction: (v.priceReaction ?? undefined) as 'UNKNOWN' | undefined, liked: v.liked || undefined, disliked: v.disliked || undefined, notes: v.feedback },
              next_action: v.nextAction ? { type: v.nextAction.type, due_at: v.nextAction.dueAt, priority: 'NORMAL', notes: v.nextAction.notes || undefined, after_hours: !!v.nextAction.afterHours, after_hours_reason: v.nextAction.afterHours?.reason } : null,
            },
          });
          analytics.track('visit_completed', { outcome: v.outcome });
          showToast(t('visits.saved'));
        }}
      />
      <CancelVisitSheet
        visible={sheet?.kind === 'cancel'}
        onClose={() => setSheet(null)}
        subtitle={sheet?.visit.customer_name ?? ''}
        reasons={L.options('VISIT_CANCEL_REASON')}
        onSubmit={async (v) => {
          if (sheet?.kind !== 'cancel') return;
          const visit = sheet.visit;
          const res = await cancel.mutateAsync({ id: visit.id, body: { reason: v.reason, note: v.note || undefined, reschedule_at: v.rescheduleAt ?? null } });
          if (v.rescheduleAt) {
            const next = res.replacement ?? { ...visit, scheduled_at: v.rescheduleAt };
            showSuccess(visitSuccess(next, t('visits.rescheduledTitle'), t, router, (c) => L.enumLabel('visit_type', c)));
          } else {
            showSuccess({
              title: t('visits.cancelledTitle'),
              lines: [
                { label: t('visits.date'), value: `${formatDay(visit.scheduled_at, true)} · ${formatTime(visit.scheduled_at)}` },
                { label: t('visits.property'), value: visitPropertyLine(visit) },
                { label: t('visits.customer'), value: visit.customer_name },
              ],
            });
          }
        }}
      />
      {sheet?.kind === 'reschedule' ? <RescheduleSheet visit={sheet.visit} onClose={() => setSheet(null)} /> : null}
      <NoShowSheet
        visible={sheet?.kind === 'noShow'}
        onClose={() => setSheet(null)}
        subtitle={sheet ? `${sheet.visit.customer_name} · ${propertyLine(sheet.visit)}` : ''}
        who={L.enumOptions('no_show_who', ['CUSTOMER', 'OWNER', 'AA', 'OTHER'])}
        reasons={L.options('VISIT_NO_SHOW_REASON')}
        nextSteps={L.enumOptions('no_show_next_step', ['RESCHEDULE', 'FOLLOW_UP', 'CANCEL'])}
        followUpTypes={L.options('FOLLOW_UP_TYPE')}
        serviceHours={{ start: L.setting('service_hours.start', '09:00'), end: L.setting('service_hours.end', '18:00') }}
        onSubmit={async (v) => {
          if (sheet?.kind !== 'noShow') return;
          const res = await noShow.mutateAsync({
            id: sheet.visit.id,
            body: {
              who_absent: v.whoAbsent as 'CUSTOMER',
              reason: v.reason ?? undefined,
              note: v.note || undefined,
              next_step: v.nextStep,
              reschedule_at: v.rescheduleAt ?? null,
              follow_up: v.followUp
                ? { type: v.followUp.type, due_at: v.followUp.dueAt, notes: v.followUp.notes || undefined, priority: 'NORMAL', after_hours: !!v.followUp.afterHours, after_hours_reason: v.followUp.afterHours?.reason }
                : null,
            },
          });
          analytics.track('visit_no_show', { who_absent: v.whoAbsent, next_step: v.nextStep });
          if (v.nextStep === 'RESCHEDULE' && res.rescheduled_visit) {
            showSuccess(visitSuccess({ ...sheet.visit, ...res.rescheduled_visit, id: res.rescheduled_visit.id }, t('visits.rescheduledTitle'), t, router, (c) => L.enumLabel('visit_type', c)));
          } else {
            showToast(v.nextStep === 'FOLLOW_UP' ? t('visits.noShowFollowUp') : t('visits.noShowDone'));
          }
        }}
      />
    </View>
  );
}

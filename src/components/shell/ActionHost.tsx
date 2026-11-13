import { useCallback, useEffect, useMemo } from 'react';
import { Linking } from 'react-native';
import { BottomSheet, ListSkeleton, type Option } from '@/components/ui';
import { CallOutcomeSheet } from '@/components/sheets/CallOutcomeSheet';
import { CompleteFollowUpSheet, FollowUpSheet } from '@/components/sheets/FollowUpSheet';
import { TransferSheet } from '@/components/sheets/TransferSheet';
import { EscalationSheet } from '@/components/sheets/EscalationSheet';
import { ReferralSheet } from '@/components/sheets/ReferralSheet';
import { MessageSheet } from '@/components/sheets/MessageSheet';
import { AddRequirementSheet } from '@/components/sheets/AddRequirementSheet';
import { useActions } from '@/state/actions';
import { useCallFlow } from '@/hooks/useCallFlow';
import {
  useAddRequirements,
  useCompleteFollowUp,
  useEscalate,
  useLogCall,
  useReferral,
  useRelationship,
  useRequestTransfer,
  useScheduleFollowUp,
  useSendMessage,
  useTemplates,
} from '@/api/hooks/leads';
import { useLabels } from '@/api/hooks/config';
import { useMe } from '@/api/hooks/me';
import { toE164 } from '@/api/keys';
import { canOpenCommunication } from '@/components/lead/CommunicationList';
import type { Requirement } from '@/api/types';
import { analytics } from '@/lib/analytics';
import { formatWhen } from '@/lib/time';
import i18n, { useT } from '@/i18n';

/** "Sell · Paras Tierea · T2 · 1204" from the server title, with a localized type label. */
export function requirementLabel(r: Pick<Requirement, 'type' | 'title'>, typeLabel: string) {
  const parts = r.title.split(' · ');
  return parts.length > 1 ? `${typeLabel} · ${parts.slice(1).join(' · ')}` : typeLabel;
}

/**
 * Mounted once in the app layout. Hosts every action sheet so Home cards, the Leads list and
 * lead detail all open the same flows, plus the dial → return → outcome flow (APP-13).
 */
export function ActionHost() {
  const t = useT();
  const { sheet, open, close, showToast, setDial } = useActions();
  const L = useLabels();
  const me = useMe();
  const relId = sheet && 'relationshipId' in sheet && sheet.relationshipId ? sheet.relationshipId : '';
  const rel = useRelationship(relId);
  const relationship = relId ? rel.data : undefined;

  const { dial } = useCallFlow((ret) => {
    analytics.track('call_completed', { requirement_id: ret.requirementId, duration_s: ret.awaySeconds });
    open({
      kind: 'call',
      relationshipId: ret.customerId,
      requirementId: ret.requirementId,
      awaySeconds: ret.awaySeconds,
      startedAt: new Date(ret.startedAt).toISOString(),
    });
  });

  useEffect(() => {
    setDial((target) => {
      analytics.track('call_started', { requirement_id: target.requirementId ?? undefined });
      void dial({ customerId: target.relationshipId, requirementId: target.requirementId ?? undefined, phone: target.phone });
    });
  }, [dial, setDial]);

  const logCall = useLogCall(relId);
  const schedule = useScheduleFollowUp(relId);
  const complete = useCompleteFollowUp();
  const transfer = useRequestTransfer();
  const escalate = useEscalate();
  const referral = useReferral();
  const sendMessage = useSendMessage(relId);
  const addReqs = useAddRequirements();
  const templates = useTemplates();

  const serviceHours = useMemo(
    () => ({ start: L.setting('service_hours.start', '09:00'), end: L.setting('service_hours.end', '18:00') }),
    [L],
  );
  const typeLabel = useCallback((code: string) => L.enumLabel('requirement_type', code), [L]);
  const actionable: Option[] = useMemo(
    () =>
      (relationship?.requirements ?? [])
        .filter((r) => r.can_act && r.status !== 'CLOSED_WON' && r.status !== 'CLOSED_LOST')
        .map((r) => ({ value: r.id, label: requirementLabel(r, typeLabel(r.type)) })),
    [relationship, typeLabel],
  );
  const defaultReq = (sheet && 'requirementId' in sheet && sheet.requirementId) || actionable[0]?.value;
  const name = relationship?.customer.name ?? '';
  const needsRel = !!relId && sheet?.kind !== 'complete';

  if (needsRel && !relationship) {
    return (
      <BottomSheet visible onClose={close} title={t('common.loading')}>
        <ListSkeleton count={1} />
      </BottomSheet>
    );
  }

  const primary = relationship?.contacts.find((c) => c.priority === 'PRIMARY');

  return (
    <>
      <CallOutcomeSheet
        visible={sheet?.kind === 'call'}
        onClose={close}
        customerName={name}
        requirements={actionable}
        defaultRequirementId={defaultReq}
        outcomes={L.options('CALL_OUTCOME')}
        followUpTypes={L.options('FOLLOW_UP_TYPE')}
        lostReasons={L.options('LOST_REASON')}
        durationSeconds={sheet?.kind === 'call' ? sheet.awaySeconds : undefined}
        serviceHours={serviceHours}
        onSubmit={async (v) => {
          await logCall.mutateAsync({
            requirementId: v.requirementId,
            body: {
              outcome: v.outcome,
              notes: v.notes || undefined,
              direction: 'OUTBOUND',
              duration_seconds: v.durationSeconds ?? null,
              started_at: sheet?.kind === 'call' ? sheet.startedAt ?? null : null,
              lost_reason: v.lostReason,
              next_action: v.nextAction ? { type: v.nextAction.type, due_at: v.nextAction.dueAt, priority: 'NORMAL', notes: v.nextAction.notes || undefined, after_hours: !!v.nextAction.afterHours, after_hours_reason: v.nextAction.afterHours?.reason } : null,
            },
          });
          analytics.track('callback_created', { outcome: v.outcome, requirement_id: v.requirementId, count: v.nextAction ? 1 : 0 });
          showToast(v.nextAction ? t('call.savedWithNext', { when: formatWhen(v.nextAction.dueAt) }) : t('call.saved'));
        }}
      />
      <FollowUpSheet
        visible={sheet?.kind === 'followUp'}
        onClose={close}
        customerName={name}
        requirements={actionable}
        defaultRequirementId={defaultReq}
        types={L.options('FOLLOW_UP_TYPE')}
        serviceHours={serviceHours}
        onSubmit={async (v) => {
          await schedule.mutateAsync({ requirementId: v.requirementId, body: { type: v.type, due_at: v.dueAt, priority: 'NORMAL', notes: v.notes || undefined, after_hours: !!v.afterHours, after_hours_reason: v.afterHours?.reason } });
          analytics.track('callback_created', { requirement_id: v.requirementId, kind: v.type });
          showToast(t('followUp.savedAt', { when: formatWhen(v.dueAt) }));
        }}
      />
      <CompleteFollowUpSheet
        visible={sheet?.kind === 'complete'}
        onClose={close}
        subtitle={sheet?.kind === 'complete' ? sheet.title : undefined}
        outcomes={L.options('FOLLOW_UP_OUTCOME')}
        onSubmit={async (v) => {
          if (sheet?.kind !== 'complete') return;
          await complete.mutateAsync({ id: sheet.followUpId, outcome: v.outcome, notes: v.notes || undefined, relationshipId: sheet.relationshipId });
          analytics.track('callback_completed', { followup_id: sheet.followUpId, outcome: v.outcome });
          showToast(t('followUp.completed'));
        }}
      />
      <TransferSheet
        visible={sheet?.kind === 'transfer'}
        onClose={close}
        customerName={name}
        initialKind={sheet?.kind === 'transfer' ? sheet.mode : 'REQUIREMENT'}
        requirements={actionable}
        defaultRequirementId={defaultReq}
        reasons={L.options('TRANSFER_REASON')}
        canTransferRelationship={!!relationship?.is_owner}
        onSubmit={async (v) => {
          await transfer.mutateAsync({
            type: v.kind,
            requirement_id: v.kind === 'REQUIREMENT' ? v.requirementId : null,
            relationship_id: v.kind === 'RELATIONSHIP' ? relId : null,
            reason: v.reason,
            destination_area: v.destinationArea || undefined,
            urgency: 'NORMAL',
            note: v.note || undefined,
          });
          analytics.track(v.kind === 'REQUIREMENT' ? 'requirement_transfer_requested' : 'relationship_transfer_requested', { reason_code: v.reason });
          showToast(t('transfer.sent'));
        }}
      />
      <EscalationSheet
        visible={sheet?.kind === 'escalate'}
        onClose={close}
        customerName={name || undefined}
        categories={L.options('ESCALATION_CATEGORY')}
        priorities={L.enumOptions('priority')}
        requirements={actionable}
        defaultRequirementId={defaultReq}
        onSubmit={async (v) => {
          await escalate.mutateAsync({
            category: v.category,
            priority: v.priority as 'NORMAL' | 'HIGH' | 'URGENT',
            notes: v.notes,
            requirement_id: v.requirementId ?? null,
            relationship_id: relId || null,
          });
          analytics.track('escalation_raised', { reason_code: v.category });
          showToast(t('escalation.sent'));
        }}
      />
      <ReferralSheet
        visible={sheet?.kind === 'referral'}
        onClose={close}
        types={L.enumOptions('requirement_type', ['BUY', 'SELL', 'RENT', 'RENT_OUT'])}
        configurations={L.options('CONFIGURATION')}
        relations={L.options('REFERRER_RELATION')}
        callbacks={L.options('CALLBACK_WINDOW')}
        typeLabel={(type) => L.enumLabel('requirement_type', type)}
        onSubmit={async (v) => {
          const res = await referral.mutateAsync({
            name: v.name,
            phone: toE164(v.phone),
            consent_confirmed: v.consent,
            // The location routes each requirement through the assignment engine (sector → area AA);
            // the typed text is also kept as the address so nothing the AA entered is lost.
            requirements: v.types.map((type) => ({
              type: type as 'BUY',
              configuration: v.configuration ?? undefined,
              locality_name: v.location,
              address_text: v.location,
            })),
            referrer_relation: v.relation ?? undefined,
            preferred_callback: v.callback ?? undefined,
            notes: v.notes || undefined,
          });
          analytics.track('referral_submitted', { requirement_count: v.types.length });
          return res;
        }}
      />
      <MessageSheet
        visible={sheet?.kind === 'message'}
        onClose={close}
        customerName={name}
        templates={templates.data ?? []}
        requirements={actionable}
        defaultRequirementId={defaultReq}
        hasPrimaryContact={!!primary}
        primaryContactLabel={primary ? `${primary.name} (${L.enumLabel('contact_role', primary.role)})` : undefined}
        language={i18n.language}
        preview={{
          customer_first_name: (primary?.name ?? name).split(' ')[0] ?? '',
          aa_name: me.data?.name ?? '',
          requirement_type_label: typeLabel(relationship?.requirements.find((r) => r.id === defaultReq)?.type ?? '').toLowerCase(),
        }}
        onSubmit={async (v) => {
          const comm = await sendMessage.mutateAsync({ requirementId: v.requirementId, body: { template_code: v.templateCode, channel: v.channel, to: v.to } });
          analytics.track('template_message_sent', { channel: v.channel, template_code: v.templateCode });
          // REQ-11: no link (automatic / queued / skipped) → say what happened instead of opening nothing.
          if (!canOpenCommunication(comm)) {
            showToast(t(`messages.status.${comm.status}`, { defaultValue: t('messages.logged') }));
            return;
          }
          try {
            await Linking.openURL(comm.deep_link);
            showToast(t('messages.logged'));
          } catch {
            showToast(t('messages.noApp'));
          }
        }}
      />
      <AddRequirementSheet
        visible={sheet?.kind === 'addRequirement'}
        onClose={close}
        customerName={name}
        types={L.enumOptions('requirement_type', ['BUY', 'SELL', 'RENT', 'RENT_OUT'])}
        configurations={L.options('CONFIGURATION')}
        timelines={L.options('TIMELINE')}
        onSubmit={async (requirements) => {
          const created = await addReqs.mutateAsync({ relationshipId: relId, requirements });
          analytics.track('requirement_added', { requirement_count: requirements.length });
          showToast(Array.isArray(created) && created.some((r) => r.is_draft) ? t('draftReq.savedAsDraft') : t('addReq.added'));
        }}
      />
    </>
  );
}

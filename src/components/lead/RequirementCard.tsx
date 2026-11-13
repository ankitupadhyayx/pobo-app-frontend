import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeftRight, Handshake, Sparkles, CalendarPlus, CheckCircle2, Clock, Eye, Hourglass, MessageCircle, PhoneCall, Plus, ChevronRight, KeyRound, FilePen } from 'lucide-react-native';
import { Badge, Button, IntentTag, SlaChip, StagePill } from '@/components/ui';
import type { RequirementProperty } from '@/api/hooks/listings';
import type { Requirement } from '@/api/types';
import { useLabels } from '@/api/hooks/config';
import { formatINR, formatWhen } from '@/lib/time';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { placeTitle } from '@/lib/property';
import { useT } from '@/i18n';
import { RequirementCommunications } from './CommunicationList';
import { CompleteRequirementSheet } from '@/components/sheets/CompleteRequirementSheet';

interface Props {
  req: Requirement;
  dnc: boolean;
  highlighted?: boolean;
  transferPending?: boolean;
  onCall: () => void;
  onFollowUp: () => void;
  onCompleteFollowUp: (followUpId: string, title: string) => void;
  onMessage: () => void;
  onTransfer: () => void;
  onMatches?: () => void;
  /** FB-03 (SELL / RENT OUT): add a property to this requirement, open one, or visit one. */
  onAddProperty?: () => void;
  onOpenProperty?: (p: RequirementProperty) => void;
  onVisitProperty?: (p: RequirementProperty) => void;
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="min-w-[45%] flex-1">
      <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</Text>
      <Text className="text-xs font-semibold text-slate-800">{value}</Text>
    </View>
  );
}

/** One card per requirement: type, servicing AA, status, SLA, details and its next action. */
export function RequirementCard({ req, dnc, highlighted, transferPending, onCall, onFollowUp, onCompleteFollowUp, onMessage, onTransfer, onMatches, onAddProperty, onOpenProperty, onVisitProperty }: Props) {
  const t = useT();
  const L = useLabels();
  const typeLabel = L.enumLabel('requirement_type', req.type);
  const closed = req.status === 'CLOSED_WON' || req.status === 'CLOSED_LOST';
  const actionable = req.can_act && !closed;
  const servicing = L.glossary('SERVICING_AA', 'Servicing AA').label;
  const location = req.title.split(' · ').slice(1).join(' · ');
  const budget =
    req.budget_min || req.budget_max ? [req.budget_min ? formatINR(req.budget_min) : null, req.budget_max ? formatINR(req.budget_max) : null].filter(Boolean).join(' – ') : null;
  const na = req.next_action;
  const naOverdue = !!na?.is_overdue;
  const outbound = actionable && !dnc;
  const ownsProperty = req.type === 'SELL' || req.type === 'RENT_OUT';
  const properties = req.properties ?? [];
  const [completing, setCompleting] = useState(false);
  const canComplete = actionable && req.access === 'FULL';

  let naButton: { label: string; icon: typeof PhoneCall; onPress: () => void; variant?: 'primary' | 'danger' } | null = null;
  if (na && actionable) {
    if ((na.type === 'FIRST_CONTACT_CALL' || na.type === 'CALL') && !dnc) naButton = { label: naOverdue ? t('common.callNow') : t('common.call'), icon: PhoneCall, onPress: onCall, variant: naOverdue ? 'danger' : 'primary' };
    else if (na.type === 'FOLLOW_UP' && na.follow_up_id) naButton = { label: t('common.complete'), icon: CheckCircle2, onPress: () => onCompleteFollowUp(na.follow_up_id!, na.title) };
    else if (na.type === 'SCHEDULE_FOLLOW_UP' && !dnc) naButton = { label: t('lead.followUp'), icon: CalendarPlus, onPress: onFollowUp };
    else if (na.type === 'COMPLETE_REQUIREMENT' && canComplete) naButton = { label: t('draftReq.complete'), icon: FilePen, onPress: () => setCompleting(true) };
  }

  return (
    <View testID={`req-card-${req.type}`} className={cn('gap-3 rounded-2xl border bg-white p-4', highlighted ? 'border-2 border-teal-400' : 'border-slate-200')}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-1">
          <IntentTag type={req.type} label={typeLabel} />
          <Text className="text-sm font-bold text-slate-900">{location || typeLabel}</Text>
          {req.source_detail?.display ? (
            <Text testID={`req-source-${req.type}`} className="text-[11px] text-slate-500">
              {t('lead.source')}: <Text className="font-bold text-slate-700">{req.source_detail.display}</Text>
            </Text>
          ) : null}
        </View>
        <View className="items-end gap-1">
          <StagePill status={req.status} label={L.enumLabel('requirement_status', req.status)} />
          {req.sla?.due_at && !dnc && (req.sla.state === 'ON_TRACK' || req.sla.state === 'AT_RISK' || req.sla.state === 'TARGET_MISSED' || req.sla.state === 'BREACHED' || req.sla.state === 'PAUSED') ? (
            <SlaChip compact dueAt={req.sla.due_at} breachAt={req.sla.breach_at} paused={req.sla.state === 'PAUSED'} />
          ) : null}
        </View>
      </View>

      {req.is_draft ? (
        <View testID={`req-draft-${req.type}`} className="gap-1.5 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <View className="flex-row items-center gap-2">
            <Badge label={t('draftReq.badge')} tone="amber" />
            <Text className="flex-1 text-xs font-bold text-amber-900">{t('draftReq.incomplete')}</Text>
          </View>
          {(req.missing_fields ?? []).map((m) => (
            <Text key={m.field} className="text-[11px] text-amber-900">• {m.message}</Text>
          ))}
          <Text className="text-[11px] text-amber-800">{t('draftReq.noMatches')}</Text>
          {canComplete && na?.type !== 'COMPLETE_REQUIREMENT' ? (
            <Button testID={`req-complete-${req.type}`} size="sm" icon={FilePen} label={t('draftReq.complete')} onPress={() => setCompleting(true)} />
          ) : null}
        </View>
      ) : null}

      <RoutingInfo req={req} servicingLabel={servicing} />

      {req.access === 'FULL' ? (
        <View className="flex-row flex-wrap gap-x-3 gap-y-2 rounded-xl bg-slate-50 p-3">
          <Detail label={t('lead.configuration')} value={req.configuration ? L.master('CONFIGURATION', req.configuration) : null} />
          <Detail label={t('lead.budget')} value={budget} />
          <Detail label={t('lead.expectedPrice')} value={req.expected_price ? formatINR(req.expected_price) : null} />
          <Detail label={t('lead.expectedRent')} value={req.expected_rent ? `${formatINR(req.expected_rent)}/mo` : null} />
          <Detail label={t('lead.leaseTerm')} value={req.lease_term_months ? t('lead.months', { count: req.lease_term_months }) : null} />
          <Detail label={t('lead.timeline_label')} value={req.timeline ? L.master('TIMELINE', req.timeline) : null} />
          <LocationDetail req={req} />
          {req.notes ? <Detail label={t('lead.notes')} value={req.notes} /> : null}
        </View>
      ) : (
        <View className="flex-row items-center gap-2 rounded-xl bg-slate-50 p-3">
          <Eye size={14} color={colors.muted} />
          <Text className="flex-1 text-xs text-slate-600">{t('lead.readOnly')}</Text>
        </View>
      )}

      {ownsProperty && req.access === 'FULL' ? (
        <View testID={`req-properties-${req.type}`} className="gap-2">
          <Text className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">{t('addProperty.properties', { count: properties.length })}</Text>
          {properties.map((p) => (
            <Pressable key={p.id} testID={`req-property-${p.id}`} accessibilityRole="button" onPress={() => onOpenProperty?.(p)} className="gap-1.5 rounded-xl border border-violet-200 bg-violet-50 p-2.5 active:bg-violet-100">
              <View className="flex-row items-start gap-2">
                <View className="flex-1">
                  <Text className="text-xs font-bold text-slate-900">{p.title || placeTitle(p)}</Text>
                  <Text className="text-[11px] text-slate-600">
                    {[p.configuration ? L.master('CONFIGURATION', p.configuration) : null, p.expected_price ? formatINR(p.expected_price) : p.expected_rent ? `${formatINR(p.expected_rent)}/mo` : null].filter(Boolean).join(' · ')}
                  </Text>
                  {p.structure_status === 'PENDING_VERIFICATION' ? <Text className="text-[10px] font-semibold text-amber-800">{t('addProperty.structurePending')}</Text> : null}
                  {!p.has_access_arrangement ? <Text className="text-[10px] text-slate-500"><KeyRound size={10} color={colors.muted} /> {t('access.missing')}</Text> : null}
                </View>
                <Badge label={L.enumLabel('listing_status', p.status)} tone={p.status === 'VERIFIED' ? 'purple' : p.status === 'WITHDRAWN' ? 'dark' : 'slate'} />
                <ChevronRight size={14} color={colors.muted} />
              </View>
              {actionable && onVisitProperty && p.status !== 'WITHDRAWN' ? (
                <Button testID={`req-property-visit-${p.id}`} size="sm" variant="outline" icon={CalendarPlus} label={t('addProperty.scheduleVisit')} onPress={() => onVisitProperty(p)} />
              ) : null}
            </Pressable>
          ))}
          {actionable && onAddProperty ? <Button testID={`req-add-property-${req.type}`} icon={Plus} label={t('addProperty.cta')} onPress={onAddProperty} /> : null}
        </View>
      ) : null}

      {transferPending ? (
        <View className="flex-row items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
          <Hourglass size={14} color={colors.warn} />
          <Text className="flex-1 text-xs font-semibold text-amber-900">{t('lead.transferPending')}</Text>
        </View>
      ) : null}

      {req.deal ? (
        <View testID={`req-deal-${req.deal.stage}`} className={cn('flex-row items-start gap-2 rounded-xl border p-2.5', req.deal.stage === 'LOST' ? 'border-slate-200 bg-slate-50' : 'border-indigo-200 bg-indigo-50')}>
          <Handshake size={14} color={req.deal.stage === 'LOST' ? colors.muted : '#4f46e5'} />
          <View className="flex-1">
            <Text className="text-xs font-bold text-slate-900">
              {t('deal.title')}: {L.hi && req.deal.label_hi ? req.deal.label_hi : req.deal.label}
            </Text>
            <Text className="text-[11px] text-slate-600">{t(`deal.hint.${req.deal.stage}`, { defaultValue: '' })}</Text>
          </View>
        </View>
      ) : null}

      {na && na.type !== 'NONE' ? (
        <View className={cn('gap-2 rounded-xl border p-3', naOverdue ? 'border-rose-300 bg-rose-50/80' : 'border-teal-200 bg-teal-50/60')}>
          <View className="flex-row items-center justify-between">
            <Text className={cn('text-[10px] font-extrabold uppercase tracking-wider', naOverdue ? 'text-rose-700' : 'text-teal-700')}>{t('lead.nextAction')}</Text>
            {na.due_at ? <Text className={cn('text-[11px] font-bold', naOverdue ? 'text-rose-700' : 'text-teal-800')}>{formatWhen(na.due_at)}</Text> : null}
          </View>
          <View className="flex-row items-center gap-2">
            <Clock size={14} color={naOverdue ? colors.danger : colors.brandDark} />
            <Text className="flex-1 text-xs font-bold text-slate-900">{na.title}</Text>
          </View>
          {naButton ? <Button testID={`req-next-${req.type}`} size="md" label={naButton.label} icon={naButton.icon} variant={naButton.variant ?? 'primary'} onPress={naButton.onPress} /> : null}
        </View>
      ) : actionable && !dnc ? (
        <Text className="text-xs italic text-slate-500">{t('lead.noNextAction')}</Text>
      ) : null}

      <RequirementCommunications requirementId={req.id} />
      <CompleteRequirementSheet req={req} visible={completing} onClose={() => setCompleting(false)} />

      {actionable ? (
        <View className="flex-row flex-wrap gap-2 border-t border-slate-100 pt-3">
          {outbound ? <Button size="sm" variant="secondary" icon={PhoneCall} label={t('common.call')} onPress={onCall} /> : null}
          {outbound ? <Button size="sm" variant="secondary" icon={CalendarPlus} label={t('lead.followUp')} onPress={onFollowUp} /> : null}
          {outbound ? <Button size="sm" variant="secondary" icon={MessageCircle} label={t('lead.message')} onPress={onMessage} /> : null}
          {onMatches && (req.type === 'BUY' || req.type === 'RENT') ? <Button testID={`req-matches-${req.type}`} size="sm" variant="secondary" icon={Sparkles} label={t('matches.open')} onPress={onMatches} /> : null}
          <Button size="sm" variant="ghost" icon={ArrowLeftRight} label={t('lead.transfer')} disabled={transferPending} onPress={onTransfer} />
        </View>
      ) : null}
    </View>
  );
}

/** R2-9 / R3-3: Territory AA, Servicing AA and Relationship owner shown separately, with the reason, plus each preferred area's territory AA. */
function RoutingInfo({ req, servicingLabel }: { req: Requirement; servicingLabel: string }) {
  const t = useT();
  const r = req.routing;
  const who = (aa: { id: string; name: string } | null | undefined, mine?: boolean) => (mine ? t('lead.you') : (aa?.name ?? '—'));
  if (!r) {
    return (
      <Text className="text-[11px] text-slate-500">
        {servicingLabel}: <Text className="font-bold text-slate-700">{who(req.servicing_aa, req.is_mine)}</Text>
      </Text>
    );
  }
  return (
    <View testID={`req-routing-${req.type}`} className="gap-1 rounded-xl border border-slate-100 p-3">
      <Row label={t('routing.territoryAa')} value={`${who(r.territory_aa)}${r.territory?.name ? ` · ${r.territory.name}` : ''}`} />
      <Row label={servicingLabel} value={who(r.servicing_aa ?? req.servicing_aa, req.is_mine)} strong />
      <Row label={t('routing.owner')} value={who(r.relationship_owner)} />
      {r.areas?.length ? (
        <View testID={`req-routing-areas-${req.type}`} className="mt-1 gap-0.5 border-t border-slate-100 pt-1.5">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('routing.areas')}</Text>
          {r.areas.map((a, i) => (
            <Row
              key={`${a.locality?.id ?? ''}-${a.society?.id ?? ''}-${i}`}
              label={a.society?.name ?? a.locality?.name ?? '—'}
              value={a.territory_aa ? `${a.territory_aa.name}${a.territory?.name ? ` · ${a.territory.name}` : ''}` : t('routing.noAreaAa')}
            />
          ))}
        </View>
      ) : null}
      {r.reason ? <Text className="mt-0.5 text-[11px] text-slate-500">{t('routing.why', { reason: r.reason })}</Text> : null}
      {r.servicing_differs_from_territory ? <Text className="text-[11px] font-semibold text-amber-700">{t('routing.differs')}</Text> : null}
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row gap-2">
      <Text className="w-28 text-[11px] text-slate-500">{label}</Text>
      <Text className={cn('flex-1 text-[11px] text-slate-800', strong ? 'font-extrabold' : 'font-semibold')}>{value}</Text>
    </View>
  );
}

/** R2-12: what location the requirement really has; never pretend. */
function LocationDetail({ req }: { req: Requirement }) {
  const t = useT();
  if (req.location_status === 'OPEN') return <Detail label={t('lead.location')} value={t('lead.locationOpen')} />;
  if (req.location_status === 'NOT_CAPTURED') {
    return (
      <View testID={`req-location-missing-${req.type}`} className="min-w-[45%] flex-1">
        <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('lead.location')}</Text>
        <Text className="text-xs font-bold text-amber-700">{t('lead.locationNotCaptured')}</Text>
      </View>
    );
  }
  const names = [...(req.preferred_localities ?? []), ...(req.preferred_societies ?? [])].map((x) => x.name);
  const own = [req.society?.name, req.locality?.name].filter(Boolean).join(', ');
  const legacy = Array.isArray(req.preferred_areas) ? (req.preferred_areas as string[]).join(', ') : '';
  return <Detail label={t('lead.location')} value={names.join(', ') || own || req.address_text || legacy || null} />;
}

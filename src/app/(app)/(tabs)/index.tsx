import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, Building2, CalendarDays, CalendarOff, CheckCircle2, ChevronRight, ClipboardList, Home as HomeIcon, KeyRound, PhoneCall, Share2, UserPlus } from 'lucide-react-native';
import { ActionCard } from '@/components/home/ActionCard';
import { FloatCard } from '@/components/home/FloatCard';
import { HeroCounters, TodayStrip } from '@/components/home/HeroCounters';
import { HOME_BADGE_KEY, homeItemTone } from '@/components/home/homeItem';
import { Card, EmptyState, ErrorState, InlineBanner, ListSkeleton, SectionTitle } from '@/components/ui';
import { useClaimFloat, useHome } from '@/api/hooks/leads';
import { useLabels } from '@/api/hooks/config';
import { useMe } from '@/api/hooks/me';
import { useMarkReminderRead } from '@/api/hooks/reminders';
import { reminderHref } from '@/lib/deeplink';
import { ApiError, errorMessage } from '@/api/errors';
import type { HomeItem, HomeSection } from '@/api/types';
import { useActions } from '@/state/actions';
import { analytics } from '@/lib/analytics';
import { formatINR, formatWhen, greeting } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

/** A section key the app has no string for yet (newer backend) reads as words, never as a raw i18n key. */
const humanize = (key: string) => key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');

function QuickAction({ icon: Icon, label, onPress, tint, testID }: { icon: typeof UserPlus; label: string; onPress: () => void; tint: string; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} className="min-w-[45%] flex-1 flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 active:bg-teal-50">
      <View className={`h-10 w-10 items-center justify-center rounded-xl ${tint}`}>
        <Icon size={20} color={colors.brandDark} />
      </View>
      <Text className="text-sm font-bold text-slate-800">{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const me = useMe();
  const home = useHome();
  const { dial, open } = useActions();
  const claim = useClaimFloat();
  const markRead = useMarkReminderRead();
  const [floatResult, setFloatResult] = useState<Record<string, { result: 'won' | 'lost' | null; error?: string }>>({});

  const openLead = (relId: string | null | undefined, reqId?: string | null) => {
    if (!relId) return;
    analytics.track('lead_opened', { screen: 'home', requirement_id: reqId ?? undefined });
    router.push({ pathname: '/lead/[id]', params: reqId ? { id: relId, requirement: reqId } : { id: relId } });
  };

  const onClaim = async (item: HomeItem) => {
    const id = item.target.float_id;
    if (!id) return;
    try {
      const req = await claim.mutateAsync(id);
      setFloatResult((r) => ({ ...r, [id]: { result: 'won' } }));
      analytics.track('territory_float_claimed', { float_id: id, result: 'won' });
      setTimeout(() => openLead(req.relationship_id, req.id), 600);
    } catch (e) {
      // Another AA won the race or the window closed: say so plainly, no retry loop.
      if (e instanceof ApiError && (e.status === 409 || e.status === 404)) {
        setFloatResult((r) => ({ ...r, [id]: { result: 'lost' } }));
        analytics.track('territory_float_lost', { float_id: id, reason_code: e.code });
      } else {
        setFloatResult((r) => ({ ...r, [id]: { result: null, error: errorMessage(e) } }));
      }
    }
  };

  const renderItem = (item: HomeItem) => {
    if (item.kind === 'FLOAT_OPPORTUNITY') {
      const fr = item.target.float_id ? floatResult[item.target.float_id] : undefined;
      return (
        <FloatCard
          key={item.id}
          testID={`home-float-${item.target.float_id}`}
          title={item.title}
          context={item.subtitle}
          expiresAt={item.due_at}
          claiming={claim.isPending && claim.variables === item.target.float_id}
          result={fr?.result ?? null}
          error={fr?.error}
          onClaim={() => onClaim(item)}
        />
      );
    }
    const relId = item.target.relationship_id;
    const reqId = item.target.requirement_id;
    const tone = homeItemTone(item);
    const isSla = item.kind === 'SLA_FIRST_CONTACT';
    const context = [item.subtitle, item.covering_for ? t('home.covering', { name: item.covering_for }) : null].filter(Boolean).join(' · ');
    const call =
      item.customer_phone && relId
        ? { label: tone === 'breach' || tone === 'overdue' ? t('common.callNow') : t('common.call'), icon: PhoneCall, onPress: () => dial({ relationshipId: relId, requirementId: reqId, phone: item.customer_phone! }) }
        : undefined;
    const completeFU = item.target.follow_up_id
      ? { label: t('common.complete'), icon: CheckCircle2, onPress: () => open({ kind: 'complete', followUpId: item.target.follow_up_id!, relationshipId: relId, title: item.title }) }
      : undefined;
    const { unit_id: unitId, listing_id: listingId } = item.target;
    // Phase 2 targets: a visit, a flat, a listing or a field task (BE Home sections).
    const openTarget = (() => {
      switch (item.next_action) {
        case 'OPEN_VISIT':
          return () => router.navigate({ pathname: '/visits', params: { bucket: 'today' } });
        case 'OPEN_UNIT':
          return unitId ? () => router.push({ pathname: '/field/unit/[id]', params: { id: unitId } }) : undefined;
        case 'OPEN_LISTING':
          return listingId ? () => router.push({ pathname: '/listing/[id]', params: { id: listingId } }) : undefined;
        case 'COMPLETE_TASK':
          return () => router.push('/more/field-tasks');
        case 'COLLECT_KEY':
        case 'RETURN_KEY':
          return () => router.push({ pathname: '/more/field-tasks', params: { kind: 'keys' } });
        case 'OPEN_REMINDER': {
          const href = reminderHref(item.target.screen, item.target);
          return () => {
            if (item.target.reminder_id) markRead.mutate(item.target.reminder_id);
            if (href) router.push(href as never);
            else router.push('/more/reminders');
          };
        }
        default:
          return relId ? () => openLead(relId, reqId) : undefined;
      }
    })();
    const openBtn = {
      label: item.next_action === 'COLLECT_KEY' ? t('keyTasks.collect') : item.next_action === 'RETURN_KEY' ? t('keyTasks.return') : item.next_action === 'VIEW_TRANSFER' ? t('home.view') : item.next_action === 'OPEN_UNIT' ? t('home.openUnit') : item.next_action === 'OPEN_LISTING' ? t('home.openListing') : t('common.open'),
      icon: item.next_action === 'COLLECT_KEY' || item.next_action === 'RETURN_KEY' ? KeyRound : item.next_action === 'OPEN_UNIT' ? HomeIcon : item.next_action === 'COMPLETE_TASK' ? ClipboardList : ArrowRight,
      onPress: () => openTarget?.(),
    };

    let primary = openBtn;
    let secondary: typeof openBtn | undefined;
    if ((item.next_action === 'CALL' || item.next_action === 'OPEN_VISIT') && call) {
      primary = call;
      secondary = item.next_action === 'OPEN_VISIT' ? openBtn : completeFU;
    } else if (item.next_action === 'COMPLETE_FOLLOW_UP' && completeFU) {
      primary = { ...completeFU, icon: CheckCircle2 };
      secondary = call ? { ...call, label: t('common.call') } : undefined;
    }

    return (
      <ActionCard
        key={item.id}
        testID={`home-item-${item.kind}`}
        badge={t(HOME_BADGE_KEY[item.kind])}
        tone={tone}
        title={item.customer_name ?? item.title}
        context={item.customer_name ? `${item.title.includes(item.customer_name) ? '' : `${item.title} · `}${context}` : context}
        sla={isSla ? { dueAt: item.due_at, breachAt: item.breach_at, paused: item.sla_state === 'PAUSED' } : undefined}
        dueText={!isSla && item.due_at ? formatWhen(item.due_at) : undefined}
        primary={primary}
        secondary={secondary}
        onOpen={openTarget}
        dnc={item.customer_dnc}
        dncText={t('leads.dncSuppressed')}
      />
    );
  };

  const name = me.data?.name?.split(' ')[0] ?? '';
  const c = home.data?.counters;
  const g = (code: string, fallback: string) => L.glossary(code, fallback);
  const pe = g('POTENTIAL_EARNING', 'Potential Earning');
  const al = g('ACTIVE_LEADS', 'Active Leads');
  const fu = g('FOLLOWUPS', 'Followups');
  const vt = g('VISIT_TODAY', 'Visit Today');
  const items = home.data?.items ?? [];
  // Territory floats are first-claim-wins, so they sit right under Quick actions instead of in the ranked list.
  const floatSection = home.data?.sections?.find((s) => s.key === 'floats');
  const sections = (home.data?.sections ?? []).filter((s) => s.key !== 'floats');

  const viewAll = (section: HomeSection) => {
    const { screen, focus } = section.view_all;
    if (screen === 'leads' && focus) router.navigate({ pathname: '/leads', params: { focus } });
    else if (screen === 'floats') router.push('/more/floats');
    else if (screen === 'visits') router.navigate({ pathname: '/visits', params: { bucket: focus ?? 'today' } });
    else if (screen === 'territory') router.push('/more/field-tasks');
    else if (screen === 'keys') router.push({ pathname: '/more/field-tasks', params: { kind: 'keys' } });
    else if (screen === 'reminders') router.push('/more/reminders');
  };

  const renderSection = (section: HomeSection) => {
    const more = section.view_all.screen !== 'none' && section.total > section.items.length;
    return (
      <View key={section.key} testID={`home-section-${section.key}`} className="gap-2.5">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-sm font-bold text-slate-900">
            {t(`home.section.${section.key}`, { defaultValue: humanize(section.key) })} <Text className="font-semibold text-slate-400">{section.total}</Text>
          </Text>
          <Text className="text-[11px] font-medium text-slate-500">{t(`home.sectionHint.${section.key}`, { defaultValue: '' })}</Text>
        </View>
        {section.items.map(renderItem)}
        {more ? (
          <Pressable
            testID={`home-view-all-${section.key}`}
            accessibilityRole="button"
            onPress={() => viewAll(section)}
            className="flex-row items-center justify-center gap-1 rounded-xl border border-teal-200 bg-white py-2.5 active:bg-teal-50"
          >
            <Text className="text-xs font-bold text-teal-800">{t('home.viewAll', { count: section.view_all.count })}</Text>
            <ChevronRight size={14} color={colors.brandDark} />
          </Pressable>
        ) : null}
      </View>
    );
  };
  const profile = home.data?.profile ?? me.data?.aa_profile;

  return (
    <ScrollView
      className="flex-1 bg-slate-100"
      contentContainerClassName="p-4 pb-10 gap-4"
      refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={() => void home.refetch()} tintColor={colors.brand} colors={[colors.brand]} />}
    >
      {/* Hero */}
      <View className="rounded-3xl bg-teal-900 p-5">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-xs font-semibold tracking-wide text-teal-200/90">{profile?.territory?.name}</Text>
            <Text className="mt-0.5 text-xl font-bold tracking-tight text-white">{t(`home.greeting_${greeting()}`, { name })}</Text>
          </View>
          <View className="rounded-full border border-teal-600/50 bg-teal-700/80 px-2.5 py-1">
            <Text className="text-[11px] font-bold text-teal-100">{L.enumLabel('duty_status', profile?.duty_status)}</Text>
          </View>
        </View>
        <HeroCounters
          items={[
            { key: 'potential', label: pe.label, definition: pe.definition, value: c?.potential_earning != null ? formatINR(c.potential_earning) : '—', note: c?.potential_earning != null && c.potential_earning_interim ? t('earnings.estimate') : undefined, onPress: () => router.push('/earnings') },
            { key: 'active', label: al.label, definition: al.definition, value: c?.active_leads ?? '–', onPress: () => router.push('/leads') },
            { key: 'followups', label: fu.label, definition: fu.definition, value: c?.follow_ups ?? '–', alert: items.some((i) => i.is_overdue), onPress: () => router.navigate({ pathname: '/leads', params: { focus: 'follow_ups' } }) },
            { key: 'visits', label: vt.label, definition: vt.definition, value: c?.visits_today ?? '–', onPress: () => router.push('/visits') },
          ]}
        />
      </View>

      {home.data?.on_leave_today ? (
        <InlineBanner tone="info">
          <Text className="text-xs font-bold text-blue-900">{t('home.onLeaveTitle')}</Text>
          <Text className="mt-0.5 text-xs text-blue-900">{t('home.onLeaveBody')}</Text>
        </InlineBanner>
      ) : profile && profile.duty_status !== 'ON_DUTY' ? (
        <Card tone="warn" onPress={() => useActions.getState().setDrawer('profile')}>
          <View className="flex-row items-center gap-2">
            <CalendarOff size={16} color={colors.warn} />
            <Text className="text-sm font-bold text-amber-900">{t('home.offDutyTitle')}</Text>
          </View>
          <Text className="mt-1 text-xs text-amber-900">{t('home.offDutyBody')}</Text>
        </Card>
      ) : null}

      {/* Quick actions */}
      <View>
        <SectionTitle title={t('home.quickActions')} />
        <View className="flex-row flex-wrap gap-2">
          <QuickAction testID="qa-add-lead" icon={UserPlus} label={g('ADD_LEAD', t('home.addLead')).label} tint="bg-teal-100/70" onPress={() => router.push('/lead/new')} />
          <QuickAction testID="qa-refer" icon={Share2} label={g('REFER', t('home.refer')).label} tint="bg-blue-100/70" onPress={() => open({ kind: 'referral' })} />
          <QuickAction testID="qa-survey" icon={Building2} label={g('SURVEY', t('home.survey')).label} tint="bg-amber-100/70" onPress={() => router.navigate('/survey')} />
          <QuickAction testID="qa-visits" icon={CalendarDays} label={g('VISITS', t('home.visits')).label} tint="bg-violet-100/70" onPress={() => router.navigate('/visits')} />
        </View>
      </View>

      {floatSection ? renderSection(floatSection) : null}

      {/* Ranked action centre */}
      <View>
        <SectionTitle title={t('home.priority', { count: sections.reduce((n, s) => n + s.total, 0) })} action={{ label: t('home.myLeads'), onPress: () => router.navigate('/leads') }} />
        {home.isPending ? (
          <ListSkeleton count={3} />
        ) : home.error && !home.data ? (
          <ErrorState error={home.error} onRetry={() => home.refetch()} />
        ) : sections.length === 0 ? (
          <EmptyState
            title={t('home.allCaughtUpTitle')}
            body={t('home.allCaughtUpBody')}
            action={{ label: g('ADD_LEAD', t('home.addLead')).label, onPress: () => router.push('/lead/new') }}
          />
        ) : (
          <View className="gap-5">{sections.map(renderSection)}</View>
        )}
      </View>

      {/* Today */}
      {c ? (
        <Card>
          <Text className="mb-3 text-sm font-bold text-slate-900">{t('home.today')}</Text>
          <TodayStrip
            items={[
              { key: 'new', label: g('NEW_LEADS', 'New Leads').label, value: c.new_leads },
              { key: 'calls', label: g('CALLS', 'Calls').label, value: c.calls },
              { key: 'fu', label: fu.label, value: c.follow_ups },
              { key: 'visits', label: g('VISITS', 'Visits').label, value: c.visits_today },
              { key: 'flats', label: g('FLATS_SURVEYED', 'Flats Surveyed').label, value: c.flats_surveyed_today },
            ]}
          />
        </Card>
      ) : null}
    </ScrollView>
  );
}

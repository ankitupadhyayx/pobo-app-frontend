import { useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarOff } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { Badge, Button, Card, Chips, DateTimeField, EmptyState, ErrorState, InlineBanner, ListSkeleton, TextField } from '@/components/ui';
import { useCancelLeave, useMyLeave, useRequestLeave, useRoster } from '@/api/hooks/account';
import { useLabels } from '@/api/hooks/config';
import { useSubmit } from '@/hooks/useSubmit';
import { FieldAnchor, FormScrollView, useFormFocus } from '@/hooks/useFormFocus';
import { ApiError } from '@/api/errors';
import { useActions } from '@/state/actions';
import { analytics } from '@/lib/analytics';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n';
import { formatDay } from '@/lib/time';

const DAY = 86400000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (s: string) => formatDay(`${s}T00:00:00`);

/** APP-20 roster view (weekly off, leave, cover) + leave request. */
export default function LeaveScreen() {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  const roster = useRoster();
  const leave = useMyLeave();
  const request = useRequestLeave();
  const showSuccess = useActions((s) => s.showSuccess);
  const form = useFormFocus();
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<string>('LEAVE');
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const cancelLeave = useCancelLeave();
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const showToast = useActions((s) => s.showToast);
  const [err, setErr] = useState<Record<string, string>>({});
  const s = useSubmit(
    async () => {
      const end = to ?? from!;
      try {
        await request.mutateAsync({ leave_type: type as 'LEAVE', start_date: iso(from!), end_date: iso(end), reason: reason.trim(), notes: notes.trim() || undefined });
      } catch (e) {
        // R2-8/R2-17: the reason is always visible: field errors under their field, others (e.g.
        // "You already have leave requested for these dates") in the banner + toast.
        const f = e instanceof ApiError ? e.fields : {};
        const map: Record<string, string> = {};
        if (f.start_date) map.from = f.start_date;
        if (f.end_date) map.to = f.end_date;
        if (f.reason) map.reason = f.reason;
        if (f.leave_type) map.type = f.leave_type;
        form.fail(Object.keys(map).length ? map : { banner: e instanceof Error ? e.message : '' }, e instanceof ApiError && e.code === 'leave_overlap' ? t('leave.overlap') : e instanceof Error ? e.message : undefined);
        throw e;
      }
      analytics.track('leave_requested', { leave_type: type });
      showSuccess({
        title: t('leave.sent'),
        body: t('leave.sentBody'),
        lines: [
          { label: t('leave.from'), value: formatDay(from!, true) },
          { label: t('leave.to'), value: formatDay(end, true) },
          { label: t('leave.reason'), value: reason.trim() },
          { label: t('leave.status'), value: t('leave.pending') },
        ],
      });
    },
    () => {
      setFormOpen(false);
      setFrom(null);
      setTo(null);
      setReason('');
      setNotes('');
    },
  );

  const r = roster.data;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = Array.from({ length: 7 }, (_, i) => new Date(today.getTime() + i * DAY));
  const onLeave = (d: Date) =>
    (r?.upcoming_leave ?? []).some((l) => l.status === 'APPROVED' && iso(d) >= l.start_date && iso(d) <= l.end_date);
  const isOff = (d: Date) => r?.weekly_off_weekday != null && (d.getDay() + 6) % 7 === r.weekly_off_weekday;

  const submit = () => {
    const e: Record<string, string> = {};
    if (!from) e.from = t('errors.required');
    if (from && to && iso(to) < iso(from)) e.to = t('leave.toBeforeFrom');
    // R2-16: start, end and reason are required (end defaults to the start for one day).
    if (!reason.trim()) e.reason = t('leave.reasonRequired');
    setErr(e);
    if (Object.keys(e).length) {
      form.fail(e);
      return;
    }
    form.clear();
    void s.run(undefined);
  };

  const statusTone = (st: string) => (st === 'APPROVED' ? 'emerald' : st === 'REJECTED' ? 'rose' : st === 'CANCELLED' ? 'slate' : 'amber');

  return (
    <View className="flex-1 bg-slate-100">
      <ConnectedHeader onBack={() => router.back()} title={t('leave.title')} />
      <FormScrollView
        form={form}
        innerClassName="gap-4"
        contentContainerClassName="p-4 pb-12"
        refreshControl={<RefreshControl refreshing={roster.isRefetching} onRefresh={() => { void roster.refetch(); void leave.refetch(); }} tintColor={colors.brand} />}
      >
        {roster.isPending ? (
          <ListSkeleton count={1} />
        ) : roster.error ? (
          <ErrorState error={roster.error} onRetry={() => roster.refetch()} />
        ) : r ? (
          <Card>
            <Text className="text-sm font-bold text-slate-900">{t('leave.roster')}</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              {t('leave.weeklyOff')}: <Text className="font-bold text-slate-700">{r.weekly_off_label ?? '—'}</Text> · {r.service_hours_start}–{r.service_hours_end}
            </Text>
            <View className="mt-3 flex-row gap-1.5">
              {week.map((d) => {
                const off = isOff(d);
                const lv = onLeave(d);
                return (
                  <View key={d.toISOString()} className={cn('flex-1 items-center rounded-xl py-2', lv ? 'bg-blue-100' : off ? 'bg-slate-200' : 'bg-teal-50')}>
                    <Text className="text-[10px] font-bold text-slate-500">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</Text>
                    <Text className="text-sm font-extrabold text-slate-900">{d.getDate()}</Text>
                    <Text className={cn('text-[9px] font-bold', lv ? 'text-blue-800' : off ? 'text-slate-600' : 'text-teal-700')}>
                      {lv ? t('leave.onLeave') : off ? t('leave.off') : t('leave.working')}
                    </Text>
                  </View>
                );
              })}
            </View>
            {r.covered_by.map((c) => (
              <Text key={c.id} className="mt-3 text-xs text-slate-600">
                {L.glossary('COVER_AA', 'Cover AA').label}: <Text className="font-bold">{c.cover_aa_name}</Text> · {fmt(c.start_date)}–{fmt(c.end_date)}
              </Text>
            ))}
            {r.covering_for.map((c) => (
              <Text key={c.id} className="mt-2 text-xs text-slate-600">
                {t('leave.coveringFor', { name: c.covered_aa_name })} · {fmt(c.start_date)}–{fmt(c.end_date)}
              </Text>
            ))}
          </Card>
        ) : null}

        {formOpen ? (
          <Card>
            <View className="gap-3">
              <Text className="text-sm font-bold text-slate-900">{t('leave.request')}</Text>
              <FieldAnchor form={form} name="type">
              <Chips label={t('leave.type')} options={L.enumOptions('leave_type').length ? L.enumOptions('leave_type') : [{ value: 'LEAVE', label: 'Leave' }, { value: 'SICK', label: 'Sick' }, { value: 'EMERGENCY', label: 'Emergency' }]} value={type} allowDeselect={false} onChange={(v) => setType(v as string)} error={err.type ?? s.apiField('leave_type')} />
              </FieldAnchor>
              <FieldAnchor form={form} name="from">
              <DateTimeField testID="leave-from" mode="date" label={t('leave.from')} required value={from} onChange={setFrom} minimumDate={today} error={err.from ?? s.apiField('start_date')} />
              </FieldAnchor>
              <FieldAnchor form={form} name="to">
              <DateTimeField testID="leave-to" mode="date" label={t('leave.to')} required value={to ?? from} onChange={setTo} minimumDate={from ?? today} error={err.to ?? s.apiField('end_date')} />
              </FieldAnchor>
              <FieldAnchor form={form} name="reason">
                <TextField testID="leave-reason" label={t('leave.reason')} required placeholder={t('leave.reasonPlaceholder')} multiline value={reason} onChangeText={setReason} error={err.reason ?? s.apiField('reason')} />
              </FieldAnchor>
              <TextField testID="leave-notes" label={t('leave.notes')} hint={t('common.optional')} multiline value={notes} onChangeText={setNotes} error={s.apiField('notes')} />
              {s.banner(['leave_type', 'start_date', 'end_date', 'reason']) ? (
                <FieldAnchor form={form} name="banner">
                  <InlineBanner testID="leave-error">{s.error instanceof ApiError && s.error.code === 'leave_overlap' ? t('leave.overlap') : s.banner(['leave_type', 'start_date', 'end_date', 'reason'])!}</InlineBanner>
                </FieldAnchor>
              ) : null}
              <View className="flex-row gap-2">
                <Button variant="secondary" label={t('common.cancel')} onPress={() => setFormOpen(false)} />
                <Button testID="leave-submit" className="flex-1" label={t('leave.submit')} loading={s.busy} onPress={submit} />
              </View>
            </View>
          </Card>
        ) : (
          <Button testID="leave-open" icon={CalendarOff} label={t('leave.request')} onPress={() => setFormOpen(true)} />
        )}

        <View className="gap-2">
          <Text className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">{t('leave.history')}</Text>
          {leave.isPending ? (
            <ListSkeleton count={1} />
          ) : (leave.data?.results ?? []).length === 0 ? (
            <EmptyState icon={CalendarOff} title={t('leave.historyEmpty')} body={t('leave.historyBody')} />
          ) : (
            leave.data!.results.map((l) => (
              <Card key={l.id}>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-slate-900">
                    {fmt(l.start_date)}
                    {l.end_date !== l.start_date ? ` – ${fmt(l.end_date)}` : ''}
                  </Text>
                  <Badge label={L.enumLabel('leave_status', l.status)} tone={statusTone(l.status)} />
                </View>
                <Text className="mt-0.5 text-xs text-slate-600">
                  {L.enumLabel('leave_type', l.leave_type ?? 'LEAVE')}
                  {l.reason ? ` · ${l.reason}` : ''}
                </Text>
                {l.review_note ? <Text className="mt-1 text-xs italic text-slate-500">{l.review_note}</Text> : null}
                {l.cover_aa_name ? (
                  <Text className="mt-1 text-xs text-slate-600">
                    {L.glossary('COVER_AA', 'Cover AA').label}: <Text className="font-bold">{l.cover_aa_name}</Text>
                  </Text>
                ) : null}
                {l.can_cancel ? (
                  <View className="mt-2 flex-row justify-end">
                    <Button
                      testID={`leave-cancel-${l.id}`}
                      size="sm"
                      variant={confirmCancel === l.id ? 'danger' : 'ghost'}
                      label={confirmCancel === l.id ? t('leave.cancelConfirm') : t('leave.cancel')}
                      loading={cancelLeave.isPending && cancelLeave.variables === l.id}
                      onPress={() =>
                        confirmCancel === l.id
                          ? cancelLeave.mutate(l.id, { onSuccess: () => (setConfirmCancel(null), showToast(t('leave.cancelled'))) })
                          : setConfirmCancel(l.id)
                      }
                    />
                  </View>
                ) : null}
              </Card>
            ))
          )}
        </View>
      </FormScrollView>
    </View>
  );
}

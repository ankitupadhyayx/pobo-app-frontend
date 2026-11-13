import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheet, Button, Chips, DateTimeField, InlineBanner, TextField } from '@/components/ui';
import { useScheduleVisit, type VisitType } from '@/api/hooks/listings';
import { useLabels } from '@/api/hooks/config';
import { useSubmit } from '@/hooks/useSubmit';
import { useFormFocus } from '@/hooks/useFormFocus';
import { useActions } from '@/state/actions';
import { analytics } from '@/lib/analytics';
import { useT } from '@/i18n';
import { visitSuccess } from './visitSuccess';

/** Schedule a visit (FB-06 success sheet, FB-07 visit types allowed for the requirement). */
export function ScheduleVisitSheet({ rid, listing, visitTypes, onClose }: { rid: string; listing: { id: string; title: string; aaName?: string | null }; visitTypes: string[]; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const L = useLabels();
  // FB-07: only the types allowed for this requirement's intent; the first is the default.
  const [visitType, setVisitType] = useState<string | null>(visitTypes[0] ?? null);
  const sched = useScheduleVisit(rid);
  const showSuccess = useActions((s) => s.showSuccess);
  const [at, setAt] = useState<Date | null>(null);
  const [duration, setDuration] = useState('45');
  const [meeting, setMeeting] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string>();
  const form = useFormFocus({ toast: false });
  const s = useSubmit(async () => {
    const visit = await sched.mutateAsync({ listing_id: listing.id, visit_type: (visitType ?? undefined) as VisitType | undefined, scheduled_at: at!.toISOString(), duration_minutes: Number(duration) || 45, meeting_point: meeting.trim() || undefined, notes: notes.trim() || undefined });
    analytics.track('visit_scheduled', { count: 1 });
    showSuccess(visitSuccess(visit, t('visits.scheduledTitle'), t, router, (c) => L.enumLabel('visit_type', c)));
  }, onClose, form);
  return (
    <BottomSheet form={form} testID="schedule-visit-sheet" visible onClose={onClose} dismissable={!s.busy} title={t('visits.scheduleTitle')} subtitle={listing.title} footer={<Button testID="schedule-visit-save" className="flex-1" label={t('visits.schedule')} loading={s.busy} onPress={() => (at ? void s.run(undefined) : (setErr(t('errors.required')), form.fail({ at: 'x' })))} />}>
      {visitTypes.length > 1 ? (
        <Chips testIDPrefix="visit-type" label={t('visits.type')} required options={visitTypes.map((c) => ({ value: c, label: L.enumLabel('visit_type', c) }))} value={visitType} allowDeselect={false} onChange={(v) => setVisitType(v as string)} error={s.apiField('visit_type')} />
      ) : null}
      <DateTimeField testID="visit-at" label={t('visits.when')} required value={at} onChange={setAt} minimumDate={new Date()} error={err ?? s.apiField('scheduled_at')} />
      <TextField label={t('visits.duration')} keyboardType="number-pad" value={duration} onChangeText={(v) => setDuration(v.replace(/\D/g, ''))} error={s.apiField('duration_minutes')} />
      <TextField label={t('visits.meetingPoint')} placeholder="Main gate security office" value={meeting} onChangeText={setMeeting} />
      <TextField label={t('visits.notes')} multiline value={notes} onChangeText={setNotes} />
      {listing.aaName ? <Text className="text-[11px] text-slate-500">{t('visits.listingAa', { name: listing.aaName })}</Text> : null}
      {s.banner(['scheduled_at', 'duration_minutes', 'listing_id', 'visit_type']) ? <InlineBanner>{s.banner(['scheduled_at', 'duration_minutes', 'listing_id', 'visit_type'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}


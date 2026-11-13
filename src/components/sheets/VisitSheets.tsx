import { useState } from 'react';
import { BottomSheet, Button, CallbackPicker, Chips, DateTimeField, InlineBanner, Select, TextField, callbackError, emptyCallback, type CallbackValue, type Option, type ServiceHours } from '@/components/ui';
import { useSubmit } from '@/hooks/useSubmit';
import { useFormFocus } from '@/hooks/useFormFocus';
import { useT } from '@/i18n';
import type { MetaOption, SheetBaseProps } from './types';

export interface CompleteVisitValues {
  outcome: string;
  interest: string | null;
  priceReaction: string | null;
  liked: string;
  disliked: string;
  feedback: string;
  nextAction?: { type: string; dueAt: string; notes: string; afterHours?: { reason: string } };
}

interface CompleteProps extends SheetBaseProps<CompleteVisitValues> {
  subtitle: string;
  /** VISIT_OUTCOME master with metadata: requires_next_action, default_next_action, sets_status. */
  outcomes: MetaOption[];
  interestLevels: Option[];
  priceReactions: Option[];
  followUpTypes: Option[];
  serviceHours?: ServiceHours;
  /** R2-5: buyer questions (interest, price, liked/disliked) only for viewings. */
  buyerFeedback?: boolean;
  /** R2-6: media status of an inspection / photography visit (gates "…completed" outcomes). */
  media?: { photos_pending: number; videos_pending: number; min_photos: number } | null;
}

/** APP-30: completing a visit needs an outcome (VISIT_OUTCOME) plus feedback; some need a next action. */
export function CompleteVisitSheet(p: CompleteProps) {
  return p.visible ? <CompleteBody {...p} /> : null;
}

function CompleteBody(p: CompleteProps) {
  const t = useT();
  const [outcome, setOutcome] = useState<string | null>(null);
  const [interest, setInterest] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [liked, setLiked] = useState('');
  const [disliked, setDisliked] = useState('');
  const [feedback, setFeedback] = useState('');
  const [nextType, setNextType] = useState<string | null>(p.followUpTypes[0]?.value ?? null);
  const [next, setNext] = useState<CallbackValue>(emptyCallback);
  const nextAt = next.at;
  const [nextNotes, setNextNotes] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const form = useFormFocus({ toast: false });
  const s = useSubmit(p.onSubmit, p.onClose, form);
  const meta = (p.outcomes.find((o) => o.value === outcome)?.meta ?? {}) as { requires_next_action?: boolean; default_next_action?: string; media_check?: string | null };
  const buyer = p.buyerFeedback !== false;
  const mediaBlock =
    meta.media_check === 'photos' && (p.media?.photos_pending ?? 0) > 0
      ? t('visits.needPhotos', { count: p.media!.photos_pending })
      : meta.media_check === 'video' && (p.media?.videos_pending ?? 0) > 0
        ? t('visits.needVideo')
        : null;
  // NEGOTIATE has a server default (+1 day) so the next action is optional there.
  const nextRequired = !!meta.requires_next_action && !meta.default_next_action;
  const showNext = !!meta.requires_next_action;
  const submit = () => {
    const e: Record<string, string> = {};
    if (!outcome) e.outcome = t('errors.required');
    else if (mediaBlock) e.outcome = mediaBlock;
    if (!feedback.trim()) e.feedback = t('visits.feedbackRequired');
    if (showNext) {
      const ne = callbackError(next, nextRequired, p.serviceHours);
      if (ne) e.next = ne === 'errors.required' ? t('call.nextActionRequired') : t(ne);
    }
    setErr(e);
    if (Object.keys(e).length) return void form.fail(e);
    form.clear();
    void s.run({
      outcome: outcome!,
      interest: buyer ? interest : null,
      priceReaction: buyer ? price : null,
      liked: buyer ? liked.trim() : '',
      disliked: buyer ? disliked.trim() : '',
      feedback: feedback.trim(),
      nextAction: showNext && nextAt && nextType ? { type: nextType, dueAt: nextAt.toISOString(), notes: nextNotes.trim(), afterHours: next.afterHours ? { reason: next.reason.trim() } : undefined } : undefined,
    });
  };
  const shown = ['outcome', 'feedback', 'feedback.notes', 'next_action', 'next_action.due_at'];
  return (
    <BottomSheet
      form={form}
      testID="complete-visit-sheet"
      visible
      onClose={p.onClose}
      dismissable={!s.busy}
      title={t('visits.completeTitle')}
      subtitle={p.subtitle}
      footer={<Button testID="complete-visit-save" className="flex-1" label={t('visits.completeSave')} loading={s.busy} onPress={submit} />}
    >
      <Chips testIDPrefix="visit-outcome" label={t('visits.outcome')} required options={p.outcomes} value={outcome} onChange={(v) => setOutcome(v as string | null)} error={err.outcome ?? s.apiField('outcome')} />
      {meta.default_next_action ? <InlineBanner tone="info">{t('visits.negotiateHint')}</InlineBanner> : null}
      {mediaBlock && !err.outcome ? <InlineBanner testID="visit-media-pending">{mediaBlock}</InlineBanner> : null}
      {buyer ? (
        <>
          <Chips label={t('visits.interest')} options={p.interestLevels} value={interest} onChange={(v) => setInterest(v as string | null)} />
          <Chips label={t('visits.priceReaction')} options={p.priceReactions} value={price} onChange={(v) => setPrice(v as string | null)} />
          <TextField label={t('visits.liked')} value={liked} onChangeText={setLiked} />
          <TextField label={t('visits.disliked')} value={disliked} onChangeText={setDisliked} />
        </>
      ) : null}
      <TextField testID="visit-feedback" label={t('visits.feedback')} required multiline value={feedback} onChangeText={setFeedback} error={err.feedback ?? s.apiField('feedback', 'feedback.notes')} />
      {showNext ? (
        <>
          <Chips label={t('call.nextType')} options={p.followUpTypes} value={nextType} allowDeselect={false} onChange={(v) => setNextType(v as string)} />
          <CallbackPicker testID="visit-next-at" label={t('call.nextAt')} required={nextRequired} value={next} onChange={setNext} hours={p.serviceHours} error={err.next ?? s.apiField('next_action', 'next_action.due_at')} />
          <TextField label={t('followUp.notes')} value={nextNotes} onChangeText={setNextNotes} />
        </>
      ) : null}
      {s.banner(shown) ? <InlineBanner>{s.banner(shown)!}</InlineBanner> : null}
    </BottomSheet>
  );
}

export interface CancelVisitValues {
  reason: string;
  note: string;
  rescheduleAt?: string;
}

/** APP-30: cancelling needs a reason; rescheduling is offered from the lead. */
export function CancelVisitSheet(p: SheetBaseProps<CancelVisitValues> & { subtitle: string; reasons: Option[] }) {
  return p.visible ? <CancelBody {...p} /> : null;
}

function CancelBody(p: SheetBaseProps<CancelVisitValues> & { subtitle: string; reasons: Option[] }) {
  const t = useT();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [resched, setResched] = useState<Date | null>(null);
  const [err, setErr] = useState<string>();
  const form = useFormFocus({ toast: false });
  const s = useSubmit(p.onSubmit, p.onClose, form);
  return (
    <BottomSheet
      form={form}
      testID="cancel-visit-sheet"
      visible
      onClose={p.onClose}
      dismissable={!s.busy}
      title={t('visits.cancelTitle')}
      subtitle={p.subtitle}
      footer={
        <Button
          testID="cancel-visit-save"
          className="flex-1"
          variant="danger"
          label={t('visits.cancelSave')}
          loading={s.busy}
          onPress={() => (reason ? void s.run({ reason, note: note.trim(), rescheduleAt: resched?.toISOString() }) : (setErr(t('errors.required')), form.fail({ reason: 'x' })))}
        />
      }
    >
      {p.reasons.length ? (
        <Select testID="cancel-reason" label={t('visits.cancelReason')} required options={p.reasons} value={reason} onChange={setReason} error={err ?? s.apiField('reason', 'cancel_reason')} />
      ) : (
        <TextField label={t('visits.cancelReason')} required value={reason ?? ''} onChangeText={setReason} error={err ?? s.apiField('reason', 'cancel_reason')} />
      )}
      <TextField label={t('visits.cancelNote')} multiline value={note} onChangeText={setNote} />
      <DateTimeField label={t('visits.rescheduleTo')} value={resched} onChange={setResched} minimumDate={new Date()} />
      {s.banner(['reason', 'cancel_reason', 'note']) ? <InlineBanner>{s.banner(['reason', 'cancel_reason', 'note'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}

export interface NoShowValues {
  whoAbsent: string;
  reason: string | null;
  note: string;
  nextStep: 'RESCHEDULE' | 'FOLLOW_UP' | 'CANCEL';
  rescheduleAt?: string;
  followUp?: { type: string; dueAt: string; notes: string; afterHours?: { reason: string } };
}

interface NoShowProps extends SheetBaseProps<NoShowValues> {
  subtitle: string;
  who: Option[];
  reasons: Option[];
  nextSteps: Option[];
  followUpTypes: Option[];
  serviceHours?: ServiceHours;
}

/** R3-7 no-show: who didn't come, why (optional), and the next step (reschedule / follow up / cancel). */
export function NoShowSheet(p: NoShowProps) {
  return p.visible ? <NoShowBody {...p} /> : null;
}

function NoShowBody(p: NoShowProps) {
  const t = useT();
  const [who, setWho] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [step, setStep] = useState<string | null>(null);
  const [at, setAt] = useState<Date | null>(null);
  const [fuType, setFuType] = useState<string | null>(p.followUpTypes[0]?.value ?? null);
  const [fu, setFu] = useState<CallbackValue>(emptyCallback);
  const [err, setErr] = useState<Record<string, string>>({});
  const form = useFormFocus({ toast: false });
  const s = useSubmit(p.onSubmit, p.onClose, form);

  const save = () => {
    const e: Record<string, string> = {};
    if (!who) e.who_absent = t('visits.noShowWhoRequired');
    if (!step) e.next_step = t('visits.noShowStepRequired');
    if (step === 'RESCHEDULE' && !at) e.reschedule_at = t('errors.required');
    if (step === 'FOLLOW_UP') {
      if (!fuType) e.follow_up_type = t('errors.required');
      const ne = callbackError(fu, true, p.serviceHours);
      if (ne) e['follow_up.due_at'] = t(ne);
    }
    setErr(e);
    if (Object.keys(e).length) {
      form.fail(e);
      return;
    }
    void s.run({
      whoAbsent: who!,
      reason,
      note: note.trim(),
      nextStep: step as NoShowValues['nextStep'],
      rescheduleAt: step === 'RESCHEDULE' ? at!.toISOString() : undefined,
      followUp: step === 'FOLLOW_UP' && fu.at ? { type: fuType!, dueAt: fu.at.toISOString(), notes: note.trim(), afterHours: fu.afterHours ? { reason: fu.reason.trim() } : undefined } : undefined,
    });
  };

  const fieldKeys = ['who_absent', 'reason', 'next_step', 'reschedule_at', 'follow_up.due_at', 'follow_up'];
  return (
    <BottomSheet
      form={form}
      testID="no-show-sheet"
      visible
      onClose={p.onClose}
      dismissable={!s.busy}
      title={t('visits.noShowTitle')}
      subtitle={p.subtitle}
      footer={<Button testID="no-show-save" className="flex-1" label={t('visits.noShowSave')} loading={s.busy} onPress={save} />}
    >
      <Chips testIDPrefix="no-show-who" label={t('visits.noShowWho')} required options={p.who} value={who} onChange={(v) => setWho(v as string | null)} error={err.who_absent ?? s.apiField('who_absent')} />
      {p.reasons.length ? (
        <Chips testIDPrefix="no-show-reason" label={t('visits.noShowReason')} options={p.reasons} value={reason} onChange={(v) => setReason(v as string | null)} error={s.apiField('reason')} />
      ) : null}
      <TextField testID="no-show-note" label={t('visits.noShowNote')} multiline value={note} onChangeText={setNote} />
      <Chips testIDPrefix="no-show-step" label={t('visits.noShowStep')} required options={p.nextSteps} value={step} onChange={(v) => setStep(v as string | null)} error={err.next_step ?? s.apiField('next_step')} />
      {step === 'RESCHEDULE' ? (
        <DateTimeField testID="no-show-at" label={t('visits.rescheduleTo')} required value={at} onChange={setAt} minimumDate={new Date()} error={err.reschedule_at ?? s.apiField('reschedule_at')} />
      ) : null}
      {step === 'FOLLOW_UP' ? (
        <>
          <Chips testIDPrefix="no-show-fu-type" label={t('call.nextType')} options={p.followUpTypes} value={fuType} allowDeselect={false} onChange={(v) => setFuType(v as string | null)} error={err.follow_up_type} />
          <CallbackPicker testID="no-show-fu-at" label={t('call.nextAt')} required value={fu} onChange={setFu} hours={p.serviceHours} error={err['follow_up.due_at'] ?? s.apiField('follow_up.due_at', 'follow_up')} />
        </>
      ) : null}
      {s.banner(fieldKeys) ? <InlineBanner>{s.banner(fieldKeys)!}</InlineBanner> : null}
    </BottomSheet>
  );
}

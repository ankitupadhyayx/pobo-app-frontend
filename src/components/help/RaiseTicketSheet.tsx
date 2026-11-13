import { useRef, useState } from 'react';
import { BottomSheet, Button, Chips, InlineBanner, TextField, type BadgeTone } from '@/components/ui';
import { TICKET_CATEGORIES, useCreateTicket, type SupportTicketDetail, type TicketCategory, type TicketStatus } from '@/api/hooks/phase3';
import { useActions } from '@/state/actions';
import { useSubmit } from '@/hooks/useSubmit';
import { useLabels } from '@/api/hooks/config';
import { useT } from '@/i18n';

export const TICKET_TONE: Record<TicketStatus, BadgeTone> = { OPEN: 'amber', IN_PROGRESS: 'blue', RESOLVED: 'emerald', CLOSED: 'slate' };

export interface TicketLink {
  relationship_id?: string;
  requirement_id?: string;
  listing_id?: string;
}

const newId = () => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/** APP-33: raise a support ticket (category, message, optional link to a lead or listing). Online only. */
export function RaiseTicketSheet({ initialCategory, link, onClose, onCreated }: { initialCategory?: TicketCategory; link?: TicketLink; onClose: () => void; onCreated?: (t: SupportTicketDetail) => void }) {
  const t = useT();
  const L = useLabels();
  const create = useCreateTicket();
  const showToast = useActions((s) => s.showToast);
  const [category, setCategory] = useState<TicketCategory | null>(initialCategory ?? null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errs, setErrs] = useState<{ category?: string; message?: string }>({});
  const clientId = useRef(newId()).current; // same id on retry → no duplicate ticket
  const s = useSubmit(async () => {
    const ticket = await create.mutateAsync({
      category: category!,
      subject: subject.trim(),
      message: message.trim(),
      relationship_id: link?.relationship_id ?? null,
      requirement_id: link?.requirement_id ?? null,
      listing_id: link?.listing_id ?? null,
      client_id: clientId,
    });
    showToast(t('help.ticketSent', { ref: ticket.reference }));
    onCreated?.(ticket);
  }, onClose);
  const submit = () => {
    const e = { category: category ? undefined : t('errors.required'), message: message.trim() ? undefined : t('errors.required') };
    setErrs(e);
    if (!e.category && !e.message) void s.run(undefined);
  };
  return (
    <BottomSheet
      visible
      onClose={onClose}
      dismissable={!s.busy}
      title={t('help.raise')}
      subtitle={t('help.raiseHint')}
      footer={<Button testID="ticket-submit" className="flex-1" label={t('help.send')} loading={s.busy} onPress={submit} />}
    >
      <Chips
        label={t('help.category')}
        required
        testIDPrefix="ticket-cat"
        options={TICKET_CATEGORIES.map((c) => ({ value: c, label: L.enumLabel('ticket_category', c) }))}
        value={category}
        onChange={(v) => setCategory(v as TicketCategory | null)}
        error={errs.category ?? s.apiField('category')}
      />
      <TextField label={t('help.subject')} value={subject} onChangeText={setSubject} maxLength={200} error={s.apiField('subject')} />
      <TextField testID="ticket-message" label={t('help.message')} required multiline value={message} onChangeText={setMessage} maxLength={4000} error={errs.message ?? s.apiField('message')} />
      {link?.requirement_id || link?.listing_id || link?.relationship_id ? <InlineBanner tone="info">{t('help.linked')}</InlineBanner> : null}
      {s.banner(['category', 'subject', 'message']) ? <InlineBanner>{s.banner(['category', 'subject', 'message'])!}</InlineBanner> : null}
    </BottomSheet>
  );
}

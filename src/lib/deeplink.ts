/**
 * Maps notification payloads (in-app list and push `data`) to app routes.
 * Payload keys come from the API: relationship_id / requirement_id / float_id / transfer_request_id.
 */
export function notificationHref(kind: string | undefined, data: unknown): string | null {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  if (typeof d.link === 'string' && d.link.startsWith('/')) return d.link;
  const rel = typeof d.relationship_id === 'string' ? d.relationship_id : null;
  const req = typeof d.requirement_id === 'string' ? d.requirement_id : null;
  // Floats can be claimed by someone else or expire before the AA taps; the floats list says so.
  if (kind === 'FLOAT_OFFER' || typeof d.float_id === 'string') {
    return typeof d.float_id === 'string' ? `/more/floats?float=${d.float_id}` : '/more/floats';
  }
  if (kind === 'LEAVE_UPDATE') return '/more/leave';
  // Revision 1: reminders from Ops open their exact record; key tasks open the key list.
  // R2-18: the API nests ids under `data.target` ({label, screen, target:{…}}); older payloads were flat.
  if (kind === 'OPS_REMINDER') {
    const target = (d.target && typeof d.target === 'object' ? d.target : d) as Parameters<typeof reminderHref>[1];
    return reminderHref(typeof d.screen === 'string' ? d.screen : null, target) ?? '/more/reminders';
  }
  const id = (k: string) => (typeof d[k] === 'string' && d[k] ? (d[k] as string) : null);
  const lead = rel ? (req ? `/lead/${rel}?requirement=${req}` : `/lead/${rel}`) : null;
  // REQ-11: a key collected / returned opens that key; open key work (collect, return, owner wants it back) opens key tasks.
  if (kind === 'KEY_TASK') {
    if ((d.action === 'KEY_COLLECTED' || d.action === 'KEY_RETURNED') && id('key_id')) return `/more/keys?key=${id('key_id')}`;
    return '/more/field-tasks?kind=keys';
  }
  // REQ-11: visit scheduled / rescheduled / cancelled opens that visit.
  if (kind === 'VISIT_UPDATE') {
    if (id('visit_id')) return `/visits?visit=${id('visit_id')}`;
    return lead ?? (id('listing_id') ? `/listing/${id('listing_id')}` : '/visits');
  }
  // REQ-11: a customer's reply opens the visit for visit answers, else the requirement it is about.
  if (kind === 'CUSTOMER_RESPONSE') {
    const visitReply = typeof d.response === 'string' && d.response.startsWith('VISIT_');
    if (visitReply && id('visit_id')) return `/visits?visit=${id('visit_id')}`;
    if (lead) return lead;
    if (id('visit_id')) return `/visits?visit=${id('visit_id')}`;
    return id('listing_id') ? `/listing/${id('listing_id')}` : '/leads';
  }
  if (lead) return lead;
  // R2-18: no dead taps. Anything else with a record id opens that record.
  if (kind === 'SUPPORT_TICKET' || id('ticket_id')) return id('ticket_id') ? `/more/ticket/${id('ticket_id')}` : '/more/learn';
  if (kind === 'EARNINGS_UPDATE') return '/earnings';
  if (id('visit_id')) return `/visits?visit=${id('visit_id')}`;
  if (id('listing_id')) return `/listing/${id('listing_id')}`;
  if (id('unit_id')) return `/field/unit/${id('unit_id')}`;
  if (id('field_task_id')) return '/more/field-tasks';
  return null;
}

/** FB-23: where a reminder from Ops (or a Home "From Ops" item) opens. Returns null when unknown. */
export function reminderHref(
  screen: string | null | undefined,
  t: { relationship_id?: string | null; requirement_id?: string | null; visit_id?: string | null; listing_id?: string | null; unit_id?: string | null; key_id?: string | null; field_task_id?: string | null; field_flag_id?: string | null; ticket_id?: string | null },
): string | null {
  const lead = t.relationship_id ? (t.requirement_id ? `/lead/${t.relationship_id}?requirement=${t.requirement_id}` : `/lead/${t.relationship_id}`) : null;
  switch (screen) {
    case 'requirement':
      return lead;
    case 'visit':
      return t.visit_id ? `/visits?visit=${t.visit_id}` : '/visits';
    case 'listing':
      return t.listing_id ? `/listing/${t.listing_id}` : null;
    case 'key':
      return '/more/keys';
    case 'field_task':
      return '/more/field-tasks';
    case 'field_flag':
      return t.listing_id ? `/listing/${t.listing_id}` : t.unit_id ? `/field/unit/${t.unit_id}` : null;
    case 'ticket':
      return t.ticket_id ? `/more/ticket/${t.ticket_id}` : '/more/learn';
    case 'unit':
      return t.unit_id ? `/field/unit/${t.unit_id}` : null;
    default:
      return lead ?? (t.listing_id ? `/listing/${t.listing_id}` : t.unit_id ? `/field/unit/${t.unit_id}` : null);
  }
}

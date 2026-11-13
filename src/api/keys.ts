/** Central TanStack Query keys so mutations can invalidate precisely. */
export const qk = {
  me: ['me'] as const,
  config: ['config'] as const,
  home: ['home'] as const,
  relationships: (filters?: object) => (filters ? (['relationships', filters] as const) : (['relationships'] as const)),
  relationship: (id: string) => ['relationship', id] as const,
  timeline: (id: string) => ['relationship', id, 'timeline'] as const,
  communications: (requirementId: string) => ['requirement', requirementId, 'communications'] as const,
  followUps: (filters?: object) => (filters ? (['followUps', filters] as const) : (['followUps'] as const)),
  floats: ['floats'] as const,
  notifications: ['notifications'] as const,
  leave: ['leave'] as const,
  roster: ['roster'] as const,
  templates: ['templates'] as const,
  transfers: ['transfers'] as const,
  societies: (q: string) => ['societies', q] as const,
  lookup: (phone: string) => ['lookup', phone] as const,
};

/** DRF cursor pagination returns `next` as a full URL; pull out the cursor value. */
export function cursorFrom(next: string | null | undefined): string | undefined {
  if (!next) return undefined;
  const m = /[?&]cursor=([^&]+)/.exec(next);
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Indian mobile (10 digits) → E.164 as the API stores it. */
export function toE164(phone10: string): string {
  const d = phone10.replace(/\D/g, '');
  return d.length === 10 ? `+91${d}` : d.startsWith('91') && d.length === 12 ? `+${d}` : phone10;
}

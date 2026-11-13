/**
 * PII-safe product analytics (APP-37). Event names ported from the prototype's src/utils/analytics.ts.
 * Rule: NEVER send customer names, phones, emails, addresses or free-text notes.
 * Enforcement is an allow-list of property keys + value checks, not just a deny-list.
 * Transport is a pluggable sink (console in dev) until a provider is chosen.
 */
export type AnalyticsEvent =
  | 'login_started'
  | 'login_completed'
  | 'onboarding_completed'
  | 'conduct_acknowledged'
  | 'duty_status_changed'
  | 'leave_requested'
  | 'lead_opened'
  | 'lead_created'
  | 'requirement_added'
  | 'requirement_transfer_requested'
  | 'relationship_transfer_requested'
  | 'call_started'
  | 'call_completed'
  | 'callback_created'
  | 'callback_completed'
  | 'referral_submitted'
  | 'escalation_raised'
  | 'visit_scheduled'
  | 'visit_completed'
  | 'visit_no_show'
  | 'territory_float_viewed'
  | 'territory_float_claimed'
  | 'territory_float_lost'
  | 'notification_opened'
  | 'template_message_sent'
  // Phase 2 (prototype names)
  | 'society_mapping_started'
  | 'tower_added'
  | 'floor_added'
  | 'unit_added'
  | 'flat_mapping_saved'
  | 'property_added'
  | 'property_submitted'
  | 'property_withdrawn'
  | 'opportunity_converted'
  | 'key_recorded'
  | 'shortlist_updated'
  | 'sync_conflict_resolved';

export type AnalyticsProps = Record<string, string | number | boolean | undefined>;

/** Only these keys may leave the device. Values must be ids, enums, counts or booleans. */
const ALLOWED_KEYS = new Set([
  'requirement_id',
  'customer_id',
  'float_id',
  'notification_id',
  'followup_id',
  'transfer_id',
  'requirement_type',
  'requirement_types',
  'requirement_count',
  'status',
  'outcome',
  'channel',
  'template_code',
  'kind',
  'source',
  'screen',
  'duty_status',
  'reason_code',
  'leave_type',
  'is_dnc',
  'has_secondary_contact',
  'result',
  'duration_s',
  'count',
  'step',
]);

const PHONE_LIKE = /\+?\d[\d\s-]{7,}\d/;
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export function scrub(props: Record<string, unknown> = {}): AnalyticsProps {
  const out: AnalyticsProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else if (typeof value === 'string') {
      // Ids/enums are short tokens; anything long, phone-like or email-like is dropped.
      if (value.length > 64 || PHONE_LIKE.test(value) || EMAIL_LIKE.test(value) || /\s{1}\S+\s/.test(value)) continue;
      out[key] = value;
    }
  }
  return out;
}

type Sink = (event: AnalyticsEvent, props: AnalyticsProps) => void;

let sink: Sink = (event, props) => {
  if (__DEV__) console.log('[analytics]', event, props);
};

export function setAnalyticsSink(next: Sink) {
  sink = next;
}

export const analytics = {
  track(event: AnalyticsEvent, props?: Record<string, unknown>) {
    try {
      sink(event, scrub(props));
    } catch {
      // analytics must never break a user flow
    }
  },
};

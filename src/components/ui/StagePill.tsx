import { Badge, type BadgeTone } from './Badge';

/**
 * Colours are presentation only; the text label always comes from /config/app labels
 * (passed in by the caller), so renaming a stage never needs an app release.
 */
const STAGE_TONES: Record<string, BadgeTone> = {
  NEW: 'teal',
  CONTACT_ATTEMPTED: 'blue',
  CONNECTED: 'blue',
  QUALIFIED: 'emerald',
  VISIT_SCHEDULED: 'indigo',
  NEGOTIATION: 'purple',
  ON_HOLD: 'amber',
  FOLLOW_UP_DUE: 'amber',
  CLOSED_WON: 'emerald',
  CLOSED_LOST: 'slate',
  DNC: 'rose',
  DO_NOT_CONTACT: 'rose',
};

const INTENT_TONES: Record<string, BadgeTone> = {
  BUY: 'blue',
  SELL: 'emerald',
  RENT: 'amber',
  RENT_OUT: 'purple',
  GENERAL: 'slate',
};

export function StagePill({ status, label }: { status: string; label: string }) {
  return <Badge label={label} tone={STAGE_TONES[status] ?? 'slate'} />;
}

export function IntentTag({ type, label }: { type: string; label: string }) {
  return <Badge label={label} tone={INTENT_TONES[type] ?? 'slate'} shape="tag" />;
}

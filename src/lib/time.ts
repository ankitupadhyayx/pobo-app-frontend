/** Formatting helpers. All server timestamps are ISO-8601; display is Asia/Kolkata device-local. */

export function msUntil(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t - now;
}

/** "14m 05s", "2h 10m", "3d 4h". Negative input is formatted as its absolute value. */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const s = Math.floor(abs / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const toDate = (v: Date | string) => (typeof v === 'string' ? new Date(v) : v);

/**
 * FB-10: 12-hour clock everywhere AA-facing, e.g. "4:30 PM", "12:05 AM". Built by hand so it never
 * depends on the device's Intl/24-hour setting (Hermes on some Android phones ignores hour12).
 */
export function formatTime(v: Date | string | null | undefined): string {
  if (!v) return '';
  const d = toDate(v);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "12 Oct", or "12 Oct 2025" with `withYear`. */
export function formatDay(v: Date | string | null | undefined, withYear = false): string {
  if (!v) return '';
  const d = toDate(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
}

const dayFmt = (d: Date) => formatDay(d);
const timeFmt = (d: Date) => formatTime(d);

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

/** "Today 4:30 PM", "Tomorrow 10:00 AM", "Yesterday 6:00 PM", "12 Oct 3:15 PM" */
export function formatWhen(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffDays = Math.round((startOfDay(d) - startOfDay(new Date(now))) / 86400000);
  const label = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : diffDays === -1 ? 'Yesterday' : dayFmt(d);
  return `${label} ${timeFmt(d)}`;
}

/** "just now", "5m ago", "3h ago", "2d ago" */
export function formatAgo(iso: string | null | undefined, now = Date.now()): string {
  const ms = msUntil(iso, now);
  if (ms === null) return '';
  const past = -ms;
  if (past < 60000) return 'just now';
  if (past < 3600000) return `${Math.floor(past / 60000)}m ago`;
  if (past < 86400000) return `${Math.floor(past / 3600000)}h ago`;
  return `${Math.floor(past / 86400000)}d ago`;
}

/** Moved to `@/lib/money` (R3-1); re-exported so existing imports keep working. */
export { formatINR } from './money';

export function greeting(now = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = now.getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

import type { Metric } from '@/api/hooks/phase3';

/** `YYYY-MM-DD` ± days, in plain calendar arithmetic (no time zone drift). */
export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function formatMetric(m: Pick<Metric, 'unit'>, v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (m.unit === 'percent') return `${v}%`;
  if (m.unit === 'seconds') {
    const mins = Math.round(v / 60);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  }
  return String(v);
}

/** Device-local calendar date as `YYYY-MM-DD`. */
export function localToday(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

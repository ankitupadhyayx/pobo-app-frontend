import type { Visit } from '@/api/hooks/listings';
import type { SuccessMessage } from '@/state/actions';
import { placeTitle } from '@/lib/property';
import { formatDay, formatINR, formatTime } from '@/lib/time';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

export function visitPropertyLine(v: Pick<Visit, 'listing' | 'requirement_title'>) {
  const l = v.listing;
  if (!l) return v.requirement_title;
  return `${placeTitle(l)}${l.expected_price ? ` · ${formatINR(l.expected_price)}` : l.expected_rent ? ` · ${formatINR(l.expected_rent)}/mo` : ''}`;
}

const isToday = (iso: string, now = new Date()) => {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

/**
 * FB-06: the "Visit Scheduled / Rescheduled" success sheet — date, 12-hour time, property and
 * customer, with View visit (opens My Visits on the right day bucket) and Done.
 */
export function visitSuccess(v: Visit, title: string, t: TFn, router: { navigate: (href: { pathname: '/visits'; params: { bucket: string; visit: string } }) => void }, typeLabel?: (code: string) => string): SuccessMessage {
  return {
    title,
    lines: [
      ...(v.visit_type && typeLabel ? [{ label: t('visits.type'), value: typeLabel(v.visit_type) }] : []),
      { label: t('visits.date'), value: formatDay(v.scheduled_at, true) },
      { label: t('visits.time'), value: formatTime(v.scheduled_at) },
      { label: t('visits.property'), value: visitPropertyLine(v) },
      { label: t('visits.customer'), value: v.customer_name },
    ],
    actions: [
      {
        label: t('visits.viewVisit'),
        testID: 'success-view-visit',
        onPress: () => router.navigate({ pathname: '/visits', params: { bucket: isToday(v.scheduled_at) ? 'today' : 'upcoming', visit: v.id } }),
      },
    ],
  };
}

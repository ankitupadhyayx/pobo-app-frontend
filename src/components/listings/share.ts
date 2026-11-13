import type { Match } from '@/api/hooks/listings';
import { formatINR } from '@/lib/time';

type Brief = Match['listing'];

/**
 * FB-04: the plain-text summary the AA shares with the customer through the phone's share sheet.
 * Title, configuration, price/rent and society only: no unit number or owner details.
 */
export function shareSummary(items: Brief[], configLabel: (code: string) => string, intro: string): string {
  const lines = items.map((l, i) => {
    const money = l.expected_price ? formatINR(l.expected_price) : l.expected_rent ? `${formatINR(l.expected_rent)}/month` : '';
    const head = l.title || `${l.configuration ? configLabel(l.configuration) : ''} in ${l.society_name ?? l.locality_name ?? ''}`.trim();
    const parts = [l.configuration ? configLabel(l.configuration) : '', money, [l.society_name, l.locality_name].filter(Boolean).join(', ')].filter(Boolean);
    return `${items.length > 1 ? `${i + 1}. ` : ''}${head}\n${parts.join(' · ')}`;
  });
  return [intro, ...lines].join('\n\n');
}

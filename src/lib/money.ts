/**
 * R3-1 money formatting (pure, no React; Node-safe for the integration scripts).
 * - `groupIndian("50000000")` → "5,00,00,000" (Indian commas: last 3 digits, then pairs).
 * - `formatRupees(50000000)` → "₹5,00,00,000" (exact amount).
 * - `formatINR(12500000)` → "₹1.25 Crore", 5000000 → "₹50 Lakh", 45000 → "₹45,000" (worded,
 *   used everywhere an amount is shown and as the hint under a money input).
 * Unit words follow the app language (set from i18n/setLanguage).
 */
type Lang = 'en' | 'hi';
const UNITS: Record<Lang, { crore: string; lakh: string }> = {
  en: { crore: 'Crore', lakh: 'Lakh' },
  hi: { crore: 'करोड़', lakh: 'लाख' },
};
let lang: Lang = 'en';

export function setMoneyLanguage(l: string | null | undefined) {
  lang = l === 'hi' ? 'hi' : 'en';
}

/** Digits only (a pasted "₹5,00,000" → "500000"); leading zeros dropped. */
export function moneyDigits(v: string): string {
  return v.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

export function groupIndian(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length <= 3) return d;
  const last3 = d.slice(-3);
  const rest = d.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

const toNumber = (n: number | string | null | undefined): number | null => {
  if (n === null || n === undefined || n === '') return null;
  const v = typeof n === 'string' ? Number(n.replace(/,/g, '')) : n;
  return Number.isFinite(v) ? v : null;
};

/** Up to 2 decimals, trailing zeros trimmed: 1.20 → "1.2", 5.00 → "5". */
const short = (v: number) => String(Math.round(v * 100) / 100);

export function formatRupees(n: number | string | null | undefined): string {
  const v = toNumber(n);
  if (v === null) return n === null || n === undefined ? '' : String(n);
  const neg = v < 0 ? '-' : '';
  const [int, frac] = Math.abs(v).toFixed(Number.isInteger(v) ? 0 : 2).split('.');
  return `${neg}₹${groupIndian(int)}${frac && frac !== '00' ? `.${frac}` : ''}`;
}

export function formatINR(n: number | string | null | undefined): string {
  const v = toNumber(n);
  if (v === null) return n === null || n === undefined ? '' : String(n);
  const a = Math.abs(v);
  const neg = v < 0 ? '-' : '';
  if (a >= 1e7) return `${neg}₹${short(a / 1e7)} ${UNITS[lang].crore}`;
  if (a >= 1e5) return `${neg}₹${short(a / 1e5)} ${UNITS[lang].lakh}`;
  return formatRupees(v);
}

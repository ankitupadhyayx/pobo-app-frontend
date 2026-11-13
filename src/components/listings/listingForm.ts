import type { Listing } from '@/api/hooks/listings';

export interface ListingDraft {
  title: string;
  configuration: string | null;
  expected_price: string;
  expected_rent: string;
  security_deposit: string;
  super_area_sqft: string;
  carpet_area_sqft: string;
  furnishing: string | null;
  parking: string | null;
  facing: string | null;
  availability: string | null;
  available_from: string | null;
  description: string;
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const n = (x: string) => (x.trim() === '' || Number.isNaN(Number(x)) ? null : Number(x));

export function draftFromListing(l: Listing): ListingDraft {
  return {
    title: l.title ?? '',
    configuration: l.configuration || null,
    expected_price: s(l.expected_price),
    expected_rent: s(l.expected_rent),
    security_deposit: s(l.security_deposit),
    super_area_sqft: s(l.super_area_sqft),
    carpet_area_sqft: s(l.carpet_area_sqft),
    furnishing: l.furnishing || null,
    parking: l.parking || null,
    facing: l.facing || null,
    availability: l.availability || null,
    available_from: l.available_from ?? null,
    description: l.description ?? '',
  };
}

/** PATCH body for `listing_draft.update` (same body as PATCH /listings/{id}). */
export function listingPayload(d: ListingDraft, type: 'SELL' | 'RENT_OUT') {
  return {
    title: d.title.trim(),
    configuration: d.configuration ?? '',
    expected_price: type === 'SELL' ? n(d.expected_price) : null,
    expected_rent: type === 'RENT_OUT' ? n(d.expected_rent) : null,
    security_deposit: type === 'RENT_OUT' ? n(d.security_deposit) : null,
    super_area_sqft: n(d.super_area_sqft),
    carpet_area_sqft: n(d.carpet_area_sqft),
    furnishing: d.furnishing ?? '',
    parking: d.parking ?? '',
    facing: d.facing ?? '',
    availability: d.availability ?? '',
    available_from: d.available_from,
    description: d.description.trim(),
  };
}

/** What a supervisor needs before verifying; checked before submit so the AA fixes it inline. */
export function submitBlockers(d: ListingDraft, type: 'SELL' | 'RENT_OUT', photos: number, t: (k: string) => string): string[] {
  const out: string[] = [];
  if (!d.configuration) out.push(t('listings.needConfig'));
  if (type === 'SELL' ? !n(d.expected_price) : !n(d.expected_rent)) out.push(type === 'SELL' ? t('listings.needPrice') : t('listings.needRent'));
  if (photos < 1) out.push(t('listings.needPhoto'));
  return out;
}

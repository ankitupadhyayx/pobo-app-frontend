import type { UnitDetail } from '@/api/hooks/field';
import { emptyDetails, emptySurvey, type DetailsDraft, type SurveyDraft } from './forms';
import type { SlotKey } from './ContactSlotEditor';

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const local10 = (p?: string) => (p ? p.replace(/^\+91/, '').replace(/\D/g, '').slice(-10) : '');

/** Start the next survey version from what's known: last survey + current contact slots. */
export function surveyFromUnit(u: UnitDetail): SurveyDraft {
  const d = emptySurvey();
  const ls = u.latest_survey;
  if (ls) {
    d.occupancy = ls.occupancy;
    d.doorstep_outcome = ls.doorstep_outcome || null;
    d.data_source = ls.data_source || null;
    d.verification = ls.verification || null;
    d.intent = ls.intent || null;
    d.intent_timeline = ls.intent_timeline || null;
    d.configuration = ls.configuration || u.configuration || null;
  } else {
    d.configuration = u.configuration || null;
  }
  for (const c of u.contacts) {
    const slot = c.slot as SlotKey;
    d.contacts[slot] = {
      name: c.name ?? '',
      phone: local10(c.phone),
      relation: c.relation ?? '',
      call_allowed: !!c.call_allowed,
      whatsapp_allowed: !!c.whatsapp_allowed,
      source: c.source || null,
    };
  }
  if (u.tenancy) {
    d.lease_end = u.tenancy.lease_end ?? null;
    d.monthly_rent = s(u.tenancy.monthly_rent);
  }
  return d;
}

export function detailsFromUnit(u: UnitDetail): DetailsDraft {
  const x = u.details;
  if (!x) return emptyDetails();
  return {
    super_area_sqft: s(x.super_area_sqft),
    carpet_area_sqft: s(x.carpet_area_sqft),
    kitchen_size: x.kitchen_size || null,
    balcony_count: s(x.balcony_count),
    balcony_size_sqft: s(x.balcony_size_sqft),
    facing: x.facing || null,
    furnishing: x.furnishing || null,
    parking: x.parking || null,
    bathrooms: s(x.bathrooms),
    nearby_school: x.nearby_school ?? '',
    nearby_market: x.nearby_market ?? '',
    nearby_transport: x.nearby_transport ?? '',
    notes: x.notes ?? '',
  };
}

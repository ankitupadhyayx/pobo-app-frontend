export type SlotKey = 'OWNER' | 'ADDITIONAL' | 'TENANT';

export interface SlotDraft {
  name: string;
  phone: string;
  relation: string;
  call_allowed: boolean;
  whatsapp_allowed: boolean;
  source: string | null;
}

export const emptySlot = (): SlotDraft => ({ name: '', phone: '', relation: '', call_allowed: false, whatsapp_allowed: false, source: null });


/** Data set 1: dated survey snapshot of one unit (DEC-01 #2). */
export interface SurveyDraft {
  occupancy: string | null;
  doorstep_outcome: string | null;
  data_source: string | null;
  verification: string | null;
  intent: string | null;
  intent_timeline: string | null;
  configuration: string | null;
  notes: string;
  contacts: Record<SlotKey, SlotDraft>;
  /** Tenancy (when tenant occupied) for expiry follow-up (APP-27). */
  lease_end: string | null;
  monthly_rent: string;
}

export const emptySurvey = (): SurveyDraft => ({
  occupancy: null,
  doorstep_outcome: null,
  data_source: null,
  verification: null,
  intent: null,
  intent_timeline: null,
  configuration: null,
  notes: '',
  contacts: { OWNER: emptySlot(), ADDITIONAL: emptySlot(), TENANT: emptySlot() },
  lease_end: null,
  monthly_rent: '',
});

/** Data set 2: optional, progressive unit details (DEC-01 #3). */
export interface DetailsDraft {
  super_area_sqft: string;
  carpet_area_sqft: string;
  kitchen_size: string | null;
  balcony_count: string;
  balcony_size_sqft: string;
  facing: string | null;
  furnishing: string | null;
  parking: string | null;
  bathrooms: string;
  nearby_school: string;
  nearby_market: string;
  nearby_transport: string;
  notes: string;
}

export const emptyDetails = (): DetailsDraft => ({
  super_area_sqft: '',
  carpet_area_sqft: '',
  kitchen_size: null,
  balcony_count: '',
  balcony_size_sqft: '',
  facing: null,
  furnishing: null,
  parking: null,
  bathrooms: '',
  nearby_school: '',
  nearby_market: '',
  nearby_transport: '',
  notes: '',
});

const PHONE = /^[6-9]\d{9}$/;

export function validateSurvey(d: SurveyDraft, t: (k: string) => string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.occupancy) e.occupancy = t('errors.required');
  for (const k of ['OWNER', 'ADDITIONAL', 'TENANT'] as SlotKey[]) {
    const c = d.contacts[k];
    if (c.phone && !PHONE.test(c.phone)) e[`${k}.phone`] = t('errors.phone');
  }
  if (d.monthly_rent && Number.isNaN(Number(d.monthly_rent))) e.monthly_rent = t('errors.number');
  return e;
}

const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s));

/** Payload helpers; final field names follow openapi.yaml when the survey contract lands. */
export function surveyPayload(d: SurveyDraft) {
  const contacts = (Object.keys(d.contacts) as SlotKey[])
    .map((slot) => {
      const c = d.contacts[slot];
      return {
        slot,
        name: c.name.trim(),
        phone: c.phone ? `+91${c.phone}` : '',
        relation: c.relation.trim(),
        call_allowed: c.call_allowed,
        whatsapp_allowed: c.whatsapp_allowed,
        source: c.source ?? '',
      };
    })
    .filter((c) => c.name || c.phone);
  return {
    occupancy: d.occupancy as 'OWNER_OCCUPIED' | 'TENANT_OCCUPIED' | 'VACANT' | 'UNKNOWN',
    doorstep_outcome: d.doorstep_outcome ?? '',
    data_source: d.data_source ?? '',
    verification: (d.verification ?? 'UNVERIFIED') as 'VERIFIED' | 'UNVERIFIED' | 'NEEDS_VERIFICATION',
    intent: d.intent ?? '',
    intent_timeline: d.intent_timeline ?? '',
    configuration: d.configuration ?? '',
    notes: d.notes.trim(),
    surveyed_at: new Date().toISOString(),
    contacts,
    tenancy: d.occupancy === 'TENANT_OCCUPIED' && (d.lease_end || d.monthly_rent) ? { lease_end: d.lease_end, monthly_rent: num(d.monthly_rent) } : null,
  };
}

export function detailsPayload(d: DetailsDraft) {
  return {
    super_area_sqft: num(d.super_area_sqft),
    carpet_area_sqft: num(d.carpet_area_sqft),
    kitchen_size: d.kitchen_size ?? '',
    balcony_count: num(d.balcony_count),
    balcony_size_sqft: num(d.balcony_size_sqft),
    facing: d.facing ?? '',
    furnishing: d.furnishing ?? '',
    parking: d.parking ?? '',
    bathrooms: num(d.bathrooms),
    nearby_school: d.nearby_school.trim(),
    nearby_market: d.nearby_market.trim(),
    nearby_transport: d.nearby_transport.trim(),
    notes: d.notes.trim(),
  };
}

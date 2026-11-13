import { emptyLocation, toLocationInput, type LocationValue } from '@/lib/location';
import { emptyLocality, type LocalityValue, type PickedLocality } from './LocalityPicker';

/** Draft of one requirement card in Add Lead / Add Requirement (maps to RequirementInput). */
export interface RequirementDraft {
  type: string;
  configuration: string | null;
  /** SELL / RENT OUT: the property's sector (one) + optional society/tower/flat + address (RV2-A). */
  locality: LocalityValue;
  societyId: string | null;
  societyName: string;
  towerName: string;
  flatNumber: string;
  location: LocationValue;
  /** BUY / RENT (R2-3/R2-10/R2-11): preferred sectors, preferred societies, or area Open. */
  preferredLocalities: LocalityValue;
  preferredSocieties: PickedLocality[];
  areaOpen: boolean;
  budgetMin: string;
  budgetMax: string;
  expectedPrice: string;
  expectedRent: string;
  leaseTermMonths: string;
  timeline: string | null;
  notes: string;
}

export function emptyDraft(type: string): RequirementDraft {
  return {
    type,
    configuration: null,
    locality: emptyLocality(),
    societyId: null,
    societyName: '',
    towerName: '',
    flatNumber: '',
    location: emptyLocation(),
    preferredLocalities: emptyLocality(),
    preferredSocieties: [],
    areaOpen: false,
    budgetMin: '',
    budgetMax: '',
    expectedPrice: '',
    expectedRent: '',
    leaseTermMonths: '',
    timeline: null,
    notes: '',
  };
}

/** Which inputs each requirement type shows (blueprint §6.1 + founder's notes). */
export function fieldsFor(type: string) {
  const owns = type === 'SELL' || type === 'RENT_OUT'; // customer's own property → exact location
  const seeks = type === 'BUY' || type === 'RENT'; // looking → preferred areas + budget
  const rental = type === 'RENT' || type === 'RENT_OUT';
  return {
    location: owns,
    preferredAreas: seeks,
    budget: type === 'BUY',
    expectedPrice: type === 'SELL',
    expectedRent: rental,
    leaseTerm: rental,
    configuration: type !== 'GENERAL',
  };
}

const num = (s: string) => {
  const v = Number(s.replace(/[,\s]/g, ''));
  return s.trim() === '' || Number.isNaN(v) ? null : v;
};

/**
 * R3-2 required fields (founder rule). Missing ones don't block a save: the requirement is kept as
 * a Draft ("Incomplete requirement") until they are filled. Keys are draft field names.
 * BUY/RENT: a preferred area (sectors, societies or Open), a budget (BUY min or max; RENT the
 * rent) and the configuration. SELL/RENT OUT: property type (configuration, unless a property is
 * already added), the location (sector, society or address) and the expected price / rent.
 */
export function requiredFields(type: string, opts: { hasProperty?: boolean } = {}): (keyof RequirementDraft)[] {
  if (type === 'BUY') return ['preferredLocalities', 'budgetMin', 'configuration'];
  if (type === 'RENT') return ['preferredLocalities', 'expectedRent', 'configuration'];
  const own: (keyof RequirementDraft)[] = opts.hasProperty ? [] : ['configuration'];
  if (type === 'SELL') return [...own, 'locality', 'expectedPrice'];
  if (type === 'RENT_OUT') return [...own, 'locality', 'expectedRent'];
  return [];
}

export function missingRequired(d: RequirementDraft, t: (k: string) => string, opts: { hasProperty?: boolean } = {}): Record<string, string> {
  const e: Record<string, string> = {};
  for (const k of requiredFields(d.type, opts)) {
    let ok = true;
    if (k === 'preferredLocalities') ok = d.areaOpen || d.preferredLocalities.items.length > 0 || !!d.preferredLocalities.other.trim() || d.preferredSocieties.length > 0;
    else if (k === 'budgetMin') ok = num(d.budgetMin) !== null || num(d.budgetMax) !== null;
    else if (k === 'locality') ok = d.locality.items.length > 0 || !!d.locality.other.trim() || !!d.societyId || !!d.societyName.trim() || !!d.location.addressText.trim() || !!d.location.paste.trim();
    else if (k === 'configuration') ok = !!d.configuration;
    else ok = num(d[k] as string) !== null;
    if (!ok) e[k] = t(`draftReq.missing.${k}`);
  }
  return e;
}

/**
 * Client-side validation; returns `{field: message}` keyed by draft field names.
 * `complete: true` (R3-2 normal save) also reports missing required fields; a "Save as draft"
 * only checks what was typed.
 */
export function validateDraft(d: RequirementDraft, t: (k: string) => string, opts: { complete?: boolean; hasProperty?: boolean } = {}): Record<string, string> {
  const f = fieldsFor(d.type);
  const e: Record<string, string> = opts.complete ? missingRequired(d, t, opts) : {};
  const numeric: (keyof RequirementDraft)[] = ['budgetMin', 'budgetMax', 'expectedPrice', 'expectedRent', 'leaseTermMonths'];
  for (const k of numeric) {
    const v = d[k] as string;
    if (v.trim() && num(v) === null) e[k] = t('errors.number');
  }
  // Never reject on a field the form doesn't show, and never force a single society.
  if (f.budget && num(d.budgetMin) !== null && num(d.budgetMax) !== null && num(d.budgetMin)! > num(d.budgetMax)!) {
    e.budgetMax = 'Must be more than "from"';
  }
  const lease = num(d.leaseTermMonths);
  if (lease !== null && (lease < 1 || lease > 120)) e.leaseTermMonths = '1–120 months';
  return e;
}

/** True when every error is only a missing required field (so "Save as draft" can keep it). */
export function onlyMissing(errs: Record<string, string>, d: RequirementDraft, t: (k: string) => string, opts: { hasProperty?: boolean } = {}): boolean {
  const miss = missingRequired(d, t, opts);
  return Object.keys(errs).length > 0 && Object.entries(errs).every(([k, v]) => miss[k] === v);
}

/** R3-2: prefill the form from a saved requirement (Complete requirement / edit). */
export function draftFromRequirement(r: {
  type: string;
  configuration?: string;
  locality: { id: string; name: string } | null;
  society: { id: string; name: string } | null;
  society_name_text?: string;
  tower?: { name?: string } | null;
  flat_number?: string;
  address_text?: string;
  maps_url?: string;
  preferred_localities?: { id: string; name: string }[];
  preferred_societies?: { id: string; name: string }[];
  area_open?: boolean;
  budget_min?: number | null;
  budget_max?: number | null;
  expected_price?: number | null;
  expected_rent?: number | null;
  lease_term_months?: number | null;
  timeline?: string;
  notes?: string;
}): RequirementDraft {
  const s = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(Math.round(Number(v))));
  return {
    ...emptyDraft(r.type),
    configuration: r.configuration || null,
    locality: { items: r.locality ? [{ id: r.locality.id, name: r.locality.name }] : [], other: '' },
    societyId: r.society?.id ?? null,
    societyName: r.society?.name ?? r.society_name_text ?? '',
    towerName: r.tower?.name ?? '',
    flatNumber: r.flat_number ?? '',
    location: { addressText: r.address_text ?? '', paste: r.maps_url ?? '' },
    preferredLocalities: { items: (r.preferred_localities ?? []).map((x) => ({ id: x.id, name: x.name })), other: '' },
    preferredSocieties: (r.preferred_societies ?? []).map((x) => ({ id: x.id, name: x.name })),
    areaOpen: !!r.area_open,
    budgetMin: s(r.budget_min),
    budgetMax: s(r.budget_max),
    expectedPrice: s(r.expected_price),
    expectedRent: s(r.expected_rent),
    leaseTermMonths: s(r.lease_term_months),
    timeline: r.timeline || null,
    notes: r.notes ?? '',
  };
}

/** Serialize to the API's RequirementInput shape (snake_case, rupees as integers). */
export function draftToInput(d: RequirementDraft, opts: { saveAsDraft?: boolean } = {}) {
  const f = fieldsFor(d.type);
  const out: Record<string, unknown> = { type: d.type };
  // R3-2: "Save as draft" keeps it a Draft; a normal save leaves it to the server (Draft only if
  // something is still missing), so Add Lead → Requirement #1 never fails on these.
  if (opts.saveAsDraft) out.save_as_draft = true;
  if (f.configuration && d.configuration) out.configuration = d.configuration;
  if (f.location) {
    if (d.locality.items[0]) out.locality_id = d.locality.items[0].id;
    else if (d.locality.other.trim()) out.locality_other = d.locality.other.trim();
    if (d.societyId) out.society_id = d.societyId;
    else if (d.societyName.trim()) out.society_name = d.societyName.trim();
    if (d.towerName.trim()) out.tower_name = d.towerName.trim();
    if (d.flatNumber.trim()) out.flat_number = d.flatNumber.trim();
    const loc = toLocationInput(d.location);
    if (loc.address_text) out.address_text = loc.address_text;
    if (loc.location_input) out.location_input = loc.location_input;
  }
  if (f.preferredAreas) {
    if (d.areaOpen) out.area_open = true;
    else {
      if (d.preferredLocalities.items.length) out.preferred_locality_ids = d.preferredLocalities.items.map((l) => l.id);
      if (d.preferredLocalities.other.trim()) out.locality_other = d.preferredLocalities.other.trim();
      if (d.preferredSocieties.length) out.preferred_society_ids = d.preferredSocieties.map((x) => x.id);
    }
  }
  if (f.budget) {
    if (num(d.budgetMin) !== null) out.budget_min = num(d.budgetMin);
    if (num(d.budgetMax) !== null) out.budget_max = num(d.budgetMax);
  }
  if (f.expectedPrice && num(d.expectedPrice) !== null) out.expected_price = num(d.expectedPrice);
  if (f.expectedRent && num(d.expectedRent) !== null) out.expected_rent = num(d.expectedRent);
  if (f.leaseTerm && num(d.leaseTermMonths) !== null) out.lease_term_months = num(d.leaseTermMonths);
  if (d.timeline) out.timeline = d.timeline;
  if (d.notes.trim()) out.notes = d.notes.trim();
  return out;
}

/** Map API field keys (`requirements.1.expected_rent`) to draft keys for inline errors. */
export const API_TO_DRAFT: Record<string, keyof RequirementDraft | 'society'> = {
  configuration: 'configuration',
  society_id: 'society',
  society_name: 'society',
  tower_name: 'towerName',
  tower_id: 'towerName',
  flat_number: 'flatNumber',
  address_text: 'location',
  location_input: 'location',
  locality_id: 'locality',
  locality_other: 'locality',
  preferred_areas: 'preferredLocalities',
  preferred_locality_ids: 'preferredLocalities',
  preferred_society_ids: 'preferredSocieties',
  area_open: 'preferredLocalities',
  budget_min: 'budgetMin',
  budget_max: 'budgetMax',
  expected_price: 'expectedPrice',
  expected_rent: 'expectedRent',
  lease_term_months: 'leaseTermMonths',
  timeline: 'timeline',
  notes: 'notes',
};

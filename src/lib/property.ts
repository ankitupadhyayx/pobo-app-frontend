/**
 * R2-2: a listing is a flat (unit in a society) or an independent property (house, builder floor,
 * villa, plot) with an address and a sector but no unit. These give one display string for both.
 */
interface PlaceLike {
  unit?: { society_name?: string | null; tower_name?: string | null; number?: string | null; locality_name?: string | null } | null;
  property_kind?: string | null;
  address_text?: string | null;
  locality?: { name?: string | null } | null;
  locality_name?: string | null;
  society_name?: string | null;
  tower_name?: string | null;
  unit_number?: string | null;
  unit_label?: string | null;
}

const humanize = (c: string) => c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, ' ');

/** "Tower 9-904" or "Builder floor" (short, for headers). */
export function placeShort(p: PlaceLike, kindLabel: (code: string) => string = humanize): string {
  const tower = p.unit?.tower_name ?? p.tower_name;
  const num = p.unit?.number ?? p.unit_number;
  if (tower || num) return [tower, num].filter(Boolean).join('-');
  if (p.unit_label) return p.unit_label;
  return p.property_kind && p.property_kind !== 'FLAT' ? kindLabel(p.property_kind) : '';
}

/** "Paras Tierea · Tower 9-904" or "Builder floor · B-12, Sector 50". */
export function placeTitle(p: PlaceLike, kindLabel: (code: string) => string = humanize): string {
  const society = p.unit?.society_name ?? p.society_name;
  if (society) return `${society} · ${placeShort(p, kindLabel)}`;
  const where = (p.address_text ?? '').split('\n')[0].trim() || p.locality?.name || p.locality_name || '';
  return [placeShort(p, kindLabel), where].filter(Boolean).join(' · ');
}

/** Sector / locality line. */
export const placeLocality = (p: PlaceLike) => p.unit?.locality_name ?? p.locality?.name ?? p.locality_name ?? '';

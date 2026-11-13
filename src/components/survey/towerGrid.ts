import type { TowerDetail, UnitStatus } from '@/api/hooks/field';
import type { FloorRow, UnitCell } from './UnitMatrix';
import type { ListingState, UnitLayer } from './unitStyle';

/** DEC-01 layer of a unit from the grid payload; the most advanced record wins. */
export function unitLayer(u: UnitStatus): UnitLayer {
  if (u.open_listing_status) return 'listing';
  if (u.open_opportunity_type) return 'opportunity';
  if (u.survey_level && u.survey_level !== 'NONE') return 'surveyed';
  return 'mapped';
}

/** Floors highest first (like the building); units sorted naturally within a floor. */
export function buildRows(tower: TowerDetail, local: Record<string, 'pending' | 'conflict' | 'rejected'>): FloorRow[] {
  const byFloor = new Map<string, UnitStatus[]>();
  for (const u of tower.units) {
    const k = u.floor_id ?? 'none';
    byFloor.set(k, [...(byFloor.get(k) ?? []), u]);
  }
  const floors = [...tower.floors].sort((a, b) => b.number - a.number);
  const toCell = (u: UnitStatus): UnitCell => {
    const st = local[`unit:${u.id}`];
    return {
      id: u.id,
      label: u.number,
      layer: unitLayer(u),
      listingState: (u.open_listing_status as ListingState | null) ?? null,
      keysHeld: u.keys_held,
      pending: st === 'pending',
      conflict: st === 'conflict' || st === 'rejected',
    };
  };
  const rows: FloorRow[] = floors.map((f) => ({
    floor: f.label || String(f.number),
    units: (byFloor.get(f.id) ?? []).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })).map(toCell),
  }));
  const loose = byFloor.get('none');
  if (loose?.length) rows.push({ floor: '—', units: loose.map(toCell) });
  return rows.filter((r) => r.units.length);
}

/**
 * Preview of tower structure generation (APP-22). The server generates the real units; this
 * shows the AA exactly what will be created before sending (labels, skipped floors, numbers).
 */
export interface FloorPlanInput {
  lowerGround: boolean;
  upperGround: boolean;
  ground: boolean;
  /** Highest numbered floor (e.g. 15). */
  topFloor: number;
  /** Floors that do not exist, e.g. [13] (often renamed 12A). */
  skip: number[];
  /** Renamed floors replacing a skipped number, e.g. { 13: '12A' }. */
  rename: Record<number, string>;
}

export function floorLabels(p: FloorPlanInput): string[] {
  const out: string[] = [];
  if (p.lowerGround) out.push('LG');
  if (p.upperGround) out.push('UG');
  if (p.ground) out.push('G');
  for (let f = 1; f <= Math.max(0, Math.min(p.topFloor, 200)); f++) {
    if (p.rename[f]) out.push(p.rename[f]);
    else if (!p.skip.includes(f)) out.push(String(f));
  }
  return out;
}

/**
 * Same tokens as the server (`POST /mapping/towers/{id}/generate`): {floor} {unit} {unit:02d}
 * {letter} (A, B, C… for unit 1, 2, 3…), plus {tower}. Default "{floor}{unit:02d}" → 1204, G01.
 */
export const DEFAULT_PATTERN = '{floor}{unit:02d}';

export function unitNumber(pattern: string, tower: string, floor: string, unit: number): string {
  return pattern
    .replace(/\{tower\}/g, tower)
    .replace(/\{floor\}/g, floor)
    .replace(/\{letter\}/g, String.fromCharCode(64 + Math.min(Math.max(unit, 1), 26)))
    .replace(/\{unit(?::0?(\d)d?)?\}/g, (_, pad: string | undefined) => (pad ? String(unit).padStart(Number(pad), '0') : String(unit)));
}

export function previewUnits(floors: string[], unitsPerFloor: number, pattern: string, tower: string) {
  return floors.map((floor) => ({ floor, units: Array.from({ length: Math.max(0, Math.min(unitsPerFloor, 50)) }, (_, i) => unitNumber(pattern, tower, floor, i + 1)) }));
}

/** Probable duplicate tower names: "Tower 2" vs "T-2" vs "t2" (governance flag, server decides). */
export function normalizeTowerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(tower|block|wing|bldg|building)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/^t(?=\d)/, '');
}

export function findDuplicateNames(names: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const n of names) {
    const k = normalizeTowerName(n);
    groups.set(k, [...(groups.get(k) ?? []), n]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

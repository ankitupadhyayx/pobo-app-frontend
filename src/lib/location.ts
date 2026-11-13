/**
 * RV2-A address without the Google API. The AA types the full address (always enough on its own),
 * can open Google Maps at that address, and paste back a Maps link or "lat, lon". This parser gives
 * the instant preview ("28.5355, 77.3910 ✓"); the server parses again and is the authority.
 * Forms handled (same list as the backend): `@lat,lon`, `?q=lat,lon` / `query=`, `ll=`,
 * `!3d<lat>!4d<lon>`, plain "28.5, 77.4". Short `maps.app.goo.gl` links can't be resolved offline:
 * we keep the link and leave the coordinates empty.
 */
export type LocationSource = 'TEXT' | 'PASTED_COORDS' | 'MAPS_LINK';

export interface ParsedLocation {
  source: Exclude<LocationSource, 'TEXT'>;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
}

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)';
const PAIR = new RegExp(`^\\s*${NUM}\\s*[, ]\\s*${NUM}\\s*$`);

const inRange = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);

function pick(lat: string, lon: string): { latitude: number; longitude: number } | null {
  const a = Number(lat);
  const b = Number(lon);
  return inRange(a, b) ? { latitude: Math.round(a * 1e6) / 1e6, longitude: Math.round(b * 1e6) / 1e6 } : null;
}

/** null = empty or not a location we understand; `latitude: null` = a link we keep without coordinates. */
export function parseLocation(raw: string): ParsedLocation | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  const plain = PAIR.exec(text);
  if (plain) {
    const c = pick(plain[1], plain[2]);
    return c ? { source: 'PASTED_COORDS', ...c, mapsUrl: null } : null;
  }
  const url = /https?:\/\/\S+/i.exec(text)?.[0];
  if (!url) return null;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    /* keep raw */
  }
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // place pin (most exact)
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // map centre
    /[?&](?:q|query|ll|destination|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  ];
  for (const re of patterns) {
    const m = re.exec(decoded);
    if (m) {
      const c = pick(m[1], m[2]);
      if (c) return { source: 'MAPS_LINK', ...c, mapsUrl: url };
    }
  }
  if (/(google\.[a-z.]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl)/i.test(url)) {
    return { source: 'MAPS_LINK', latitude: null, longitude: null, mapsUrl: url };
  }
  return null;
}

/** Google Maps search URL (opens the Maps app when installed, else the website). No API key. */
export function mapsSearchUrl(query: string): string {
  const q = query.trim();
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : 'https://www.google.com/maps';
}

export const formatCoords = (lat: number, lon: number) => `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

export interface LocationValue {
  addressText: string;
  paste: string;
}

export const emptyLocation = (addressText = ''): LocationValue => ({ addressText, paste: '' });

/**
 * API input shared by every address (RV2-A contract): `address_text` plus the raw paste as
 * `location_input` (the server parses it; a bad paste → 400 `fields.location_input`).
 */
export function toLocationInput(v: LocationValue): { address_text: string; location_input?: string } {
  const paste = v.paste.trim();
  return { address_text: v.addressText.trim(), ...(paste ? { location_input: paste } : {}) };
}

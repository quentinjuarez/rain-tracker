/**
 * Exhaustive location string parser.
 *
 * Supported formats:
 *  ── Decimal degrees ──────────────────────────────────────────────
 *   48.8566, 2.3522
 *   48.8566 2.3522
 *   48.8566,2.3522
 *   lat: 48.8566  lng: 2.3522
 *
 *  ── Signed (negative = S / W) ────────────────────────────────────
 *   -33.8688, 151.2093
 *
 *  ── Degrees + compass direction ──────────────────────────────────
 *   48.8566°N, 2.3522°E
 *   48.8566N 2.3522E
 *   N48.8566 E2.3522
 *
 *  ── Degrees Minutes Seconds (DMS) ────────────────────────────────
 *   48°51'24.0"N 2°21'7.9"E
 *   48°51′24.0″N 2°21′7.9″E   (unicode quotes)
 *   48d51m24.0sN 2d21m7.9sE
 *   48 51 24.0 N, 2 21 7.9 E
 *
 *  ── Degrees Decimal Minutes (DDM) ────────────────────────────────
 *   48°51.4000'N, 2°21.1317'E
 *   48 51.4000 N 2 21.1317 E
 *
 *  ── Google Maps URLs ─────────────────────────────────────────────
 *   https://www.google.com/maps/@48.8566,2.3522,15z
 *   https://www.google.com/maps/place/.../@48.8566,2.3522,15z
 *   https://maps.google.com/?q=48.8566,2.3522
 *   https://goo.gl/maps/...  (only if coords embedded)
 *   https://www.google.com/maps?q=48.8566,2.3522
 *   https://maps.app.goo.gl/...  → not resolvable client-side
 *
 *  ── Plus codes / Open Location Codes ────────────────────────────
 *   (not supported – would need a geocoder)
 *
 * Returns `{ lat, lng }` or `null`.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

function clamp(lat: number, lng: number): LatLng | null {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Convert DMS (degrees, minutes, seconds) to decimal degrees.
 */
function dmsToDecimal(
  deg: number,
  min: number,
  sec: number,
  direction: string,
): number {
  const sign = /[SWsw]/.test(direction) ? -1 : 1;
  return sign * (Math.abs(deg) + min / 60 + sec / 3600);
}

// ── Regex building blocks ────────────────────────────────────────────

// Degree symbols: °, d, º
const DEG = `[°dº]`;
// Minute symbols: ', ′, m, ʹ
const MIN = `['''′ʹm]`;
// Second symbols: ", ″, s, ʺ, ''
const SEC = `["""″ʺs]|''`;
// Cardinal directions
const NS = `[NnSs]`;
const EW = `[EeWwOo]`; // O for Ouest (French)

// ── Strategy: Google Maps URL ────────────────────────────────────────

function tryGoogleMapsUrl(input: string): LatLng | null {
  // Pattern 1: /@lat,lng   (with optional zoom)
  const atMatch = input.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch && atMatch[1] && atMatch[2]) {
    return clamp(parseFloat(atMatch[1]), parseFloat(atMatch[2]));
  }

  // Pattern 2: ?q=lat,lng  or &q=lat,lng or ?ll=lat,lng
  const qMatch = input.match(
    /[?&](?:q|ll|query|center)=(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/,
  );
  if (qMatch && qMatch[1] && qMatch[2]) {
    return clamp(parseFloat(qMatch[1]), parseFloat(qMatch[2]));
  }

  // Pattern 3: /maps/place/lat,lng
  const placeMatch = input.match(/\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (placeMatch && placeMatch[1] && placeMatch[2]) {
    return clamp(parseFloat(placeMatch[1]), parseFloat(placeMatch[2]));
  }

  return null;
}

// ── Strategy: DMS  48°51'24.0"N 2°21'7.9"E ──────────────────────────

function tryDms(input: string): LatLng | null {
  // Full DMS with symbols: 48°51'24.0"N 2°21'7.9"E
  const dmsRe = new RegExp(
    `(${NS})?\\s*(-?\\d+\\.?\\d*)\\s*${DEG}?\\s*(\\d+\\.?\\d*)\\s*${MIN}\\s*(\\d+\\.?\\d*)\\s*(?:${SEC})\\s*(${NS})?` +
      `[\\s,/]+` +
      `(${EW})?\\s*(-?\\d+\\.?\\d*)\\s*${DEG}?\\s*(\\d+\\.?\\d*)\\s*${MIN}\\s*(\\d+\\.?\\d*)\\s*(?:${SEC})\\s*(${EW})?`,
    'i',
  );
  const m = input.match(dmsRe);
  if (m && m[2] && m[3] && m[4] && m[7] && m[8] && m[9]) {
    const latDir = m[1] || m[5] || 'N';
    const lngDir = m[6] || m[10] || 'E';
    const lat = dmsToDecimal(
      parseFloat(m[2]),
      parseFloat(m[3]),
      parseFloat(m[4]),
      latDir,
    );
    const lng = dmsToDecimal(
      parseFloat(m[7]),
      parseFloat(m[8]),
      parseFloat(m[9]),
      lngDir,
    );
    return clamp(lat, lng);
  }

  // Space-only DMS: 48 51 24.0 N, 2 21 7.9 E
  const spaceRe = new RegExp(
    `(${NS})?\\s*(-?\\d+)\\s+(\\d+\\.?\\d*)\\s+(\\d+\\.?\\d*)\\s*(${NS})?` +
      `[\\s,/]+` +
      `(${EW})?\\s*(-?\\d+)\\s+(\\d+\\.?\\d*)\\s+(\\d+\\.?\\d*)\\s*(${EW})?`,
    'i',
  );
  const s = input.match(spaceRe);
  if (s && s[2] && s[3] && s[4] && s[7] && s[8] && s[9]) {
    const latDir = s[1] || s[5] || 'N';
    const lngDir = s[6] || s[10] || 'E';
    const lat = dmsToDecimal(
      parseFloat(s[2]),
      parseFloat(s[3]),
      parseFloat(s[4]),
      latDir,
    );
    const lng = dmsToDecimal(
      parseFloat(s[7]),
      parseFloat(s[8]),
      parseFloat(s[9]),
      lngDir,
    );
    return clamp(lat, lng);
  }

  return null;
}

// ── Strategy: DDM  48°51.4000'N 2°21.1317'E ─────────────────────────

function tryDdm(input: string): LatLng | null {
  const ddmRe = new RegExp(
    `(${NS})?\\s*(-?\\d+\\.?\\d*)\\s*${DEG}\\s*(\\d+\\.?\\d*)\\s*${MIN}?\\s*(${NS})?` +
      `[\\s,/]+` +
      `(${EW})?\\s*(-?\\d+\\.?\\d*)\\s*${DEG}\\s*(\\d+\\.?\\d*)\\s*${MIN}?\\s*(${EW})?`,
    'i',
  );
  const m = input.match(ddmRe);
  if (m && m[2] && m[3] && m[6] && m[7]) {
    const latDir = m[1] || m[4] || 'N';
    const lngDir = m[5] || m[8] || 'E';
    const lat = dmsToDecimal(parseFloat(m[2]), parseFloat(m[3]), 0, latDir);
    const lng = dmsToDecimal(parseFloat(m[6]), parseFloat(m[7]), 0, lngDir);
    return clamp(lat, lng);
  }
  return null;
}

// ── Strategy: Decimal + cardinal  48.8566°N, 2.3522°E ────────────────

function tryDecimalCardinal(input: string): LatLng | null {
  const re = new RegExp(
    `(${NS})?\\s*(-?\\d+\\.?\\d*)\\s*${DEG}?\\s*(${NS})?` +
      `[\\s,/]+` +
      `(${EW})?\\s*(-?\\d+\\.?\\d*)\\s*${DEG}?\\s*(${EW})?`,
    'i',
  );
  const m = input.match(re);
  if (!m || !m[2] || !m[5]) return null;

  const latDir = m[1] || m[3];
  const lngDir = m[4] || m[6];
  // At least one direction must be present to distinguish from plain decimal
  if (!latDir && !lngDir) return null;

  let lat = parseFloat(m[2]);
  let lng = parseFloat(m[5]);
  if (latDir && /[SWsw]/.test(latDir)) lat = -Math.abs(lat);
  if (lngDir && /[SWswOo]/.test(lngDir)) lng = -Math.abs(lng);

  return clamp(lat, lng);
}

// ── Strategy: labeled  lat: 48.8566  lng: 2.3522 ────────────────────

function tryLabeled(input: string): LatLng | null {
  const re =
    /(?:lat(?:itude)?)[:\s=]+(-?\d+\.?\d*)[°]?\s*[,;\s/]+\s*(?:lo?ng?(?:itude)?)[:\s=]+(-?\d+\.?\d*)[°]?/i;
  const m = input.match(re);
  if (m && m[1] && m[2]) return clamp(parseFloat(m[1]), parseFloat(m[2]));
  return null;
}

// ── Strategy: plain decimal  48.8566, 2.3522 ────────────────────────

function tryDecimal(input: string): LatLng | null {
  const re = /(-?\d+\.?\d*)\s*[,;\s/]\s*(-?\d+\.?\d*)/;
  const m = input.match(re);
  if (!m || !m[1] || !m[2]) return null;
  return clamp(parseFloat(m[1]), parseFloat(m[2]));
}

// ── Main parser ──────────────────────────────────────────────────────

export function parseLocation(raw: string): LatLng | null {
  const input = raw.trim();
  if (!input) return null;

  // If it looks like a URL, try Google Maps parser first
  if (/https?:\/\//i.test(input)) {
    return tryGoogleMapsUrl(input);
  }

  // Try each strategy in order of specificity
  return (
    tryDms(input) ??
    tryDdm(input) ??
    tryDecimalCardinal(input) ??
    tryLabeled(input) ??
    tryDecimal(input)
  );
}

// ── Supported formats caption ────────────────────────────────────────

export const LOCATION_FORMATS = [
  '48.8566, 2.3522',
  '-33.8688, 151.2093',
  '48.8566°N, 2.3522°E',
  '48°51\'24.0"N 2°21\'7.9"E',
  "48°51.4000'N, 2°21.1317'E",
  'lat: 48.8566 lng: 2.3522',
  'https://www.google.com/maps/@48.8566,2.3522,15z',
  'https://maps.google.com/?q=48.8566,2.3522',
] as const;

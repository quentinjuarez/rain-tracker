import { describe, it, expect } from 'vitest';
import { parseLocation } from '../utils/parseLocation';

describe('parseLocation', () => {
  // ── Null / empty ────────────────────────────────────────────────────
  it('returns null for empty string', () => {
    expect(parseLocation('')).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(parseLocation('hello world')).toBeNull();
  });

  it('returns null for out-of-range lat', () => {
    expect(parseLocation('91.0, 2.0')).toBeNull();
  });

  it('returns null for out-of-range lng', () => {
    expect(parseLocation('48.0, 181.0')).toBeNull();
  });

  // ── Plain decimal ──────────────────────────────────────────────────
  describe('decimal degrees', () => {
    it('comma separated', () => {
      expect(parseLocation('48.8566, 2.3522')).toEqual({
        lat: 48.8566,
        lng: 2.3522,
      });
    });

    it('comma no space', () => {
      expect(parseLocation('48.8566,2.3522')).toEqual({
        lat: 48.8566,
        lng: 2.3522,
      });
    });

    it('space separated', () => {
      expect(parseLocation('48.8566 2.3522')).toEqual({
        lat: 48.8566,
        lng: 2.3522,
      });
    });

    it('semicolon separated', () => {
      expect(parseLocation('48.8566; 2.3522')).toEqual({
        lat: 48.8566,
        lng: 2.3522,
      });
    });

    it('negative coords (Sydney)', () => {
      expect(parseLocation('-33.8688, 151.2093')).toEqual({
        lat: -33.8688,
        lng: 151.2093,
      });
    });

    it('negative lng (New York)', () => {
      expect(parseLocation('40.7128, -74.0060')).toEqual({
        lat: 40.7128,
        lng: -74.006,
      });
    });

    it('both negative (Buenos Aires)', () => {
      expect(parseLocation('-34.6037, -58.3816')).toEqual({
        lat: -34.6037,
        lng: -58.3816,
      });
    });

    it('integer coords', () => {
      expect(parseLocation('48, 2')).toEqual({ lat: 48, lng: 2 });
    });
  });

  // ── Labeled ────────────────────────────────────────────────────────
  describe('labeled', () => {
    it('lat: ... lng: ...', () => {
      expect(parseLocation('lat: 48.8566 lng: 2.3522')).toEqual({
        lat: 48.8566,
        lng: 2.3522,
      });
    });

    it('latitude: ... longitude: ...', () => {
      expect(parseLocation('latitude: 48.8566, longitude: 2.3522')).toEqual({
        lat: 48.8566,
        lng: 2.3522,
      });
    });

    it('lat=... lng=...', () => {
      expect(parseLocation('lat=48.8566 lng=2.3522')).toEqual({
        lat: 48.8566,
        lng: 2.3522,
      });
    });
  });

  // ── Decimal + cardinal direction ───────────────────────────────────
  describe('decimal + cardinal', () => {
    it('48.8566°N, 2.3522°E', () => {
      expect(parseLocation('48.8566°N, 2.3522°E')).toEqual({
        lat: 48.8566,
        lng: 2.3522,
      });
    });

    it('48.8566N 2.3522E (no degree symbol)', () => {
      expect(parseLocation('48.8566N 2.3522E')).toEqual({
        lat: 48.8566,
        lng: 2.3522,
      });
    });

    it('N48.8566 E2.3522 (prefix direction)', () => {
      expect(parseLocation('N48.8566 E2.3522')).toEqual({
        lat: 48.8566,
        lng: 2.3522,
      });
    });

    it('33.8688°S, 151.2093°E (south)', () => {
      const r = parseLocation('33.8688°S, 151.2093°E');
      expect(r).toEqual({ lat: -33.8688, lng: 151.2093 });
    });

    it('34.6037S 58.3816W (west)', () => {
      const r = parseLocation('34.6037S 58.3816W');
      expect(r).toEqual({ lat: -34.6037, lng: -58.3816 });
    });
  });

  // ── DMS ────────────────────────────────────────────────────────────
  describe('DMS (degrees minutes seconds)', () => {
    it('48°51\'24.0"N 2°21\'7.9"E', () => {
      const r = parseLocation('48°51\'24.0"N 2°21\'7.9"E');
      expect(r).not.toBeNull();
      expect(r!.lat).toBeCloseTo(48.8567, 3);
      expect(r!.lng).toBeCloseTo(2.3522, 3);
    });

    it('unicode quotes  48°51′24.0″N 2°21′7.9″E', () => {
      const r = parseLocation('48°51\u203224.0\u2033N 2°21\u20327.9\u2033E');
      expect(r).not.toBeNull();
      expect(r!.lat).toBeCloseTo(48.8567, 3);
    });

    it('d/m/s notation  48d51m24.0sN 2d21m7.9sE', () => {
      const r = parseLocation('48d51m24.0sN 2d21m7.9sE');
      expect(r).not.toBeNull();
      expect(r!.lat).toBeCloseTo(48.8567, 3);
    });

    it('spaces  48 51 24.0 N, 2 21 7.9 E', () => {
      const r = parseLocation('48 51 24.0 N, 2 21 7.9 E');
      expect(r).not.toBeNull();
      expect(r!.lat).toBeCloseTo(48.8567, 3);
    });

    it('southern hemisphere DMS', () => {
      // Sydney: 33°52'10"S 151°12'30"E
      const r = parseLocation('33°52\'10"S 151°12\'30"E');
      expect(r).not.toBeNull();
      expect(r!.lat).toBeCloseTo(-33.8694, 3);
      expect(r!.lng).toBeCloseTo(151.2083, 3);
    });

    it('with comma separator  48°51\'24"N, 2°21\'8"E', () => {
      const r = parseLocation('48°51\'24"N, 2°21\'8"E');
      expect(r).not.toBeNull();
      expect(r!.lat).toBeCloseTo(48.8567, 3);
    });
  });

  // ── DDM ────────────────────────────────────────────────────────────
  describe('DDM (degrees decimal minutes)', () => {
    it("48°51.4000'N, 2°21.1317'E", () => {
      const r = parseLocation("48°51.4000'N, 2°21.1317'E");
      expect(r).not.toBeNull();
      expect(r!.lat).toBeCloseTo(48.8567, 3);
      expect(r!.lng).toBeCloseTo(2.3522, 3);
    });

    it('without trailing quote', () => {
      const r = parseLocation('48°51.4000N, 2°21.1317E');
      expect(r).not.toBeNull();
      expect(r!.lat).toBeCloseTo(48.8567, 3);
    });
  });

  // ── Google Maps URLs ───────────────────────────────────────────────
  describe('Google Maps URLs', () => {
    it('@lat,lng in path', () => {
      expect(
        parseLocation('https://www.google.com/maps/@48.8566,2.3522,15z'),
      ).toEqual({ lat: 48.8566, lng: 2.3522 });
    });

    it('place/@lat,lng in path', () => {
      expect(
        parseLocation(
          'https://www.google.com/maps/place/Paris/@48.8566,2.3522,15z',
        ),
      ).toEqual({ lat: 48.8566, lng: 2.3522 });
    });

    it('?q=lat,lng', () => {
      expect(
        parseLocation('https://maps.google.com/?q=48.8566,2.3522'),
      ).toEqual({ lat: 48.8566, lng: 2.3522 });
    });

    it('?q=lat,lng with extra params', () => {
      expect(
        parseLocation('https://www.google.com/maps?q=48.8566,2.3522&z=15'),
      ).toEqual({ lat: 48.8566, lng: 2.3522 });
    });

    it('negative coords in URL', () => {
      expect(
        parseLocation('https://www.google.com/maps/@-33.8688,151.2093,15z'),
      ).toEqual({ lat: -33.8688, lng: 151.2093 });
    });

    it('place/lat,lng', () => {
      expect(
        parseLocation('https://www.google.com/maps/place/48.8566,2.3522'),
      ).toEqual({ lat: 48.8566, lng: 2.3522 });
    });

    it('returns null for unparseable URL', () => {
      expect(
        parseLocation('https://www.google.com/maps/place/Paris'),
      ).toBeNull();
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('leading/trailing whitespace', () => {
      expect(parseLocation('  48.8566, 2.3522  ')).toEqual({
        lat: 48.8566,
        lng: 2.3522,
      });
    });

    it('zero coords', () => {
      expect(parseLocation('0, 0')).toEqual({ lat: 0, lng: 0 });
    });

    it('boundary values  90, 180', () => {
      expect(parseLocation('90, 180')).toEqual({ lat: 90, lng: 180 });
    });

    it('boundary values  -90, -180', () => {
      expect(parseLocation('-90, -180')).toEqual({ lat: -90, lng: -180 });
    });

    it('slash separator', () => {
      expect(parseLocation('48.8566 / 2.3522')).toEqual({
        lat: 48.8566,
        lng: 2.3522,
      });
    });
  });
});

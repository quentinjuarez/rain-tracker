export type LocationMode = 'geo' | 'manual';

export type RainProvider = 'rainviewer' | 'owm' | 'rainbow';

/** Normalized bar for OWM / Rainbow timeline display */
export interface RainBar {
  /** Unix timestamp (seconds) */
  time: number;
  /** Raw precipitation value (mm/h for Rainbow, mm per 3 h for OWM) */
  value: number;
  /** Precipitation type – only present for Rainbow */
  type?: string;
}

export type Position = {
  lat: number;
  lon: number;
  mode: LocationMode;
};

export type WeatherCurrent = {
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  weather_code: number;
  wind_speed_10m: number;
  time: string;
};

export type WeatherHourly = {
  time: string[];
  temperature_2m: number[];
  weather_code: number[];
  precipitation_probability: number[];
  precipitation: number[];
};

export type WeatherData = {
  latitude: number;
  longitude: number;
  timezone: string;
  current: WeatherCurrent;
  current_units: Record<string, string>;
  hourly: WeatherHourly;
  hourly_units: Record<string, string>;
};

export type GeoLocation = {
  city: string;
  country: string;
};

export type ProfileState = {
  position: Position | null;
};

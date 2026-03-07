export type LocationMode = 'geo' | 'manual';

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

export function decodeWMO(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: 'Clear Sky' };
  if (code === 1) return { icon: '🌤️', label: 'Mainly Clear' };
  if (code === 2) return { icon: '⛅', label: 'Partly Cloudy' };
  if (code === 3) return { icon: '☁️', label: 'Overcast' };
  if (code <= 48) return { icon: '🌁', label: 'Foggy' };
  if (code <= 55) return { icon: '🌦️', label: 'Drizzle' };
  if (code <= 57) return { icon: '🌧️', label: 'Freezing Drizzle' };
  if (code <= 65) return { icon: '🌧️', label: 'Rain' };
  if (code <= 67) return { icon: '🌧️', label: 'Freezing Rain' };
  if (code <= 75) return { icon: '🌨️', label: 'Snowfall' };
  if (code === 77) return { icon: '🌨️', label: 'Snow Grains' };
  if (code <= 82) return { icon: '🌦️', label: 'Showers' };
  if (code <= 86) return { icon: '🌨️', label: 'Snow Showers' };
  if (code === 95) return { icon: '⛈️', label: 'Thunderstorm' };
  return { icon: '⛈️', label: 'Thunderstorm' };
}

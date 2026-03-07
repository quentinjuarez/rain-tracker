import { ref, watch } from 'vue';
import { useProfileStore } from '../stores/profile';
import type { WeatherData, GeoLocation } from '../types';

const API = 'http://localhost:14001';

export function useWeather() {
  const store = useProfileStore();

  const weather = ref<WeatherData | null>(null);
  const geo = ref<GeoLocation | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchWeather(lat: number, lon: number) {
    loading.value = true;
    error.value = null;
    try {
      const [wRes, gRes] = await Promise.all([
        fetch(`${API}/weather?lat=${lat}&lon=${lon}`),
        fetch(`${API}/geocode?lat=${lat}&lon=${lon}`),
      ]);

      if (!wRes.ok) throw new Error(`Weather API error ${wRes.status}`);
      if (!gRes.ok) throw new Error(`Geocode API error ${gRes.status}`);

      weather.value = await wRes.json();
      geo.value = await gRes.json();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch weather';
    } finally {
      loading.value = false;
    }
  }

  function refresh() {
    if (store.position) {
      fetchWeather(store.position.lat, store.position.lon);
    }
  }

  watch(
    () => store.position,
    (pos) => {
      if (pos) fetchWeather(pos.lat, pos.lon);
    },
    { immediate: true },
  );

  return { weather, geo, loading, error, refresh };
}

import { ref, watch, type Ref } from 'vue';
import { useProfileStore } from '../stores/profile';
import type { WeatherData, GeoLocation } from '../types';

const API = 'http://localhost:14001';

// ── Singleton state ───────────────────────────────────────────────────────────

const weather: Ref<WeatherData | null> = ref(null);
const geo: Ref<GeoLocation | null> = ref(null);
const loading: Ref<boolean> = ref(false);
const error: Ref<string | null> = ref(null);
export const locationTimezone: Ref<string> = ref(
  Intl.DateTimeFormat().resolvedOptions().timeZone,
);

let _watcherStarted = false;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _watcherStarted = false;
  });
}

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

    if (weather.value?.timezone)
      locationTimezone.value = weather.value.timezone;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch weather';
  } finally {
    loading.value = false;
  }
}

function _ensureWatcher() {
  if (_watcherStarted) return;
  _watcherStarted = true;
  const store = useProfileStore();
  watch(
    () => store.position,
    (pos) => {
      if (pos) void fetchWeather(pos.lat, pos.lon);
    },
    { immediate: true },
  );
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useWeather() {
  _ensureWatcher();

  function refresh() {
    const store = useProfileStore();
    if (store.position)
      void fetchWeather(store.position.lat, store.position.lon);
  }

  return { weather, geo, loading, error, refresh };
}

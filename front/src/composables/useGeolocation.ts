import { ref } from 'vue';
import { useProfileStore } from '../stores/profile';

/**
 * Geolocation helper. Call `locate()` to fetch GPS position.
 * On success, stores position with locationMode = 'geo'.
 */
export function useGeolocation() {
  const store = useProfileStore();
  const error = ref<string | null>(null);
  const loading = ref(false);

  function locate() {
    if (!navigator.geolocation) {
      error.value = 'Geolocation is not supported by your browser';
      return;
    }

    loading.value = true;
    error.value = null;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        loading.value = false;
        error.value = null;
        store.setPosition(pos.coords.latitude, pos.coords.longitude, 'geo');
      },
      (err) => {
        loading.value = false;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            error.value =
              'Location access denied. Please enable it in your browser settings.';
            break;
          case err.POSITION_UNAVAILABLE:
            error.value = 'Location unavailable';
            break;
          case err.TIMEOUT:
            error.value = 'Location request timed out';
            break;
          default:
            error.value = 'Unknown geolocation error';
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }

  return { error, loading, locate };
}

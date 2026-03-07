<template>
  <div
    class="flex flex-col items-center justify-center h-full gap-6 text-led font-mono px-6"
  >
    <h1 class="text-2xl font-bold uppercase tracking-widest glow-sm">
      Rain Tracker
    </h1>
    <p class="text-led/70 text-sm text-center max-w-sm">
      To get started, please provide your location. You can either use your GPS
      location or enter it manually in various formats.
    </p>

    <div class="w-full max-w-sm space-y-3">
      <!-- Primary: GPS -->
      <BaseButton
        class="w-full"
        size="md"
        :disabled="geoLoading"
        @click="locate"
      >
        <SpinnerIcon v-if="geoLoading" size="sm" class="mr-1" />
        {{ geoLoading ? 'Locating…' : ' Use my GPS location' }}
      </BaseButton>
      <div v-if="geoError" class="text-red-400 text-xs text-center">
        {{ geoError }}
      </div>

      <!-- Separator -->
      <div
        class="flex items-center gap-3 text-led/40 text-[11px] uppercase tracking-widest"
      >
        <span class="flex-1 h-px bg-led/20" />
        or enter manually
        <span class="flex-1 h-px bg-led/20" />
      </div>

      <!-- Secondary: manual input -->
      <BaseInput
        v-model="locationRaw"
        type="text"
        placeholder="Coordinates or Google Maps link…"
        class="w-full"
        @keydown.enter="submitManual"
      />
      <div v-if="locationRaw && parsed" class="text-xs text-green-400">
        ✓ {{ parsed.lat.toFixed(5) }}, {{ parsed.lng.toFixed(5) }}
      </div>
      <div v-else-if="locationRaw && !parsed" class="text-xs text-red-400">
        Could not parse location
      </div>
      <BaseButton
        variant="ghost"
        class="w-full"
        size="sm"
        :disabled="!parsed"
        @click="submitManual"
      >
        Confirm location
      </BaseButton>

      <details class="text-led/50 text-[11px]">
        <summary
          class="cursor-pointer hover:text-led transition-colors tracking-widest text-center"
        >
          Supported formats
        </summary>
        <ul class="mt-2 space-y-1 font-mono">
          <li v-for="f in LOCATION_FORMATS" :key="f">{{ f }}</li>
        </ul>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import BaseButton from './BaseButton.vue';
import BaseInput from './BaseInput.vue';
import SpinnerIcon from './SpinnerIcon.vue';
import { useGeolocation } from '../composables/useGeolocation';
import { useProfileStore } from '../stores/profile';
import { parseLocation, LOCATION_FORMATS } from '../utils/parseLocation';

const store = useProfileStore();
const { error: geoError, loading: geoLoading, locate } = useGeolocation();

const locationRaw = ref('');
const parsed = computed(() => parseLocation(locationRaw.value));

function submitManual() {
  if (!parsed.value) return;
  store.setPosition(parsed.value.lat, parsed.value.lng, 'manual');
}
</script>

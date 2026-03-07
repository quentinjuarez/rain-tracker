<template>
  <div
    class="flex flex-col gap-3 p-4 w-[min(280px,90vw)] rounded-2xl border border-white/8 bg-black/60 backdrop-blur-2xl"
  >
    <!-- Loading skeleton -->
    <template v-if="loading && !weather">
      <div class="h-4 w-2/5 rounded-lg bg-white/10 animate-pulse" />
      <div class="h-12 w-3/5 rounded-lg bg-white/10 animate-pulse" />
      <div class="h-8 w-full rounded-lg bg-white/10 animate-pulse" />
    </template>

    <template v-else-if="weather">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div
          class="flex items-center gap-1.5 text-xs text-white/50 tracking-wide"
        >
          <span class="text-white/60">⌖</span>
          <span class="text-white/70">{{ geo?.city ?? '—' }}</span>
          <span
            v-if="geo?.country"
            class="text-[9px] border border-white/15 rounded px-1 text-white/35 leading-snug"
          >
            {{ geo.country }}
          </span>
        </div>
        <button
          class="text-white/25 hover:text-white/70 disabled:opacity-20 transition-colors cursor-pointer p-0.5"
          :disabled="loading"
          title="Refresh"
          @click="refresh"
        >
          <SpinnerIcon v-if="loading" size="sm" />
          <span v-else class="text-sm leading-none">↻</span>
        </button>
      </div>

      <!-- Temp + icon -->
      <div class="flex items-center gap-3">
        <span class="text-4xl leading-none">{{ conditionIcon }}</span>
        <div class="flex items-start leading-none">
          <span class="text-5xl font-bold tracking-tight text-white">
            {{ Math.round(weather.current.temperature_2m) }}
          </span>
          <span class="text-lg mt-1 text-white/35">
            {{ weather.current_units.temperature_2m }}
          </span>
        </div>
      </div>

      <!-- Condition -->
      <p class="text-[10px] uppercase tracking-widest text-white/35 -mt-1">
        {{ conditionLabel }}
      </p>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-1 pt-2 border-t border-white/8">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-white/5"
        >
          <span class="text-sm">{{ stat.icon }}</span>
          <span class="text-[11px] font-semibold text-white/85">{{
            stat.value
          }}</span>
          <span class="text-[8px] uppercase tracking-widest text-white/30">{{
            stat.label
          }}</span>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex items-center justify-between border-t border-white/8 pt-1.5"
      >
        <span class="text-[9px] text-white/20 tracking-wide"
          >upd. {{ updatedAt }}</span
        >
        <BaseButton variant="ghost" size="sm" @click="store.clearPosition()">
          change location
        </BaseButton>
      </div>
    </template>

    <!-- Error -->
    <template v-else-if="error">
      <span class="text-lg">⚠</span>
      <p class="text-xs text-red-400/80 m-0">{{ error }}</p>
      <BaseButton variant="ghost" size="sm" @click="refresh">retry</BaseButton>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProfileStore } from '../stores/profile';
import { useWeather } from '../composables/useWeather';
import { decodeWMO } from '../utils/weather';
import SpinnerIcon from './SpinnerIcon.vue';
import BaseButton from './BaseButton.vue';

const store = useProfileStore();
const { weather, geo, loading, error, refresh } = useWeather();

const conditionIcon = computed(() =>
  weather.value ? decodeWMO(weather.value.current.weather_code).icon : '—',
);
const conditionLabel = computed(() =>
  weather.value ? decodeWMO(weather.value.current.weather_code).label : '',
);

const stats = computed(() => {
  if (!weather.value) return [];
  const { current, current_units } = weather.value;
  return [
    {
      icon: '🌡',
      value: `${Math.round(current.apparent_temperature)}${current_units.apparent_temperature}`,
      label: 'feels like',
    },
    {
      icon: '💧',
      value: `${current.relative_humidity_2m}${current_units.relative_humidity_2m}`,
      label: 'humidity',
    },
    {
      icon: '💨',
      value: `${current.wind_speed_10m}${current_units.wind_speed_10m}`,
      label: 'wind',
    },
  ];
});

const updatedAt = computed(() => {
  if (!weather.value?.current?.time) return '—';
  return new Date(weather.value.current.time).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
});
</script>

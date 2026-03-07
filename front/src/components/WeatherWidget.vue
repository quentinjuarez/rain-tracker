<template>
  <div class="flex items-center justify-center w-full h-full">
    <!-- Loading skeleton -->
    <div
      v-if="loading && !weather"
      class="flex flex-col gap-3 p-7 border border-primary/10 rounded-2xl w-[min(360px,90vw)]"
    >
      <div class="h-16 w-3/5 rounded-lg bg-primary/20 animate-pulse" />
      <div class="h-5 w-2/5 rounded-lg bg-primary/20 animate-pulse" />
      <div class="h-10 w-full rounded-lg bg-primary/20 animate-pulse" />
    </div>

    <!-- Data card -->
    <div
      v-else-if="weather"
      class="flex flex-col gap-4 p-7 border border-primary/20 rounded-2xl bg-primary/5 backdrop-blur-md w-[min(360px,90vw)] shadow-[0_8px_32px_color-mix(in_srgb,var(--color-primary)_8%,transparent)]"
    >
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div
          class="flex items-center gap-1.5 text-xs text-primary/70 tracking-wide"
        >
          <span class="text-base">⌖</span>
          <span class="flex items-center gap-1.5">
            {{ geo?.city ?? '—' }}
            <span
              v-if="geo?.country"
              class="text-[10px] border border-current rounded px-0.5 opacity-50 leading-snug"
            >
              {{ geo.country }}
            </span>
          </span>
        </div>
        <button
          class="text-primary/50 hover:text-primary disabled:opacity-30 transition-opacity text-lg leading-none px-1 cursor-pointer"
          :disabled="loading"
          title="Refresh"
          @click="refresh"
        >
          <SpinnerIcon v-if="loading" size="sm" />
          <span v-else>↻</span>
        </button>
      </div>

      <!-- Main temp -->
      <div class="flex items-center gap-5">
        <span
          class="text-6xl leading-none drop-shadow-[0_0_8px_rgba(255,255,255,.2)]"
        >
          {{ conditionIcon }}
        </span>
        <div class="flex items-start leading-none">
          <span class="text-7xl font-bold tracking-tight text-primary">
            {{ Math.round(weather.current.temperature_2m) }}
          </span>
          <span class="text-2xl mt-1.5 text-primary/60">
            {{ weather.current_units.temperature_2m }}
          </span>
        </div>
      </div>

      <!-- Condition label -->
      <p class="text-sm uppercase tracking-widest text-primary/50 -mt-2">
        {{ conditionLabel }}
      </p>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-2 pt-2 border-t border-primary/10">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl bg-primary/5"
        >
          <span class="text-base">{{ stat.icon }}</span>
          <span class="text-sm font-semibold text-primary">{{
            stat.value
          }}</span>
          <span class="text-[10px] uppercase tracking-widest text-primary/40">{{
            stat.label
          }}</span>
        </div>
      </div>

      <!-- 48h forecast strip -->
      <div class="flex flex-col gap-2 pt-2 border-t border-primary/10">
        <p class="text-[10px] uppercase tracking-widest text-primary/40">
          48h forecast
        </p>
        <div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <div
            v-for="slot in forecast48"
            :key="slot.time"
            class="flex flex-col items-center gap-1 min-w-[52px] py-2 px-1 rounded-xl bg-primary/5 shrink-0"
          >
            <span class="text-[10px] text-primary/50 tabular-nums">{{
              slot.hour
            }}</span>
            <span class="text-lg leading-none">{{ slot.icon }}</span>
            <span class="text-xs font-semibold text-primary"
              >{{ slot.temp }}°</span
            >
            <span class="text-[10px] text-primary/40">{{ slot.precip }}%</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex items-center justify-between pt-1 border-t border-primary/10"
      >
        <span class="text-[11px] text-primary/30 tracking-wide"
          >updated {{ updatedAt }}</span
        >
        <BaseButton variant="ghost" size="sm" @click="store.clearPosition()">
          change location
        </BaseButton>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="flex flex-col items-center gap-3 p-8 border border-red-400/30 rounded-2xl w-[min(360px,90vw)]"
    >
      <span class="text-2xl">⚠</span>
      <p class="text-sm text-red-400/80 text-center m-0">{{ error }}</p>
      <BaseButton variant="ghost" size="sm" @click="refresh">retry</BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProfileStore } from '../stores/profile';
import { useWeather } from '../composables/useWeather';
import SpinnerIcon from './SpinnerIcon.vue';
import BaseButton from './BaseButton.vue';

const store = useProfileStore();
const { weather, geo, loading, error, refresh } = useWeather();

// WMO weather code → emoji + label
function decodeWMO(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: 'Clear Sky' };
  if (code === 1) return { icon: '🌤️', label: 'Mainly Clear' };
  if (code === 2) return { icon: '⛅', label: 'Partly Cloudy' };
  if (code === 3) return { icon: '☁️', label: 'Overcast' };
  if (code <= 48) return { icon: '�', label: 'Foggy' };
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
  const d = new Date(weather.value.current.time);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

// 48h forecast — one slot every 3h, skipping past hours
const forecast48 = computed(() => {
  if (!weather.value?.hourly) return [];
  const { time, temperature_2m, weather_code, precipitation_probability } =
    weather.value.hourly;
  const now = Date.now();
  return time
    .map((t, i) => ({ t, i }))
    .filter(({ t, i }) => new Date(t).getTime() >= now && i % 3 === 0)
    .slice(0, 16)
    .map(({ t, i }) => ({
      time: t,
      hour: new Date(t).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      icon: decodeWMO(weather_code[i]).icon,
      temp: Math.round(temperature_2m[i]),
      precip: precipitation_probability[i] ?? 0,
    }));
});
</script>

<template>
  <div class="w-full px-4 pb-4">
    <BaseCard class="px-4 py-3">
      <!-- Loading skeleton -->
      <div v-if="loading && !weather" class="flex gap-3">
        <div
          v-for="i in 8"
          :key="i"
          class="h-20 w-14 shrink-0 rounded-xl bg-white/10 animate-pulse"
        />
      </div>

      <template v-else-if="weather">
        <!-- Header row -->
        <div class="flex items-center justify-between mb-2">
          <p class="text-[9px] uppercase tracking-widest text-white/40">
            48h forecast
          </p>
          <span class="text-[9px] text-white/25 tracking-wide">{{
            timezone
          }}</span>
        </div>
        <!-- Slots -->
        <div class="flex gap-2 overflow-x-auto no-scrollbar">
          <div
            v-for="slot in forecast48"
            :key="slot.time"
            class="flex flex-col items-center gap-1 min-w-[52px] py-2 px-1 rounded-xl shrink-0 transition-colors"
            :class="
              slot.isNow ? 'bg-white/10 ring-1 ring-white/10' : 'bg-white/5'
            "
          >
            <span
              class="text-[9px] tabular-nums leading-none"
              :class="
                slot.isNow ? 'text-white/80 font-semibold' : 'text-white/35'
              "
            >
              {{ slot.isNow ? 'now' : slot.hour }}
            </span>
            <span class="text-xl leading-none mt-0.5">{{ slot.icon }}</span>
            <span class="text-xs font-semibold text-white/90"
              >{{ slot.temp }}°</span
            >
            <!-- Precip bar -->
            <div class="w-full px-2 mt-0.5">
              <div
                class="h-0.5 w-full rounded-full bg-white/10 overflow-hidden"
              >
                <div
                  class="h-full rounded-full transition-all"
                  :class="slot.precip >= 40 ? 'bg-sky-400/70' : 'bg-white/20'"
                  :style="{ width: `${slot.precip}%` }"
                />
              </div>
            </div>
            <span
              class="text-[9px] tabular-nums"
              :class="slot.precip >= 40 ? 'text-sky-400/80' : 'text-white/25'"
            >
              {{ slot.precip }}%
            </span>
          </div>
        </div>
      </template>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useWeather } from '../composables/useWeather';
import { decodeWMO } from '../utils/weather';
import BaseCard from './BaseCard.vue';

const { weather, loading } = useWeather();

const timezone = computed(
  () => weather.value?.timezone?.replace('_', ' ') ?? '',
);

const forecast48 = computed(() => {
  if (!weather.value?.hourly) return [];
  const { time, temperature_2m, weather_code, precipitation_probability } =
    weather.value.hourly;
  const now = Date.now();
  // First upcoming slot index (closest to now)
  const firstIdx = time.findIndex(
    (t) => new Date(t).getTime() >= now - 30 * 60 * 1000,
  );

  return time
    .map((t, i) => ({ t, i }))
    .filter(({ t, i }) => {
      if (i < Math.max(firstIdx, 0)) return false;
      const h = new Date(t).getHours();
      return h >= 8; // skip 00:00–07:59
    })
    .slice(0, 48)
    .map(({ t, i }, idx) => ({
      time: t,
      hour: new Date(t).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      icon: decodeWMO(weather_code[i]).icon,
      temp: Math.round(temperature_2m[i]),
      precip: precipitation_probability[i] ?? 0,
      isNow: idx === 0,
    }));
});
</script>

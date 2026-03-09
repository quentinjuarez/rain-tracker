<template>
  <BaseCard class="flex flex-col gap-2 px-3 py-2.5 w-36">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <span
        class="text-[10px] uppercase tracking-widest text-white/40 font-semibold"
        >Nowcast</span
      >
      <button
        class="w-4 h-4 flex items-center justify-center text-white/40 hover:text-white/80 transition"
        @click="togglePlay"
        :title="playing ? 'Pause' : 'Play'"
      >
        <svg
          v-if="!playing"
          fill="currentColor"
          viewBox="0 0 16 16"
          class="w-3 h-3"
        >
          <path d="M3 2.5v11L13 8z" />
        </svg>
        <svg v-else fill="currentColor" viewBox="0 0 16 16" class="w-3 h-3">
          <rect x="3" y="2" width="3.5" height="12" rx="1" />
          <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
        </svg>
      </button>
    </div>

    <!-- Error -->
    <div
      v-if="error"
      class="text-[10px] text-red-400/80 bg-red-500/10 rounded px-1.5 py-1"
    >
      {{ error }}
    </div>

    <!-- Loading skeleton -->
    <div v-else-if="loading && !frames.length" class="flex flex-col gap-1">
      <div
        v-for="i in 6"
        :key="i"
        class="h-4 rounded bg-white/10 animate-pulse"
      />
    </div>

    <!-- Frame list -->
    <div v-else class="flex flex-col gap-0.5">
      <div
        v-for="(f, i) in frames"
        :key="f.time"
        class="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors duration-300"
        :class="i === activeIndex ? 'bg-white/10' : ''"
      >
        <span
          class="inline-block w-1 h-1 rounded-full shrink-0 transition-all duration-300"
          :class="i === activeIndex ? 'bg-white/80 scale-125' : 'bg-white/20'"
        />
        <span
          class="text-[11px] font-mono transition-colors duration-300"
          :class="i === activeIndex ? 'text-white' : 'text-white/40'"
        >
          {{
            new Date(f.time * 1000).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: locationTimezone,
            })
          }}
        </span>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { useRainSync } from '../composables/useRainSync';
import { locationTimezone } from '../composables/useWeather';
import BaseCard from './BaseCard.vue';

const { frames, activeIndex, loading, error, playing, togglePlay, dispose } =
  useRainSync();

onBeforeUnmount(() => dispose());
</script>

<template>
  <div
    class="flex flex-col gap-2 px-3 py-2.5 rounded-2xl backdrop-blur border border-white/10 w-36"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <span
          class="text-[10px] uppercase tracking-widest text-white/40 font-semibold"
          >Radar</span
        >
        <button
          class="text-[9px] px-1 py-0.5 rounded font-mono transition"
          :class="
            devMode
              ? 'bg-amber-400/30 text-amber-300'
              : 'bg-white/10 text-white/30 hover:text-white/60'
          "
          @click="devMode = !devMode"
        >
          DEV
        </button>
      </div>
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

    <!-- Loading skeleton -->
    <div v-if="loading && !radarFrames.length" class="flex flex-col gap-1">
      <div
        v-for="i in 6"
        :key="i"
        class="h-4 rounded bg-white/10 animate-pulse"
      />
    </div>

    <!-- Frame rows -->
    <div v-else class="flex flex-col gap-0.5">
      <div
        v-for="(f, i) in radarFrames"
        :key="f.time"
        class="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors duration-300"
        :class="i === activeIndex ? 'bg-white/8' : ''"
      >
        <span
          class="inline-block w-1 h-1 rounded-full shrink-0 transition-all duration-300"
          :class="i === activeIndex ? 'bg-blue-400 scale-125' : 'bg-white/20'"
        />
        <span
          class="text-[11px] font-mono transition-colors duration-300"
          :class="i === activeIndex ? 'text-white' : 'text-white/40'"
        >
          {{
            new Date(f.time * 1000).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })
          }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { useRainSync } from '../composables/useRainSync';

const {
  devMode,
  activeIndex,
  radarFrames,
  loading,
  playing,
  togglePlay,
  dispose,
} = useRainSync();

onBeforeUnmount(() => dispose());
</script>

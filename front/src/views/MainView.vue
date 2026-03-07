<template>
  <div class="relative w-dvw h-dvh overflow-hidden bg-gray-900">
    <!-- Full-screen rain map (background) -->
    <div v-if="hasPosition" class="absolute inset-0">
      <RainMap />
    </div>

    <!-- Onboarding — centred -->
    <div
      v-if="!hasPosition"
      class="absolute inset-0 flex items-center justify-center"
    >
      <OnboardingScreen />
    </div>

    <!-- HUD overlays -->
    <template v-else>
      <!-- Current weather — top right -->
      <div class="absolute top-4 right-4 z-1000">
        <WeatherCurrent />
      </div>
      <!-- 48h forecast — bottom full width -->
      <div class="absolute bottom-0 left-0 right-0 z-1000">
        <WeatherForecast />
      </div>
      <!-- Rain timeline — top left -->
      <div class="absolute top-4 left-4 z-1000">
        <RainTimeline />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProfileStore } from '../stores/profile';
import OnboardingScreen from '../components/OnboardingScreen.vue';
import WeatherCurrent from '../components/WeatherCurrent.vue';
import WeatherForecast from '../components/WeatherForecast.vue';
import RainMap from '../components/RainMap.vue';
import RainTimeline from '../components/RainTimeline.vue';

const store = useProfileStore();
const hasPosition = computed(() => store.hasPosition);
</script>

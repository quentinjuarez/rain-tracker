<template>
  <div class="relative w-dvw h-dvh overflow-hidden bg-gray-900">
    <!-- Background glow -->
    <div class="bg-glow" />
    <!-- Full-screen map placeholder (future) -->
    <div class="absolute inset-0" />

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
      <div class="absolute top-4 right-4">
        <WeatherCurrent />
      </div>
      <!-- 48h forecast — bottom full width -->
      <div class="absolute bottom-0 left-0 right-0">
        <WeatherForecast />
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

const store = useProfileStore();
const hasPosition = computed(() => store.hasPosition);
</script>

<style scoped>
.bg-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 60% 50% at 50% 50%,
    color-mix(in srgb, var(--color-primary) 8%, transparent),
    transparent 70%
  );
  pointer-events: none;
}
</style>

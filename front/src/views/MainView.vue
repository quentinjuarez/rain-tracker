<template>
  <div
    class="relative w-dvw h-dvh overflow-hidden bg-gray-900 flex items-center justify-center"
  >
    <!-- Background glow -->
    <div class="bg-glow" />
    <OnboardingScreen v-if="!hasPosition" />
    <WeatherWidget v-else />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProfileStore } from '../stores/profile';
import OnboardingScreen from '../components/OnboardingScreen.vue';
import WeatherWidget from '../components/WeatherWidget.vue';

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

<template>
  <div
    class="flex flex-col items-center justify-center h-full gap-6 text-white font-mono px-6"
  >
    <h1 class="text-2xl font-bold uppercase tracking-widest glow-sm">
      Rain Tracker
    </h1>
    <p class="text-white/70 text-sm text-center max-w-sm">
      To get started, please provide your location. You can either use your GPS
      location or enter it manually in various formats.
    </p>

    <div class="w-full max-w-sm">
      <LocationPicker is-onboarding />
    </div>
  </div>
</template>

<script setup lang="ts">
import LocationPicker from './LocationPicker.vue';
</script>

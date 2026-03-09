<template>
  <div class="space-y-1">
    <div class="flex justify-between text-xs">
      <span>{{ label }}</span>
      <span class="text-white/50">{{ displayValue }}</span>
    </div>
    <input
      type="range"
      :value="model"
      :min="min"
      :max="max"
      :step="step ?? 1"
      class="slider w-full"
      @input="model = Number(($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  displayValue: string;
  min: number;
  max: number;
  step?: number;
}>();

const model = defineModel<number>({ required: true });
</script>

<style scoped>
.slider {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  outline: none;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
}
.slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  border: none;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
}
</style>

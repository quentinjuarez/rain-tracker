<template>
  <div
    class="w-full bg-black/80 border border-white/20 text-white text-sm pr-2 font-mono rounded-lg focus:border-white/60 focus:outline-none cursor-pointer"
  >
    <select v-model="model" class="w-full h-full px-3 py-2">
      <slot />
    </select>
  </div>
</template>

<script setup lang="ts">
const model = defineModel<string>();
</script>

<style scoped>
option {
  background: #000;
  color: #fff;
}
</style>

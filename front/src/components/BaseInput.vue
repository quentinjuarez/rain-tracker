<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'sm' | 'md';
  }>(),
  {
    size: 'md',
  },
);

const model = defineModel<string>();
</script>

<template>
  <input
    v-model="model"
    :class="[
      'bg-black border border-primary/80 text-primary font-mono rounded-lg focus:border-primary focus:outline-none placeholder:text-primary/80',
      {
        'text-sm px-4 py-2.5': size === 'md',
        'text-xs px-3 py-1.5': size === 'sm',
      },
    ]"
  />
</template>

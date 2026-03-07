<template>
  <button
    type="button"
    class="flex items-center justify-center gap-1"
    :class="[
      'rounded-lg transition-colors backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider',
      {
        // sizes
        'text-sm px-4 py-2.5': size === 'md',
        'text-xs px-3 py-1.5': size === 'sm',
        // variants
        'bg-led text-black hover:bg-led/80': variant === 'default',
        'border border-led/80 text-led hover:bg-led/10 bg-black/10':
          variant === 'ghost',
        'bg-red-400 text-white hover:bg-red-400/80': variant === 'danger',
        'border border-red-400 text-red-400 hover:bg-red-400/20':
          variant === 'danger-ghost',
      },
    ]"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'default' | 'ghost' | 'danger' | 'danger-ghost';
    size?: 'sm' | 'md';
  }>(),
  {
    variant: 'default',
    size: 'md',
  },
);
</script>

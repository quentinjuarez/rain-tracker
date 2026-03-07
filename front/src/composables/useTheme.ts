import { ref, watch } from 'vue';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'rain-tracker-theme';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

const theme = ref<Theme>(getInitialTheme());

function applyTheme(t: Theme) {
  const html = document.documentElement;
  html.classList.toggle('light', t === 'light');
  html.classList.toggle('dark', t === 'dark');
}

// Apply immediately (before first render)
applyTheme(theme.value);

watch(theme, (t) => {
  applyTheme(t);
  localStorage.setItem(STORAGE_KEY, t);
});

export function useTheme() {
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }

  return {
    theme,
    toggleTheme,
    isDark: () => theme.value === 'dark',
  };
}

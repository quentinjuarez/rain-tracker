<template>
  <div class="relative w-full h-full">
    <div ref="mapEl" class="absolute inset-0" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useProfileStore } from '../stores/profile';
import { useRainSync } from '../composables/useRainSync';

const store = useProfileStore();
const { snapshot, frames, activeIndex, dispose } = useRainSync();

const mapEl = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let rainLayer: L.TileLayer | null = null;

// ── Tile URL ──────────────────────────────────────────────────────────

function rainTileUrl(snap: number, forecastOffset: number): string {
  return `http://localhost:14001/rain/rainbow/tile/${snap}/${forecastOffset}/{z}/{x}/{y}`;
}

// ── Frame display ─────────────────────────────────────────────────────

function showFrame(index: number) {
  if (!map || !frames.value.length) return;
  const frame = frames.value[index];
  if (!frame) return;

  if (rainLayer) {
    map.removeLayer(rainLayer);
    rainLayer = null;
  }

  rainLayer = L.tileLayer(rainTileUrl(snapshot.value, frame.forecastOffset), {
    opacity: 0.8,
    zIndex: 10,
    maxZoom: 18,
    maxNativeZoom: 12,
    attribution: '<a href="https://rainbow.ai">Rainbow Weather</a>',
  });
  rainLayer.addTo(map);
}

// ── Watchers ──────────────────────────────────────────────────────────

watch(activeIndex, (i) => showFrame(i));

// When a new snapshot is fetched, reload the current frame with new tiles
watch(snapshot, () => showFrame(activeIndex.value));

watch(frames, () => showFrame(activeIndex.value));

// ── Map init ──────────────────────────────────────────────────────────

function initMap(lat: number, lon: number) {
  if (!mapEl.value || map) return;

  map = L.map(mapEl.value, {
    center: [lat, lon],
    zoom: 12,
    zoomControl: false,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '© <a href="https://carto.com">CARTO</a> © <a href="https://openstreetmap.org">OSM</a>',
    maxZoom: 19,
    maxNativeZoom: 19,
  }).addTo(map);

  L.marker([lat, lon], {
    icon: L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:rgba(96,165,250,0.9);border:2px solid white;box-shadow:0 0 0 4px rgba(96,165,250,0.3)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    }),
    zIndexOffset: 100,
  }).addTo(map);

  showFrame(activeIndex.value);
}

// ── Lifecycle ─────────────────────────────────────────────────────────

onMounted(() => {
  const pos = store.position;
  if (pos) initMap(pos.lat, pos.lon);
});

watch(
  () => store.position,
  (pos) => {
    if (!pos) return;
    if (!map) initMap(pos.lat, pos.lon);
    else map.setView([pos.lat, pos.lon], 12);
  },
);

onBeforeUnmount(() => {
  dispose();
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

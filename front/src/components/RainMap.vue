<template>
  <div class="relative w-full h-full">
    <!-- Leaflet map container -->
    <div ref="mapEl" class="absolute inset-0" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useProfileStore } from '../stores/profile';
import { useRainSync } from '../composables/useRainSync';
import { mmToRgb } from '../utils/rainScale';

const store = useProfileStore();
const { devMode, activeIndex, radarFrames, mockMapFrames, dispose } =
  useRainSync();

const mapEl = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let rainLayer: L.TileLayer | null = null;

// ── Canvas rain renderer ──────────────────────────────────────────────

type RainCell = { lat: number; lon: number; radius: number; mm: number };

class RainCanvasLayer extends L.Layer {
  private _canvas: HTMLCanvasElement | null = null;
  private _cells: RainCell[] = [];
  private _mapRef: L.Map | null = null;

  onAdd(map: L.Map): this {
    this._mapRef = map;
    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText =
      'position:absolute;top:0;left:0;pointer-events:none;';
    map.getPanes().overlayPane!.appendChild(this._canvas);
    map.on('moveend zoomend viewreset resize', this._redraw, this);
    this._redraw();
    return this;
  }

  onRemove(map: L.Map): this {
    this._canvas?.remove();
    this._canvas = null;
    this._mapRef = null;
    map.off('moveend zoomend viewreset resize', this._redraw, this);
    return this;
  }

  update(cells: RainCell[]) {
    this._cells = cells;
    this._redraw();
  }

  clear() {
    this._cells = [];
    this._redraw();
  }

  private _metersToPixels(map: L.Map, meters: number, lat: number): number {
    const p1 = map.latLngToLayerPoint([lat, 0]);
    const p2 = map.latLngToLayerPoint([lat, 0.01]);
    const degLen = Math.abs(p2.x - p1.x);
    const metersPer001Deg = 0.01 * Math.cos((lat * Math.PI) / 180) * 111_320;
    return (meters / metersPer001Deg) * degLen;
  }

  private _redraw() {
    const map = this._mapRef;
    const canvas = this._canvas;
    if (!map || !canvas) return;

    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;

    const origin = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, origin);

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size.x, size.y);

    for (const cell of this._cells) {
      const pt = map.latLngToLayerPoint([cell.lat, cell.lon]);
      const rpx = this._metersToPixels(map, cell.radius, cell.lat);
      const [r, g, b] = mmToRgb(cell.mm);
      const alpha = Math.min(0.72, 0.12 + cell.mm / 14);

      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rpx);
      grad.addColorStop(0, `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
      grad.addColorStop(
        0.45,
        `rgba(${r},${g},${b},${(alpha * 0.55).toFixed(3)})`,
      );
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, rpx, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }
}

// ── DEV mock ─────────────────────────────────────────────────────────

let canvasLayer: RainCanvasLayer | null = null;

function showMockFrame(index: number) {
  if (!canvasLayer) return;
  const pos = store.position;
  if (!pos) return;
  const f = mockMapFrames.value[index];
  if (!f) return;
  canvasLayer.update(
    f.cells.map(({ dlat, dlon, radius, mm }) => ({
      lat: pos.lat + dlat,
      lon: pos.lon + dlon,
      radius,
      mm,
    })),
  );
}

// ── RainViewer tile display ───────────────────────────────────────────

function rainTileUrl(path: string): string {
  return `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/2/1_1.png`;
}

function showRadarFrame(index: number) {
  if (!map || !radarFrames.value.length) return;
  const frame = radarFrames.value[index];
  if (!frame) return;
  if (rainLayer) {
    map.removeLayer(rainLayer);
    rainLayer = null;
  }
  rainLayer = L.tileLayer(rainTileUrl(frame.path), {
    opacity: 0.8,
    zIndex: 10,
    minZoom: 0,
    maxNativeZoom: 7, // RainViewer max supported zoom is 7
    maxZoom: 18,
    attribution: '<a href="https://rainviewer.com">RainViewer</a>',
  });
  rainLayer.addTo(map);
}

function showFrame(index: number) {
  if (!radarFrames.value.length) return;
  const i = index % radarFrames.value.length;
  if (devMode.value) showMockFrame(i);
  else showRadarFrame(i);
}

// ── Watchers ─────────────────────────────────────────────────────────

// Advance displayed frame whenever the shared index changes
watch(activeIndex, (i) => showFrame(i));

// Show latest frame when radarFrames are loaded/updated by useRainSync
watch(radarFrames, () => {
  if (rainLayer && map) {
    map.removeLayer(rainLayer);
    rainLayer = null;
  }
  canvasLayer?.clear();
  showFrame(activeIndex.value);
});

// ── Map init ─────────────────────────────────────────────────────────

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

  canvasLayer = new RainCanvasLayer();
  canvasLayer.addTo(map);

  // Show current frame (data already fetched by useRainSync)
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

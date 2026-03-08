import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = process.env.PORT || 14001;

// ── Security ───────────────────────────────────────────────────────

app.use(helmet());
app.disable('x-powered-by');

// CORS: restrict origins in production
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : null; // null = allow all in dev

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server, same-origin)
      if (!origin) return callback(null, true);
      if (!ALLOWED_ORIGINS) return callback(null, true); // dev: allow all
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET'],
    optionsSuccessStatus: 200,
  }),
);

// Simple in-memory cache - { data, expiresAt }
const cache = new Map();

function setCache(key, data, ttlSeconds = 30) {
  cache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}
function getCache(key) {
  if (process.env.DISABLED_CACHE === 'true') return null;

  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(key);
    return null;
  }
  return e.data;
}

// ── Health check ───────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── Weather proxy (Open-Meteo) ─────────────────────────────────────

app.get('/weather', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res
      .status(400)
      .json({ error: 'lat and lon query params are required' });
  }

  // Snap to ~10 km grid (0.1° ≈ 11 km) to maximise cache hits
  const rLat = Number(lat).toFixed(1);
  const rLon = Number(lon).toFixed(1);

  const cacheKey = `weather:${rLat}:${rLon}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${rLat}&longitude=${rLon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
      `&hourly=temperature_2m,weather_code,precipitation_probability,precipitation` +
      `&past_hours=3&forecast_hours=48&wind_speed_unit=ms&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open-Meteo error: ${response.status}`);
    const data = await response.json();

    setCache(cacheKey, data, 300); // 5 min TTL
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

// ── Reverse geocoding proxy (Nominatim) ────────────────────────────

app.get('/geocode', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res
      .status(400)
      .json({ error: 'lat and lon query params are required' });
  }

  // Snap to ~10 km grid (0.1° ≈ 11 km) to maximise cache hits
  const rLat = Number(lat).toFixed(1);
  const rLon = Number(lon).toFixed(1);

  const cacheKey = `geocode:${rLat}:${rLon}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${rLat}&lon=${rLon}&format=json&zoom=10&addressdetails=1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'rain-tracker/1.0' },
    });
    if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);
    const data = await response.json();

    const payload = {
      city:
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.county ||
        data.display_name?.split(',')[0] ||
        'Unknown',
      country: data.address?.country_code?.toUpperCase() ?? '',
    };

    setCache(cacheKey, payload, 3600); // 1 h TTL
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch location name' });
  }
});

// ── Rainbow proxy ─────────────────────────────────────────────────

app.get('/rain/rainbow/snapshot', async (req, res) => {
  const apiKey = process.env.RAINBOW_API_KEY;
  if (!apiKey)
    return res.status(503).json({ error: 'RAINBOW_API_KEY not configured' });

  const cached = getCache('rainbow:snapshot');
  if (cached) return res.json(cached);

  try {
    const response = await fetch('https://api.rainbow.ai/tiles/v1/snapshot', {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });
    if (!response.ok)
      throw new Error(`Rainbow snapshot error: ${response.status}`);
    const data = await response.json();
    console.log('[rainbow] snapshot:', data.snapshot);
    setCache('rainbow:snapshot', data, 600); // 10 min
    res.json(data);
  } catch (err) {
    console.error('[rainbow] snapshot error:', err);
    res.status(500).json({ error: 'Failed to fetch Rainbow snapshot' });
  }
});

app.get(
  '/rain/rainbow/tile/:snapshot/:forecastTime/:z/:x/:y',
  async (req, res) => {
    const { snapshot, forecastTime, z, x, y } = req.params;

    const apiKey = process.env.RAINBOW_API_KEY;
    if (!apiKey) return res.status(503).send('RAINBOW_API_KEY not configured');

    const cacheKey = `tile:${snapshot}:${forecastTime}:${z}:${x}:${y}`;
    const cached = getCache(cacheKey);
    if (cached) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.setHeader('X-Cache', 'HIT');
      return res.send(cached);
    }

    try {
      const url = `https://api.rainbow.ai/tiles/v1/precip/${snapshot}/${forecastTime}/${z}/${x}/${y}?color=0`;
      const response = await fetch(url, {
        headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      });

      if (!response.ok) {
        return res.status(response.status).send('Tile fetch error');
      }

      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      setCache(cacheKey, imageBuffer, 600); // 10 min TTL

      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.setHeader('X-Cache', 'MISS');
      res.send(imageBuffer);
    } catch (err) {
      console.error('[rainbow] tile error:', err);
      res.status(500).send('Failed to proxy tile');
    }
  },
);

// ── 404 handler ────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error handler ──────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: origin not allowed' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

const PORT_NUM = Number(PORT);

app.listen(PORT_NUM, () =>
  console.log(`server running on http://localhost:${PORT_NUM}`),
);

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 14001;

// ── Security ───────────────────────────────────────────────────────

// Helmet: secure HTTP headers
app.use(helmet());

// Disable X-Powered-By (also done by helmet, belt & suspenders)
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

// Rate limiting: 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

const PORT_NUM = Number(PORT);
const DISABLED_CACHE = true;

// Simple in-memory cache - { data, expiresAt }
const cache = new Map();

function setCache(key, data, ttlSeconds = 30) {
  cache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}
function getCache(key) {
  if (DISABLED_CACHE) return null;

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

  const cacheKey = `weather:${Number(lat).toFixed(2)}:${Number(lon).toFixed(2)}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
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

  const cacheKey = `geocode:${Number(lat).toFixed(2)}:${Number(lon).toFixed(2)}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`;

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

// ── Rain: Rainbow Weather nowcast proxy ────────────────────────────
// Minute-by-minute precipitation for the next 4 hours.
// 10 min cache to stay within the 1000 req/day free quota.

app.get('/rain/rainbow', async (req, res) => {
  console.log('CICICICICICI');
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res
      .status(400)
      .json({ error: 'lat and lon query params are required' });
  }

  const apiKey =
    process.env.RAINBOW_API_KEY || '668373194f67495d910e8372b7b088fe';
  if (!apiKey) {
    return res.status(503).json({ error: 'RAINBOW_API_KEY not configured' });
  }

  const cacheKey = `rainbow:${Number(lat).toFixed(3)}:${Number(lon).toFixed(3)}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `https://api.rainbow.ai/nowcast/v1/precip/${Number(lon)}/${Number(lat)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error(`Rainbow API error: ${response.status}`);
    const data = await response.json();

    console.log({ data });

    setCache(cacheKey, data, 600); // 10 min – stay within daily quota
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch Rainbow nowcast data' });
  }
});

// ── Rain: OpenWeatherMap forecast proxy ────────────────────────────
// 5-day / 3-hour forecast (free tier). Used for timeline bars.

app.get('/rain/owm', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res
      .status(400)
      .json({ error: 'lat and lon query params are required' });
  }

  const apiKey = process.env.OWM_API_KEY || '0d24f288c1ea9e704b3e27b807e8b6ff';
  if (!apiKey) {
    return res.status(503).json({ error: 'OWM_API_KEY not configured' });
  }

  const cacheKey = `owm:${Number(lat).toFixed(3)}:${Number(lon).toFixed(3)}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url =
      `https://api.openweathermap.org/data/2.5/forecast` +
      `?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&cnt=16`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OWM API error: ${response.status}`);
    const data = await response.json();

    setCache(cacheKey, data, 600); // 10 min
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch OWM forecast data' });
  }
});

// ── Rain: OpenWeatherMap precipitation tile proxy ──────────────────
// Proxies OWM map tiles so the API key stays server-side.
// Higher rate limit because one map view loads dozens of tiles.

// const tileLimiter = rateLimit({
//   windowMs: 60 * 1000,
//   max: 600,
//   standardHeaders: true,
//   legacyHeaders: false,
// });

app.get('/rain/owm/tile/:z/:x/:y', async (req, res) => {
  const { z, x, y } = req.params;

  const apiKey = process.env.OWM_API_KEY;
  if (!apiKey) return res.status(503).send('OWM_API_KEY not configured');

  try {
    const url = `https://tile.openweathermap.org/map/precipitation_new/${z}/${x}/${y}.png?appid=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok)
      return res.status(response.status).send('Tile fetch error');

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=600');
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to proxy tile');
  }
});

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

app.listen(PORT_NUM, () =>
  console.log(`server running on http://localhost:${PORT_NUM}`),
);

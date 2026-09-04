require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const connectDB = require('./config/db');
const fetchCurrentAffairs = require('./jobs/fetchCurrentAffairs');

const authRoutes = require('./routes/authRoutes');
const classRoutes = require('./routes/classRoutes');
const studentRoutes = require('./routes/studentRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const currentAffairRoutes = require('./routes/currentAffairRoutes');

const app = express();

// Express auto-generates an ETag for every JSON response by default. On a
// repeated identical request the browser then gets a bare 304 back, which
// can confuse a plain fetch() client into thinking the request failed
// (seen as "Could not load holidays/classes right now" even though the
// data is fine). API responses should always be fresh, not cached, so we
// turn this off entirely for this app.
app.disable('etag');

app.use(express.json());

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true
}));

// Belt-and-braces: explicitly tell the browser never to cache /api responses.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/current-affairs', currentAffairRoutes);

// 404 fallback for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

// Generic error handler (catches anything thrown/rejected that a route missed)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Vikash Academy API running on port ${PORT}`));

  // Fetch current affairs once at startup (so the list isn't empty on a
  // fresh deploy/restart), then every day at 6:00 AM server time.
  fetchCurrentAffairs();
  cron.schedule('0 6 * * *', fetchCurrentAffairs);
});
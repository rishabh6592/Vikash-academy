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

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 5000;

// Server ko turant start karo, DB connection ka wait mat karo.
// Isse Render ko port turant mil jayega, chahe DB connect ho raha ho ya fail ho jaye.
app.listen(PORT, () => console.log(`Vikash Academy API running on port ${PORT}`));

connectDB()
  .then(() => {
    console.log('MongoDB connected');
    fetchCurrentAffairs();
    cron.schedule('0 6 * * *', fetchCurrentAffairs);
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
  });
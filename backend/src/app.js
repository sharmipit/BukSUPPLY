const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(helmet());

// Allow both localhost and 127.0.0.1 origins during development
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  'http://127.0.0.1:5500',
  'http://localhost:5500',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);

// 404 for unknown routes
app.use((_req, res) => res.status(404).json({ success: false, message: 'Not found.' }));

// Last-resort error handler
app.use((err, _req, res, _next) => {
  const status = err.status && err.status < 500 ? err.status : 500;
  res.status(status).json({
    success: false,
    message: status === 400 ? 'Invalid request body.' : 'Something went wrong.',
  });
});

module.exports = app;
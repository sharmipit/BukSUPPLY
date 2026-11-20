require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const settings = require('./services/settings');

const app = express();

// Trust Proxy
app.set('trust proxy', 1);

// CORS Configuration
const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

const envOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (mobile apps, curl, postman, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || origin.endsWith('.google.com')) {
        return callback(null, true);
      }

      console.warn(`[cors] blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Settings-Token'],
    exposedHeaders: ['Content-Disposition'],
  })
);

// Core Middleware
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/admin/users', require('./routes/adminUserRoutes'));
app.use('/api/admin/settings', require('./routes/settings'));
app.use('/api/requisitions', require('./routes/requisitionRoutes'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/activity', require('./routes/activityLogRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));

// Public configuration for client sign-in (non-sensitive values)
app.get('/api/public-config', (req, res) => {
  const s = settings.get();
  res.json({
    googleEnabled: s.googleEnabled && !!s.googleClientId,
    googleClientId: s.googleClientId,
    recaptchaEnabled: s.recaptchaEnabled && !!s.recaptchaSiteKey,
    recaptchaSiteKey: s.recaptchaSiteKey,
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'buksupply-backend' });
});

// Unknown API routes handler
app.use('/api', (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// --- Global Error Handler ---
app.use(require('./middleware/errorHandler'));

// --- Start Server ---
const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`BukSUPPLY server running on port ${PORT}`);
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
  });

  // Fail loudly if an old process still owns the port
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Kill the old process and restart.`);
      process.exit(1);
    }
    throw err;
  });
});

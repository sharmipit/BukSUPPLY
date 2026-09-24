const rateLimit = require('express-rate-limit');

// 30 requests / 15 minutes per IP on every auth endpoint
module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});
/**
 * Centralized error handler — register last in server.js.
 *
 * Handles:
 *   - CORS rejections (from the cors() middleware)
 *   - Malformed JSON bodies (entity.parse.failed)
 *   - Operational AppError instances (thrown by controllers/services)
 *   - Unexpected errors (fallback 500)
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Origin not allowed by CORS.' });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON body.' });
  }

  if (err.isOperational && err.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
};

module.exports = errorHandler;

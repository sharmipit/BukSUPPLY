require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/database/connection');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('Set JWT_SECRET in .env (at least 32 random characters)');
}

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
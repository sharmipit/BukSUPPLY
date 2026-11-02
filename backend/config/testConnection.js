require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas successfully.');
    console.log('Host:', mongoose.connection.host);
    console.log('Database:', mongoose.connection.name);
  } catch (err) {
    console.error('Connection failed:', err.message);
    console.error(
      'Check: 1) MONGODB_URI in .env is correct, 2) your IP is whitelisted in Atlas Network Access, 3) username/password are correct.'
    );
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();

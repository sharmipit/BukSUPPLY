const mongoose = require('mongoose');
const settings = require('../services/settings');

const connectDB = async () => {
  const { uri: mongoUri, name: mongoDbName } = settings.database();
  if (!mongoUri) {
    console.error(
      'No MongoDB connection string found. Set MONGODB_URI in your .env file, ' +
        'or save one in the System Settings page.'
    );
    process.exit(1);
  }

  try {
    const options = mongoDbName ? { dbName: mongoDbName } : {};
    const conn = await mongoose.connect(mongoUri, options);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

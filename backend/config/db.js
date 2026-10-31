const mongoose = require('mongoose');
const settings = require('../services/settings');

/**
 * Connects to the BukSUPPLY MongoDB Atlas cluster using Mongoose.
 * Reads the connection string from the system settings (data/settings.json).
 * On first run, it falls back to process.env.MONGODB_URI.
 */
const connectDB = async () => {
  const { mongoUri, mongoDbName } = settings.get();

  if (!mongoUri) {
    console.error(
      'No MongoDB connection string found. Set MONGODB_URI in your .env file, ' +
        'or save one in the System Settings page.'
    );
    process.exit(1);
  }

  try {
    // Only force a database name if one was saved in System Settings.
    // Otherwise Mongoose uses the name inside the connection string.
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

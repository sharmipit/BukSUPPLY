const mongoose = require("mongoose");

/**
 * Connects to the BukSUPPLY MongoDB Atlas cluster using Mongoose.
 * Reads the connection string from process.env.MONGODB_URI.
 */
const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error(
      "MONGODB_URI is not set. Copy .env.example to .env and fill in your Atlas connection string."
    );
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

const mongoose = require("mongoose");
const logger = require('../utils/logger');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Connect to MongoDB with retries.
 * Returns true if connected, false if all retries failed.
 * Never calls process.exit() — the server stays alive either way.
 */
const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Skipping MongoDB connection.");
    return false;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`MongoDB connection attempt ${attempt}/${MAX_RETRIES}...`);
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
        retryWrites: true,
      });
      console.log("MongoDB connected successfully");
      logger.info('database.connected');
      return true;
    } catch (err) {
      console.error(`MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);
      logger.error('database.connection_failed', { message: err.message, attempt });

      if (attempt < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  console.error("All MongoDB connection attempts failed.");
  console.error("Server is still running. DB-dependent routes will return errors.");
  console.error("To fix: check Atlas cluster status, Network Access, and MONGO_URI in Render.");
  return false;
};

// Connection event handlers (registered once, fire on future events too)
mongoose.connection.on('disconnected', () => {
  console.warn("MongoDB disconnected");
  logger.warn('database.disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log("MongoDB reconnected");
  logger.info('database.reconnected');
});

mongoose.connection.on('error', (err) => {
  console.error("MongoDB error:", err.message);
  logger.error('database.error', { message: err.message });
});

module.exports = connectDB;

const mongoose = require("mongoose");
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      retryWrites: true,
    });
    logger.info('database.connected');
  } catch (err) {
    logger.error('database.connection_failed', { message: err.message });
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('database.disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('database.reconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('database.error', { message: err.message });
  });
};

module.exports = connectDB;

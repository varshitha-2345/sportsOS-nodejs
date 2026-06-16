process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION');
  console.error(err);
  console.error(err.stack);
});require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();

//const Sentry = require('@sentry/node');

const requiredEnv = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// Initialize Sentry before anything else
/*if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '1.0.0',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}*/

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require("./config/db");
const requestIdMiddleware = require('./middleware/requestId');
const requestTimeout = require('./middleware/requestTimeout');
const logger = require('./utils/logger');
const app = express();

const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// In production, ALLOWED_ORIGINS must be set to prevent open CORS
if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS.length === 0) {
  console.error('CRITICAL: ALLOWED_ORIGINS must be set in production. Refusing to start with open CORS.');
  process.exit(1);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.length === 0) {
      // Development: allow all origins
      return callback(null, true);
    }

    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 hours preflight cache
};

async function start() {
  await connectDB();

  // Request ID — must be first middleware
  app.use(requestIdMiddleware);

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      logger.info('request', {
        requestId: req.requestId,
        method: req.method,
        route: req.path,
        statusCode: res.statusCode,
        durationMs,
      });
    });
    next();
  });

  app.use(helmet({
    crossOriginResourcePolicy: false,
  }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(requestTimeout(30000));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '100kb' }));

  // Sentry request handler
  /*if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.requestHandler());
  }*/

  app.get('/', (req, res) => res.send('Sports OS API is Running!'));

  app.use('/health', require('./controllers/healthController'));
  app.use('/auth',      require('./controllers/authController'));
  app.use('/athletes',  require('./controllers/athleteController'));
  app.use('/academies', require('./controllers/academyController'));
  app.use('/coaches',   require('./controllers/coachController'));
  app.use('/shortlist', require('./controllers/shortlistController'));
  app.use('/enquiries', require('./controllers/enquiryController'));
  app.use('/admin',     require('./controllers/adminController'));

  // Sentry error handler
  /*if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
  }*/

  app.listen(PORT, () => {
    logger.info('server.started', { port: PORT, environment: process.env.NODE_ENV || 'development' });
  });
}

// Graceful shutdown
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { message: err.message, stack: err.stack });
  process.exit(1);
});

start();

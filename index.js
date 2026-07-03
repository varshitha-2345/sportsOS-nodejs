process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION');
  console.error(err);
  console.error(err.stack);
});
require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();

// ─── Environment Audit (no secrets exposed) ────────────────────
console.log("=== ENVIRONMENT AUDIT ===");
console.log("NODE_ENV:", process.env.NODE_ENV || "(not set)");
console.log("PORT:", process.env.PORT || "(not set, default 3000)");
console.log("MONGO_URI present:", !!process.env.MONGO_URI);
console.log("JWT_SECRET present:", !!process.env.JWT_SECRET);
console.log("JWT_REFRESH_SECRET present:", !!process.env.JWT_REFRESH_SECRET);
console.log("ALLOWED_ORIGINS present:", !!process.env.ALLOWED_ORIGINS);
console.log("ALLOWED_ORIGINS value:", process.env.ALLOWED_ORIGINS || "(empty)");
console.log("=========================");

const requiredEnv = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    console.error("Server cannot start without this variable. Set it in Render dashboard.");
    process.exit(1);
  }
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const connectDB = require("./config/db");
const requestIdMiddleware = require('./middleware/requestId');
const requestTimeout = require('./middleware/requestTimeout');
const logger = require('./utils/logger');
const app = express();

// Trust Render's reverse proxy so req.ip and X-Forwarded-For are handled correctly
app.set('trust proxy', 1);

// ─── /healthz — lightweight, no DB dependency ──────────────────
// Registered FIRST so Render can detect an open port immediately.
// This endpoint NEVER depends on MongoDB, middleware, or auth.
app.get('/healthz', (req, res) => {
  res.status(200).json({
    ok: true,
    server: 'running',
    timestamp: new Date().toISOString(),
  });
});

// ─── CORS ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS.length === 0) {
  console.error("FATAL: ALLOWED_ORIGINS must be set in production.");
  console.error("Set ALLOWED_ORIGINS in Render dashboard (comma-separated URLs).");
  console.error("Example: https://sportsos-ui.vercel.app,https://sportsos.vercel.app");
  process.exit(1);
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.length === 0) {
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
  maxAge: 86400,
};

// ─── Request ID (first real middleware) ────────────────────────
app.use(requestIdMiddleware);

// ─── Request logging ───────────────────────────────────────────
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
app.use(requestTimeout(30000));
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));

// ─── Routes ────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('Sports OS API is Running!'));
app.use('/health', require('./controllers/healthController'));
app.use('/auth',      require('./controllers/authController'));
app.use('/athletes',  require('./controllers/athleteController'));
app.use('/academies', require('./controllers/academyController'));
app.use('/coaches',   require('./controllers/coachController'));
app.use('/sports',    require('./controllers/sportsController'));
app.use('/shortlist', require('./controllers/shortlistController'));
app.use('/enquiries', require('./controllers/enquiryController'));
app.use('/reviews',   require('./controllers/reviewController'));
app.use('/admin',     require('./controllers/adminController'));

// ─── Start server (port opens immediately) ─────────────────────
// app.listen() runs FIRST so Render detects an open port.
// MongoDB connects in the background — non-blocking.
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
  logger.info('server.started', { port: PORT, environment: process.env.NODE_ENV || 'development' });

  // Connect to MongoDB AFTER the port is open.
  // If MongoDB fails, the server stays alive — DB-dependent routes will error.
  console.log("Connecting to MongoDB...");
  connectDB()
    .then((connected) => {
      if (connected) {
        console.log("MongoDB connected successfully");
      } else {
        console.warn("MongoDB connection failed. DB-dependent routes will not work.");
        console.warn("Check Render logs for details. Server is still running.");
      }
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err.message);
      console.warn("Server is still running. DB-dependent routes will not work.");
    });
});

// ─── Graceful shutdown ─────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', { reason: String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { message: err.message, stack: err.stack });
  process.exit(1);
});
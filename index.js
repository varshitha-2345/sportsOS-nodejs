require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();

const requiredEnv = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require("./config/db");
const app = express();

const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

async function start() {
  await connectDB();

  app.use(helmet());
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(cors({
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : true,
    credentials: true,
  }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (req, res) => res.send('Sports OS API is Running!'));

  app.use('/auth',      require('./controllers/authController'));
  app.use('/athletes',  require('./controllers/athleteController'));
  app.use('/academies', require('./controllers/academyController'));
  app.use('/coaches',   require('./controllers/coachController'));
  app.use('/shortlist', require('./controllers/shortlistController'));
  app.use('/enquiries', require('./controllers/enquiryController'));

  app.listen(PORT, () => {
      console.log(`Sports OS API running on port ${PORT}`);
  });
}

start();

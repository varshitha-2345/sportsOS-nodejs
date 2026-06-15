require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();

const requiredEnv = ['MONGO_URI', 'JWT_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const express = require('express');
const cors = require('cors');
const connectDB = require("./config/db");
const app = express();

const PORT = process.env.PORT || 3000;

async function start() {
  await connectDB();

  app.use(cors());
  app.use(express.json());

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

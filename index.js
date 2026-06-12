require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();
const express = require('express');
const cors = require('cors');
const connectDB = require("./config/db");
const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Sports OS API is Running!'));

app.use('/auth',      require('./controllers/authController'));
app.use('/athletes',  require('./controllers/athleteController'));
app.use('/academies', require('./controllers/academyController'));
app.use('/coaches',   require('./controllers/coachController'));
app.use('/shortlist', require('./controllers/shortlistController'));
app.use('/enquiries', require('./controllers/enquiryController'));

app.listen(3000, () => {
    console.log('Sports OS API running on port 3000');
});

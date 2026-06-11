require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();
const express = require('express');
const connectDB = require("./config/db");
const app = express();

connectDB();

app.use(express.json());

app.get('/', (req, res) => res.send('Sports OS API is Running!'));

app.use('/auth',      require('./controllers/authController'));
app.use('/athletes',  require('./controllers/athleteController'));
app.use('/academies', require('./controllers/academyController'));
app.use('/coaches',   require('./controllers/coachController'));
app.use('/shortlist', require('./controllers/shortlistController'));

app.listen(3000, () => {
    console.log('Sports OS API running on port 3000');
});

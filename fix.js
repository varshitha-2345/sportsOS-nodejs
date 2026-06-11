
const fs = require('fs');
const path = require('path');

// ── 1. models/User.js ──────────────────────────────────────────────
const userModel = `const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
`;

// ── 2. middleware/authMiddleware.js ────────────────────────────────
const authMiddleware = `const jwt = require('jsonwebtoken');

// Check if user is logged in (has valid token)
const protect = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token. Please login.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token. Please login again.' });
    }
};

// Check if logged in user is admin
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
};

module.exports = { protect, adminOnly };
`;

// ── 3. controllers/authController.js ──────────────────────────────
const authController = `const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// POST /auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'name, email and password are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already registered' });
        }

        // Hash password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: role || 'user'
        });

        res.status(201).json({
            message: 'Registered successfully',
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, name: user.name, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
`;

// ── 4. controllers/academyController.js ───────────────────────────
const academyController = `const express = require('express');
const router = express.Router();
const academyRepo = require('../repositories/academyRepository');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ── PUBLIC ROUTES — No login required ─────────────────────────────

// GET /academies
router.get('/', async (req, res) => {
    try {
        const academies = await academyRepo.getAllAcademies();
        res.json(academies);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /academies/sport/Cricket
// GET /academies/sport/Cricket,Football
router.get('/sport/:sport', async (req, res) => {
    try {
        const academies = await academyRepo.getAcademiesBySport(req.params.sport);
        res.json(academies);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /academies/distance/10
router.get('/distance/:maxKm', async (req, res) => {
    try {
        const academies = await academyRepo.getAcademiesByDistance(req.params.maxKm);
        res.json(academies);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /academies/distance/10/sport/Cricket
router.get('/distance/:maxKm/sport/:sport', async (req, res) => {
    try {
        const academies = await academyRepo.getAcademiesByDistanceAndSport(
            req.params.maxKm,
            req.params.sport
        );
        res.json(academies);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /academies/verified/all
router.get('/verified/all', async (req, res) => {
    try {
        const academies = await academyRepo.getVerifiedAcademies();
        res.json(academies);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /academies/verified/distance/10
router.get('/verified/distance/:maxKm', async (req, res) => {
    try {
        const academies = await academyRepo.getVerifiedAcademiesByDistance(req.params.maxKm);
        res.json(academies);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /academies/goal/short-term
// GET /academies/goal/long-term?sport=Cricket&maxKm=10
router.get('/goal/:goalType', async (req, res) => {
    try {
        const { goalType } = req.params;
        if (!['short-term', 'long-term'].includes(goalType)) {
            return res.status(400).json({ message: 'goalType must be short-term or long-term' });
        }
        const filters = {};
        if (req.query.sport) filters.sport = req.query.sport;
        if (req.query.maxKm) filters.maxKm = req.query.maxKm;
        const academies = await academyRepo.getAcademiesByGoal(goalType, filters);
        res.json(academies);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /academies/:id
router.get('/:id', async (req, res) => {
    try {
        const academy = await academyRepo.getAcademyById(req.params.id);
        if (!academy) return res.status(404).json({ message: 'Academy not found' });
        res.json(academy);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── PRIVATE ROUTES — Admin only (token required) ───────────────────

// POST /academies
router.post('/', protect, adminOnly, async (req, res) => {
    try {
        const { name, sport, location, distanceKm, verified, goalType } = req.body;
        if (!name || !sport || !location) {
            return res.status(400).json({ message: 'name, sport and location are required' });
        }
        const sportArray = Array.isArray(sport) ? sport : [sport];
        const isDuplicate = await academyRepo.findDuplicate(name, sportArray[0], location);
        if (isDuplicate) {
            return res.status(409).json({ message: 'Academy already exists!' });
        }
        const academy = await academyRepo.createAcademy({
            name, sport: sportArray, location, distanceKm, verified, goalType
        });
        res.status(201).json(academy);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /academies/:id
router.put('/:id', protect, adminOnly, async (req, res) => {
    try {
        if (req.body.sport && !Array.isArray(req.body.sport)) {
            req.body.sport = [req.body.sport];
        }
        const academy = await academyRepo.updateAcademy(req.params.id, req.body);
        if (!academy) return res.status(404).json({ message: 'Academy not found' });
        res.json(academy);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE /academies/:id
router.delete('/:id', protect, adminOnly, async (req, res) => {
    try {
        const deleted = await academyRepo.deleteAcademy(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Academy not found' });
        res.json({ message: 'Deleted academy with id ' + req.params.id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
`;

// ── 5. controllers/athleteController.js ───────────────────────────
const athleteController = `const express = require('express');
const router = express.Router();
const athleteRepo = require('../repositories/athleteRepository');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ── PUBLIC ROUTES — No login required ─────────────────────────────

router.get('/', async (req, res) => {
    try {
        const athletes = await athleteRepo.getAllAthletes();
        res.json(athletes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/sport/:sport', async (req, res) => {
    try {
        const athletes = await athleteRepo.getAthletesBySport(req.params.sport);
        res.json(athletes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/distance/:maxKm', async (req, res) => {
    try {
        const athletes = await athleteRepo.getAthletesByDistance(req.params.maxKm);
        res.json(athletes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/distance/:maxKm/sport/:sport', async (req, res) => {
    try {
        const athletes = await athleteRepo.getAthletesByDistanceAndSport(
            req.params.maxKm,
            req.params.sport
        );
        res.json(athletes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/goal/:goalType', async (req, res) => {
    try {
        const { goalType } = req.params;
        if (!['short-term', 'long-term'].includes(goalType)) {
            return res.status(400).json({ message: 'goalType must be short-term or long-term' });
        }
        const filters = {};
        if (req.query.sport) filters.sport = req.query.sport;
        if (req.query.maxKm) filters.maxKm = req.query.maxKm;
        const athletes = await athleteRepo.getAthletesByGoal(goalType, filters);
        res.json(athletes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const athlete = await athleteRepo.getAthleteById(req.params.id);
        if (!athlete) return res.status(404).json({ message: 'Athlete not found' });
        res.json(athlete);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── PRIVATE ROUTES — Admin only (token required) ───────────────────

router.post('/', protect, adminOnly, async (req, res) => {
    try {
        const { name, sport, age, academy, distanceKm, goalType } = req.body;
        if (!name || !sport || !age || !academy) {
            return res.status(400).json({ message: 'name, sport, age and academy are required' });
        }
        const sportArray = Array.isArray(sport) ? sport : [sport];
        const isDuplicate = await athleteRepo.findDuplicate(name, sportArray[0], age, academy);
        if (isDuplicate) {
            return res.status(409).json({ message: 'Athlete already exists!' });
        }
        const athlete = await athleteRepo.createAthlete({
            name, sport: sportArray, age, academy, distanceKm, goalType
        });
        res.status(201).json(athlete);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
    try {
        if (req.body.sport && !Array.isArray(req.body.sport)) {
            req.body.sport = [req.body.sport];
        }
        const athlete = await athleteRepo.updateAthlete(req.params.id, req.body);
        if (!athlete) return res.status(404).json({ message: 'Athlete not found' });
        res.json(athlete);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
    try {
        const deleted = await athleteRepo.deleteAthlete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Athlete not found' });
        res.json({ message: 'Deleted athlete with id ' + req.params.id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
`;

// ── 6. index.js ───────────────────────────────────────────────────
const indexJs = `require("dns").setServers(["8.8.8.8", "8.8.4.4"]);
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
`;

// ── Write all files ───────────────────────────────────────────────
if (!fs.existsSync('./models'))      fs.mkdirSync('./models');
if (!fs.existsSync('./middleware'))  fs.mkdirSync('./middleware');
if (!fs.existsSync('./controllers')) fs.mkdirSync('./controllers');

fs.writeFileSync('./models/User.js',                    userModel);
fs.writeFileSync('./middleware/authMiddleware.js',       authMiddleware);
fs.writeFileSync('./controllers/authController.js',     authController);
fs.writeFileSync('./controllers/academyController.js',  academyController);
fs.writeFileSync('./controllers/athleteController.js',  athleteController);
fs.writeFileSync('./index.js',                          indexJs);

console.log('All files written successfully!');
console.log('Now add JWT_SECRET=sportsossecretkey123 to your .env file');

const express = require('express');
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

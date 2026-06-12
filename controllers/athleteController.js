const express = require('express');
const router = express.Router();
const athleteRepo = require('../repositories/athleteRepository');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { ok, fail } = require('../utils/response');

// ── PUBLIC ROUTES — No login required ─────────────────────────────

router.get('/', async (req, res) => {
    try {
        const athletes = await athleteRepo.getAllAthletes();
        res.json(ok(athletes));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

router.get('/sport/:sport', async (req, res) => {
    try {
        const athletes = await athleteRepo.getAthletesBySport(req.params.sport);
        res.json(ok(athletes));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

router.get('/distance/:maxKm', async (req, res) => {
    try {
        const athletes = await athleteRepo.getAthletesByDistance(req.params.maxKm);
        res.json(ok(athletes));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

router.get('/distance/:maxKm/sport/:sport', async (req, res) => {
    try {
        const athletes = await athleteRepo.getAthletesByDistanceAndSport(
            req.params.maxKm,
            req.params.sport
        );
        res.json(ok(athletes));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

router.get('/goal/:goalType', async (req, res) => {
    try {
        const { goalType } = req.params;
        if (!['short-term', 'long-term'].includes(goalType)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'goalType must be short-term or long-term'));
        }
        const filters = {};
        if (req.query.sport) filters.sport = req.query.sport;
        if (req.query.maxKm) filters.maxKm = req.query.maxKm;
        const athletes = await athleteRepo.getAthletesByGoal(goalType, filters);
        res.json(ok(athletes));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

router.get('/:id', async (req, res) => {
    try {
        const athlete = await athleteRepo.getAthleteById(req.params.id);
        if (!athlete) return res.status(404).json(fail('NOT_FOUND', 'Athlete not found'));
        res.json(ok(athlete));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

// ── PRIVATE ROUTES — Admin only (token required) ───────────────────

router.post('/', protect, adminOnly, async (req, res) => {
    try {
        const { name, sport, age, academy, distanceKm, goalType } = req.body;
        if (!name || !sport || !age || !academy) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'name, sport, age and academy are required'));
        }
        const sportArray = Array.isArray(sport) ? sport : [sport];
        const isDuplicate = await athleteRepo.findDuplicate(name, sportArray[0], age, academy);
        if (isDuplicate) {
            return res.status(409).json(fail('CONFLICT', 'Athlete already exists!'));
        }
        const athlete = await athleteRepo.createAthlete({
            name, sport: sportArray, age, academy, distanceKm, goalType
        });
        res.status(201).json(ok(athlete));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
    try {
        if (req.body.sport && !Array.isArray(req.body.sport)) {
            req.body.sport = [req.body.sport];
        }
        const athlete = await athleteRepo.updateAthlete(req.params.id, req.body);
        if (!athlete) return res.status(404).json(fail('NOT_FOUND', 'Athlete not found'));
        res.json(ok(athlete));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
    try {
        const deleted = await athleteRepo.deleteAthlete(req.params.id);
        if (!deleted) return res.status(404).json(fail('NOT_FOUND', 'Athlete not found'));
        res.json(ok({ message: 'Deleted athlete with id ' + req.params.id }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

module.exports = router;

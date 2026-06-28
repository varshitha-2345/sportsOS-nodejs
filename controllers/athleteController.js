const express = require('express');
const router = express.Router();
const athleteRepo = require('../repositories/athleteRepository');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { ok, fail } = require('../utils/response');
const { validateObjectId, clampPageSize, clampPage } = require('../utils/validation');
const publicLimiter = require('../middleware/publicLimiter');

// ── PUBLIC ROUTES — No login required ─────────────────────────────

router.get('/', publicLimiter, async (req, res) => {
    try {
        const { sport, page, pageSize } = req.query;
        const result = await athleteRepo.getAthletesFiltered({
            sport,
            page: clampPage(page),
            pageSize: clampPageSize(pageSize),
        });
        res.json(ok(result));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

router.get('/sport/:sport', publicLimiter, async (req, res) => {
    try {
        const athletes = await athleteRepo.getAthletesBySport(req.params.sport);
        res.json(ok(athletes));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

router.get('/distance/:maxKm', publicLimiter, async (req, res) => {
    try {
        const athletes = await athleteRepo.getAthletesByDistance(req.params.maxKm);
        res.json(ok(athletes));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

router.get('/distance/:maxKm/sport/:sport', publicLimiter, async (req, res) => {
    try {
        const athletes = await athleteRepo.getAthletesByDistanceAndSport(
            req.params.maxKm,
            req.params.sport
        );
        res.json(ok(athletes));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

router.get('/goal/:goalType', publicLimiter, async (req, res) => {
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
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

router.get('/:id', publicLimiter, async (req, res) => {
    try {
        if (!validateObjectId(req, res)) return;
        const athlete = await athleteRepo.getAthleteById(req.params.id);
        if (!athlete) return res.status(404).json(fail('NOT_FOUND', 'Athlete not found'));
        res.json(ok(athlete));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
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
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ── Validation helpers ─────────────────────────────────────────
function validateAthleteUpdate(body) {
    const errors = [];
    if (body.name !== undefined) {
        if (typeof body.name !== 'string' || body.name.trim().length === 0) errors.push('name must be a non-empty string');
        else if (body.name.length > 200) errors.push('name must be 200 characters or fewer');
    }
    if (body.age !== undefined) {
        const a = Number(body.age);
        if (isNaN(a) || a < 3 || a > 25) errors.push('age must be a number between 3 and 25');
    }
    if (body.sport !== undefined) {
        if (typeof body.sport !== 'string' && !Array.isArray(body.sport)) errors.push('sport must be a string or array');
    }
    if (body.goalType !== undefined) {
        if (!['short-term', 'long-term'].includes(body.goalType)) errors.push('goalType must be short-term or long-term');
    }
    if (body.distanceKm !== undefined) {
        const d = Number(body.distanceKm);
        if (isNaN(d) || d < 0) errors.push('distanceKm must be a non-negative number');
    }
    return errors;
}

const ATHLETE_UPDATE_FIELDS = ['name','sport','age','academy','distanceKm','goalType'];
router.put('/:id', protect, adminOnly, async (req, res) => {
    try {
        if (!validateObjectId(req, res)) return;
        const allowed = {};
        for (const key of ATHLETE_UPDATE_FIELDS) {
            if (req.body[key] !== undefined) allowed[key] = req.body[key];
        }
        const errors = validateAthleteUpdate(allowed);
        if (errors.length > 0) {
            return res.status(400).json(fail('VALIDATION_ERROR', errors.join('; ')));
        }
        if (allowed.sport && !Array.isArray(allowed.sport)) {
            allowed.sport = [allowed.sport];
        }
        const athlete = await athleteRepo.updateAthlete(req.params.id, allowed);
        if (!athlete) return res.status(404).json(fail('NOT_FOUND', 'Athlete not found'));
        res.json(ok(athlete));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
    try {
        if (!validateObjectId(req, res)) return;
        const deleted = await athleteRepo.deleteAthlete(req.params.id);
        if (!deleted) return res.status(404).json(fail('NOT_FOUND', 'Athlete not found'));
        res.json(ok({ message: 'Deleted athlete with id ' + req.params.id }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const coachRepo = require('../repositories/coachRepository');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { ok, fail } = require('../utils/response');
const { validateObjectId, clampPageSize, clampPage } = require('../utils/validation');
const publicLimiter = require('../middleware/publicLimiter');

// GET /coaches — list with filtering + pagination
router.get('/', publicLimiter, async (req, res) => {
    try {
        const { sport, city, experienceYears, search, page, pageSize } = req.query;
        const result = await coachRepo.getCoachesFiltered({
            sport, city, experienceYears, search,
            page: clampPage(page),
            pageSize: clampPageSize(pageSize),
        });
        res.json(ok(result));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /coaches/academy/:academyId
router.get('/academy/:academyId', publicLimiter, async (req, res) => {
    try {
        const coaches = await coachRepo.getCoachesByAcademy(req.params.academyId);
        res.json(ok(coaches));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /coaches/sport/:sport
router.get('/sport/:sport', publicLimiter, async (req, res) => {
    try {
        const coaches = await coachRepo.getCoachesBySport(req.params.sport);
        res.json(ok(coaches));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /coaches/by-slug/:slug
router.get('/by-slug/:slug', publicLimiter, async (req, res) => {
    try {
        const coach = await coachRepo.getCoachBySlug(req.params.slug);
        if (!coach) return res.status(404).json(fail('NOT_FOUND', 'Coach not found'));
        res.json(ok(coach));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /coaches/:id
router.get('/:id', publicLimiter, async (req, res) => {
    try {
        if (!validateObjectId(req, res)) return;
        const coach = await coachRepo.getCoachById(req.params.id);
        if (!coach) return res.status(404).json(fail('NOT_FOUND', 'Coach not found'));
        res.json(ok(coach));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// POST create coach
router.post('/', protect, adminOnly, async (req, res) => {
    try {
        const { name, slug, avatar, certifications, experienceYears, sportsCoached, specialization, academyId, location, contact, verificationStatus, rating, status } = req.body;
        if (!name || !sportsCoached || !location) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'name, sportsCoached and location are required'));
        }
        const isDuplicate = await coachRepo.findDuplicate(name, academyId);
        if (isDuplicate) {
            return res.status(409).json(fail('CONFLICT', 'Coach already exists!'));
        }
        const coach = await coachRepo.createCoach({
            slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            name, avatar, certifications, experienceYears, sportsCoached, specialization,
            academyId, location, contact, verificationStatus, rating, status,
        });
        res.status(201).json(ok(coach));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ── Validation helpers ─────────────────────────────────────────
function validateCoachUpdate(body) {
    const errors = [];
    if (body.name !== undefined) {
        if (typeof body.name !== 'string' || body.name.trim().length === 0) errors.push('name must be a non-empty string');
        else if (body.name.length > 200) errors.push('name must be 200 characters or fewer');
    }
    if (body.slug !== undefined) {
        if (typeof body.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)) errors.push('slug must be lowercase alphanumeric with hyphens');
        else if (body.slug.length > 100) errors.push('slug must be 100 characters or fewer');
    }
    if (body.experienceYears !== undefined) {
        const y = Number(body.experienceYears);
        if (isNaN(y) || y < 0 || y > 50) errors.push('experienceYears must be a number between 0 and 50');
    }
    if (body.rating !== undefined) {
        const r = Number(body.rating);
        if (isNaN(r) || r < 0 || r > 5) errors.push('rating must be a number between 0 and 5');
    }
    if (body.status !== undefined) {
        if (!['draft', 'published', 'suspended'].includes(body.status)) errors.push('status must be draft, published, or suspended');
    }
    return errors;
}

// PUT update coach
const COACH_UPDATE_FIELDS = ['slug','name','avatar','certifications','experienceYears','sportsCoached','specialization','academyId','location','contact','verificationStatus','rating','status'];
router.put('/:id', protect, adminOnly, async (req, res) => {
    try {
        if (!validateObjectId(req, res)) return;
        const allowed = {};
        for (const key of COACH_UPDATE_FIELDS) {
            if (req.body[key] !== undefined) allowed[key] = req.body[key];
        }
        const errors = validateCoachUpdate(allowed);
        if (errors.length > 0) {
            return res.status(400).json(fail('VALIDATION_ERROR', errors.join('; ')));
        }
        const coach = await coachRepo.updateCoach(req.params.id, allowed);
        if (!coach) return res.status(404).json(fail('NOT_FOUND', 'Coach not found'));
        res.json(ok(coach));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// DELETE coach
router.delete('/:id', protect, adminOnly, async (req, res) => {
    try {
        if (!validateObjectId(req, res)) return;
        const deleted = await coachRepo.deleteCoach(req.params.id);
        if (!deleted) return res.status(404).json(fail('NOT_FOUND', 'Coach not found'));
        res.json(ok({ message: 'Deleted coach with id ' + req.params.id }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

module.exports = router;

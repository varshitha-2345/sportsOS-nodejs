const express = require('express');
const router = express.Router();
const academyRepo = require('../repositories/academyRepository');
const { unmapAcademyInput } = require('../utils/academyMapper');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { ok, fail } = require('../utils/response');
const { validateObjectId, clampPageSize, clampPage } = require('../utils/validation');
const publicLimiter = require('../middleware/publicLimiter');

// ── PUBLIC ROUTES ──────────────────────────────────────────────────

// GET /academies — list with filtering + pagination
router.get('/', publicLimiter, async (req, res) => {
    try {
        const { sport, facility, level, status, search, page, pageSize } = req.query;
        const result = await academyRepo.getAcademiesFiltered({
            sport, facility, level, status, search,
            page: clampPage(page),
            pageSize: clampPageSize(pageSize),
        });
        res.json(ok(result));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /academies/sport/Cricket
router.get('/sport/:sport', publicLimiter, async (req, res) => {
    try {
        const academies = await academyRepo.getAcademiesBySport(req.params.sport);
        res.json(ok(academies));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /academies/verified/all
router.get('/verified/all', publicLimiter, async (req, res) => {
    try {
        const academies = await academyRepo.getVerifiedAcademies();
        res.json(ok(academies));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /academies/by-slug/:slug
router.get('/by-slug/:slug', publicLimiter, async (req, res) => {
    try {
        const academy = await academyRepo.getAcademyBySlug(req.params.slug);
        if (!academy) return res.status(404).json(fail('NOT_FOUND', 'Academy not found'));
        res.json(ok(academy));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /academies/:id
router.get('/:id', publicLimiter, async (req, res) => {
    try {
        if (!validateObjectId(req, res)) return;
        const academy = await academyRepo.getAcademyById(req.params.id);
        if (!academy) return res.status(404).json(fail('NOT_FOUND', 'Academy not found'));
        res.json(ok(academy));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ── PRIVATE ROUTES ─────────────────────────────────────────────────

// POST /academies
router.post('/', protect, adminOnly, async (req, res) => {
    try {
        const { name, slug, description, location, contact, sportsOffered, facilities, trainingLevels, certifications, verificationStatus, achievementSignals, rating, coverImage, status } = req.body;
        if (!name || !sportsOffered || !location) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'name, sportsOffered and location are required'));
        }
        const isDuplicate = await academyRepo.findDuplicate(name, location.city || location);
        if (isDuplicate) {
            return res.status(409).json(fail('CONFLICT', 'Academy already exists!'));
        }
        const academy = await academyRepo.createAcademy({
            slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            ...unmapAcademyInput({
                name, description, location, contact, sportsOffered, facilities, trainingLevels,
                certifications, verificationStatus, achievementSignals, rating, coverImage, status,
            }),
        });
        res.status(201).json(ok(academy));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ── Validation helpers ─────────────────────────────────────────
function validateAcademyUpdate(body) {
    const errors = [];
    if (body.name !== undefined) {
        if (typeof body.name !== 'string' || body.name.trim().length === 0) errors.push('name must be a non-empty string');
        else if (body.name.length > 200) errors.push('name must be 200 characters or fewer');
    }
    if (body.slug !== undefined) {
        if (typeof body.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)) errors.push('slug must be lowercase alphanumeric with hyphens');
        else if (body.slug.length > 100) errors.push('slug must be 100 characters or fewer');
    }
    if (body.description !== undefined) {
        if (typeof body.description !== 'string') errors.push('description must be a string');
        else if (body.description.length > 2000) errors.push('description must be 2000 characters or fewer');
    }
    if (body.rating !== undefined) {
        const avg = typeof body.rating === 'object' && body.rating !== null
            ? Number(body.rating.average)
            : Number(body.rating);
        if (isNaN(avg) || avg < 0 || avg > 5) errors.push('rating.average must be a number between 0 and 5');
    }
    if (body.status !== undefined) {
        if (!['draft', 'published', 'suspended'].includes(body.status)) errors.push('status must be draft, published, or suspended');
    }
    return errors;
}

// PUT /academies/:id
const ACADEMY_UPDATE_FIELDS = ['slug','name','description','location','contact','sportsOffered','facilities','trainingLevels','certifications','verificationStatus','achievementSignals','rating','coverImage','gallery','status'];
router.put('/:id', protect, adminOnly, async (req, res) => {
    try {
        if (!validateObjectId(req, res)) return;
        const allowed = {};
        for (const key of ACADEMY_UPDATE_FIELDS) {
            if (req.body[key] !== undefined) allowed[key] = req.body[key];
        }
        const errors = validateAcademyUpdate(allowed);
        if (errors.length > 0) {
            return res.status(400).json(fail('VALIDATION_ERROR', errors.join('; ')));
        }
        const academy = await academyRepo.updateAcademy(req.params.id, unmapAcademyInput(allowed));
        if (!academy) return res.status(404).json(fail('NOT_FOUND', 'Academy not found'));
        res.json(ok(academy));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// DELETE /academies/:id
router.delete('/:id', protect, adminOnly, async (req, res) => {
    try {
        if (!validateObjectId(req, res)) return;
        const deleted = await academyRepo.deleteAcademy(req.params.id);
        if (!deleted) return res.status(404).json(fail('NOT_FOUND', 'Academy not found'));
        res.json(ok({ message: 'Deleted academy with id ' + req.params.id }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

module.exports = router;

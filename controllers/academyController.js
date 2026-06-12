const express = require('express');
const router = express.Router();
const academyRepo = require('../repositories/academyRepository');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { ok, fail } = require('../utils/response');

// ── PUBLIC ROUTES ──────────────────────────────────────────────────

// GET /academies — list with filtering + pagination
router.get('/', async (req, res) => {
    try {
        const { sport, facility, level, status, search, page, pageSize } = req.query;
        const result = await academyRepo.getAcademiesFiltered({
            sport, facility, level, status, search,
            page: page ? parseInt(page) : 1,
            pageSize: pageSize ? parseInt(pageSize) : 20,
        });
        res.json(ok(result));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

// GET /academies/sport/Cricket
router.get('/sport/:sport', async (req, res) => {
    try {
        const academies = await academyRepo.getAcademiesBySport(req.params.sport);
        res.json(ok(academies));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

// GET /academies/verified/all
router.get('/verified/all', async (req, res) => {
    try {
        const academies = await academyRepo.getVerifiedAcademies();
        res.json(ok(academies));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

// GET /academies/by-slug/:slug
router.get('/by-slug/:slug', async (req, res) => {
    try {
        const academy = await academyRepo.getAcademyBySlug(req.params.slug);
        if (!academy) return res.status(404).json(fail('NOT_FOUND', 'Academy not found'));
        res.json(ok(academy));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

// GET /academies/:id
router.get('/:id', async (req, res) => {
    try {
        const academy = await academyRepo.getAcademyById(req.params.id);
        if (!academy) return res.status(404).json(fail('NOT_FOUND', 'Academy not found'));
        res.json(ok(academy));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
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
            name, description, location, contact, sportsOffered, facilities, trainingLevels,
            certifications, verificationStatus, achievementSignals, rating, coverImage, status,
        });
        res.status(201).json(ok(academy));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

// PUT /academies/:id
router.put('/:id', protect, adminOnly, async (req, res) => {
    try {
        const academy = await academyRepo.updateAcademy(req.params.id, req.body);
        if (!academy) return res.status(404).json(fail('NOT_FOUND', 'Academy not found'));
        res.json(ok(academy));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

// DELETE /academies/:id
router.delete('/:id', protect, adminOnly, async (req, res) => {
    try {
        const deleted = await academyRepo.deleteAcademy(req.params.id);
        if (!deleted) return res.status(404).json(fail('NOT_FOUND', 'Academy not found'));
        res.json(ok({ message: 'Deleted academy with id ' + req.params.id }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const coachRepo = require('../repositories/coachRepository');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { ok, fail } = require('../utils/response');

// GET /coaches — list with filtering + pagination
router.get('/', async (req, res) => {
    try {
        const { sport, search, page, pageSize } = req.query;
        const result = await coachRepo.getCoachesFiltered({
            sport, search,
            page: page ? parseInt(page) : 1,
            pageSize: pageSize ? parseInt(pageSize) : 20,
        });
        res.json(ok(result));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /coaches/academy/:academyId
router.get('/academy/:academyId', async (req, res) => {
    try {
        const coaches = await coachRepo.getCoachesByAcademy(req.params.academyId);
        res.json(ok(coaches));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /coaches/sport/:sport
router.get('/sport/:sport', async (req, res) => {
    try {
        const coaches = await coachRepo.getCoachesBySport(req.params.sport);
        res.json(ok(coaches));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /coaches/by-slug/:slug
router.get('/by-slug/:slug', async (req, res) => {
    try {
        const coach = await coachRepo.getCoachBySlug(req.params.slug);
        if (!coach) return res.status(404).json(fail('NOT_FOUND', 'Coach not found'));
        res.json(ok(coach));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /coaches/:id
router.get('/:id', async (req, res) => {
    try {
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

// PUT update coach
router.put('/:id', protect, adminOnly, async (req, res) => {
    try {
        const coach = await coachRepo.updateCoach(req.params.id, req.body);
        if (!coach) return res.status(404).json(fail('NOT_FOUND', 'Coach not found'));
        res.json(ok(coach));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// DELETE coach
router.delete('/:id', protect, adminOnly, async (req, res) => {
    try {
        const deleted = await coachRepo.deleteCoach(req.params.id);
        if (!deleted) return res.status(404).json(fail('NOT_FOUND', 'Coach not found'));
        res.json(ok({ message: 'Deleted coach with id ' + req.params.id }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

module.exports = router;

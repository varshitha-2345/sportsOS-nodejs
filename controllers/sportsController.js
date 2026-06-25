const express = require('express');
const router = express.Router();
const sportsService = require('../services/sportsService');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { ok, fail } = require('../utils/response');
const publicLimiter = require('../middleware/publicLimiter');

const DEFAULT_ICON  = '/images/sports/default-sport.svg';
const DEFAULT_COVER = '/images/sports/default-sport-cover.jpg';

function applyDefaults(sport) {
  if (!sport) return sport;
  const obj = sport.toObject ? sport.toObject() : { ...sport };
  if (!obj.icon)      obj.icon      = DEFAULT_ICON;
  if (!obj.coverImage) obj.coverImage = DEFAULT_COVER;
  return obj;
}

function applyDefaultsToList(sports) {
  return sports.map(applyDefaults);
}

// ── PUBLIC ROUTES ──────────────────────────────────────────────────

// GET /sports — list all published sports
router.get('/', publicLimiter, async (req, res) => {
    try {
        const { category, status } = req.query;
        const sports = await sportsService.getAllSports({
            status: status || 'published',
            category,
        });
        res.json(ok({ items: applyDefaultsToList(sports), pagination: { page: 1, pageSize: sports.length, total: sports.length, hasMore: false } }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /sports/by-slug/:slug — get sport by slug
router.get('/by-slug/:slug', publicLimiter, async (req, res) => {
    try {
        const sport = await sportsService.getSportBySlug(req.params.slug);
        if (!sport) return res.status(404).json(fail('NOT_FOUND', 'Sport not found'));
        res.json(ok(applyDefaults(sport)));
    } catch (err) {
        if (err.message === 'Sport not found') {
            return res.status(404).json(fail('NOT_FOUND', 'Sport not found'));
        }
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /sports/:slug — get sport by slug (alias)
router.get('/:slug', publicLimiter, async (req, res) => {
    try {
        const sport = await sportsService.getSportBySlug(req.params.slug);
        if (!sport) return res.status(404).json(fail('NOT_FOUND', 'Sport not found'));
        res.json(ok(applyDefaults(sport)));
    } catch (err) {
        if (err.message === 'Sport not found') {
            return res.status(404).json(fail('NOT_FOUND', 'Sport not found'));
        }
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ── ADMIN ROUTES ───────────────────────────────────────────────────

// POST /sports — add a new sport (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
    try {
        const sport = await sportsService.addSport(req.body);
        res.status(201).json(ok(applyDefaults(sport)));
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json(fail('DUPLICATE', 'A sport with this name already exists'));
        }
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// PUT /sports/:id — update a sport (admin only)
router.put('/:id', protect, adminOnly, async (req, res) => {
    try {
        const sport = await sportsService.updateSport(req.params.id, req.body);
        res.json(ok(applyDefaults(sport)));
    } catch (err) {
        if (err.message === 'Sport not found') {
            return res.status(404).json(fail('NOT_FOUND', 'Sport not found'));
        }
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// DELETE /sports/:id — delete a sport (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
    try {
        await sportsService.deleteSport(req.params.id);
        res.json(ok({ message: 'Sport deleted' }));
    } catch (err) {
        if (err.message === 'Sport not found') {
            return res.status(404).json(fail('NOT_FOUND', 'Sport not found'));
        }
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

module.exports = router;

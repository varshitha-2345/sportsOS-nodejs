const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const shortlistRepo = require('../repositories/shortlistRepository');
const Academy = require('../models/Academy');
const Coach = require('../models/Coach');
const { ok, fail } = require('../utils/response');

// GET /shortlist/me — get current user's shortlist (raw records)
router.get('/me', protect, async (req, res) => {
    try {
        const items = await shortlistRepo.findByUser(req.user.id);
        res.json(ok(items));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /shortlist/me/populated — get current user's shortlist with full item data
router.get('/me/populated', protect, async (req, res) => {
    try {
        const items = await shortlistRepo.findByUser(req.user.id);
        const academySlugs = items.filter(i => i.itemType === 'academy').map(i => i.itemId);
        const coachSlugs = items.filter(i => i.itemType === 'coach').map(i => i.itemId);

        const [academies, coaches] = await Promise.all([
            academySlugs.length > 0 ? Academy.find({ slug: { $in: academySlugs } }) : [],
            coachSlugs.length > 0 ? Coach.find({ slug: { $in: coachSlugs } }) : [],
        ]);

        const academyMap = new Map(academies.map(a => [a.slug, a.toJSON()]));
        const coachMap = new Map(coaches.map(c => [c.slug, c.toJSON()]));

        const populated = items.map(item => {
            const data = item.itemType === 'academy'
                ? academyMap.get(item.itemId)
                : coachMap.get(item.itemId);
            return { ...item.toJSON(), data: data || null };
        });

        res.json(ok(populated));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /shortlist/check/:itemType/:slug — check if item is in shortlist
router.get('/check/:itemType/:slug', protect, async (req, res) => {
    try {
        const { itemType, slug } = req.params;
        if (!['academy', 'coach'].includes(itemType)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'itemType must be academy or coach'));
        }
        const exists = await shortlistRepo.existsForUser(req.user.id, itemType, slug);
        res.json(ok({ inShortlist: exists }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// POST /shortlist — add item to shortlist
router.post('/', protect, async (req, res) => {
    try {
        const { itemType, itemId } = req.body;

        if (!itemType || !itemId) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'itemType and itemId are required'));
        }

        if (!['academy', 'coach'].includes(itemType)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'itemType must be academy or coach'));
        }

        const existing = await shortlistRepo.findDuplicate(req.user.id, itemType, itemId);
        if (existing) {
            return res.status(409).json(fail('CONFLICT', 'Already in shortlist'));
        }

        const item = await shortlistRepo.create(req.user.id, itemType, itemId);
        res.status(201).json(ok(item));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// DELETE /shortlist/clear-all — clear all shortlist items for current user
router.delete('/clear-all', protect, async (req, res) => {
    try {
        await shortlistRepo.clearByUser(req.user.id);
        res.json(ok({ cleared: true }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// DELETE /shortlist/by-slug/:itemType/:slug — remove by item type and slug
router.delete('/by-slug/:itemType/:slug', protect, async (req, res) => {
    try {
        const { itemType, slug } = req.params;
        if (!['academy', 'coach'].includes(itemType)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'itemType must be academy or coach'));
        }
        const item = await shortlistRepo.removeByUserAndItem(req.user.id, itemType, slug);
        if (!item) return res.status(404).json(fail('NOT_FOUND', 'Shortlist item not found'));
        res.json(ok({ itemType, itemId: slug }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// DELETE /shortlist/:id — remove item from shortlist by record ID
router.delete('/:id', protect, async (req, res) => {
    try {
        if (!require('mongoose').Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid ID format'));
        }
        const item = await shortlistRepo.findById(req.params.id);
        if (!item) return res.status(404).json(fail('NOT_FOUND', 'Shortlist item not found'));
        if (item.userId.toString() !== req.user.id) {
            return res.status(403).json(fail('FORBIDDEN', 'You can only delete your own shortlist items'));
        }
        await shortlistRepo.remove(req.params.id);
        res.json(ok({ id: req.params.id }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

module.exports = router;

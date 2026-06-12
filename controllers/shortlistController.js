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
        const academyIds = items.filter(i => i.itemType === 'academy').map(i => i.itemId);
        const coachIds = items.filter(i => i.itemType === 'coach').map(i => i.itemId);

        const [academies, coaches] = await Promise.all([
            academyIds.length > 0 ? Academy.find({ _id: { $in: academyIds } }) : [],
            coachIds.length > 0 ? Coach.find({ _id: { $in: coachIds } }) : [],
        ]);

        const academyMap = new Map(academies.map(a => [a.id, a.toJSON()]));
        const coachMap = new Map(coaches.map(c => [c.id, c.toJSON()]));

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

// DELETE /shortlist/:id — remove item from shortlist
router.delete('/:id', protect, async (req, res) => {
    try {
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

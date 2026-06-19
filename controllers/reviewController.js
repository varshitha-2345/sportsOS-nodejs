const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const reviewRepo = require('../repositories/reviewRepository');
const { ok, fail } = require('../utils/response');

const reviewLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many reviews. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

// POST /reviews — submit a review (auth required)
router.post('/', protect, reviewLimiter, async (req, res) => {
    try {
        const { targetId, targetType, rating, title, text, photos, parentName, childAge, sport, relationship } = req.body;

        if (!targetId || !targetType || !rating) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'targetId, targetType, and rating are required'));
        }

        if (!['academy', 'coach'].includes(targetType)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'targetType must be academy or coach'));
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Rating must be between 1 and 5'));
        }

        const existing = await reviewRepo.findForUser(req.user.id, targetId, targetType);
        if (existing) {
            return res.status(409).json(fail('DUPLICATE', 'You have already reviewed this item'));
        }

        const review = await reviewRepo.create({
            userId: req.user.id,
            targetId,
            targetType,
            rating,
            title: title || undefined,
            text: text || undefined,
            photos: photos || [],
            parentName: parentName || req.user.name,
            childAge: childAge || undefined,
            sport: sport || undefined,
            relationship: relationship || 'parent',
            isVerified: true,
            moderationStatus: 'approved',
        });

        res.status(201).json(ok({ reviewId: review.id }));
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json(fail('DUPLICATE', 'You have already reviewed this item'));
        }
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /reviews/:targetType/:targetId — get reviews for a target
router.get('/:targetType/:targetId', async (req, res) => {
    try {
        const { targetType, targetId } = req.params;
        const { sort = '-createdAt', limit = 50, skip = 0 } = req.query;

        if (!['academy', 'coach'].includes(targetType)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid targetType'));
        }

        const reviews = await reviewRepo.findByTarget(targetId, targetType, {
            sort,
            limit: parseInt(limit),
            skip: parseInt(skip),
        });

        const stats = await reviewRepo.getStats(targetId, targetType);

        res.json(ok({ reviews, stats }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /reviews/me — get current user's reviews
router.get('/me', protect, async (req, res) => {
    try {
        const reviews = await reviewRepo.findByUser(req.user.id);
        res.json(ok(reviews));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// PUT /reviews/:id — update a review (owner only)
router.put('/:id', protect, async (req, res) => {
    try {
        const review = await reviewRepo.findById(req.params.id);
        if (!review) {
            return res.status(404).json(fail('NOT_FOUND', 'Review not found'));
        }
        if (review.userId._id.toString() !== req.user.id) {
            return res.status(403).json(fail('FORBIDDEN', 'Not your review'));
        }

        const { rating, title, text, photos } = req.body;
        const updated = await reviewRepo.updateById(req.params.id, {
            ...(rating && { rating }),
            ...(title !== undefined && { title }),
            ...(text !== undefined && { text }),
            ...(photos && { photos }),
        });

        res.json(ok(updated));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// DELETE /reviews/:id — delete a review (owner or admin)
router.delete('/:id', protect, async (req, res) => {
    try {
        const review = await reviewRepo.findById(req.params.id);
        if (!review) {
            return res.status(404).json(fail('NOT_FOUND', 'Review not found'));
        }
        if (review.userId._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json(fail('FORBIDDEN', 'Not authorized'));
        }

        await reviewRepo.deleteById(req.params.id);
        res.json(ok({ deleted: true }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const enquiryRepo = require('../repositories/enquiryRepository');
const { ok, fail } = require('../utils/response');

// POST /enquiries — submit an enquiry (auth optional — guests can submit)
router.post('/', async (req, res) => {
    try {
        const { targetType, targetId, intent, parentInfo, childInfo, sportInterest, message } = req.body;

        if (!targetType || !targetId || !parentInfo || !sportInterest) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'targetType, targetId, parentInfo, and sportInterest are required'));
        }

        if (!['academy', 'coach'].includes(targetType)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'targetType must be academy or coach'));
        }

        if (!parentInfo.name || !parentInfo.email || !parentInfo.phone) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'parentInfo.name, parentInfo.email, and parentInfo.phone are required'));
        }

        // Attach userId if authenticated (optional)
        let userId = null;
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const jwt = require('jsonwebtoken');
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.id;
            } catch { /* guest */ }
        }

        const enquiry = await enquiryRepo.create({
            userId,
            targetType,
            targetId,
            intent: intent || 'trial',
            parentInfo,
            childInfo: childInfo || undefined,
            sportInterest,
            message: message || undefined,
        });

        res.status(201).json(ok({
            enquiryId: enquiry.id,
            leadId: enquiry.leadId || null,
            whatsappConfirmationSent: false,
        }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

// GET /enquiries/me — get current user's enquiries
router.get('/me', protect, async (req, res) => {
    try {
        const enquiries = await enquiryRepo.findByUser(req.user.id);
        res.json(ok(enquiries));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

// GET /enquiries — admin: get all enquiries
router.get('/', protect, adminOnly, async (req, res) => {
    try {
        const enquiries = await enquiryRepo.findAll();
        res.json(ok(enquiries));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

module.exports = router;

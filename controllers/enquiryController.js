const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const enquiryRepo = require('../repositories/enquiryRepository');
const { ok, fail } = require('../utils/response');
const { isValidEmail, validateObjectId } = require('../utils/validation');

const enquiryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many enquiries. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

// POST /enquiries — submit an enquiry (auth optional — guests can submit)
router.post('/', enquiryLimiter, async (req, res) => {
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

        if (!isValidEmail(parentInfo.email)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid email format'));
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
            } catch { /* guest — ignore invalid tokens */ }
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
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /enquiries/me — get current user's enquiries
router.get('/me', protect, async (req, res) => {
    try {
        const enquiries = await enquiryRepo.findByUser(req.user.id);
        res.json(ok(enquiries));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /enquiries — admin: get all enquiries
router.get('/', protect, adminOnly, async (req, res) => {
    try {
        const enquiries = await enquiryRepo.findAll();
        res.json(ok(enquiries));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

module.exports = router;

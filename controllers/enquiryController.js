const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const enquiryService = require('../services/enquiryService');
const enquiryRepo = require('../repositories/enquiryRepository');
const Academy = require('../models/Academy');
const Coach = require('../models/Coach');
const { ok, fail } = require('../utils/response');
const { isValidEmail } = require('../utils/validation');

const VALID_INTENTS = ['contact', 'callback', 'trial', 'enrollment_interest', 'whatsapp'];

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

        const resolvedIntent = intent || 'trial';
        if (!VALID_INTENTS.includes(resolvedIntent)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid enquiry intent'));
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

        // Look up target name for display
        let targetName = '';
        try {
            if (targetType === 'academy') {
                const academy = await Academy.findById(targetId).select('name');
                targetName = academy?.name || '';
            } else if (targetType === 'coach') {
                const coach = await Coach.findById(targetId).select('name');
                targetName = coach?.name || '';
            }
        } catch { /* non-critical */ }

        const result = await enquiryService.createEnquiry({
            userId,
            targetType,
            targetId,
            targetName,
            intent: resolvedIntent,
            parentInfo,
            childInfo: childInfo || undefined,
            sportInterest,
            message: message || '',
            source: targetType === 'academy' ? 'academy_detail' : 'coach_detail',
        });

        res.status(201).json(ok({
            enquiryId: result.enquiryId,
            leadId: result.leadId,
            whatsappConfirmationSent: result.whatsappConfirmationSent,
        }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /enquiries/me — get current user's enquiries
router.get('/me', protect, async (req, res) => {
    try {
        const enquiries = await enquiryService.getEnquiriesByUser(req.user.id);
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

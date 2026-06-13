const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { ok, fail } = require('../utils/response');
const { protect } = require('../middleware/authMiddleware');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

function generateToken(user) {
    return jwt.sign(
        { id: user.id || user._id, name: user.name, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function safeUser(user) {
    return { id: user.id || user._id, name: user.name, email: user.email, phone: user.phone || '', role: user.role, onboardingCompleted: !!user.onboardingCompleted };
}

// POST /auth/register
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'name, email and password are required'));
        }

        if (password.length < 8) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Password must be at least 8 characters'));
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json(fail('CONFLICT', 'Email already registered'));
        }

        // Hash password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        // Always default to athlete — ignore role from request body
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            phone: phone || undefined,
            role: 'athlete'
        });

        const token = generateToken(user);

        res.status(201).json(ok({ token, user: safeUser(user) }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// POST /auth/login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'email and password are required'));
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json(fail('INVALID_CREDENTIALS', 'Invalid email or password'));
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json(fail('INVALID_CREDENTIALS', 'Invalid email or password'));
        }

        // Generate JWT token
        const token = generateToken(user);

        res.json(ok({ token, user: safeUser(user) }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// GET /auth/me — return current user from token
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json(fail('NOT_FOUND', 'User not found'));
        }
        res.json(ok(safeUser(user)));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// PUT /auth/onboarding — mark onboarding as completed
router.put('/onboarding', protect, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { onboardingCompleted: true },
            { new: true }
        );
        if (!user) {
            return res.status(404).json(fail('NOT_FOUND', 'User not found'));
        }
        res.json(ok(safeUser(user)));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

module.exports = router;

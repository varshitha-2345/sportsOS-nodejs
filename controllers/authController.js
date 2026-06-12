const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ok, fail } = require('../utils/response');

function generateToken(user) {
    return jwt.sign(
        { id: user.id || user._id, name: user.name, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function safeUser(user) {
    return { id: user.id || user._id, name: user.name, email: user.email, role: user.role };
}

// POST /auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'name, email and password are required'));
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json(fail('CONFLICT', 'Email already registered'));
        }

        // Hash password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone: phone || undefined,
            role: role || 'athlete'
        });

        const token = generateToken(user);

        res.status(201).json(ok({ token, user: safeUser(user) }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'email and password are required'));
        }

        const user = await User.findOne({ email });
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
        res.status(500).json(fail('SERVER_ERROR', err.message));
    }
});

module.exports = router;

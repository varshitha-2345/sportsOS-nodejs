const { ipKeyGenerator } = require('express-rate-limit');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const OTP = require('../models/OTP');
const RefreshToken = require('../models/RefreshToken');
const { sendWelcomeEmail, sendPasswordResetEmail, sendOtpEmail } = require('../services/emailService');
const { logEvent } = require('../services/auditService');
const { ok, fail } = require('../utils/response');
const { protect } = require('../middleware/authMiddleware');
const { isValidEmail } = require('../utils/validation');
const logger = require('../utils/logger');

// Strict login limiter: 5 attempts per 15 min per IP (brute force protection)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again in 15 minutes.' } },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// Register limiter: 3 accounts per hour per IP (spam prevention)
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many registration attempts. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
   keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// General auth limiter: 20 per 15 min (me, onboarding, etc.)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

// Forgot password limiter: 3 per hour per IP
const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many password reset requests. Please try again in an hour.' } },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// Reset password limiter: 10 per hour per IP
const resetPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many password reset attempts. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// Refresh token limiter: 20 per 15 min per IP (handles token rotation for legitimate clients)
const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many token refresh attempts. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// OTP limiter: 5 per 15 min per IP (brute force protection)
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many verification attempts. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// Resend OTP limiter: 3 per 15 min per IP
const resendOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many resend requests. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
});

// ─── Token Helpers ───────────────────────────────────────────

function parseDuration(str) {
    const match = String(str).match(/^(\d+)\s*(s|m|h|d)$/);
    if (!match) return 15 * 60 * 1000;
    const val = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return val * multipliers[unit];
}

function generateAccessToken(user) {
    return jwt.sign(
        { id: user.id || user._id, name: user.name, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );
}

function generateRefreshTokenValue() {
    return crypto.randomBytes(40).toString('hex');
}

// ─── OTP Helpers ─────────────────────────────────────────────

function generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
}

function getRefreshExpiry() {
    return parseDuration(process.env.JWT_REFRESH_EXPIRY || '30d');
}

function isProduction() {
    return process.env.NODE_ENV === 'production';
}

function setRefreshTokenCookie(res, token) {
    const maxAge = getRefreshExpiry();
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: isProduction(),
        sameSite: isProduction() ? 'none' : 'lax',
        path: '/auth',
        maxAge,
    });
}

function clearRefreshTokenCookie(res) {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: isProduction(),
        sameSite: isProduction() ? 'none' : 'lax',
        path: '/auth',
    });
}

async function storeRefreshToken(token, userId, req) {
    const expiresAt = new Date(Date.now() + getRefreshExpiry());
    return RefreshToken.create({
        token,
        userId,
        userAgent: req.headers['user-agent'] || '',
        ipAddress: req.ip || '',
        expiresAt,
    });
}

function safeUser(user) {
    return {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        isVerified: !!user.isVerified,
        onboardingCompleted: !!user.onboardingCompleted,
        age: user.age ?? null,
        gender: user.gender || null,
        sportInterests: user.sportInterests || [],
        skillLevel: user.skillLevel || null,
        goals: user.goals || '',
        location: user.location || '',
        children: (user.children || []).map(c => ({
            id: c._id?.toString?.() || c.id,
            name: c.name,
            age: c.age,
            gender: c.gender || null,
            sportInterests: c.sportInterests || [],
            skillLevel: c.skillLevel || null,
        })),
    };
}

// ─── POST /auth/register ─────────────────────────────────────

router.post('/register', registerLimiter, async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'name, email and password are required'));
        }

        if (!isValidEmail(email)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid email format'));
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json(fail('VALIDATION_ERROR', passwordError));
        }

        const normalizedEmail = email.toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'name, email and password are required'));
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            phone: phone || undefined,
            role: 'athlete',
            isVerified: false,
        });

        // Generate OTP for email verification
        const otp = generateOtp();
        await OTP.create({ userId: user._id, otp, type: 'email_verification' });

        // Send OTP email (non-blocking)
        sendOtpEmail({ name: user.name, email: user.email }, otp, 'email_verification').catch((err) => {
            logger.error('email.otp_failed', { userId: user._id, message: err.message });
        });

        logEvent({ userId: user._id, action: 'user.registered', metadata: { email: user.email }, req });

        res.status(201).json(ok({ requiresVerification: true, email: user.email }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── POST /auth/login ────────────────────────────────────────

router.post('/login', loginLimiter, async (req, res) => {
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

        // Check if email is verified
        if (!user.isVerified) {
            // Resend OTP automatically
            const otp = generateOtp();
            await OTP.findOneAndDelete({ userId: user._id, type: 'email_verification' });
            await OTP.create({ userId: user._id, otp, type: 'email_verification' });

            sendOtpEmail({ name: user.name, email: user.email }, otp, 'email_verification').catch((err) => {
                logger.error('email.otp_failed', { userId: user._id, message: err.message });
            });

            return res.status(403).json(fail('EMAIL_NOT_VERIFIED', 'Please verify your email. A new code has been sent.'));
        }

        const token = generateAccessToken(user);
        const refreshTokenValue = generateRefreshTokenValue();
        await storeRefreshToken(refreshTokenValue, user._id, req);
        setRefreshTokenCookie(res, refreshTokenValue);

        logEvent({ userId: user._id, action: 'user.login', metadata: { email: user.email }, req });

        res.json(ok({ token, user: safeUser(user) }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── POST /auth/refresh ──────────────────────────────────────

router.post('/refresh', refreshLimiter, async (req, res) => {
    try {
        const refreshTokenValue = req.cookies?.refreshToken;
        if (!refreshTokenValue) {
            return res.status(401).json(fail('UNAUTHORIZED', 'No refresh token'));
        }

        const record = await RefreshToken.findOne({ token: refreshTokenValue });
        if (!record) {
            clearRefreshTokenCookie(res);
            return res.status(401).json(fail('UNAUTHORIZED', 'Invalid refresh token'));
        }

        if (record.revokedAt) {
            clearRefreshTokenCookie(res);
            return res.status(401).json(fail('UNAUTHORIZED', 'Refresh token revoked'));
        }

        if (record.expiresAt < new Date()) {
            clearRefreshTokenCookie(res);
            return res.status(401).json(fail('UNAUTHORIZED', 'Refresh token expired'));
        }

        const user = await User.findById(record.userId);
        if (!user) {
            clearRefreshTokenCookie(res);
            return res.status(401).json(fail('UNAUTHORIZED', 'User not found'));
        }

        // Token rotation: revoke old token, issue new pair
        record.revokedAt = new Date();
        await record.save();

        const newAccessToken = generateAccessToken(user);
        const newRefreshTokenValue = generateRefreshTokenValue();
        await storeRefreshToken(newRefreshTokenValue, user._id, req);
        setRefreshTokenCookie(res, newRefreshTokenValue);

        res.json(ok({ token: newAccessToken }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── POST /auth/logout ───────────────────────────────────────

router.post('/logout', protect, async (req, res) => {
    try {
        const refreshTokenValue = req.cookies?.refreshToken;
        if (refreshTokenValue) {
            await RefreshToken.findOneAndUpdate(
                { token: refreshTokenValue },
                { revokedAt: new Date() }
            );
        }
        clearRefreshTokenCookie(res);
        logEvent({ userId: req.user.id, action: 'user.logout', req });
        res.json(ok({ message: 'Logged out successfully' }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── POST /auth/verify-otp ──────────────────────────────────

router.post('/verify-otp', otpLimiter, async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'email and otp are required'));
        }

        const normalizedEmail = email.toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid email or OTP'));
        }

        if (user.isVerified) {
            return res.status(400).json(fail('ALREADY_VERIFIED', 'Email is already verified'));
        }

        // Find and validate OTP
        const otpRecord = await OTP.findOne({
            userId: user._id,
            otp,
            type: 'email_verification',
        });

        if (!otpRecord) {
            return res.status(400).json(fail('INVALID_OTP', 'Invalid or expired OTP'));
        }

        // Check expiry
        if (otpRecord.expiresAt < new Date()) {
            await OTP.findByIdAndDelete(otpRecord._id);
            return res.status(400).json(fail('OTP_EXPIRED', 'OTP has expired. Please request a new one.'));
        }

        // Delete OTP
        await OTP.findByIdAndDelete(otpRecord._id);

        // Mark user as verified
        user.isVerified = true;
        await user.save();

        // Generate tokens
        const token = generateAccessToken(user);
        const refreshTokenValue = generateRefreshTokenValue();
        await storeRefreshToken(refreshTokenValue, user._id, req);
        setRefreshTokenCookie(res, refreshTokenValue);

        // Send welcome email (non-blocking)
        sendWelcomeEmail(user).catch((err) => {
            logger.error('email.welcome_failed', { userId: user._id, message: err.message });
        });

        logEvent({ userId: user._id, action: 'user.email_verified', metadata: { email: user.email }, req });

        res.json(ok({ token, user: safeUser(user) }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── POST /auth/resend-otp ──────────────────────────────────

router.post('/resend-otp', resendOtpLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== 'string') {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Email is required'));
        }

        const normalizedEmail = email.toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });

        // Always return success to prevent email enumeration
        if (!user || user.isVerified) {
            return res.json(ok({ message: 'If an account exists, a new code has been sent.' }));
        }

        // Delete previous OTP
        await OTP.findOneAndDelete({ userId: user._id, type: 'email_verification' });

        // Generate new OTP
        const otp = generateOtp();
        await OTP.create({ userId: user._id, otp, type: 'email_verification' });

        // Send OTP email (non-blocking)
        sendOtpEmail({ name: user.name, email: user.email }, otp, 'email_verification').catch((err) => {
            logger.error('email.otp_failed', { userId: user._id, message: err.message });
        });

        logEvent({ userId: user._id, action: 'user.otp_resent', metadata: { email: user.email }, req });

        return res.json(ok({ message: 'If an account exists, a new code has been sent.' }));
    } catch (err) {
        return res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── GET /auth/session ───────────────────────────────────────

router.get('/session', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json(fail('NOT_FOUND', 'User not found'));
        }
        res.json(ok({ authenticated: true, user: safeUser(user) }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── GET /auth/me ────────────────────────────────────────────

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

// ─── Validation Helpers ──────────────────────────────────────

const VALID_SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'competitive'];
const VALID_GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];
const VALID_ONBOARDING_ROLES = ['athlete', 'parent'];

function validateOnboarding(body) {
    const errors = [];
    if (body.role !== undefined && !VALID_ONBOARDING_ROLES.includes(body.role)) {
        errors.push('role must be athlete or parent');
    }
    if (body.age !== undefined) {
        const a = Number(body.age);
        if (isNaN(a) || a < 1 || a > 120) errors.push('age must be between 1 and 120');
    }
    if (body.gender !== undefined && !VALID_GENDERS.includes(body.gender)) {
        errors.push('gender must be male, female, other, or prefer_not_to_say');
    }
    if (body.sportInterests !== undefined) {
        if (!Array.isArray(body.sportInterests)) errors.push('sportInterests must be an array');
        else if (body.sportInterests.length === 0) errors.push('sportInterests must have at least one sport');
    }
    if (body.skillLevel !== undefined && !VALID_SKILL_LEVELS.includes(body.skillLevel)) {
        errors.push('skillLevel must be beginner, intermediate, advanced, or competitive');
    }
    if (body.goals !== undefined && typeof body.goals !== 'string') {
        errors.push('goals must be a string');
    }
    if (body.location !== undefined && typeof body.location !== 'string') {
        errors.push('location must be a string');
    }
    if (body.children !== undefined) {
        if (!Array.isArray(body.children)) errors.push('children must be an array');
        else {
            body.children.forEach((c, i) => {
                if (!c.name || typeof c.name !== 'string') errors.push(`children[${i}].name is required`);
                const age = Number(c.age);
                if (isNaN(age) || age < 1 || age > 25) errors.push(`children[${i}].age must be between 1 and 25`);
            });
        }
    }
    return errors;
}

// ─── PUT /auth/onboarding ────────────────────────────────────

router.put('/onboarding', protect, authLimiter, async (req, res) => {
    try {
        const { role, age, gender, sportInterests, skillLevel, goals, location, children } = req.body;

        const errors = validateOnboarding(req.body);
        if (errors.length > 0) {
            return res.status(400).json(fail('VALIDATION_ERROR', errors.join('; ')));
        }

        const update = { onboardingCompleted: true };
        if (role !== undefined && VALID_ONBOARDING_ROLES.includes(role)) update.role = role;
        if (age !== undefined) update.age = Number(age);
        if (gender !== undefined) update.gender = gender;
        if (sportInterests !== undefined) update.sportInterests = sportInterests;
        if (skillLevel !== undefined) update.skillLevel = skillLevel;
        if (goals !== undefined) update.goals = goals;
        if (location !== undefined) update.location = location;
        if (children !== undefined) {
            update.children = children.map(c => ({
                name: c.name,
                age: Number(c.age),
                gender: c.gender || undefined,
                sportInterests: c.sportInterests || [],
                skillLevel: c.skillLevel || undefined,
            }));
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            update,
            { new: true, runValidators: true }
        );
        if (!user) {
            return res.status(404).json(fail('NOT_FOUND', 'User not found'));
        }
        logEvent({ userId: req.user.id, action: 'user.onboarding_completed', metadata: { role: update.role }, req });
        res.json(ok(safeUser(user)));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── Profile Update Helpers ──────────────────────────────────

const PROFILE_ALLOWED_FIELDS = ['name', 'phone'];

function validateProfile(body) {
    const errors = [];
    if (body.name !== undefined) {
        if (typeof body.name !== 'string' || body.name.trim().length < 1) {
            errors.push('name must be a non-empty string');
        } else if (body.name.trim().length > 100) {
            errors.push('name must be at most 100 characters');
        }
    }
    if (body.phone !== undefined) {
        if (typeof body.phone !== 'string') {
            errors.push('phone must be a string');
        }
    }
    return errors;
}

// ─── PATCH /auth/profile ─────────────────────────────────────

router.patch('/profile', protect, authLimiter, async (req, res) => {
    try {
        const update = {};
        for (const field of PROFILE_ALLOWED_FIELDS) {
            if (req.body[field] !== undefined) {
                update[field] = field === 'name' ? req.body[field].trim() : req.body[field];
            }
        }

        if (Object.keys(update).length === 0) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'No valid fields to update'));
        }

        const errors = validateProfile(req.body);
        if (errors.length > 0) {
            return res.status(400).json(fail('VALIDATION_ERROR', errors.join('; ')));
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            update,
            { new: true, runValidators: true }
        );
        if (!user) {
            return res.status(404).json(fail('NOT_FOUND', 'User not found'));
        }
        logEvent({ userId: req.user.id, action: 'user.profile_updated', metadata: { fields: Object.keys(update) }, req });
        res.json(ok(safeUser(user)));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── Password Validation ──────────────────────────────────────

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function validatePassword(password) {
    if (typeof password !== 'string') return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/\d/.test(password)) return 'Password must contain at least one number';
    return null;
}

// ─── POST /auth/forgot-password ───────────────────────────────

router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== 'string') {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Email is required'));
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json(ok({ message: 'If an account exists, a reset link has been sent.' }));
        }

        // Generate cryptographically secure token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await user.save();

        // Send email (non-blocking)
        sendPasswordResetEmail(user, resetToken).catch((err) => {
            logger.error('email.reset_failed', { userId: user._id, message: err.message });
        });

        logEvent({ userId: user._id, action: 'user.password_reset_requested', metadata: { email: normalizedEmail }, req });

        return res.json(ok({ message: 'If an account exists, a reset link has been sent.' }));
    } catch (err) {
        return res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── POST /auth/reset-password ────────────────────────────────

router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || typeof token !== 'string') {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Reset token is required'));
        }

        if (!password) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Password is required'));
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json(fail('VALIDATION_ERROR', passwordError));
        }

        // Hash the token to match what's stored
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: new Date() },
        });

        if (!user) {
            return res.status(400).json(fail('INVALID_TOKEN', 'Invalid or expired reset token'));
        }

        // Update password
        user.password = await bcrypt.hash(password, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Invalidate all active refresh sessions for this user
        await RefreshToken.updateMany(
            { userId: user._id, revokedAt: null },
            { revokedAt: new Date() }
        );

        logEvent({ userId: user._id, action: 'user.password_reset_completed', req });

        return res.json(ok({ message: 'Password reset successful. Please login with your new password.' }));
    } catch (err) {
        return res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

module.exports = router;

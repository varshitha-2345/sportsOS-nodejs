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

// Strict login limiter: temporary relaxed limits (testing)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again in 15 minutes.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

// Register limiter: temporary relaxed limits (testing)
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many registration attempts. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

// General auth limiter: 20 per 15 min (me, onboarding, etc.)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

// Forgot password limiter: temporary relaxed limits (testing)
const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many password reset requests. Please try again in an hour.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

// Reset password limiter: temporary relaxed limits (testing)
const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many password reset attempts. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

// Refresh token limiter: 20 per 15 min per IP (handles token rotation for legitimate clients)
const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many token refresh attempts. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

// OTP limiter: temporary relaxed limits (testing)
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many verification attempts. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

// Resend OTP limiter: temporary relaxed limits (testing)
const resendOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many resend requests. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
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
        phoneVerified: !!user.phoneVerified,
        onboardingCompleted: !!user.onboardingCompleted,
        age: user.age ?? null,
        gender: user.gender || null,
        sportInterests: user.sportInterests || [],
        skillLevel: user.skillLevel || null,
        goals: user.goals || '',
        location: user.location || '',
        avatar: user.avatar || null,
        authProvider: user.authProvider || 'credentials',
        lastLoginAt: user.lastLoginAt || null,
        preferences: user.preferences || {},
        consent: user.consent || { analytics: false, marketing: false, whatsapp: false },
        themePreference: user.themePreference || 'system',
        children: (user.children || []).map(c => ({
            id: c._id?.toString?.() || c.id || '',
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

        logger.info('register.received', {
            hasName: !!name,
            hasEmail: !!email,
            hasPassword: !!password,
            hasPhone: !!phone,
            bodyKeys: req.body ? Object.keys(req.body) : 'req.body undefined',
        });

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
            logger.info('register.duplicate_email', {
                email: normalizedEmail,
            });
            return res.status(409).json(
                fail(
                    'VALIDATION_ERROR',
                    'An account with this email already exists'
                )
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            phone: phone || undefined,
            role: 'athlete',
            isVerified: false,
            authProvider: 'credentials',
            lastLoginAt: new Date(),
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

        user.lastLoginAt = new Date();
        await user.save();

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
        record.lastUsedAt = new Date();
        await record.save();

        // Update lastLoginAt on user
        user.lastLoginAt = new Date();
        await user.save();

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

const PROFILE_ALLOWED_FIELDS = ['name', 'phone', 'preferences', 'consent', 'themePreference'];

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
    if (body.preferences !== undefined) {
        if (typeof body.preferences !== 'object' || body.preferences === null) {
            errors.push('preferences must be an object');
        }
    }
    if (body.consent !== undefined) {
        if (typeof body.consent !== 'object' || body.consent === null) {
            errors.push('consent must be an object');
        }
    }
    if (body.themePreference !== undefined) {
        const validThemes = ['alpine-light', 'midnight-ice', 'ember-orange', 'graphite-titanium', 'system'];
        if (!validThemes.includes(body.themePreference)) {
            errors.push('themePreference must be a valid theme');
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
                if (field === 'name') {
                    update[field] = req.body[field].trim();
                } else if (field === 'preferences' || field === 'consent') {
                    // Merge nested objects instead of replacing
                    update['$set'] = update['$set'] || {};
                    for (const [key, value] of Object.entries(req.body[field])) {
                        update[`$set.${field}.${key}`] = value;
                    }
                } else {
                    update[field] = req.body[field];
                }
            }
        }

        if (Object.keys(update).length === 0) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'No valid fields to update'));
        }

        const errors = validateProfile(req.body);
        if (errors.length > 0) {
            return res.status(400).json(fail('VALIDATION_ERROR', errors.join('; ')));
        }

        // Use $set for nested objects to merge instead of replace
        const updateOps = {};
        if (update.$set) {
            updateOps.$set = update.$set;
            delete update.$set;
        }
        if (Object.keys(update).length > 0) {
            updateOps.$set = { ...updateOps.$set, ...update };
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            Object.keys(updateOps).length > 0 ? updateOps : update,
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

// ─── POST /auth/google ──────────────────────────────────────
// Verifies Google ID token, creates user if not exists, returns JWT.

const googleAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/google', googleAuthLimiter, async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Google ID token is required'));
        }

        // Verify the ID token with Google's tokeninfo endpoint
        const fetch = (await import('node-fetch')).default;
        const googleRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
        );

        if (!googleRes.ok) {
            return res.status(401).json(fail('AUTH_ERROR', 'Invalid Google token'));
        }

        const googleUser = await googleRes.json();

        if (!googleUser.email || !googleUser.email_verified) {
            return res.status(401).json(fail('AUTH_ERROR', 'Google account email not verified'));
        }

        const email = googleUser.email.toLowerCase();
        const name = googleUser.name || email.split('@')[0];
        const picture = googleUser.picture || null;

        // Find or create user
        let user = await User.findOne({ email });

        if (user) {
            // Update name/picture if missing
            if (!user.name && name) user.name = name;
            user.isVerified = true; // Google emails are verified
            // Preserve existing authProvider if user already has one (e.g., 'credentials')
            // Only set provider for new logins, don't overwrite existing provider
            if (!user.authProvider || user.authProvider === 'credentials') {
                user.authProvider = 'google';
            }
            user.lastLoginAt = new Date();
            await user.save();
        } else {
            // Create new user — no password needed for OAuth users
            user = await User.create({
                name,
                email,
                password: crypto.randomBytes(32).toString('hex'), // random password, won't be used
                role: 'athlete',
                isVerified: true,
                onboardingCompleted: false,
                authProvider: 'google',
            });
        }

        // Generate tokens
        const token = generateAccessToken(user);
        const refreshTokenValue = generateRefreshTokenValue();
        await storeRefreshToken(refreshTokenValue, user._id, req);
        setRefreshTokenCookie(res, refreshTokenValue);

        logEvent({ userId: user._id, action: 'user.social_login', metadata: { provider: 'google' }, req });

        res.json(ok({
            token,
            user: safeUser(user),
        }));
    } catch (err) {
        logger.error('auth.google.error', { message: err.message });
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── POST /auth/microsoft ───────────────────────────────────
// Verifies Microsoft ID token, creates user if not exists, returns JWT.

const microsoftAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/microsoft', microsoftAuthLimiter, async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Microsoft ID token is required'));
        }

        const fetch = (await import('node-fetch')).default;
        const crypto = require('crypto');

        // Decode the token header to get the kid
        const parts = idToken.split('.');
        if (parts.length !== 3) {
            return res.status(401).json(fail('AUTH_ERROR', 'Invalid Microsoft token format'));
        }

        let header, payload;
        try {
            header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
            payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        } catch {
            return res.status(401).json(fail('AUTH_ERROR', 'Invalid Microsoft token encoding'));
        }

        // Basic validation
        if (!payload.email) {
            return res.status(401).json(fail('AUTH_ERROR', 'Microsoft token missing email'));
        }

        // Verify token hasn't expired
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return res.status(401).json(fail('AUTH_ERROR', 'Microsoft token expired'));
        }

        // Verify issuer
        const validIssuers = [
            'https://login.microsoftonline.com/' + payload.tid + '/v2.0',
            'https://sts.windows.net/' + payload.tid + '/',
        ];
        if (!validIssuers.includes(payload.iss)) {
            return res.status(401).json(fail('AUTH_ERROR', 'Invalid Microsoft token issuer'));
        }

        // Verify audience (REQUIRED — reject if MICROSOFT_CLIENT_ID not configured)
        const expectedAud = process.env.MICROSOFT_CLIENT_ID;
        if (!expectedAud) {
            logger.error('auth.microsoft.missing_client_id', { message: 'MICROSOFT_CLIENT_ID env var not set' });
            return res.status(500).json(fail('SERVER_ERROR', 'Microsoft auth not configured'));
        }
        if (payload.aud !== expectedAud) {
            return res.status(401).json(fail('AUTH_ERROR', 'Invalid Microsoft token audience'));
        }

        // Verify signature using Microsoft JWKS (REQUIRED — do not fall through)
        let signatureVerified = false;
        try {
            const discoveryRes = await fetch('https://login.microsoftonline.com/common/discovery/v2.0/keys');
            if (!discoveryRes.ok) {
                logger.error('auth.microsoft.jwks_fetch_failed', { status: discoveryRes.status });
                return res.status(401).json(fail('AUTH_ERROR', 'Unable to verify Microsoft token'));
            }
            const jwks = await discoveryRes.json();
            const key = jwks.keys?.find((k) => k.kid === header.kid);
            if (!key || !key.n || !key.e) {
                return res.status(401).json(fail('AUTH_ERROR', 'Microsoft token signing key not found'));
            }

            // Reconstruct RSA public key from JWK components
            const publicKeyObject = crypto.createPublicKey({
                key: { kty: key.kty, n: key.n, e: key.e },
                format: 'jwk',
            });

            // Verify the signature
            const dataToVerify = parts[0] + '.' + parts[1];
            const signature = Buffer.from(parts[2], 'base64url');
            const verify = crypto.createVerify('RSA-SHA256');
            verify.update(dataToVerify);
            signatureVerified = verify.verify(publicKeyObject, signature);

            if (!signatureVerified) {
                return res.status(401).json(fail('AUTH_ERROR', 'Invalid Microsoft token signature'));
            }
        } catch (verifyErr) {
            logger.error('auth.microsoft.jwks_verify_failed', { message: verifyErr.message });
            return res.status(401).json(fail('AUTH_ERROR', 'Failed to verify Microsoft token signature'));
        }

        const email = payload.email.toLowerCase();
        const name = payload.name || email.split('@')[0];

        // Find or create user
        let user = await User.findOne({ email });

        if (user) {
            if (!user.name && name) user.name = name;
            user.isVerified = true;
            // Preserve existing authProvider if user already has one (e.g., 'credentials')
            if (!user.authProvider || user.authProvider === 'credentials') {
                user.authProvider = 'microsoft';
            }
            user.lastLoginAt = new Date();
            await user.save();
        } else {
            user = await User.create({
                name,
                email,
                password: crypto.randomBytes(32).toString('hex'),
                role: 'athlete',
                isVerified: true,
                onboardingCompleted: false,
                authProvider: 'microsoft',
                lastLoginAt: new Date(),
            });
        }

        const token = generateAccessToken(user);
        const refreshTokenValue = generateRefreshTokenValue();
        await storeRefreshToken(refreshTokenValue, user._id, req);
        setRefreshTokenCookie(res, refreshTokenValue);

        logEvent({ userId: user._id, action: 'user.social_login', metadata: { provider: 'microsoft' }, req });

        res.json(ok({
            token,
            user: safeUser(user),
        }));
    } catch (err) {
        logger.error('auth.microsoft.error', { message: err.message });
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── POST /auth/login-otp ────────────────────────────────────
// Sends OTP to email for passwordless login.

router.post('/login-otp', otpLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string') {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Email is required'));
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Always return success to prevent email enumeration
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.json(ok({ message: 'If an account exists, a login code has been sent.' }));
        }

        // Delete previous login OTPs
        await OTP.findOneAndDelete({ userId: user._id, type: 'login' });

        const otp = generateOtp();
        await OTP.create({ userId: user._id, otp, type: 'login' });

        sendOtpEmail({ name: user.name, email: user.email }, otp, 'login').catch((err) => {
            logger.error('email.login_otp_failed', { userId: user._id, message: err.message });
        });

        logEvent({ userId: user._id, action: 'user.login_otp_sent', metadata: { email: normalizedEmail }, req });

        return res.json(ok({ message: 'If an account exists, a login code has been sent.' }));
    } catch (err) {
        return res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── POST /auth/verify-login-otp ─────────────────────────────
// Verifies OTP for passwordless login.

router.post('/verify-login-otp', otpLimiter, async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'email and otp are required'));
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(400).json(fail('INVALID_OTP', 'Invalid or expired code'));
        }

        const otpRecord = await OTP.findOne({
            userId: user._id,
            otp,
            type: 'login',
        });

        if (!otpRecord) {
            return res.status(400).json(fail('INVALID_OTP', 'Invalid or expired code'));
        }

        if (otpRecord.expiresAt < new Date()) {
            await OTP.findByIdAndDelete(otpRecord._id);
            return res.status(400).json(fail('OTP_EXPIRED', 'Code has expired. Please request a new one.'));
        }

        await OTP.findByIdAndDelete(otpRecord._id);

        user.isVerified = true;
        user.lastLoginAt = new Date();
        await user.save();

        const token = generateAccessToken(user);
        const refreshTokenValue = generateRefreshTokenValue();
        await storeRefreshToken(refreshTokenValue, user._id, req);
        setRefreshTokenCookie(res, refreshTokenValue);

        logEvent({ userId: user._id, action: 'user.login_otp_verified', metadata: { email: user.email }, req });

        res.json(ok({ token, user: safeUser(user) }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── POST /auth/forgot-password-otp ─────────────────────────
// Sends OTP for password reset via email.

router.post('/forgot-password-otp', forgotPasswordLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string') {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Email is required'));
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json(ok({ message: 'If an account exists, a reset code has been sent.' }));
        }

        // Check auth provider
        if (user.authProvider === 'google' || user.authProvider === 'microsoft') {
            return res.status(400).json(fail(
                'OAUTH_ACCOUNT',
                `This account uses ${user.authProvider === 'google' ? 'Google' : 'Microsoft'} Sign In. No password reset required.`
            ));
        }

        // Delete previous reset OTPs
        await OTP.findOneAndDelete({ userId: user._id, type: 'password_reset' });

        const otp = generateOtp();
        await OTP.create({ userId: user._id, otp, type: 'password_reset' });

        sendOtpEmail({ name: user.name, email: user.email }, otp, 'password_reset').catch((err) => {
            logger.error('email.reset_otp_failed', { userId: user._id, message: err.message });
        });

        logEvent({ userId: user._id, action: 'user.password_reset_otp_sent', metadata: { email: normalizedEmail }, req });

        return res.json(ok({ message: 'If an account exists, a reset code has been sent.' }));
    } catch (err) {
        return res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── POST /auth/verify-reset-otp ────────────────────────────
// Verifies OTP for password reset and returns a reset token.

router.post('/verify-reset-otp', resetPasswordLimiter, async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'email and otp are required'));
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(400).json(fail('INVALID_OTP', 'Invalid or expired code'));
        }

        const otpRecord = await OTP.findOne({
            userId: user._id,
            otp,
            type: 'password_reset',
        });

        if (!otpRecord) {
            return res.status(400).json(fail('INVALID_OTP', 'Invalid or expired code'));
        }

        if (otpRecord.expiresAt < new Date()) {
            await OTP.findByIdAndDelete(otpRecord._id);
            return res.status(400).json(fail('OTP_EXPIRED', 'Code has expired. Please request a new one.'));
        }

        await OTP.findByIdAndDelete(otpRecord._id);

        // Generate a short-lived reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await user.save();

        logEvent({ userId: user._id, action: 'user.reset_otp_verified', metadata: { email: user.email }, req });

        return res.json(ok({ resetToken }));
    } catch (err) {
        return res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── GET /auth/provider/:email ──────────────────────────────
// Check auth provider for a given email (for forgot password UI).

router.get('/provider/:email', async (req, res) => {
    try {
        const { email } = req.params;
        if (!email || typeof email !== 'string') {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Email is required'));
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail }).select('authProvider');

        if (!user) {
            return res.json(ok({ provider: null }));
        }

        return res.json(ok({ provider: user.authProvider || 'credentials' }));
    } catch (err) {
        return res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── GET /auth/sessions ─────────────────────────────────────
// List all active sessions (refresh tokens) for the current user.

router.get('/sessions', protect, async (req, res) => {
    try {
        const sessions = await RefreshToken.find({
            userId: req.user.id,
            revokedAt: null,
        }).sort({ createdAt: -1 }).lean();

        const result = sessions.map((s) => ({
            id: s._id,
            userAgent: s.userAgent || '',
            ipAddress: s.ipAddress || '',
            lastUsedAt: s.lastUsedAt || s.createdAt,
            createdAt: s.createdAt,
            isCurrent: s.token === req.cookies?.refreshToken,
        }));

        res.json(ok({ sessions: result }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── DELETE /auth/sessions/:id ──────────────────────────────
// Revoke a specific session (other device).

router.delete('/sessions/:id', protect, async (req, res) => {
    try {
        const session = await RefreshToken.findOne({
            _id: req.params.id,
            userId: req.user.id,
            revokedAt: null,
        });

        if (!session) {
            return res.status(404).json(fail('NOT_FOUND', 'Session not found'));
        }

        session.revokedAt = new Date();
        await session.save();

        logEvent({ userId: req.user.id, action: 'user.session_revoked', metadata: { sessionId: req.params.id }, req });

        res.json(ok({ message: 'Session revoked' }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── DELETE /auth/sessions ──────────────────────────────────
// Revoke all sessions except the current one.

router.delete('/sessions', protect, async (req, res) => {
    try {
        const currentToken = req.cookies?.refreshToken;
        const result = await RefreshToken.updateMany(
            {
                userId: req.user.id,
                revokedAt: null,
                ...(currentToken ? { token: { $ne: currentToken } } : {}),
            },
            { revokedAt: new Date() }
        );

        logEvent({ userId: req.user.id, action: 'user.all_sessions_revoked', metadata: { count: result.modifiedCount }, req });

        res.json(ok({ message: 'All other sessions revoked', count: result.modifiedCount }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── PUT /auth/change-password ──────────────────────────────
// Change password (requires current password).

router.put('/change-password', protect, authLimiter, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Current password and new password are required'));
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            return res.status(400).json(fail('VALIDATION_ERROR', passwordError));
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json(fail('NOT_FOUND', 'User not found'));
        }

        // OAuth users don't have a real password
        if (user.authProvider !== 'credentials') {
            return res.status(400).json(fail('INVALID_OPERATION', `This account uses ${user.authProvider === 'google' ? 'Google' : 'Microsoft'} Sign In. Password change is not available.`));
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json(fail('INVALID_CREDENTIALS', 'Current password is incorrect'));
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        // Invalidate all other sessions
        const currentToken = req.cookies?.refreshToken;
        await RefreshToken.updateMany(
            {
                userId: user._id,
                revokedAt: null,
                ...(currentToken ? { token: { $ne: currentToken } } : {}),
            },
            { revokedAt: new Date() }
        );

        logEvent({ userId: user._id, action: 'user.password_changed', req });

        res.json(ok({ message: 'Password changed successfully' }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── PUT /auth/change-email ─────────────────────────────────
// Change email (requires password verification).

router.put('/change-email', protect, authLimiter, async (req, res) => {
    try {
        const { newEmail, password } = req.body;

        if (!newEmail || !password) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'New email and password are required'));
        }

        if (!isValidEmail(newEmail)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid email format'));
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json(fail('NOT_FOUND', 'User not found'));
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json(fail('INVALID_CREDENTIALS', 'Password is incorrect'));
        }

        const normalizedEmail = newEmail.toLowerCase().trim();

        // Check if email is already taken
        const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
        if (existing) {
            return res.status(409).json(fail('DUPLICATE_EMAIL', 'This email is already associated with another account'));
        }

        user.email = normalizedEmail;
        user.isVerified = false;
        await user.save();

        // Generate OTP for new email verification
        const otp = generateOtp();
        await OTP.findOneAndDelete({ userId: user._id, type: 'email_verification' });
        await OTP.create({ userId: user._id, otp, type: 'email_verification' });

        sendOtpEmail({ name: user.name, email: normalizedEmail }, otp, 'email_verification').catch((err) => {
            logger.error('email.otp_failed', { userId: user._id, message: err.message });
        });

        logEvent({ userId: user._id, action: 'user.email_changed', metadata: { newEmail: normalizedEmail }, req });

        res.json(ok({ message: 'Email updated. Please verify your new email.', requiresVerification: true }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── PUT /auth/change-phone ─────────────────────────────────
// Change phone number.

router.put('/change-phone', protect, authLimiter, async (req, res) => {
    try {
        const { phone } = req.body;

        if (phone === undefined) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Phone number is required'));
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { phone: phone || '' },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json(fail('NOT_FOUND', 'User not found'));
        }

        logEvent({ userId: req.user.id, action: 'user.phone_changed', req });

        res.json(ok(safeUser(user)));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── DELETE /auth/account ───────────────────────────────────
// Delete account (requires password confirmation).

router.delete('/account', protect, authLimiter, async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Password is required to delete account'));
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json(fail('NOT_FOUND', 'User not found'));
        }

        // OAuth users: skip password check
        if (user.authProvider === 'credentials') {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json(fail('INVALID_CREDENTIALS', 'Password is incorrect'));
            }
        }

        // Revoke all sessions
        await RefreshToken.updateMany(
            { userId: user._id, revokedAt: null },
            { revokedAt: new Date() }
        );

        // Delete user
        await User.findByIdAndDelete(user._id);

        // Clean up related data
        await OTP.deleteMany({ userId: user._id });

        clearRefreshTokenCookie(res);

        logEvent({ userId: req.user.id, action: 'user.account_deleted', metadata: { email: user.email }, req });

        res.json(ok({ message: 'Account deleted successfully' }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── GET /auth/children ───────────────────────────────────────

router.get('/children', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json(fail('NOT_FOUND', 'User not found'));
        }
        const children = (user.children || []).map(c => ({
            id: c._id?.toString?.() || c.id || '',
            name: c.name,
            age: c.age,
            gender: c.gender || null,
            sportInterests: c.sportInterests || [],
            skillLevel: c.skillLevel || null,
        }));
        res.json(ok(children));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── POST /auth/children ──────────────────────────────────────

const VALID_CHILD_GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];

router.post('/children', protect, authLimiter, async (req, res) => {
    try {
        const { name, age, gender, sportInterests, skillLevel } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length < 1) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Child name is required'));
        }
        const parsedAge = Number(age);
        if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 25) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Child age must be between 1 and 25'));
        }
        if (gender !== undefined && !VALID_CHILD_GENDERS.includes(gender)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid gender value'));
        }
        if (skillLevel !== undefined && !VALID_SKILL_LEVELS.includes(skillLevel)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid skill level'));
        }
        if (sportInterests !== undefined && !Array.isArray(sportInterests)) {
            return res.status(400).json(fail('VALIDATION_ERROR', 'sportInterests must be an array'));
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json(fail('NOT_FOUND', 'User not found'));
        }

        user.children.push({
            name: name.trim(),
            age: parsedAge,
            gender: gender || undefined,
            sportInterests: sportInterests || [],
            skillLevel: skillLevel || undefined,
        });
        await user.save();

        const added = user.children[user.children.length - 1];
        logEvent({ userId: req.user.id, action: 'user.child_added', metadata: { childName: name.trim() }, req });

        res.json(ok({
            id: added._id?.toString?.() || '',
            name: added.name,
            age: added.age,
            gender: added.gender || null,
            sportInterests: added.sportInterests || [],
            skillLevel: added.skillLevel || null,
        }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── PATCH /auth/children/:childId ────────────────────────────

router.patch('/children/:childId', protect, authLimiter, async (req, res) => {
    try {
        const { childId } = req.params;
        const { name, age, gender, sportInterests, skillLevel } = req.body;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json(fail('NOT_FOUND', 'User not found'));
        }

        const child = user.children.id(childId);
        if (!child) {
            return res.status(404).json(fail('NOT_FOUND', 'Child not found'));
        }

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length < 1) {
                return res.status(400).json(fail('VALIDATION_ERROR', 'Child name is required'));
            }
            child.name = name.trim();
        }
        if (age !== undefined) {
            const parsedAge = Number(age);
            if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 25) {
                return res.status(400).json(fail('VALIDATION_ERROR', 'Child age must be between 1 and 25'));
            }
            child.age = parsedAge;
        }
        if (gender !== undefined) {
            if (!VALID_CHILD_GENDERS.includes(gender)) {
                return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid gender value'));
            }
            child.gender = gender;
        }
        if (sportInterests !== undefined) {
            if (!Array.isArray(sportInterests)) {
                return res.status(400).json(fail('VALIDATION_ERROR', 'sportInterests must be an array'));
            }
            child.sportInterests = sportInterests;
        }
        if (skillLevel !== undefined) {
            if (!VALID_SKILL_LEVELS.includes(skillLevel)) {
                return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid skill level'));
            }
            child.skillLevel = skillLevel;
        }

        await user.save();

        logEvent({ userId: req.user.id, action: 'user.child_updated', metadata: { childId }, req });

        res.json(ok({
            id: child._id?.toString?.() || '',
            name: child.name,
            age: child.age,
            gender: child.gender || null,
            sportInterests: child.sportInterests || [],
            skillLevel: child.skillLevel || null,
        }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

// ─── DELETE /auth/children/:childId ───────────────────────────

router.delete('/children/:childId', protect, authLimiter, async (req, res) => {
    try {
        const { childId } = req.params;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json(fail('NOT_FOUND', 'User not found'));
        }

        const child = user.children.id(childId);
        if (!child) {
            return res.status(404).json(fail('NOT_FOUND', 'Child not found'));
        }

        child.deleteOne();
        await user.save();

        logEvent({ userId: req.user.id, action: 'user.child_removed', metadata: { childId }, req });

        res.json(ok({ message: 'Child removed' }));
    } catch (err) {
        res.status(500).json(fail('SERVER_ERROR', 'Internal server error'));
    }
});

module.exports = router;

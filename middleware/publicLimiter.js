const rateLimit = require('express-rate-limit');

const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
});

module.exports = publicLimiter;

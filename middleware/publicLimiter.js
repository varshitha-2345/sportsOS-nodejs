const rateLimit = require('express-rate-limit');
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});
module.exports = publicLimiter;

const logger = require('../utils/logger');

/**
 * Request timeout middleware.
 * Aborts requests that take longer than the specified timeout.
 * Prevents slow clients / resource-exhaustion attacks from holding connections open.
 */
function requestTimeout(timeoutMs = 30000) {
    return (req, res, next) => {
        const timer = setTimeout(() => {
            if (!res.headersSent) {
                logger.warn('request.timeout', {
                    requestId: req.requestId,
                    method: req.method,
                    path: req.path,
                    timeoutMs,
                });
                res.status(504).json({
                    ok: false,
                    error: { code: 'TIMEOUT', message: 'Request timed out' },
                });
            }
        }, timeoutMs);

        res.on('finish', () => clearTimeout(timer));
        res.on('close', () => clearTimeout(timer));

        next();
    };
}

module.exports = requestTimeout;

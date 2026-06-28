const levels = ['debug', 'info', 'warn', 'error'];

function createLogger() {
    function log(level, message, meta = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            requestId: meta.requestId || undefined,
            userId: meta.userId || undefined,
            route: meta.route || undefined,
            method: meta.method || undefined,
            statusCode: meta.statusCode || undefined,
            durationMs: meta.durationMs || undefined,
            ...sanitizeMeta(meta),
        };

        // Remove undefined fields
        Object.keys(entry).forEach(k => entry[k] === undefined && delete entry[k]);

        const output = JSON.stringify(entry);

        if (level === 'error') {
            console.error(output);
        } else if (level === 'warn') {
            console.warn(output);
        } else {
            console.log(output);
        }
    }

    function sanitizeMeta(meta) {
        const sanitized = { ...meta };
        // Remove sensitive fields
        delete sanitized.password;
        delete sanitized.token;
        delete sanitized.refreshToken;
        delete sanitized.authorization;
        delete sanitized.requestId;
        delete sanitized.userId;
        delete sanitized.route;
        delete sanitized.method;
        delete sanitized.statusCode;
        delete sanitized.durationMs;
        return sanitized;
    }

    return {
        debug: (msg, meta) => log('debug', msg, meta),
        info: (msg, meta) => log('info', msg, meta),
        warn: (msg, meta) => log('warn', msg, meta),
        error: (msg, meta) => log('error', msg, meta),
    };
}

module.exports = createLogger();

const AuditLog = require('../models/AuditLog');

async function logEvent({ userId, action, metadata, req }) {
    try {
        await AuditLog.create({
            userId: userId || undefined,
            action,
            metadata: metadata || {},
            ipAddress: req?.ip || undefined,
            userAgent: req?.headers?.['user-agent'] || undefined,
            requestId: req?.requestId || undefined,
        });
    } catch (err) {
        // Audit logging should never crash the request
        console.error('Audit log failed:', err.message);
    }
}

module.exports = { logEvent };

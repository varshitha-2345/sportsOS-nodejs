const crypto = require('crypto');

function requestIdMiddleware(req, res, next) {
    const existingId = req.headers['x-request-id'];
    const requestId = existingId || crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
}

module.exports = requestIdMiddleware;

const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');

const protect = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json(fail('UNAUTHORIZED', 'No token. Please login.'));
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json(fail('TOKEN_EXPIRED', 'Access token expired'));
        }
        return res.status(401).json(fail('TOKEN_INVALID', 'Invalid token'));
    }
};

const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json(fail('FORBIDDEN', 'Access denied. Admins only.'));
    }
};

module.exports = { protect, adminOnly };

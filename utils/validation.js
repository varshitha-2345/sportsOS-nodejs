const mongoose = require('mongoose');
const { fail } = require('./response');

const MAX_PAGE_SIZE = 100;

/**
 * Validate that req.params.id is a valid MongoDB ObjectId.
 * Returns 400 and sends response if invalid; returns true if valid.
 */
function validateObjectId(req, res) {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json(fail('VALIDATION_ERROR', 'Invalid ID format'));
        return false;
    }
    return true;
}

/**
 * Validate email format.
 * Returns true if valid, false otherwise.
 */
function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Clamp pageSize to 1..MAX_PAGE_SIZE. Returns a safe integer.
 */
function clampPageSize(raw, defaultSize = 20) {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 1) return defaultSize;
    return Math.min(n, MAX_PAGE_SIZE);
}

/**
 * Clamp page to 1+. Returns a safe integer.
 */
function clampPage(raw) {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 1) return 1;
    return n;
}

module.exports = { validateObjectId, isValidEmail, clampPageSize, clampPage, MAX_PAGE_SIZE };

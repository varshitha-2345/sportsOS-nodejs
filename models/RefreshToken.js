const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
    token:       { type: String, required: true, unique: true, index: true },
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userAgent:   { type: String, default: '' },
    ipAddress:   { type: String, default: '' },
    lastUsedAt:  { type: Date, default: Date.now },
    expiresAt:   { type: Date, required: true, index: { expires: 0 } },
    revokedAt:   { type: Date, default: null },
}, { timestamps: true });

refreshTokenSchema.index({ userId: 1, revokedAt: 1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action:    { type: String, required: true },
    metadata:  { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
}, { timestamps: true });

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days TTL

module.exports = mongoose.model('AuditLog', auditLogSchema);

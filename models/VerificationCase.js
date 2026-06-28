const mongoose = require('mongoose');
const { Schema } = mongoose;

const verificationCaseSchema = new Schema({
  targetType: { type: String, enum: ['academy', 'coach'], required: true },
  targetId:   { type: Schema.Types.ObjectId, required: true },

  status: {
    type: String,
    enum: ['queued', 'under_review', 'needs_info', 'verified', 'rejected'],
    default: 'queued',
  },

  submittedAt: { type: Date, default: Date.now },
  assignedTo:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt:   Date,

  evidence: [{
    type:       { type: String, enum: ['document', 'image', 'note'] },
    url:        String,
    text:       String,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: Date,
    hash:       String,
  }],

  reviewerNotes:  String,
  decisionReason: String,
  auditLogId:     String,
}, { timestamps: true });

verificationCaseSchema.index({ targetType: 1, targetId: 1, status: 1 });

module.exports = mongoose.model('VerificationCase', verificationCaseSchema);

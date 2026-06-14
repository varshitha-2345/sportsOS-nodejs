const mongoose = require('mongoose');
const { Schema } = mongoose;

const leadActivitySchema = new Schema({
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },

  actorType: { type: String, enum: ['system', 'admin'], required: true },
  actorId:   { type: Schema.Types.ObjectId, ref: 'User', default: null },

  type: {
    type: String,
    enum: ['note', 'status_change', 'contact_attempt', 'whatsapp_sent', 'callback_logged'],
    required: true,
  },

  payload: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

leadActivitySchema.index({ leadId: 1, createdAt: -1 });

module.exports = mongoose.model('LeadActivity', leadActivitySchema);

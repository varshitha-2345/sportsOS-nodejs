const mongoose = require('mongoose');
const { Schema } = mongoose;

const leadSchema = new Schema({
  enquiryId: { type: Schema.Types.ObjectId, ref: 'Enquiry', required: true },

  source: {
    type: String,
    enum: ['academy_detail', 'coach_detail', 'compare', 'shortlist', 'search'],
    required: true,
  },

  ownerType: { type: String, enum: ['academy', 'coach'], required: true },
  ownerId:   { type: Schema.Types.ObjectId, required: true },

  userId:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
  childId: { type: Schema.Types.ObjectId, ref: 'Child', default: null },

  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'trial_scheduled', 'converted', 'lost'],
    default: 'new',
  },

  assignedTo:     { type: Schema.Types.ObjectId, ref: 'User', default: null },
  lastActivityAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);

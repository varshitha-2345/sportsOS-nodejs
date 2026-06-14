const mongoose = require('mongoose');
const { Schema } = mongoose;

const analyticsSchema = new Schema({
  event:  { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  data:   Schema.Types.Mixed,
}, { timestamps: true });

analyticsSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema);

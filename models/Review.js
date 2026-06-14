const mongoose = require('mongoose');
const { Schema } = mongoose;

const reviewSchema = new Schema({
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetId:   { type: Schema.Types.ObjectId, required: true },
  targetType: { type: String, enum: ['academy', 'coach'], required: true },
  rating:     { type: Number, min: 1, max: 5, required: true },

  text:    String,
  comment: String,

  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  moderatorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

reviewSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);

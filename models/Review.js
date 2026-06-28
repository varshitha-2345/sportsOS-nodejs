const mongoose = require('mongoose');
const { Schema } = mongoose;

const reviewSchema = new Schema({
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetId:   { type: Schema.Types.ObjectId, required: true },
  targetType: { type: String, enum: ['academy', 'coach'], required: true },
  rating:     { type: Number, min: 1, max: 5, required: true },

  title:    { type: String, maxlength: 100 },
  text:     { type: String, maxlength: 2000 },
  comment:  { type: String, maxlength: 2000 },

  photos:   [{ type: String }],

  parentName: { type: String },
  childAge:   { type: Number },
  sport:      { type: String },
  relationship: { type: String, enum: ['parent', 'athlete', 'other'], default: 'parent' },

  helpfulCount: { type: Number, default: 0 },
  reportedCount: { type: Number, default: 0 },

  isVerified: { type: Boolean, default: false },

  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  moderatorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

reviewSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
reviewSchema.index({ targetId: 1, targetType: 1, moderationStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);

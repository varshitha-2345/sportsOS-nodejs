const mongoose = require('mongoose');
const { Schema } = mongoose;

const sportSchema = new Schema({
  name:        { type: String, required: true, unique: true },
  slug:        { type: String, required: true, unique: true },
  description: String,
  icon:        String,
  coverImage:  String,

  category: {
    type: String,
    enum: ['team', 'individual', 'combat', 'racquet', 'aquatic', 'athletics', 'other'],
  },

  status: {
    type: String,
    enum: ['published', 'draft'],
    default: 'published',
  },

  competitionPathway: {
    levels: [{
      key:         { type: String, enum: ['district', 'state', 'national', 'international'] },
      label:       String,
      description: String,
    }],
  },

  explorationGuidance: {
    ageSuitability: {
      min: Number,
      max: Number,
    },
    physicalRequirements: [String],
    notes:                String,
  },
}, { timestamps: true });

module.exports = mongoose.model('Sport', sportSchema);

const mongoose = require('mongoose');
const { Schema } = mongoose;

const tournamentSchema = new Schema({
  tournamentName:   { type: String, required: true },
  level:            { type: String, enum: ['International', 'National'], required: true },
  organizer: { type: String },
  frequency:        { type: String, required: true },
  shortDescription: { type: String, required: true },
}, { _id: false });

const sportSchema = new Schema({
  // ── Basic Information ─────────────────────────────────────────
  name:             { type: String, required: true, unique: true },
  slug:             { type: String, required: true, unique: true },
  category:         { type: String, enum: ['Indoor', 'Outdoor', 'Both'], required: true },
  sportType:        { type: String, enum: ['team', 'individual', 'both'], required: true },
  shortDescription: { type: String, required: true },
  fullDescription:  { type: String, required: true },
  origin:           { type: String, required: true },
  popularityInIndia:    { type: String, required: true },
  popularityWorldwide:  { type: String, required: true },
  icon:             { type: String, default: '/images/sports/default-sport.svg' },
  coverImage:       { type: String, default: '/images/sports/default-sport-cover.jpg' },

  // ── Sport Details ─────────────────────────────────────────────
  howToPlay:        { type: String, required: true },
  objectiveOfGame:  { type: String, required: true },
  teamSize:         { type: String, required: true },
  matchDuration:    { type: String, required: true },
  scoringSystem:    { type: String, required: true },
  playingSurface:   { type: String, required: true },
  requiredEquipment: [{ type: String }],
  ageGroups:        { type: String, required: true },
  beginnerFriendly: { type: Boolean, default: false },
  olympicSport:     { type: Boolean, default: false },

  // ── Additional Practical Info ─────────────────────────────────
  estimatedMonthlyCost: { type: String, required: true },
  playingSeason:        { type: String, enum: ['All Year', 'Seasonal'], required: true },
  trainingFrequency:    { type: String, required: true },
  averageLearningTime:  { type: String, required: true },
  injuryRisk:           { type: String, enum: ['Low', 'Medium', 'High'], required: true },
  fitnessLevelRequired: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
  suitableFor:          [{ type: String, enum: ['Kids', 'Teens', 'Adults', 'Seniors'], required: true }],
  individualOrTeam:     { type: String, enum: ['Individual', 'Team', 'Both'], required: true },
  indoorOutdoor:        { type: String, enum: ['Indoor', 'Outdoor', 'Both'], required: true },

  // ── Benefits ──────────────────────────────────────────────────
  physicalBenefits: [{ type: String }],
  mentalBenefits:   [{ type: String }],
  skillsDeveloped:  [{ type: String }],

  // ── Career & Pathway ─────────────────────────────────────────
  careerOpportunities: [{ type: String }],
  scholarships:        [{ type: String }],
  professionalLeagues: [{ type: String }],

  // ── Tournament Information ────────────────────────────────────
  tournaments: [tournamentSchema],

  // ── Legacy / Frontend Compatibility ───────────────────────────
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

  // ── Status ────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['published', 'draft'],
    default: 'published',
  },
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

module.exports = mongoose.model('Sport', sportSchema);

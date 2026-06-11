const mongoose = require('mongoose');

const academySchema = new mongoose.Schema({
    name:        { type: String, required: true },
    sport:       { type: [String], required: true },  // Array: supports multiple sports e.g. ["Cricket","Football"]
    location:    { type: String, required: true },
    distanceKm:  { type: Number },
    verified:    { type: Boolean, default: false },
    // goalType: short-term = quick skill/trial (<3 months), long-term = career/competitive (6+ months)
    goalType:    { type: String, enum: ['short-term', 'long-term', 'both'], default: 'both' },
}, { timestamps: true });

module.exports = mongoose.model('Academy', academySchema);
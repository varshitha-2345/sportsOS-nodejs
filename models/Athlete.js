const mongoose = require('mongoose');

const athleteSchema = new mongoose.Schema({
    name:     { type: String, required: true },
    sport:    { type: [String], required: true },  // Array — supports multiple sports
    age:      { type: Number, required: true },
    academy:  { type: String, required: true },
    distanceKm: { type: Number },                  // distance from athlete's location
    goalType: { type: String, enum: ['short-term', 'long-term', 'both'], default: 'both' }
}, { timestamps: true });

module.exports = mongoose.model('Athlete', athleteSchema);
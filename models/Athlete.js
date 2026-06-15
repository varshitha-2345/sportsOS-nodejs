const mongoose = require('mongoose');

const athleteSchema = new mongoose.Schema({
    name:     { type: String, required: true },
    sport:    { type: [String], required: true },  // Array — supports multiple sports
    age:      { type: Number, required: true },
    academy:  { type: String, required: true },
    distanceKm: { type: Number },                  // distance from athlete's location
    goalType: { type: String, enum: ['short-term', 'long-term', 'both'], default: 'both' }
}, { timestamps: true });

athleteSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Athlete', athleteSchema);
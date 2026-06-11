const mongoose = require('mongoose');

const shortlistSchema = new mongoose.Schema({
    athleteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', required: true },
    academyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academy', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Shortlist', shortlistSchema);
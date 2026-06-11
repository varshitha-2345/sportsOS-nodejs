const mongoose = require('mongoose');

const coachSchema = new mongoose.Schema({
    name:      { type: String, required: true },
    sport:     { type: String, required: true },
    academyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academy', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Coach', coachSchema);
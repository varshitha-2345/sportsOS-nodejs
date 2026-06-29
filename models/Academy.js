const mongoose = require('mongoose');

const academySchema = new mongoose.Schema({
    academyId:      { type: String },
    name:           { type: String, required: true },
    slug:           { type: String, unique: true },
    latitude:       { type: Number },
    longitude:      { type: Number },
    description:    { type: String },
    sport:          { type: String, required: true },   // single string, e.g. "Cricket"
    address:        { type: String },
    city:           { type: String },
    state:          { type: String },
    contactNumber:  { type: String },
    googleMapsLink: { type: String },
    academyImage:   { type: String },
    fees:           { type: String },
    facilities:     { type: String },   // comma-separated string, e.g. "Gym, Practice Pitch"
    batchTimings:   { type: String },
    ageGroups:      { type: String },
    gender:         { type: String },
    batchCapacity:  { type: Number },
    verified:       { type: Boolean, default: false },
    socialLinks:    { type: String },   // stored as a JSON string
    rating:         { type: Number, default: 0 },
    reviewCount:    { type: Number, default: 0 },
    savedCount:     { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Academy', academySchema);
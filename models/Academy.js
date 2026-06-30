const mongoose = require('mongoose');

const academySchema = new mongoose.Schema({
    academyId:      { type: String },
    name:           { type: String, required: true },
    slug:           { type: String, unique: true },
    latitude:       { type: Number },
    longitude:      { type: Number },
    description:    { type: String },

    // Single sport stored in DB
    sport:          { type: String, required: true },

    address:        { type: String },
    city:           { type: String },
    state:          { type: String },

    contactNumber:  { type: String },
    googleMapsLink: { type: String },

    academyImage:   { type: String },

    fees:           { type: String },

    // Facilities Array
    facilities: {
        type: [String],
        default: []
    },

    batchTimings:   { type: String },
    ageGroups:      { type: String },
    gender:         { type: String },
    batchCapacity:  { type: Number },

    verified:       { type: Boolean, default: false },

    socialLinks:    { type: String },

    // ✅ Added fields
    gallery: {
        type: [String],
        default: []
    },

    trainingLevels: {
        type: [String],
        default: []
    },

    certifications: {
        type: [String],
        default: []
    },

    achievementSignals: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    rating:         { type: Number, default: 0 },
    reviewCount:    { type: Number, default: 0 },
    savedCount:     { type: Number, default: 0 },

    status: {
        type: String,
        enum: ['draft', 'published', 'suspended'],
        default: 'published'
    }

}, { timestamps: true });

module.exports = mongoose.model('Academy', academySchema);

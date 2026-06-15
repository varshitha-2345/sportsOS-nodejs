const mongoose = require('mongoose');

const certificationSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    issuer:      { type: String, required: true },
    year:        { type: Number, required: true },
    documentUrl: { type: String },
}, { _id: false });

const achievementSignalsSchema = new mongoose.Schema({
    stateAthletesProduced:     { type: Number, default: 0 },
    nationalAthletesProduced:  { type: Number, default: 0 },
    competitionParticipations: [{ type: String }],
    milestones:                [{ type: String }],
}, { _id: false });

const academySchema = new mongoose.Schema({
    slug:               { type: String, required: true, unique: true, lowercase: true },
    name:               { type: String, required: true },
    description:        { type: String, default: '' },
    location: {
        address:        { type: String },
        city:           { type: String, required: true },
        state:          { type: String, required: true },
        country:        { type: String, default: 'IN' },
        district:       { type: String },
        lat:            { type: Number, default: 0 },
        lng:            { type: Number, default: 0 },
        pincode:        { type: String },
        geohash:        { type: String },
    },
    contact: {
        phone:          { type: String },
        email:          { type: String },
        website:        { type: String },
    },
    sportsOffered:      [{ type: String }],
    facilities:         [{ type: String, enum: ['indoor','outdoor','ground','court','equipment','changing_room','parking','physio','gym'] }],
    trainingLevels:     [{ type: String, enum: ['beginner','intermediate','advanced','elite'] }],
    certifications:     [certificationSchema],
    verificationStatus: { type: String, enum: ['unverified','pending','verified','rejected'], default: 'unverified' },
    achievementSignals: { type: achievementSignalsSchema, default: () => ({}) },
    rating: {
        average:        { type: Number, default: 0 },
        count:          { type: Number, default: 0 },
    },
    coverImage:         { type: String },
    status:             { type: String, enum: ['draft','published','suspended'], default: 'published' },
}, { timestamps: true });

academySchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        ret.lastUpdatedAt = ret.updatedAt;
        delete ret._id;
        delete ret.__v;
        delete ret.updatedAt;
        return ret;
    }
});

module.exports = mongoose.model('Academy', academySchema);

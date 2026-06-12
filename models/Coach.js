const mongoose = require('mongoose');

const certificationSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    issuer:      { type: String, required: true },
    year:        { type: Number, required: true },
    documentUrl: { type: String },
}, { _id: false });

const coachSchema = new mongoose.Schema({
    slug:               { type: String, required: true, unique: true, lowercase: true },
    name:               { type: String, required: true },
    avatar:             { type: String },
    certifications:     [certificationSchema],
    experienceYears:    { type: Number, default: 0 },
    sportsCoached:      [{ type: String }],
    specialization:     [{ type: String }],
    academyId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Academy' },
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
    },
    verificationStatus: { type: String, enum: ['unverified','pending','verified','rejected'], default: 'unverified' },
    rating: {
        average:        { type: Number, default: 0 },
        count:          { type: Number, default: 0 },
    },
    status:             { type: String, enum: ['draft','published','suspended'], default: 'published' },
}, { timestamps: true });

coachSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        ret.lastUpdatedAt = ret.updatedAt;
        delete ret._id;
        delete ret.__v;
        delete ret.updatedAt;
        return ret;
    }
});

module.exports = mongoose.model('Coach', coachSchema);

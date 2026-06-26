const mongoose = require('mongoose');

const childSchema = new mongoose.Schema({
    name:       { type: String, required: true },
    age:        { type: Number, required: true, min: 1, max: 25 },
    gender:     { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    sportInterests: [{ type: String }],
    skillLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'competitive'] },
}, { _id: true, timestamps: false });

const userSchema = new mongoose.Schema({
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone:    { type: String },
    avatar:   { type: String },
    authProvider: { type: String, enum: ['credentials', 'google', 'microsoft'], default: 'credentials' },
    lastLoginAt:  { type: Date },
    role:     { type: String, enum: ['athlete', 'parent', 'coach', 'academy_owner', 'admin'], default: 'athlete' },
    isVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    onboardingCompleted: { type: Boolean, default: false },
    // Onboarding profile fields
    age:            { type: Number, min: 1, max: 120 },
    gender:         { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    sportInterests: [{ type: String }],
    skillLevel:     { type: String, enum: ['beginner', 'intermediate', 'advanced', 'competitive'] },
    goals:          { type: String, maxlength: 500 },
    location:       { type: String },
    children:       [childSchema],
    // Preferences and consent
    preferences: {
        type: {
            favoriteSports: [{ type: String }],
            city:           { type: String, default: '' },
            radius:         { type: Number, default: 5 },
            skillLevel:     { type: String, default: '' },
            goals:          { type: String, default: '' },
            notifications:  { type: Boolean, default: true },
            language:       { type: String, default: 'en' },
        },
        default: {},
    },
    consent: {
        type: {
            analytics:  { type: Boolean, default: false },
            marketing:  { type: Boolean, default: false },
            whatsapp:   { type: Boolean, default: false },
        },
        default: { analytics: false, marketing: false, whatsapp: false },
    },
    themePreference: { type: String, enum: ['alpine-light', 'midnight-ice', 'system'], default: 'system' },
    // Password reset fields
    resetPasswordToken:   { type: String },
    resetPasswordExpires: { type: Date },
}, { timestamps: true });

userSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        return ret;
    }
});

module.exports = mongoose.model('User', userSchema);

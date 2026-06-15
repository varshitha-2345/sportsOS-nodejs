const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone:    { type: String },
    role:     { type: String, enum: ['athlete', 'parent', 'coach', 'academy_owner', 'admin'], default: 'athlete' }
}, { timestamps: true });

userSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
    }
});

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const shortlistSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemType: { type: String, enum: ['academy', 'coach', 'sport'], required: true },
    itemId: { type: String, required: true },
}, { timestamps: true });

// One user can save a given item only once
shortlistSchema.index({ userId: 1, itemType: 1, itemId: 1 }, { unique: true });

shortlistSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Shortlist', shortlistSchema);

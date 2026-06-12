const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    targetType: { type: String, enum: ['academy', 'coach'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    intent: { type: String, enum: ['contact', 'callback', 'trial', 'enrollment_interest'], default: 'trial' },
    parentInfo: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true },
    },
    childInfo: {
        name: { type: String },
        age: { type: Number },
    },
    sportInterest: { type: String, required: true },
    message: { type: String },
    status: { type: String, enum: ['submitted', 'delivered', 'failed', 'bounced'], default: 'submitted' },
    deliveryAttempts: { type: Number, default: 0 },
    lastDeliveryAt: { type: Date },
    failureReason: { type: String },
    whatsappConfirmationSent: { type: Boolean, default: false },
    whatsappMessageId: { type: String },
    leadId: { type: String },
    ipHash: { type: String },
    userAgentHash: { type: String },
}, { timestamps: true });

enquirySchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Enquiry', enquirySchema);

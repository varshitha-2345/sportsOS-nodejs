const mongoose = require('mongoose');
const { Schema } = mongoose;

const otpSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  otp:    { type: String, required: true },
  type: {
    type: String,
    enum: ['email_verification', 'phone_verification', 'password_reset', 'login'],
    required: true,
  },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 10 * 60 * 1000) },
}, { timestamps: true });

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', otpSchema);

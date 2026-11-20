const mongoose = require('mongoose');

const EmailVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, enum: ['signup'], required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

EmailVerificationSchema.index({ email: 1, purpose: 1 }, { unique: true });
EmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-deletes expired codes

module.exports = mongoose.model('EmailVerification', EmailVerificationSchema);
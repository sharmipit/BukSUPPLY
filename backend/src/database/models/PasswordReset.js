const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  codeHash: { type: String, required: true }, // the code itself is never stored
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB auto-deletes expired codes

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
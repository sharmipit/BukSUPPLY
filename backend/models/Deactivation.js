const mongoose = require('mongoose');

/**
 * One row per deactivation. The User document only keeps accountStatus, so this
 * remembers WHY, WHEN and BY WHOM an account was deactivated. The reason is shown to
 * the user when they try to sign in, and to the administrator in the account details.
 *
 * "active: true" marks the current deactivation. It is switched off when the account
 * is reactivated, so the history of earlier deactivations is kept.
 */
const deactivationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    source: { type: String, enum: ['admin', 'self'], required: true },
    reason: { type: String, trim: true, maxlength: 300, default: '' },
    byName: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
    endedAt: { type: Date },
    endedByName: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Deactivation || mongoose.model('Deactivation', deactivationSchema);
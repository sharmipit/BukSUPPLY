const mongoose = require('mongoose');

// Tracks user account deactivations (reason, actor, active status, history)
const deactivationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    source: { type: String, enum: ['admin', 'self'], required: true },
    reason: { type: String, trim: true, maxlength: 300, default: '' },
    byName: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
    endedAt: { type: Date },
    endedByName: { type: String, trim: true, default: '' },
    endReason: { type: String, trim: true, maxlength: 300, default: '' }, // why it was reactivated
  },
  { timestamps: true }
);

module.exports = mongoose.models.Deactivation || mongoose.model('Deactivation', deactivationSchema);
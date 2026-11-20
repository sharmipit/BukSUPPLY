const mongoose = require('mongoose');

// Reactivation request sent by deactivated users for administrator review
const reactivationRequestSchema = new mongoose.Schema(
  {
    // No "index: true" here: the partial unique index on { user: 1 } below already covers it
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, trim: true, required: true, maxlength: 500 },
    status: { type: String, enum: ['Pending', 'Approved', 'Declined'], default: 'Pending' },
    resolvedAt: { type: Date },
    resolvedByName: { type: String, trim: true, default: '' },
    adminNote: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

// A user can have only ONE pending request at a time (stops spamming the administrator)
reactivationRequestSchema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { status: 'Pending' } }
);

module.exports =
  mongoose.models.ReactivationRequest ||
  mongoose.model('ReactivationRequest', reactivationRequestSchema);
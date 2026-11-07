const mongoose = require('mongoose');

const CATEGORIES = [
  'Account',
  'Requisition',
  'Inventory',
  'Report',
  'User Management',
  'System',
  'System Settings',
];

const ActivityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Snapshot of who did it, so the log stays readable even if the account changes later
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    action: { type: String, required: true }, // e.g. SIGN_IN, REQUISITION_FILED
    description: { type: String, required: true },
    reference: { type: String, default: '' }, // e.g. the slip number
    ip: { type: String, default: '' },
  },
  // Log entries are never edited, so there is no updatedAt
  { timestamps: { createdAt: true, updatedAt: false } }
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
module.exports.CATEGORIES = CATEGORIES;

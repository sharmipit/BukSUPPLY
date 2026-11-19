const mongoose = require('mongoose');

// Gives each slip a readable, collision-free number: REQ-2026-001, 002, ...
const Counter =
  mongoose.models.Counter ||
  mongoose.model(
    'Counter',
    new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } })
  );

// In-stock items: linked to a real inventory item so stock can be deducted
const stockLine = new mongoose.Schema(
  {
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
    name: { type: String, required: true, trim: true },
    unit: { type: String, trim: true, default: '' },
    qty: { type: Number, required: true, min: 1 },
    reason: { type: String, trim: true, default: '' },
    maxNormal: Number,
  },
  { _id: false }
);

const RequisitionSchema = new mongoose.Schema(
  {
    slipNumber: { type: String, unique: true, index: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    department: { type: String, trim: true, default: '' },
    title: { type: String, required: [true, 'Title is required'], trim: true },
    purpose: { type: String, required: [true, 'Purpose is required'], trim: true },
    itemsList: [stockLine],
    // Pending -> Processing -> Approved (ready for release) -> Accepted (received by requester)
    // Denied is possible before Accepted. Cancelled is set by the requester while Pending.
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Approved', 'Accepted', 'Denied', 'Cancelled'],
      default: 'Pending',
    },
    remarks: { type: String, default: '' },
    denyReason: { type: String, default: '' },
    approvedAt: Date, // when the items were marked ready for release
    processedAt: Date, // when the slip reached its final state (Accepted or Denied)
    reviewedBy: { type: String, default: '' }, // moderator/admin who last handled it
    reviewedAt: Date,
    cancelledAt: Date,
    // Set once stock has been deducted for this slip, so it can never be deducted twice
    stockDeducted: { type: Boolean, default: false },
    // Set when a slip is denied, so an administrator's Undo can return it to where it was
    previousStatus: { type: String, default: '' },
    previousRemarks: { type: String, default: '' },
    // Set the first time the Google Form shows a valid response for this slip.
    // Once set, the "Send Feedback" button stays disabled for good.
    feedbackSubmittedAt: { type: Date },
  },
  { timestamps: true }
);

RequisitionSchema.statics.nextSlipNumber = async function () {
  const year = new Date().getFullYear();
  const c = await Counter.findOneAndUpdate(
    { _id: `req-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `REQ-${year}-${String(c.seq).padStart(3, '0')}`;
};

module.exports = mongoose.model('Requisition', RequisitionSchema);
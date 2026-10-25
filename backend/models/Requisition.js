const mongoose = require('mongoose');

// Gives each slip a readable, collision-free number: REQ-2026-001, 002, ...
const Counter =
  mongoose.models.Counter ||
  mongoose.model(
    'Counter',
    new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } })
  );

// External purchase items: free text, not linked to the inventory
const stockItem = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 1 },
    reason: { type: String, trim: true, default: '' },
    maxNormal: Number,
  },
  { _id: false }
);

// In-stock (bodega) items: linked to a real inventory item so stock can be deducted
const bodegaItem = new mongoose.Schema(
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
    itemsList: [bodegaItem], // in-stock items
    purchaseItems: [stockItem], // special purchase items
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Purchasing', 'Accepted', 'Denied'],
      default: 'Pending',
    },
    remarks: { type: String, default: '' },
    processedAt: Date,
    reviewedBy: { type: String, default: '' }, // name of the moderator/admin who last handled it
    reviewedAt: Date,
    // Set once stock has been deducted for this slip, so it can never be deducted twice
    stockDeducted: { type: Boolean, default: false },
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

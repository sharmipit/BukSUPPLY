const mongoose = require('mongoose');

// ITM-001, ITM-002 ... without race conditions
const Counter =
  mongoose.models.Counter ||
  mongoose.model(
    'Counter',
    new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } })
  );

const movementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Created', 'Received', 'Withdrawn', 'Edited', 'Archived', 'Restored'],
    required: true,
  },
  qty: Number,
  before: Number,
  after: Number,
  by: String,
  reference: { type: String, default: '' },
  remark: { type: String, default: '' },
  date: { type: Date, default: Date.now },
});

const itemSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    supplier: { type: String, default: '', trim: true, maxlength: 120 },
    unit: { type: String, default: 'pcs', trim: true },
    quantity: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 10, min: 0 },
    maxNormal: { type: Number, default: 10, min: 1 },
    // Archived items are hidden from requests and counts, but never deleted
    archived: { type: Boolean, default: false, index: true },
    archivedAt: Date,
    archivedBy: String,
    addedBy: String,
    updatedBy: String,
    movements: [movementSchema],
  },
  { timestamps: true }
);

// Shapes the JSON exactly like the React pages expect:
// id = "ITM-001" (display + API path), _id = Mongo id (used by requisitions)
itemSchema.set('toJSON', {
  transform(doc, ret) {
    ret.id = ret.code;
    ret._id = String(ret._id);
    ret.dateAdded = ret.createdAt;
    ret.updated = ret.updatedAt;
    // Old documents have no supplier / archived fields yet
    ret.supplier = ret.supplier || '';
    ret.archived = !!ret.archived;
    if (ret.movements) {
      ret.movements = ret.movements.map((m) => ({
        ...m,
        id: String(m._id),
        _id: undefined,
      }));
    }
    // Old documents may still carry a "location" value in MongoDB; never send it
    delete ret.location;
    delete ret.createdAt;
    delete ret.updatedAt;
    delete ret.__v;
    return ret;
  },
});

const InventoryItem = mongoose.model('InventoryItem', itemSchema);

InventoryItem.nextCode = async () => {
  const c = await Counter.findOneAndUpdate(
    { _id: 'inventory' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `ITM-${String(c.seq).padStart(3, '0')}`;
};

module.exports = InventoryItem;

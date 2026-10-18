const mongoose = require("mongoose");

// Gives each slip a readable, collision-free number: REQ-2026-001, 002, ...
const Counter = mongoose.models.Counter ||
  mongoose.model("Counter", new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }));

const stockItem = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 1 },
    reason: { type: String, trim: true, default: "" },
    maxNormal: Number, // display-only for now; real limits should come from inventory later
  },
  { _id: false }
);

const RequisitionSchema = new mongoose.Schema(
  {
    slipNumber: { type: String, unique: true, index: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    department: { type: String, trim: true, default: "" },
    title: { type: String, required: [true, "Title is required"], trim: true },
    purpose: { type: String, required: [true, "Purpose is required"], trim: true },
    itemsList: [stockItem],     // in-stock items
    purchaseItems: [stockItem], // special purchase items
    status: {
      type: String,
      enum: ["Pending", "Processing", "Purchasing", "Accepted", "Denied"],
      default: "Pending",
    },
    remarks: { type: String, default: "" },
    processedAt: Date,
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
  return `REQ-${year}-${String(c.seq).padStart(3, "0")}`;
};

module.exports = mongoose.model("Requisition", RequisitionSchema);
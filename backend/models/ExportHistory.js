const mongoose = require('mongoose');

const exportHistorySchema = new mongoose.Schema(
  {
    report: { type: String, enum: ['stocks', 'requests', 'transactions'], required: true },
    format: { type: String, enum: ['pdf', 'xlsx'], required: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    user: { type: String, default: 'Unknown user' },
  },
  { timestamps: true }
);

exportHistorySchema.set('toJSON', {
  transform(doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    delete ret.updatedAt;
    return ret;
  },
});

module.exports = mongoose.model('ExportHistory', exportHistorySchema);

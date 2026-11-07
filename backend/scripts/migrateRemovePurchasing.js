require('dotenv').config();
const mongoose = require('mongoose');
const Requisition = require('../models/Requisition');

const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const col = Requisition.collection; // raw collection: bypasses the new schema/enum

  const purchasing = await col.countDocuments({ status: 'Purchasing' });
  const withPurchase = await col.countDocuments({ purchaseItems: { $exists: true } });
  // Slips that only had purchase items are now empty and need a manual decision
  const emptyActive = await col
    .find({
      itemsList: { $size: 0 },
      status: { $in: ['Pending', 'Processing', 'Purchasing'] },
    })
    .project({ slipNumber: 1, status: 1 })
    .toArray();

  console.log(`Slips in "Purchasing": ${purchasing} (will become "Processing")`);
  console.log(`Slips with purchaseItems field: ${withPurchase} (field will be removed)`);
  console.log(
    `Active slips with NO stock items (review manually): ${
      emptyActive.map((s) => `${s.slipNumber} [${s.status}]`).join(', ') || 'none'
    }`
  );

  if (APPLY) {
    await col.updateMany({ status: 'Purchasing' }, { $set: { status: 'Processing' } });
    await col.updateMany({ purchaseItems: { $exists: true } }, { $unset: { purchaseItems: '' } });
    console.log('Done.');
  } else {
    console.log('Dry run only. Re-run with --apply to make the changes.');
  }
  await mongoose.disconnect();
})();
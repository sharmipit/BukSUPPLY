const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const Requisition = require('../models/Requisition'); // adjust to your model path
const AppError = require('../utils/AppError');

const MAX_MOVE_ATTEMPTS = 5;

// Atomically adjust stock and record movement history in one write (prevents negative quantity and lost history)
async function moveStock(match, delta, { by, reference = '', remark = '' }) {
  for (let attempt = 0; attempt < MAX_MOVE_ATTEMPTS; attempt++) {
    const current = await InventoryItem.findOne(match).select('quantity');
    if (!current) return null;

    const before = current.quantity;
    const after = before + delta;
    if (after < 0) return null;

    const movementId = new mongoose.Types.ObjectId();
    const item = await InventoryItem.findOneAndUpdate(
      { ...match, _id: current._id, quantity: before },
      {
        $set: { quantity: after, updatedBy: by },
        $push: {
          movements: {
            _id: movementId,
            type: delta > 0 ? 'Received' : 'Withdrawn',
            qty: Math.abs(delta),
            before,
            after,
            by,
            reference,
            remark,
            date: new Date(),
          },
        },
      },
      { new: true }
    );

    if (item) {
      return { item, movementId, before, after };
    }
  }

  throw new AppError('Stock was updated concurrently. Please try again.', 409);
}

async function undoMove(itemId, delta, movementId) {
  await InventoryItem.updateOne(
    { _id: itemId },
    { $inc: { quantity: -delta }, $pull: { movements: { _id: movementId } } }
  );
}

// Old slips have no saved link, so fall back to matching the item name (ignoring case)
async function resolveItemId(line) {
  if (mongoose.isValidObjectId(line.inventoryItemId)) return line.inventoryItemId;
  const name = String(line.name || '').trim();
  if (!name) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = await InventoryItem.findOne({ name: new RegExp(`^${escaped}$`, 'i') }).select(
    '_id'
  );
  return found ? found._id : null;
}

// Deduct stock for accepted requisition (atomic and idempotent via stockDeducted flag)
async function deductForRequisition(requisitionId, by) {
  const reqDoc = await Requisition.findOneAndUpdate(
    { _id: requisitionId, stockDeducted: { $ne: true } },
    { $set: { stockDeducted: true } },
    { new: true }
  );
  if (!reqDoc) return { skipped: true, deducted: [] };

  const reference = reqDoc.slipNumber || String(reqDoc._id);
  const done = [];
  const summary = []; // what the moderator sees after accepting

  try {
    // In-stock lines, then purchased lines. Both must exist in the inventory with enough on hand:
    // bought items have to be received into the inventory first, then they are handed out.
    const lines = [
      ...(reqDoc.itemsList || []).map((line) => ({ line, bought: false })),
      ...(reqDoc.purchaseItems || []).map((line) => ({ line, bought: true })),
    ];

    for (const { line, bought } of lines) {
      const qty = Math.floor(Number(line.qty));
      if (!(qty >= 1)) continue;

      const itemId = await resolveItemId(line);
      if (!itemId) {
        throw new Error(
          bought
            ? `"${line.name}" hasn't been added to the inventory yet. Receive it in Inventory first, then accept.`
            : `"${line.name}" can't be found in the inventory. Add it in Inventory first, or deny the request.`
        );
      }

      const res = await moveStock({ _id: itemId }, -qty, {
        by,
        reference,
        remark: bought ? 'Requisition claimed (purchased item)' : 'Requisition claimed',
      });

      if (!res) {
        const it = await InventoryItem.findById(itemId).select('name quantity unit');
        throw new Error(
          it
            ? bought
              ? `Only ${it.quantity} ${it.unit} of ${it.name} is in the inventory, but ${qty} are needed. Receive the purchased items in Inventory first.`
              : `Not enough stock for ${it.name}: ${it.quantity} left, ${qty} requested.`
            : 'An item on this slip no longer exists in the inventory.'
        );
      }
      done.push({ itemId, delta: -qty, movementId: res.movementId });
      summary.push({
        name: res.item.name,
        unit: res.item.unit,
        qty,
        before: res.before,
        after: res.after,
      });
    }
  } catch (err) {
    for (const d of done.reverse()) await undoMove(d.itemId, d.delta, d.movementId);
    await Requisition.updateOne({ _id: requisitionId }, { $set: { stockDeducted: false } });
    throw err;
  }
  return { skipped: false, deducted: summary };
}

// Roll back stock deductions on requisition undo (restores inventory levels and records movements)
async function restoreForRequisition(requisitionId, by) {
  const reqDoc = await Requisition.findOneAndUpdate(
    { _id: requisitionId, stockDeducted: true },
    { $set: { stockDeducted: false } },
    { new: true }
  );
  if (!reqDoc) return { skipped: true, restored: [], missing: [] };

  const reference = reqDoc.slipNumber || String(reqDoc._id);
  const restored = [];
  const missing = [];

  const lines = [...(reqDoc.itemsList || []), ...(reqDoc.purchaseItems || [])];
  for (const line of lines) {
    const qty = Math.floor(Number(line.qty));
    if (!(qty >= 1)) continue;

    const itemId = await resolveItemId(line);
    const res = itemId
      ? await moveStock({ _id: itemId }, qty, {
          by,
          reference,
          remark: `Returned to stock: undo of ${reference}`,
        })
      : null;

    if (!res) {
      missing.push(line.name);
      continue;
    }
    restored.push({
      name: res.item.name,
      unit: res.item.unit,
      qty,
      before: res.before,
      after: res.after,
    });
  }
  return { skipped: false, restored, missing };
}

module.exports = { moveStock, deductForRequisition, restoreForRequisition };

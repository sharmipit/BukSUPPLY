const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const Requisition = require('../models/Requisition'); // adjust to your model path

/**
 * Atomically add (delta > 0) or remove (delta < 0) stock and log the movement.
 * A withdrawal only matches if enough stock exists, so stock can never go negative
 * and two admins can't both spend the same units.
 * Returns null when the match failed (not found / not enough stock).
 */
async function moveStock(match, delta, { by, reference = '', remark = '' }) {
  const filter = { ...match };
  if (delta < 0) filter.quantity = { $gte: -delta };

  const before = await InventoryItem.findOneAndUpdate(
    filter,
    { $inc: { quantity: delta }, $set: { updatedBy: by } },
    { new: false } // returns the document as it was BEFORE the change
  );
  if (!before) return null;

  const movementId = new mongoose.Types.ObjectId();
  const item = await InventoryItem.findByIdAndUpdate(
    before._id,
    {
      $push: {
        movements: {
          _id: movementId,
          type: delta > 0 ? 'Received' : 'Withdrawn',
          qty: Math.abs(delta),
          before: before.quantity,
          after: before.quantity + delta,
          by,
          reference,
          remark,
          date: new Date(),
        },
      },
    },
    { new: true }
  );
  return { item, movementId, before: before.quantity, after: before.quantity + delta };
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

/**
 * Called when an admin accepts a requisition. Deducts every in-stock line and every purchased line.
 * All-or-nothing: if any item is short, earlier deductions are rolled back and an error is thrown.
 * Safe to call twice: the stockDeducted flag makes the second call a no-op.
 */
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
        remark: bought ? 'Requisition approved (purchased item)' : 'Requisition approved',
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

module.exports = { moveStock, deductForRequisition };

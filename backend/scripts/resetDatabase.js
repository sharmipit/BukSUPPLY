/**
 * Database Reset Script for BukSUPPLY
 * 
 * Clears test/transaction data to reset the system "back to day 1" for demonstrations,
 * while safely preserving all Administrator accounts.
 * 
 * Usage:
 *   node scripts/resetDatabase.js --dry-run
 *     (Shows what will be deleted and kept without changing anything)
 * 
 *   node scripts/resetDatabase.js --confirm
 *     (Clears transactions, requisitions, logs, non-admin users, and resets counters. Keeps inventory items.)
 * 
 *   node scripts/resetDatabase.js --confirm --wipe-inventory
 *     (Also wipes all inventory items and resets inventory counter to ITM-001)
 * 
 *   node scripts/resetDatabase.js --confirm --keep-moderators
 *     (Keeps Moderator accounts in addition to Administrators)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Load models
const User = require('../models/User');
const Requisition = require('../models/Requisition');
const InventoryItem = require('../models/InventoryItem');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const Deactivation = require('../models/Deactivation');
const ReactivationRequest = require('../models/ReactivationRequest');
const EmailVerification = require('../models/EmailVerification');
const ExportHistory = require('../models/ExportHistory');

// Counter model (registered in InventoryItem and Requisition)
const Counter = mongoose.models.Counter || mongoose.model(
  'Counter',
  new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } })
);

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isConfirmed = args.includes('--confirm');
  const wipeInventory = args.includes('--wipe-inventory');
  const keepModerators = args.includes('--keep-moderators');

  if (!isDryRun && !isConfirmed) {
    console.log(`
=============================================================
  BukSUPPLY Database Reset Tool
=============================================================

This tool will prepare your database for your presentation by:
  - Keeping all Administrator accounts intact
  - Removing test user accounts (Students, Regular Staff${keepModerators ? '' : ', Moderators'})
  - Deleting all requisitions & requisition number sequences
  - Deleting all notifications & activity/audit logs
  - Deleting deactivation & reactivation records
  - Deleting pending verification codes & export histories
  - Resetting requisition counter back to 001 (e.g., REQ-${new Date().getFullYear()}-001)
  - ${wipeInventory ? 'Wiping all inventory items and resetting item code to ITM-001' : 'Preserving existing inventory items (use --wipe-inventory to clear them too)'}

To preview what would be cleared without modifying anything:
  npm run db:reset:dry
  OR
  node scripts/resetDatabase.js --dry-run

To execute the reset:
  npm run db:reset
  OR
  node scripts/resetDatabase.js --confirm

Options:
  --wipe-inventory    Also deletes all inventory items and resets item code to ITM-001
  --keep-moderators   Keep Moderator accounts in addition to Administrator accounts
=============================================================
`);
    process.exit(0);
  }

  console.log(`\nConnecting to MongoDB...`);
  await connectDB();

  console.log(isDryRun ? `\n--- [DRY RUN MODE: No data will be deleted] ---` : `\n--- [RESETTING DATABASE] ---`);

  // 1. Identify users to preserve vs delete
  const rolesToKeep = ['Administrator'];
  if (keepModerators) rolesToKeep.push('Moderator');

  const adminsToKeep = await User.find({ role: { $in: rolesToKeep } }).select('firstName lastName email role');
  const usersToDeleteCount = await User.countDocuments({ role: { $nin: rolesToKeep } });

  console.log(`\n[User Accounts]`);
  console.log(`  Preserving ${adminsToKeep.length} account(s):`);
  adminsToKeep.forEach(admin => {
    console.log(`    - [${admin.role}] ${admin.firstName} ${admin.lastName} (${admin.email})`);
  });
  console.log(`  Users to delete: ${usersToDeleteCount} account(s)`);

  // 2. Count transactional and logging records
  const reqCount = await Requisition.countDocuments();
  const notifCount = await Notification.countDocuments();
  const logCount = await ActivityLog.countDocuments();
  const deactCount = await Deactivation.countDocuments();
  const reactCount = await ReactivationRequest.countDocuments();
  const emailVerifCount = await EmailVerification.countDocuments();
  const exportCount = await ExportHistory.countDocuments();
  const invCount = await InventoryItem.countDocuments();
  const counterCount = await Counter.countDocuments();

  console.log(`\n[Records Summary]`);
  console.log(`  - Requisitions:       ${reqCount}`);
  console.log(`  - Notifications:      ${notifCount}`);
  console.log(`  - Activity Logs:      ${logCount}`);
  console.log(`  - Deactivations:      ${deactCount}`);
  console.log(`  - Reactivation Reqs:  ${reactCount}`);
  console.log(`  - Email Verifications:${emailVerifCount}`);
  console.log(`  - Export Histories:   ${exportCount}`);
  console.log(`  - Inventory Items:    ${invCount} (${wipeInventory ? 'WILL BE WIPED' : 'WILL BE KEPT'})`);
  console.log(`  - Sequence Counters:  ${counterCount}`);

  if (isDryRun) {
    console.log(`\nDry run complete. No changes were made.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // Perform Deletions
  console.log(`\nExecuting clean-up...`);

  // Delete non-admin users
  const deletedUsers = await User.deleteMany({ role: { $nin: rolesToKeep } });
  console.log(`  ✓ Removed ${deletedUsers.deletedCount} user account(s).`);

  // Reset admin accounts to active, clean state
  await User.updateMany(
    { role: { $in: rolesToKeep } },
    {
      $set: {
        accountStatus: 'Active',
        archived: false,
        'reactivationNotice.pending': false,
        'reactivationNotice.reason': '',
      },
      $unset: {
        resetPasswordOtp: '',
        resetPasswordOtpExpires: '',
        resetPasswordOtpAttempts: '',
      }
    }
  );
  console.log(`  ✓ Cleaned and verified ${adminsToKeep.length} preserved account(s) (Status: Active).`);

  // Delete requisitions
  const deletedReqs = await Requisition.deleteMany({});
  console.log(`  ✓ Removed ${deletedReqs.deletedCount} requisition(s).`);

  // Delete notifications
  const deletedNotifs = await Notification.deleteMany({});
  console.log(`  ✓ Removed ${deletedNotifs.deletedCount} notification(s).`);

  // Delete activity logs
  const deletedLogs = await ActivityLog.deleteMany({});
  console.log(`  ✓ Removed ${deletedLogs.deletedCount} activity log(s).`);

  // Delete deactivations & reactivation requests
  const deletedDeact = await Deactivation.deleteMany({});
  const deletedReact = await ReactivationRequest.deleteMany({});
  console.log(`  ✓ Removed ${deletedDeact.deletedCount} deactivation(s) and ${deletedReact.deletedCount} reactivation request(s).`);

  // Delete email verifications & export histories
  const deletedVerifs = await EmailVerification.deleteMany({});
  const deletedExports = await ExportHistory.deleteMany({});
  console.log(`  ✓ Removed ${deletedVerifs.deletedCount} verification code(s) and ${deletedExports.deletedCount} export history log(s).`);

  // Reset Requisition sequence counters
  const currentYear = new Date().getFullYear();
  await Counter.deleteMany({ _id: { $regex: /^req-/ } });
  console.log(`  ✓ Reset Requisition counter (next slip will be REQ-${currentYear}-001).`);

  // Inventory handling
  if (wipeInventory) {
    const deletedInv = await InventoryItem.deleteMany({});
    await Counter.deleteOne({ _id: 'inventory' });
    console.log(`  ✓ Removed ${deletedInv.deletedCount} inventory item(s) and reset item counter to ITM-001.`);
  } else {
    // Clear out movement logs within items if desired, but keep stock items intact
    console.log(`  ✓ Kept all ${invCount} inventory item(s).`);
  }

  console.log(`\n=============================================================`);
  console.log(`🎉 Database reset successfully completed!`);
  console.log(`Your system is clean and ready for the final presentation.`);
  console.log(`=============================================================\n`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('\nReset failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

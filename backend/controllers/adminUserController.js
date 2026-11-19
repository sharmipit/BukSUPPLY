const mongoose = require('mongoose');
const User = require('../models/User');
const Deactivation = require('../models/Deactivation');
const ReactivationRequest = require('../models/ReactivationRequest');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../services/activityLog');
const { sendEmail } = require('../utils/sendEmail');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeHtml = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

// Administrators are never listed and can never be deactivated from this page
const MANAGED_ROLES = ['Student', 'Regular Staff', 'Moderator'];
const REASON_MIN = 5;
const REASON_MAX = 300;

const fullName = (u) =>
  [u.firstName, u.lastName].filter((n) => n && n !== '-').join(' ') || u.email || 'Unknown user';

// Shape a DB user into what the UserManagement table expects
const toDTO = (u, hasRequest = false) => ({
  _id: u._id,
  id: u.idNumber || '—',
  name: `${u.firstName} ${u.lastName}`,
  role: u.role === 'Regular Staff' ? 'Staff' : u.role,
  email: u.email,
  contact: u.contactNumber || '',
  status: u.accountStatus,
  createdAt: u.createdAt,
  archived: !!u.archived,
  hasRequest,
});

// Email the user. Fire and forget: an email problem must never break the action.
const mailUser = (user, subject, lines) => {
  Promise.resolve()
    .then(() =>
      sendEmail({
        to: user.email,
        subject,
        text: lines.join('\n\n'),
        html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; border: 1px solid #dfd8cc; border-radius: 8px; color: #594d46;">
          <h2 style="color: #8c5839; margin-top: 0;">BukSUPPLY</h2>
          ${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}
        </div>`,
      })
    )
    .catch((e) => console.error('account email error:', e.message));
};

// GET /api/admin/users?filter=All&search=&page=1&limit=5
// filter: All | User | Moderator | Deactivated | Requests (deactivated users who sent a request) | Archived
// Archived accounts only show up under "Archived"; every other filter hides them.
exports.getUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 50);
  const filter = req.query.filter || 'All';
  const search = (req.query.search || '').trim();

  const query = { role: { $in: MANAGED_ROLES } };

  // Old documents have no "archived" field, so "not archived" is { $ne: true }
  if (filter === 'Archived') query.archived = true;
  else query.archived = { $ne: true };

  if (filter === 'User') query.role = { $in: ['Student', 'Regular Staff'] };
  else if (filter === 'Moderator') query.role = 'Moderator';
  else if (filter === 'Deactivated') query.accountStatus = 'Deactivated';
  else if (filter === 'Requests') {
    query.accountStatus = 'Deactivated';
    query._id = { $in: await ReactivationRequest.distinct('user', { status: 'Pending' }) };
  }

  if (search) {
    const rx = escapeRegex(search);
    query.$or = [
      { idNumber: { $regex: rx, $options: 'i' } },
      // matches "Last, First"
      {
        $expr: {
          $regexMatch: {
            input: { $concat: ['$lastName', ', ', '$firstName'] },
            regex: rx,
            options: 'i',
          },
        },
      },
      // matches "First Last"
      {
        $expr: {
          $regexMatch: {
            input: { $concat: ['$firstName', ' ', '$lastName'] },
            regex: rx,
            options: 'i',
          },
        },
      },
    ];
  }

  const [users, total, pendingRequests] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(query),
    ReactivationRequest.countDocuments({ status: 'Pending' }),
  ]);

  // Which of these users have a reactivation request waiting?
  const waiting = await ReactivationRequest.find({
    user: { $in: users.map((u) => u._id) },
    status: 'Pending',
  }).select('user');
  const waitingIds = new Set(waiting.map((r) => String(r.user)));

  res.json({
    users: users.map((u) => toDTO(u, waitingIds.has(String(u._id)))),
    total,
    page,
    limit,
    pendingRequests,
  });
});

// GET /api/admin/users/:id  (the account details pop-up)
exports.getUserDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid user ID.', 400);

  const user = await User.findOne({ _id: id, role: { $in: MANAGED_ROLES } });
  if (!user) throw new AppError('User not found.', 404);

  const deactivated = user.accountStatus === 'Deactivated';

  const [lastSignIn, deactivation, pending, declined] = await Promise.all([
    ActivityLog.findOne({ user: user._id, action: { $in: ['SIGN_IN', 'SIGN_UP'] } })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean(),
    deactivated
      ? Deactivation.findOne({ user: user._id, active: true }).sort({ createdAt: -1 }).lean()
      : null,
    deactivated ? ReactivationRequest.findOne({ user: user._id, status: 'Pending' }).lean() : null,
    deactivated
      ? ReactivationRequest.findOne({ user: user._id, status: 'Declined' })
          .sort({ resolvedAt: -1 })
          .lean()
      : null,
  ]);

  // A decline only matters if it came after the current deactivation began
  const lastDecline =
    declined && (!deactivation || declined.createdAt >= deactivation.createdAt) ? declined : null;

  res.json({
    user: {
      ...toDTO(user, !!pending),
      archivedAt: user.archived ? user.archivedAt || null : null,
      archivedBy: user.archived ? user.archivedBy || '' : '',
      signInMethod: user.authProvider === 'google' ? 'Google' : 'Email and password',
      lastSignIn: lastSignIn ? lastSignIn.createdAt : null,
      deactivation: deactivated
        ? {
            reason: deactivation ? deactivation.reason : '',
            source: deactivation ? deactivation.source : '',
            byName: deactivation ? deactivation.byName : '',
            date: deactivation ? deactivation.createdAt : null,
          }
        : null,
      request: pending ? { message: pending.message, date: pending.createdAt } : null,
      lastDecline: lastDecline
        ? { note: lastDecline.adminNote, date: lastDecline.resolvedAt }
        : null,
    },
  });
});

// POST /api/admin/users/moderators
exports.createModerator = async (req, res) => {
  try {
    const idNumber = (req.body.idNumber || '').trim().toUpperCase();
    const firstName = (req.body.firstName || '').trim();
    const lastName = (req.body.lastName || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!idNumber)
      return res.status(400).json({ message: 'ID number is required.', field: 'idNumber' });
    if (!/^[A-Z0-9-]{3,20}$/.test(idNumber))
      return res
        .status(400)
        .json({ message: 'Use 3-20 letters, numbers, or hyphens.', field: 'idNumber' });
    if (!firstName)
      return res.status(400).json({ message: 'First name is required.', field: 'firstName' });
    if (!lastName)
      return res.status(400).json({ message: 'Last name is required.', field: 'lastName' });
    if (!/^[^@\s]+@buksu\.edu\.ph$/.test(email))
      return res
        .status(400)
        .json({ message: 'Moderators must use an @buksu.edu.ph email.', field: 'email' });
    if (password.length < 8)
      return res
        .status(400)
        .json({ message: 'Password must be at least 8 characters.', field: 'password' });

    const user = await User.create({
      firstName,
      lastName,
      email,
      idNumber,
      password, // hashed by the pre("save") hook
      role: 'Moderator',
      authProvider: 'local',
      accountStatus: 'Active',
      agreedToTerms: true,
    });

    res.status(201).json({ user: toDTO(user) });
  } catch (err) {
    if (err.code === 11000) {
      if (err.keyPattern?.email)
        return res
          .status(409)
          .json({ message: 'An account with this email already exists.', field: 'email' });
      if (err.keyPattern?.idNumber)
        return res
          .status(409)
          .json({ message: 'This ID number is already in use.', field: 'idNumber' });
    }
    if (err.name === 'ValidationError') {
      const first = Object.values(err.errors)[0];
      return res.status(400).json({ message: first.message, field: first.path });
    }
    console.error('createModerator error:', err);
    res.status(500).json({ message: 'Failed to create moderator.' });
  }
};

// PATCH /api/admin/users/:id/deactivate   body: { reason }
exports.deactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid user ID.', 400);

  if (String(id) === String(req.user._id))
    throw new AppError('You cannot deactivate your own account.', 400);

  const reason = String(req.body.reason || '').trim();
  if (reason.length < REASON_MIN)
    return res.status(400).json({
      message: `Please give a reason (at least ${REASON_MIN} characters).`,
      field: 'reason',
    });
  if (reason.length > REASON_MAX)
    return res
      .status(400)
      .json({ message: `The reason must be ${REASON_MAX} characters or fewer.`, field: 'reason' });

  // Only an active, non-administrator account can be deactivated
  const user = await User.findOneAndUpdate(
    { _id: id, role: { $in: MANAGED_ROLES }, accountStatus: { $ne: 'Deactivated' } },
    { accountStatus: 'Deactivated' },
    { new: true }
  );

  if (!user) {
    const exists = await User.exists({ _id: id, role: { $in: MANAGED_ROLES } });
    throw new AppError(
      exists ? 'Account is already deactivated.' : 'User not found.',
      exists ? 400 : 404
    );
  }

  // Close any older open record, then remember this one
  await Deactivation.updateMany(
    { user: user._id, active: true },
    { active: false, endedAt: new Date() }
  );
  await Deactivation.create({
    user: user._id,
    source: 'admin',
    reason,
    byName: fullName(req.user),
  });

  await logActivity(
    req.user,
    {
      category: 'Account',
      action: 'USER_DEACTIVATED',
      description: `Deactivated the account of ${fullName(user)}`,
      reference: user.idNumber || '',
    },
    req
  );

  mailUser(user, 'Your BukSUPPLY account was deactivated', [
    `Hello ${user.firstName}, your BukSUPPLY account has been deactivated by an administrator.`,
    `Reason: ${reason}`,
    'If you think this is a mistake, sign in with your account on the BukSUPPLY sign-in page. You will see an option to send a reactivation request to the administrator.',
  ]);

  res.json({ user: toDTO(user) });
});

// PATCH /api/admin/users/:id/reactivate
exports.reactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid user ID.', 400);

  const user = await User.findOneAndUpdate(
    {
      _id: id,
      role: { $in: MANAGED_ROLES },
      accountStatus: 'Deactivated',
      archived: { $ne: true },
    },
    { accountStatus: 'Active' },
    { new: true }
  );

  if (!user) {
    const found = await User.findOne({ _id: id, role: { $in: MANAGED_ROLES } }).select('archived');
    if (!found) throw new AppError('User not found.', 404);
    throw new AppError(
      found.archived
        ? 'Unarchive this account before reactivating it.'
        : 'Account is not deactivated.',
      400
    );
  }

  const by = fullName(req.user);
  const now = new Date();

  // Close the deactivation and approve the user's waiting request (if any)
  await Deactivation.updateMany(
    { user: user._id, active: true },
    { active: false, endedAt: now, endedByName: by }
  );
  await ReactivationRequest.updateMany(
    { user: user._id, status: 'Pending' },
    { status: 'Approved', resolvedAt: now, resolvedByName: by }
  );

  await logActivity(
    req.user,
    {
      category: 'Account',
      action: 'USER_REACTIVATED',
      description: `Reactivated the account of ${fullName(user)}`,
      reference: user.idNumber || '',
    },
    req
  );

  mailUser(user, 'Your BukSUPPLY account was reactivated', [
    `Hello ${user.firstName}, your BukSUPPLY account has been reactivated.`,
    'You can now sign in again.',
  ]);

  res.json({ user: toDTO(user) });
});

// PATCH /api/admin/users/:id/decline-request   body: { note } (optional)
exports.declineRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid user ID.', 400);

  const note = String(req.body.note || '').trim();
  if (note.length > REASON_MAX)
    return res
      .status(400)
      .json({ message: `The note must be ${REASON_MAX} characters or fewer.`, field: 'note' });

  const user = await User.findOne({ _id: id, role: { $in: MANAGED_ROLES } });
  if (!user) throw new AppError('User not found.', 404);

  const request = await ReactivationRequest.findOneAndUpdate(
    { user: user._id, status: 'Pending' },
    {
      status: 'Declined',
      resolvedAt: new Date(),
      resolvedByName: fullName(req.user),
      adminNote: note,
    },
    { new: true }
  );
  if (!request) throw new AppError('There is no pending request for this account.', 404);

  await logActivity(
    req.user,
    {
      category: 'Account',
      action: 'REACTIVATION_DECLINED',
      description: `Declined the reactivation request of ${fullName(user)}`,
      reference: user.idNumber || '',
    },
    req
  );

  mailUser(user, 'Your BukSUPPLY reactivation request was declined', [
    `Hello ${user.firstName}, the administrator reviewed your reactivation request and could not reactivate your account at this time.`,
    ...(note ? [`Note from the administrator: ${note}`] : []),
  ]);

  res.json({ user: toDTO(user, false) });
});

// PATCH /api/admin/users/:id/archive
// Only a deactivated account with no waiting reactivation request can be archived.
// The account is hidden from the normal lists but never deleted.
exports.archiveUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid user ID.', 400);

  const target = await User.findOne({ _id: id, role: { $in: MANAGED_ROLES } }).select(
    'accountStatus archived'
  );
  if (!target) throw new AppError('User not found.', 404);
  if (target.archived) throw new AppError('Account is already archived.', 400);
  if (target.accountStatus !== 'Deactivated')
    throw new AppError('Only deactivated accounts can be archived.', 400);

  if (await ReactivationRequest.exists({ user: target._id, status: 'Pending' }))
    throw new AppError(
      'This account has a reactivation request. Approve or decline it first.',
      409
    );

  const user = await User.findOneAndUpdate(
    {
      _id: id,
      role: { $in: MANAGED_ROLES },
      accountStatus: 'Deactivated',
      archived: { $ne: true },
    },
    { archived: true, archivedAt: new Date(), archivedBy: fullName(req.user) },
    { new: true }
  );
  if (!user) throw new AppError('The account changed. Please refresh and try again.', 409);

  await logActivity(
    req.user,
    {
      category: 'Account',
      action: 'USER_ARCHIVED',
      description: `Archived the account of ${fullName(user)}`,
      reference: user.idNumber || '',
    },
    req
  );

  res.json({ user: toDTO(user) });
});

// PATCH /api/admin/users/:id/unarchive
// Brings the account back to the Deactivated list (it stays deactivated).
exports.unarchiveUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid user ID.', 400);

  const user = await User.findOneAndUpdate(
    { _id: id, role: { $in: MANAGED_ROLES }, archived: true },
    { $set: { archived: false }, $unset: { archivedAt: '', archivedBy: '' } },
    { new: true }
  );

  if (!user) {
    const exists = await User.exists({ _id: id, role: { $in: MANAGED_ROLES } });
    throw new AppError(exists ? 'Account is not archived.' : 'User not found.', exists ? 400 : 404);
  }

  await logActivity(
    req.user,
    {
      category: 'Account',
      action: 'USER_UNARCHIVED',
      description: `Unarchived the account of ${fullName(user)}`,
      reference: user.idNumber || '',
    },
    req
  );

  res.json({ user: toDTO(user) });
});

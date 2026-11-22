const User = require('../models/User');
const { logActivity } = require('../services/activityLog');
const Deactivation = require('../models/Deactivation');
const Notification = require('../models/Notification');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const {
  formatName,
  nameProblem,
  contactProblem,
  passwordProblem,
} = require('../utils/validators');

// hasPassword is false for accounts created with Google that never set a password.
// The password field is "select: false", so it is checked with a query instead of loading the hash.
const hasPasswordSet = async (userId) =>
  Boolean(await User.exists({ _id: userId, password: { $type: 'string', $ne: '' } }));

const publicUser = (u, hasPassword) => ({
  id: u._id,
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  idNumber: u.idNumber,
  role: u.role,
  contactNumber: u.contactNumber,
  ...(u.avatar ? { avatar: u.avatar } : {}), // only send avatar when one exists
  accountStatus: u.accountStatus,
  hasPassword,
});

exports.getProfile = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user, await hasPasswordSet(req.user._id)) });
});

const FIELD_LABELS = {
  firstName: 'first name',
  lastName: 'last name',
  contactNumber: 'contact number',
};

// Same rules as the Profile page (shared with Sign Up and User Management)
const FIELD_RULES = {
  firstName: (v) => ({ value: formatName(v), problem: nameProblem(v, 'First name') }),
  lastName: (v) => ({ value: formatName(v), problem: nameProblem(v, 'Last name') }),
  contactNumber: (v) => ({ value: String(v ?? '').trim(), problem: contactProblem(v) }),
};

exports.updateProfile = async (req, res) => {
  try {
    const user = req.user;
    const changed = [];

    // whitelist only, and every value must follow the shared field rules
    const problems = {};
    for (const field of Object.keys(FIELD_LABELS)) {
      const raw = req.body[field];
      if (raw === undefined) continue;

      const { value, problem } = FIELD_RULES[field](raw);
      if (problem) {
        problems[field] = problem;
        continue;
      }
      if (value !== user[field]) {
        user[field] = value;
        changed.push(FIELD_LABELS[field]);
      }
    }

    if (Object.keys(problems).length) {
      return res.status(400).json({ message: 'Validation failed.', errors: problems });
    }

    await user.save();

    // Field names only, never the values themselves
    if (changed.length) {
      await logActivity(
        user,
        {
          category: 'Account',
          action: 'PROFILE_UPDATED',
          description: `Updated profile (${changed.join(', ')})`,
        },
        req
      );
    }

    res.json({ user: publicUser(user, await hasPasswordSet(user._id)) });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.fromEntries(
        Object.entries(err.errors).map(([k, v]) => [k, v.message])
      );
      return res.status(400).json({ message: 'Validation failed.', errors });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * POST /api/user/password   body: { newPassword, confirmPassword }
 * Lets an account that has NO password yet (created with Google) set one, so the person can
 * still sign in with email and password if Google sign-in is turned off.
 * An account that already has a password cannot use this: changing it goes through
 * "Forgot Password" on the sign-in page.
 */
exports.setPassword = asyncHandler(async (req, res) => {
  const { newPassword, confirmPassword } = req.body;

  if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw new AppError('User not found.', 404);

  if (user.password) {
    throw new AppError(
      'This account already has a password. Use "Forgot Password" on the sign-in page to change it.',
      409
    );
  }

  const problem = passwordProblem(newPassword);
  if (problem) return res.status(400).json({ message: problem, field: 'newPassword' });
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.', field: 'confirmPassword' });
  }

  // Assigning triggers the pre-save bcrypt hook. Never use findOneAndUpdate() here,
  // since it would store the password in plain text.
  user.password = newPassword;
  await user.save();

  await logActivity(
    user,
    { category: 'Account', action: 'PASSWORD_SET', description: 'Set an account password' },
    req
  );

  // A short notice, so the owner can notice if this was not them
  try {
    await Notification.create({
      user: user._id,
      title: 'Password Created',
      message:
        'A password was added to your account. You can now sign in with your email and password too.',
      type: 'success',
    });
  } catch (notifErr) {
    console.error('Notification error:', notifErr);
  }

  res.json({ message: 'Password saved.', user: publicUser(user, true) });
});

exports.deactivateAccount = asyncHandler(async (req, res) => {
  const user = req.user;
  if (user.role === 'Administrator') {
    throw new AppError('Administrators cannot deactivate their own account.', 403);
  }
  user.accountStatus = 'Deactivated';
  await user.save();

  // Remember that the owner did this, so the sign-in page can explain it later.
  // A problem here must never undo the deactivation.
  try {
    await Deactivation.updateMany({ user: user._id, active: true }, { active: false, endedAt: new Date() });
    await Deactivation.create({
      user: user._id,
      source: 'self',
      reason: 'You deactivated this account yourself.',
      byName: [user.firstName, user.lastName].filter((n) => n && n !== '-').join(' ') || user.email,
    });
  } catch (e) {
    console.error('deactivation record error:', e.message);
  }

  await logActivity(
    user,
    { category: 'Account', action: 'ACCOUNT_DEACTIVATED', description: 'Deactivated own account' },
    req
  );

  res.json({ message: 'Account deactivated.' });
});
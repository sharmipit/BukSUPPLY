const { logActivity } = require('../services/activityLog');
const Deactivation = require('../models/Deactivation');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const { formatName, nameProblem, contactProblem } = require('../utils/validators');

const publicUser = (u) => ({
  id: u._id,
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  idNumber: u.idNumber,
  role: u.role,
  contactNumber: u.contactNumber,
  ...(u.avatar ? { avatar: u.avatar } : {}), // only send avatar when one exists
  accountStatus: u.accountStatus,
});

exports.getProfile = (req, res) => {
  res.json({ user: publicUser(req.user) });
};

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

    res.json({ user: publicUser(user) });
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
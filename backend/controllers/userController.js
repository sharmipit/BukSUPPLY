const { logActivity } = require('../services/activityLog');

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

exports.updateProfile = async (req, res) => {
  try {
    const user = req.user;
    const changed = [];

    // whitelist only
    for (const field of Object.keys(FIELD_LABELS)) {
      const value = req.body[field];
      if (value !== undefined && value !== user[field]) {
        user[field] = value;
        changed.push(FIELD_LABELS[field]);
      }
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

exports.deactivateAccount = async (req, res) => {
  try {
    const user = req.user;
    if (user.role === 'Administrator') {
      return res.status(403).json({
        message: 'Administrators cannot deactivate their own account.',
      });
    }
    user.accountStatus = 'Deactivated';
    await user.save();

    await logActivity(
      user,
      { category: 'Account', action: 'ACCOUNT_DEACTIVATED', description: 'Deactivated own account' },
      req
    );

    res.json({ message: 'Account deactivated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
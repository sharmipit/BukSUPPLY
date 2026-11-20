const ActivityLog = require('../models/ActivityLog');

const fullName = (u) =>
  [u.firstName, u.lastName].filter((n) => n && n !== '-').join(' ') || u.email || 'Unknown user';

// Record audit activity log (fails gracefully without interrupting primary action)
exports.logActivity = async (user, { category, action, description, reference = '' }, req) => {
  try {
    if (!user || !user._id) return;
    await ActivityLog.create({
      user: user._id,
      actorName: fullName(user),
      actorRole: user.role,
      category,
      action,
      description,
      reference,
      ip: req?.ip || '',
    });
  } catch (err) {
    console.error('logActivity error:', err.message);
  }
};
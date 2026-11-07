const ActivityLog = require('../models/ActivityLog');

const fullName = (u) =>
  [u.firstName, u.lastName].filter((n) => n && n !== '-').join(' ') || u.email || 'Unknown user';

/**
 * Records one activity. Logging must never break the real action,
 * so this swallows its own errors.
 *
 *   logActivity(req.user, { category, action, description, reference }, req)
 */
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
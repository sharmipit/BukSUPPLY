const ActivityLog = require('../models/ActivityLog');
const { CATEGORIES } = require('../models/ActivityLog');
const { logActivity } = require('../services/activityLog');
const asyncHandler = require('../middleware/asyncHandler');

const STAFF_ROLES = ['Moderator', 'Administrator'];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);

const toClient = (l, showIp) => ({
  id: l._id,
  user: l.actorName,
  role: l.actorRole === 'Regular Staff' ? 'Staff' : l.actorRole,
  category: l.category,
  action: l.action,
  description: l.description,
  reference: l.reference,
  ...(showIp ? { ip: l.ip } : {}),
  date: l.createdAt.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }),
  createdAt: l.createdAt,
});

/**
 * GET /api/activity?scope=mine|all&category=&search=&from=&to=&page=&limit=
 * - Regular users: always their own entries (scope is ignored).
 * - Moderators: scope=all shows everyone except administrator activity.
 * - Administrators: scope=all shows everyone.
 */
exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const role = req.user.role;
  const isStaff = STAFF_ROLES.includes(role);
  const wantAll = isStaff && (req.query.scope || 'all') === 'all';

  const query = {};
  if (!wantAll) query.user = req.user._id;
  else if (role === 'Moderator') query.actorRole = { $ne: 'Administrator' };

  const category = String(req.query.category || '');
  if (CATEGORIES.includes(category)) query.category = category;

  // Dates are picked in Philippine time (UTC+8); "to" includes the whole day
  const range = {};
  if (isDay(String(req.query.from || ''))) range.$gte = new Date(`${req.query.from}T00:00:00+08:00`);
  if (isDay(String(req.query.to || ''))) range.$lte = new Date(`${req.query.to}T23:59:59.999+08:00`);
  if (Object.keys(range).length) query.createdAt = range;

  const search = String(req.query.search || '').trim();
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    query.$or = [{ description: rx }, { reference: rx }, ...(wantAll ? [{ actorName: rx }] : [])];
  }

  const [logs, total] = await Promise.all([
    ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(query),
  ]);

  res.json({
    logs: logs.map((l) => toClient(l, role === 'Administrator')),
    total,
    page,
    limit,
  });
});

/** POST /api/activity/logout: the JWT is stateless, so the client tells us it is signing out */
exports.logout = asyncHandler(async (req, res) => {
  await logActivity(req.user, { category: 'Account', action: 'SIGN_OUT', description: 'Signed out' }, req);
  res.json({ message: 'Recorded.' });
});

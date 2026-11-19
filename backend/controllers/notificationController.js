const Notification = require("../models/Notification");
const asyncHandler = require("../middleware/asyncHandler");

// Cleared notifications are hidden, never erased
const visible = (userId) => ({ user: userId, hidden: { $ne: true } });

const toClient = (n) => ({
  id: n._id,
  title: n.title,
  message: n.message,
  type: n.type,
  link: n.link,
  read: n.read,
  date: n.createdAt.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }),
});

exports.list = asyncHandler(async (req, res) => {
  const docs = await Notification.find(visible(req.user._id)).sort({ createdAt: -1 });
  res.json({ notifications: docs.map(toClient) });
});

exports.markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
  res.json({ message: "Marked as read." });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ ...visible(req.user._id), read: false }, { read: true });
  res.json({ message: "All marked as read." });
});

// "Delete": hides one notification
exports.remove = asyncHandler(async (req, res) => {
  await Notification.updateOne(
    { _id: req.params.id, user: req.user._id },
    { hidden: true, read: true }
  );
  res.json({ message: "Notification removed." });
});

// "Clear All": hides every visible notification of this user
exports.clearAll = asyncHandler(async (req, res) => {
  await Notification.updateMany(visible(req.user._id), { hidden: true, read: true });
  res.json({ message: "All notifications cleared." });
});

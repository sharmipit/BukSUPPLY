const Notification = require("../models/Notification");

const toClient = (n) => ({
  id: n._id,
  title: n.title,
  message: n.message,
  type: n.type,
  link: n.link,
  read: n.read,
  date: n.createdAt.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }),
});

exports.list = async (req, res) => {
  const docs = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ notifications: docs.map(toClient) });
};

exports.markRead = async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
  res.json({ message: "Marked as read." });
};

exports.markAllRead = async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ message: "All marked as read." });
};

exports.remove = async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ message: "Notification deleted." });
};

exports.clearAll = async (req, res) => {
  await Notification.deleteMany({ user: req.user._id });
  res.json({ message: "All notifications cleared." });
};
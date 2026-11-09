const Notification = require("../models/Notification");

const SERVER_ERROR = { message: "Something went wrong. Please try again." };

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

exports.list = async (req, res) => {
  try {
    const docs = await Notification.find(visible(req.user._id)).sort({ createdAt: -1 });
    res.json({ notifications: docs.map(toClient) });
  } catch (err) {
    console.error("list notifications error:", err);
    res.status(500).json(SERVER_ERROR);
  }
};

exports.markRead = async (req, res) => {
  try {
    await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
    res.json({ message: "Marked as read." });
  } catch (err) {
    console.error("markRead error:", err);
    res.status(500).json(SERVER_ERROR);
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ ...visible(req.user._id), read: false }, { read: true });
    res.json({ message: "All marked as read." });
  } catch (err) {
    console.error("markAllRead error:", err);
    res.status(500).json(SERVER_ERROR);
  }
};

// "Delete": hides one notification
exports.remove = async (req, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, user: req.user._id },
      { hidden: true, read: true }
    );
    res.json({ message: "Notification removed." });
  } catch (err) {
    console.error("remove notification error:", err);
    res.status(500).json(SERVER_ERROR);
  }
};

// "Clear All": hides every visible notification of this user
exports.clearAll = async (req, res) => {
  try {
    await Notification.updateMany(visible(req.user._id), { hidden: true, read: true });
    res.json({ message: "All notifications cleared." });
  } catch (err) {
    console.error("clearAll error:", err);
    res.status(500).json(SERVER_ERROR);
  }
};
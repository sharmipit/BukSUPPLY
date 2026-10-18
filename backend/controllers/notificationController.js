const Notification = require("../models/Notification");

const SERVER_ERROR = { message: "Something went wrong. Please try again." };

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
    const docs = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
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
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ message: "All marked as read." });
  } catch (err) {
    console.error("markAllRead error:", err);
    res.status(500).json(SERVER_ERROR);
  }
};

exports.remove = async (req, res) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
    res.json({ message: "Notification deleted." });
  } catch (err) {
    console.error("delete notification error:", err);
    res.status(500).json(SERVER_ERROR);
  }
};

exports.clearAll = async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });
    res.json({ message: "All notifications cleared." });
  } catch (err) {
    console.error("clearAll error:", err);
    res.status(500).json(SERVER_ERROR);
  }
};
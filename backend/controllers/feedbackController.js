const Requisition = require('../models/Requisition');
const feedback = require('../services/feedback');

const SERVER_ERROR = { message: 'Something went wrong. Please try again.' };

/** GET /api/feedback/link/:slip (owner of an Accepted slip only) */
exports.link = async (req, res) => {
  try {
    if (!feedback.enabled()) {
      return res.status(403).json({ message: 'Feedback is turned off.' });
    }
    const doc = await Requisition.findOne({
      slipNumber: req.params.slip,
      requester: req.user._id,
    });
    if (!doc) return res.status(404).json({ message: 'Requisition not found.' });
    if (doc.status !== 'Accepted') {
      return res.status(409).json({ message: 'Feedback opens once the items are received.' });
    }
    res.json({ url: feedback.linkFor(doc.slipNumber) });
  } catch (err) {
    console.error('feedback link error:', err);
    res.status(500).json(SERVER_ERROR);
  }
};

/** GET /api/feedback/summary (Moderator / Administrator) */
exports.summary = async (req, res) => {
  try {
    if (!feedback.enabled()) return res.json({ enabled: false });
    res.json({ enabled: true, ...(await feedback.summary()) });
  } catch (err) {
    console.error('feedback summary error:', err.message);
    res.status(502).json({ message: 'Could not read responses from Google Forms.' });
  }
};
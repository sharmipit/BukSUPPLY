const Requisition = require('../models/Requisition');
const feedback = require('../services/feedback');
const { logActivity } = require('../services/activityLog');

const SERVER_ERROR = { message: 'Something went wrong. Please try again.' };

// The slip must belong to the signed-in user (identity comes from the slip, never from the form)
const findOwnSlip = (req) =>
  Requisition.findOne({ slipNumber: req.params.slip, requester: req.user._id });

/**
 * Saves "feedback received" on the slip, once.
 * timestamps:false keeps updatedAt unchanged, so the staff Requests list order does not move.
 */
const markSubmitted = async (doc, at, req) => {
  if (doc.feedbackSubmittedAt) return doc.feedbackSubmittedAt;

  const updated = await Requisition.findOneAndUpdate(
    { _id: doc._id, feedbackSubmittedAt: null }, // matches "missing" too
    { $set: { feedbackSubmittedAt: at } },
    { new: true, timestamps: false }
  );

  // Only the request that really changed it writes the log entry
  if (updated) {
    await logActivity(
      req.user,
      {
        category: 'Requisition',
        action: 'FEEDBACK_SUBMITTED',
        description: `Sent feedback for requisition slip "${doc.title}"`,
        reference: doc.slipNumber,
      },
      req
    );
    return updated.feedbackSubmittedAt;
  }
  return at;
};

/** GET /api/feedback/link/:slip (owner of an Accepted slip only) */
exports.link = async (req, res) => {
  try {
    if (!feedback.enabled()) {
      return res.status(403).json({ message: 'Feedback is turned off.' });
    }
    const doc = await findOwnSlip(req);
    if (!doc) return res.status(404).json({ message: 'Requisition not found.' });
    if (doc.status !== 'Accepted') {
      return res.status(409).json({ message: 'Feedback opens once the items are received.' });
    }

    const alreadySent = { message: 'Feedback was already sent for this slip.', submitted: true };

    // One feedback per slip
    if (doc.feedbackSubmittedAt) return res.status(409).json(alreadySent);

    // The user may have submitted earlier and never come back to the system: check Google now.
    // If Google cannot be reached we still give the link (the first valid response wins anyway).
    try {
      const at = await feedback.submittedAt(doc.slipNumber, { fresh: true });
      if (at) {
        await markSubmitted(doc, at, req);
        return res.status(409).json(alreadySent);
      }
    } catch (err) {
      console.error('feedback pre-check error:', err.message);
    }

    // Name, email, ID number, account type and department are pre-filled from the account
    res.json({
      url: feedback.linkFor(doc.slipNumber, { user: req.user, department: doc.department }),
    });
  } catch (err) {
    console.error('feedback link error:', err);
    res.status(500).json(SERVER_ERROR);
  }
};

/** GET /api/feedback/status/:slip (owner only): has the feedback arrived? */
exports.status = async (req, res) => {
  try {
    const doc = await findOwnSlip(req);
    if (!doc) return res.status(404).json({ message: 'Requisition not found.' });

    if (doc.feedbackSubmittedAt) {
      return res.json({ submitted: true, at: doc.feedbackSubmittedAt });
    }
    if (!feedback.enabled() || doc.status !== 'Accepted') {
      return res.json({ submitted: false });
    }

    try {
      const at = await feedback.submittedAt(doc.slipNumber, { fresh: true });
      if (at) {
        const saved = await markSubmitted(doc, at, req);
        return res.json({ submitted: true, at: saved });
      }
    } catch (err) {
      // Google hiccup: tell the page to keep waiting instead of showing an error
      console.error('feedback status error:', err.message);
      return res.json({ submitted: false, checked: false });
    }

    res.json({ submitted: false });
  } catch (err) {
    console.error('feedback status error:', err);
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

/** GET /api/feedback/debug (Administrator only): why is feedback not being detected? */
exports.debug = async (req, res) => {
  try {
    res.json(await feedback.diagnose());
  } catch (err) {
    console.error('feedback debug error:', err.message);
    res.status(500).json({ message: err.message });
  }
};
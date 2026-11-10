const express = require('express');
const router = express.Router();
const settings = require('../services/settings');
const su = require('../services/suAccess');
const { logActivity } = require('../services/activityLog');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('Administrator'));

const userId = (req) => String(req.user._id ?? req.user.id);

const SECTION_TITLE = {
  google: 'Google sign-in',
  recaptcha: 'reCAPTCHA',
  smtp: 'Email (SMTP)',
  pdfshift: 'PDF reports',
  nutrient: 'Excel reports',
};

const log = (req, action, description, reference = '') =>
  logActivity(req.user, { category: 'System Settings', action, description, reference }, req);

// ---- Unlock (no token needed yet) ----
router.post('/unlock/start', async (req, res) => {
  try {
    const result = await su.start(userId(req), req.body.email, req.body.pin);
    // No code step when SMTP isn't set up: the page is already unlocked
    if (!result.otpRequired) await log(req, 'SETTINGS_UNLOCKED', 'Unlocked System Settings');
    res.json(result);
  } catch (e) {
    await log(req, 'SETTINGS_UNLOCK_FAILED', 'Failed attempt to unlock System Settings');
    res.status(400).json({ message: e.message });
  }
});

router.post('/unlock/verify', async (req, res) => {
  try {
    const result = su.verify(userId(req), req.body.otp);
    await log(req, 'SETTINGS_UNLOCKED', 'Unlocked System Settings');
    res.json(result);
  } catch (e) {
    await log(req, 'SETTINGS_UNLOCK_FAILED', 'Failed attempt to unlock System Settings');
    res.status(400).json({ message: e.message });
  }
});

// ---- Everything below needs the unlock token ----
router.use(su.requireUnlock);

router.get('/', (req, res) => {
  res.json(settings.publicView());
});

// One section at a time: google | recaptcha | smtp | pdfshift | nutrient
router.put('/:section', async (req, res) => {
  try {
    const result = await settings.update(req.params.section, req.body);
    const title = SECTION_TITLE[req.params.section] || req.params.section;
    await log(req, 'SETTINGS_UPDATED', `Updated ${title} settings`, title);
    res.json(result);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Restore one section to its default values
router.post('/:section/reset', async (req, res) => {
  try {
    const result = settings.reset(req.params.section);
    const title = SECTION_TITLE[req.params.section] || req.params.section;
    await log(req, 'SETTINGS_RESET', `Reset ${title} settings to default`, title);
    res.json(result);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

module.exports = router;

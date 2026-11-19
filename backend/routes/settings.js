const express = require('express');
const su = require('../services/suAccess');
const { protect, restrictTo } = require('../middleware/auth');
const ctrl = require('../controllers/settingsController');

const router = express.Router();

router.use(protect, restrictTo('Administrator'));

// ---- Unlock (no token needed yet) ----
router.post('/unlock/start', ctrl.unlockStart);
router.post('/unlock/verify', ctrl.unlockVerify);

// ---- Everything below needs the unlock token ----
router.use(su.requireUnlock);

router.get('/', ctrl.getSettings);

// One section at a time: google | recaptcha | smtp | pdfshift | nutrient | drive
router.put('/:section', ctrl.updateSection);

// Restore one section to its default values
router.post('/:section/reset', ctrl.resetSection);

module.exports = router;

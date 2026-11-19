const express = require('express');
const { protect, restrictTo } = require('../middleware/auth');
const reports = require('../controllers/reportController');

const router = express.Router();

// Reports are staff only
router.use(protect, restrictTo('Moderator', 'Administrator'));

// ---------- History ----------
router.get('/history', reports.getHistory);
router.post('/history', reports.createHistory);

// ---------- Verify a report by the code printed in its footer ----------
router.get('/verify/:code', reports.verifyReport);

// ---------- Issuance slip (PDF or editable Excel for one requisition) ----------
// Must stay above '/:type' so "issuance" is never read as a report type.
router.get('/issuance/:slip/export', reports.exportIssuance);

// ---------- Raw JSON endpoint (also used by the preview) ----------
router.get('/:type', reports.getReport);

// ---------- File export ----------
router.get('/:type/export', reports.exportReport);

module.exports = router;

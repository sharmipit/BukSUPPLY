const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const c = require('../controllers/feedbackController');

router.use(protect);
router.get('/link/:slip', c.link);
router.get('/summary', restrictTo('Moderator', 'Administrator'), c.summary);

module.exports = router;
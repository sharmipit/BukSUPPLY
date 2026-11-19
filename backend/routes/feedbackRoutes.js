const router = require('express').Router();
const { protect, restrictTo } = require('../middleware/auth');
const c = require('../controllers/feedbackController');

router.use(protect);

// Owner of an Accepted slip: get the pre-filled Google Form link
router.get('/link/:slip', c.link);

// Owner of the slip: has the feedback arrived yet? (the page polls this after opening the form)
router.get('/status/:slip', c.status);

// Staff: averages, star counts and recent comments
router.get('/summary', restrictTo('Moderator', 'Administrator'), c.summary);

// Administrator: health check for the Google Forms connection
router.get('/debug', restrictTo('Administrator'), c.debug);

module.exports = router;
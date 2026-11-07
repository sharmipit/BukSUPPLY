const router = require('express').Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/activityLogController');

router.use(protect);

// Read-only on purpose: there is no route to edit or delete log entries
router.get('/', c.list);
router.post('/logout', c.logout);

module.exports = router;
const express = require('express');
const { protect, restrictTo } = require('../middleware/auth');
const inventory = require('../controllers/inventoryController');

const router = express.Router();
const staffOnly = restrictTo(...inventory.STAFF_ROLES);

router.use(protect);

// Everyone logged in can read (the request form needs it)
router.get('/', inventory.listItems);

router.post('/', staffOnly, inventory.createItem);
router.put('/:code', staffOnly, inventory.updateItem);
router.post('/:code/adjust', staffOnly, inventory.adjustStock);

router.get('/:code/open-requests', staffOnly, inventory.getOpenRequests);
router.patch('/:code/archive', staffOnly, inventory.archiveItem);
router.patch('/:code/restore', staffOnly, inventory.restoreItem);

module.exports = router;

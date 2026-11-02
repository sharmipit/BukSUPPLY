const express = require('express');
const router = express.Router();
const settings = require('../services/settings');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('Administrator'));

router.get('/', (req, res) => {
  res.json(settings.publicView());
});

router.put('/', (req, res) => {
  try {
    res.json(settings.update(req.body));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

module.exports = router;

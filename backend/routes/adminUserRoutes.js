const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth"); // <- rename to match your middleware
const {
  getUsers,
  createModerator,
  reactivateUser,
} = require("../controllers/adminUserController");

router.use(protect, restrictTo("Administrator"));

router.get("/", getUsers);
router.post("/moderators", createModerator);
router.patch("/:id/reactivate", reactivateUser);

module.exports = router;
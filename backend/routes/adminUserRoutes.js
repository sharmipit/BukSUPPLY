const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/auth"); 
const {
  getUsers,
  getUserDetails,
  createModerator,
  deactivateUser,
  reactivateUser,
  declineRequest,
  archiveUser,
  unarchiveUser,
} = require("../controllers/adminUserController");

router.use(protect, restrictTo("Administrator"));

router.get("/", getUsers);
router.post("/moderators", createModerator);
router.get("/:id", getUserDetails);
router.patch("/:id/deactivate", deactivateUser);
router.patch("/:id/reactivate", reactivateUser);
router.patch("/:id/decline-request", declineRequest);
router.patch("/:id/archive", archiveUser);
router.patch("/:id/unarchive", unarchiveUser);

module.exports = router;
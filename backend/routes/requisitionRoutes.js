const router = require("express").Router();
const { protect, restrictTo } = require("../middleware/auth");
const c = require("../controllers/requisitionController");

router.use(protect);

// Staff only: every slip, and changing a slip's status
router.get("/all", restrictTo("Moderator", "Administrator"), c.listAll);
router.patch("/:slip/status", restrictTo("Moderator", "Administrator"), c.setStatus);

// Any signed-in user: their own slips
router.get("/", c.list);
router.post("/", c.create);
router.put("/:slip", c.update);
router.delete("/:slip", c.remove);

module.exports = router;
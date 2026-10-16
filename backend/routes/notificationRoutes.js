const router = require("express").Router();
const { protect } = require("../middleware/auth");
const c = require("../controllers/notificationController");

router.use(protect);
router.get("/", c.list);
router.patch("/read-all", c.markAllRead); // must come before "/:id/read"
router.patch("/:id/read", c.markRead);
router.delete("/", c.clearAll);
router.delete("/:id", c.remove);

module.exports = router;
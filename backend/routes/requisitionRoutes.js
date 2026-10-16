const router = require("express").Router();
const { protect } = require("../middleware/auth");
const c = require("../controllers/requisitionController");

router.use(protect);
router.get("/", c.list);
router.post("/", c.create);
router.put("/:slip", c.update);
router.delete("/:slip", c.remove);

module.exports = router;
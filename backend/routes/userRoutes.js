const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { protect } = require("../middleware/auth");
const {
  getProfile,
  updateProfile,
  setPassword,
  deactivateAccount,
} = require("../controllers/userController");

const isProd = process.env.NODE_ENV === "production";

const makeLimiter = (max, windowMinutes = 15) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: isProd ? max : max * 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." },
  });

const profileLimiter = makeLimiter(30);
const deactivateLimiter = makeLimiter(5, 60);
const passwordLimiter = makeLimiter(10, 60); // first-time password setup (Google accounts)

router.get("/profile", protect, profileLimiter, getProfile);
router.put("/profile", protect, profileLimiter, updateProfile);
router.post("/password", protect, passwordLimiter, setPassword);
router.put("/deactivate", protect, deactivateLimiter, deactivateAccount);

module.exports = router;
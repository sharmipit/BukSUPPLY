const express = require("express");
const router = express.Router();

const {
  signUp,
  signIn,
  requestOtp,
  verifyOtp,
  resetPassword,
} = require("../controllers/authController");

// --- Sign up / Sign in (Student, Regular Staff, Moderator, Administrator) ---
router.post("/signup", signUp);
router.post("/signin", signIn);

// --- Forgot password (6-digit OTP workflow) ---
router.post("/forgot-password/request-code", requestOtp);
router.post("/forgot-password/verify-code", verifyOtp);
router.post("/forgot-password/reset-password", resetPassword);

module.exports = router;
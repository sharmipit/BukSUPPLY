const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const {
  signUp,
  signIn,
  googleSignIn,
  requestOtp,
  verifyOtp,
  resetPassword,
} = require("../controllers/authController");

// Slows down brute-force and spam attempts (per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

// --- Sign up / Sign in (Student, Regular Staff, Moderator, Administrator) ---
router.post("/signup", authLimiter, signUp);
router.post("/signin", authLimiter, signIn);

// --- Google Sign-In ---
router.post("/google", authLimiter, googleSignIn);

// --- Forgot password (6-digit OTP workflow) ---
router.post("/forgot-password/request-code", authLimiter, requestOtp);
router.post("/forgot-password/verify-code", authLimiter, verifyOtp);
router.post("/forgot-password/reset-password", authLimiter, resetPassword);

module.exports = router;
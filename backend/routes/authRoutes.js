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

const isProd = process.env.NODE_ENV === "production";

const makeLimiter = (max, windowMinutes = 15, options = {}) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: isProd ? max : max * 10, // relaxed in development so testing doesn't lock you out
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." },
    ...options,
  });

const signinLimiter = makeLimiter(10, 15, { skipSuccessfulRequests: true }); // password guessing (failures only)
const signupLimiter = makeLimiter(10, 60);  // fake account creation
const googleLimiter = makeLimiter(30);
const otpRequestLimiter = makeLimiter(5);   // each request sends an email
const otpCheckLimiter = makeLimiter(10, 15, { skipSuccessfulRequests: true }); // verify + reset (failures only)

// --- Sign up / Sign in ---
router.post("/signup", signupLimiter, signUp);
router.post("/signin", signinLimiter, signIn);

// --- Google Sign-In ---
router.post("/google", googleLimiter, googleSignIn);

// --- Forgot password (6-digit OTP workflow) ---
router.post("/forgot-password/request-code", otpRequestLimiter, requestOtp);
router.post("/forgot-password/verify-code", otpCheckLimiter, verifyOtp);
router.post("/forgot-password/reset-password", otpCheckLimiter, resetPassword);

module.exports = router;
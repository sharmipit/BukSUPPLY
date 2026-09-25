const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendOtpEmail } = require("../utils/sendEmail");

const STUDENT_DOMAIN = "@student.buksu.edu.ph";
const STAFF_DOMAIN = "@buksu.edu.ph";
const OTP_EXPIRES_MINUTES = Number(process.env.RESET_TOKEN_EXPIRES_MINUTES) || 15;

// --- Helpers -----------------------------------------------------------

/**
 * Determines the role a public signup should receive based on the
 * institutional email domain. Returns null if the domain isn't allowed.
 * Note: emails ending in @student.buksu.edu.ph must be checked first,
 * since that domain is itself a subdomain of @buksu.edu.ph.
 */
const resolveRoleFromEmail = (email) => {
  const lower = email.toLowerCase();
  if (lower.endsWith(STUDENT_DOMAIN)) return "Student";
  if (lower.endsWith(STAFF_DOMAIN)) return "Regular Staff";
  return null;
};

const generateOtp = () => {
  // 6-digit numeric string, zero-padded (e.g. "004821")
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
};

const signToken = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
};

// --- Controllers ---------------------------------------------------------

/**
 * POST /api/auth/signup
 * Public signup for Student / Regular Staff only.
 */
exports.signUp = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      idNumber,
      password,
      confirmPassword,
      termsAndConditions,
      privacyPolicy,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !idNumber ||
      !password ||
      !confirmPassword ||
      termsAndConditions === undefined ||
      privacyPolicy === undefined
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match.",
      });
    }

    if (termsAndConditions !== true || privacyPolicy !== true) {
      return res.status(400).json({
        message: "You must accept the Terms and Conditions and Privacy Policy.",
      });
    }

    const role = resolveRoleFromEmail(email);
    if (!role) {
      return res.status(400).json({
        message: "Please use a valid BukSU institutional email address.",
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const user = new User({
      firstName,
      lastName,
      email,
      idNumber,
      password,
      role,
      accountStatus: "Active",
      termsAndConditions,
      privacyPolicy,
    });

    await user.save();

    return res.status(201).json({ message: "Account created successfully!" });
  } catch (err) {
    console.error("signUp error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

/**
 * POST /api/auth/signin
 * Sign in for all roles (Student, Regular Staff, Moderator, Administrator).
 */
exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (user.accountStatus === "Deactivated") {
      return res.status(403).json({ message: "Your account has been deactivated." });
    }

    const token = signToken(user);

    return res.status(200).json({
      message: "Signed in successfully.",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        idNumber: user.idNumber,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    });
  } catch (err) {
    console.error("signIn error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

/**
 * POST /api/auth/forgot-password/request-code
 * Step 1: generate and email a 6-digit OTP.
 */
exports.requestOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "Email address not found." });
    }

    const otp = generateOtp();

    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);
    user.resetPasswordOtpUsed = false;
    await user.save();

    await sendOtpEmail(user.email, otp);

    return res.status(200).json({
      message: "A verification code has been sent to your email.",
    });
  } catch (err) {
    console.error("requestOtp error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

/**
 * POST /api/auth/forgot-password/verify-code
 * Step 2: verify the OTP without consuming it (consumption happens on reset).
 */
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and verification code are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+resetPasswordOtp +resetPasswordOtpExpires"
    );

    const isValid =
      user &&
      user.resetPasswordOtp &&
      user.resetPasswordOtp === otp &&
      !user.resetPasswordOtpUsed &&
      user.resetPasswordOtpExpires &&
      user.resetPasswordOtpExpires.getTime() > Date.now();

    if (!isValid) {
      return res.status(400).json({ message: "Invalid or expired verification code." });
    }

    return res.status(200).json({ message: "Verification code confirmed." });
  } catch (err) {
    console.error("verifyOtp error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

/**
 * POST /api/auth/forgot-password/reset-password
 * Step 3: set a new password, consuming the OTP.
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+resetPasswordOtp +resetPasswordOtpExpires +password"
    );

    const isValid =
      user &&
      user.resetPasswordOtp &&
      user.resetPasswordOtp === otp &&
      !user.resetPasswordOtpUsed &&
      user.resetPasswordOtpExpires &&
      user.resetPasswordOtpExpires.getTime() > Date.now();

    if (!isValid) {
      return res.status(400).json({ message: "Invalid or expired verification code." });
    }

    // Assigning triggers the pre-save bcrypt hashing hook — never use
    // findOneAndUpdate() here, since that would bypass the hook and store
    // the password in plain text.
    user.password = newPassword;
    user.resetPasswordOtpUsed = true;
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpires = undefined;
    await user.save();

    return res.status(200).json({
      message: "Password reset successful! You may now sign in.",
    });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};
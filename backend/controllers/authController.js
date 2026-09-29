const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { sendOtpEmail } = require("../utils/sendEmail");

const EMAIL_PATTERN = /^[^@\s]+@(student\.)?buksu\.edu\.ph$/;
const STUDENT_DOMAIN = "@student.buksu.edu.ph";
const OTP_EXPIRES_MINUTES = Number(process.env.RESET_TOKEN_EXPIRES_MINUTES) || 15;
const OTP_MAX_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 8;

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- Helpers -----------------------------------------------------------

const isString = (v) => typeof v === "string";
const normalizeEmail = (email) => email.trim().toLowerCase();

const resolveRoleFromEmail = (email) => {
  if (!EMAIL_PATTERN.test(email)) return null;
  return email.endsWith(STUDENT_DOMAIN) ? "Student" : "Regular Staff";
};

const generateOtp = () =>
  crypto.randomInt(0, 1000000).toString().padStart(6, "0");

const hashOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");

const signToken = (user) =>
  jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });

const SERVER_ERROR = { message: "Something went wrong. Please try again." };
const GOOGLE_ONLY_MESSAGE =
  'This account uses Google Sign-In. Please use "Continue with Google" instead.';

/**
 * Checks an OTP against the stored hash. Counts failed attempts and locks
 * the code after OTP_MAX_ATTEMPTS. The user must have been loaded with
 * OTP_SELECT.
 */
const OTP_SELECT = "+resetPasswordOtp +resetPasswordOtpExpires +resetPasswordOtpAttempts";

const checkOtp = async (user, otp) => {
  if (
    !user ||
    !user.resetPasswordOtp ||
    user.resetPasswordOtpUsed ||
    !user.resetPasswordOtpExpires ||
    user.resetPasswordOtpExpires.getTime() <= Date.now()
  ) {
    return false;
  }

  const attempts = user.resetPasswordOtpAttempts || 0;
  if (attempts >= OTP_MAX_ATTEMPTS) return false;

  const stored = Buffer.from(user.resetPasswordOtp, "hex");
  const given = Buffer.from(hashOtp(otp), "hex");
  const match = stored.length === given.length && crypto.timingSafeEqual(stored, given);

  if (!match) {
    user.resetPasswordOtpAttempts = attempts + 1;
    await user.save();
    return false;
  }
  return true;
};

const publicUser = (user) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  idNumber: user.idNumber || null,
  role: user.role,
  accountStatus: user.accountStatus,
  profileComplete: Boolean(user.idNumber),
});

// --- Controllers ---------------------------------------------------------

/** POST /api/auth/signup */
exports.signUp = async (req, res) => {
  try {
    const { firstName, lastName, email, idNumber, password, confirmPassword, termsAgreement } =
      req.body;

    if (![firstName, lastName, email, idNumber, password, confirmPassword].every(isString)) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const cleanEmail = normalizeEmail(email);

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !cleanEmail ||
      !idNumber.trim() ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    if (termsAgreement !== true) {
      return res
        .status(400)
        .json({ message: "You must agree to the Terms and Conditions and Privacy Policy." });
    }

    const role = resolveRoleFromEmail(cleanEmail);
    if (!role) {
      return res
        .status(400)
        .json({ message: "Please use a valid BukSU institutional email address." });
    }

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const user = new User({
      firstName,
      lastName,
      email: cleanEmail,
      idNumber,
      password,
      role,
      authProvider: "local",
      accountStatus: "Active",
      agreedToTerms: true,
    });

    await user.save();

    return res.status(201).json({ message: "Account created successfully!" });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: Object.values(err.errors)[0].message });
    }
    if (err.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    console.error("signUp error:", err);
    return res.status(500).json(SERVER_ERROR);
  }
};

/** POST /api/auth/signin */
exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isString(email) || !isString(password) || !email.trim() || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: normalizeEmail(email) }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!user.password) {
      return res.status(400).json({ message: GOOGLE_ONLY_MESSAGE });
    }

    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (user.accountStatus === "Deactivated") {
      return res.status(403).json({ message: "Your account has been deactivated." });
    }

    return res.status(200).json({
      message: "Signed in successfully.",
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    console.error("signIn error:", err);
    return res.status(500).json(SERVER_ERROR);
  }
};

/**
 * POST /api/auth/google
 * Verifies a Google ID token, enforces the BukSU domain restriction,
 * and creates / logs in the user.
 */
exports.googleSignIn = async (req, res) => {
  try {
    const { credential, agreedToTerms } = req.body;

    if (!isString(credential) || !credential) {
      return res.status(400).json({ message: "Missing Google credential." });
    }

    // Step 1: verify the token is real and issued for THIS app
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ message: "Invalid Google credential." });
    }

    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(403).json({ message: "Google account email is not verified." });
    }

    const email = normalizeEmail(payload.email);

    // Step 2: server-side domain check (never trust the client for this)
    const role = resolveRoleFromEmail(email);
    if (!role) {
      return res
        .status(403)
        .json({ message: "Please use a valid BukSU institutional Google account." });
    }

    let user = await User.findOne({ email }).select("+googleId");

    if (user && user.accountStatus === "Deactivated") {
      return res.status(403).json({ message: "Your account has been deactivated." });
    }

    if (!user) {
      // First time this email has signed in: create the account
      if (agreedToTerms !== true) {
        return res.status(428).json({
          requiresTerms: true,
          message: "Please agree to the Terms and Conditions and Privacy Policy to continue.",
        });
      }

      user = new User({
        firstName: payload.given_name || payload.name || "Unknown",
        lastName: payload.family_name || "-", // schema requires a non-empty last name
        email,
        role,
        authProvider: "google",
        googleId: payload.sub,
        agreedToTerms: true,
      });
      await user.save();
    } else if (!user.googleId) {
      // Existing account signing in with Google for the first time:
      // link the Google identity to it.
      user.googleId = payload.sub;
      await user.save();
    } else if (user.googleId !== payload.sub) {
      // Same email but a different Google account: refuse
      return res.status(403).json({ message: "This email is linked to a different Google account." });
    }

    return res.status(200).json({
      message: "Signed in successfully.",
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: Object.values(err.errors)[0].message });
    }
    if (err.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    console.error("googleSignIn error:", err);
    return res.status(500).json(SERVER_ERROR);
  }
};

/** POST /api/auth/forgot-password/request-code */
exports.requestOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!isString(email) || !email.trim()) {
      return res.status(400).json({ message: "Email is required." });
    }

    // Same response whether or not the account exists (no email enumeration)
    const genericResponse = {
      message: "If that email is registered, a verification code has been sent.",
    };

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user || user.accountStatus === "Deactivated" || user.authProvider === "google") {
      return res.status(200).json(genericResponse);
    }

    const otp = generateOtp();

    user.resetPasswordOtp = hashOtp(otp);
    user.resetPasswordOtpExpires = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);
    user.resetPasswordOtpUsed = false;
    user.resetPasswordOtpAttempts = 0;
    await user.save();

    await sendOtpEmail(user.email, otp); // send the plain code, store only the hash

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error("requestOtp error:", err);
    return res.status(500).json(SERVER_ERROR);
  }
};

/** POST /api/auth/forgot-password/verify-code */
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!isString(email) || !email.trim() || !(isString(otp) || typeof otp === "number")) {
      return res.status(400).json({ message: "Email and verification code are required." });
    }

    const user = await User.findOne({ email: normalizeEmail(email) }).select(OTP_SELECT);

    if (!(await checkOtp(user, otp))) {
      return res.status(400).json({ message: "Invalid or expired verification code." });
    }

    return res.status(200).json({ message: "Verification code confirmed." });
  } catch (err) {
    console.error("verifyOtp error:", err);
    return res.status(500).json(SERVER_ERROR);
  }
};

/** POST /api/auth/forgot-password/reset-password */
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (
      !isString(email) ||
      !email.trim() ||
      !(isString(otp) || typeof otp === "number") ||
      !isString(newPassword) ||
      !isString(confirmPassword) ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const user = await User.findOne({ email: normalizeEmail(email) }).select(
      `${OTP_SELECT} +password`
    );

    if (!(await checkOtp(user, otp))) {
      return res.status(400).json({ message: "Invalid or expired verification code." });
    }

    // Assigning triggers the pre-save bcrypt hook. Never use
    // findOneAndUpdate() here, since it would store the password in plain text.
    user.password = newPassword;
    user.resetPasswordOtpUsed = true;
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpires = undefined;
    user.resetPasswordOtpAttempts = 0;
    await user.save();

    return res.status(200).json({ message: "Password reset successful! You may now sign in." });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json(SERVER_ERROR);
  }
};
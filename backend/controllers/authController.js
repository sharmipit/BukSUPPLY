const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { sendOtpEmail } = require('../utils/sendEmail');
const Notification = require('../models/Notification');
const Deactivation = require('../models/Deactivation');
const ReactivationRequest = require('../models/ReactivationRequest');
const settings = require('../services/settings');
const emailCodes = require('../services/emailVerification');
const { logActivity } = require('../services/activityLog');
const asyncHandler = require('../middleware/asyncHandler');
const {
  formatName,
  nameProblem,
  emailShapeProblem,
  idProblem,
  passwordProblem,
} = require('../utils/validators');

const EMAIL_PATTERN = /^([^@\s]+@(student\.)?buksu\.edu\.ph|sharmagnegamboa11@gmail\.com)$/i;
const STUDENT_DOMAIN = '@student.buksu.edu.ph';
const OTP_EXPIRES_MINUTES = Number(process.env.RESET_TOKEN_EXPIRES_MINUTES) || 15;
const OTP_MAX_ATTEMPTS = 5;

const googleClient = new OAuth2Client();

// --- Helpers -----------------------------------------------------------

const isString = (v) => typeof v === 'string';
const normalizeEmail = (email) => email.trim().toLowerCase();

const resolveRoleFromEmail = (email) => {
  if (!EMAIL_PATTERN.test(email)) return null;
  return email.endsWith(STUDENT_DOMAIN) ? 'Student' : 'Regular Staff';
};

const generateOtp = () => crypto.randomInt(0, 1000000).toString().padStart(6, '0');

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

const signToken = (user) =>
  jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

const verifyRecaptcha = async (token, ip) => {
  const s = settings.get();

  // Toggle off in System Settings = skip the check
  if (!s.recaptchaEnabled) return true;

  if (!s.recaptchaSecretKey) {
    console.error('reCAPTCHA is on but no secret key is saved in System Settings.');
    return false;
  }
  if (!isString(token) || !token) return false;

  const params = new URLSearchParams({
    secret: s.recaptchaSecretKey,
    response: token,
  });
  if (ip) params.append('remoteip', ip);

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await response.json();
  return data.success === true;
};

const GOOGLE_ONLY_MESSAGE =
  'This account uses Google Sign-In. Please use "Continue with Google" instead.';

const REACTIVATION_MIN = 10;
const REACTIVATION_MAX = 500;

const fullName = (u) =>
  [u.firstName, u.lastName].filter((n) => n && n !== '-').join(' ') || u.email || 'Unknown user';

// Deactivated account response payload with status and pending requests
const deactivatedPayload = async (user) => {
  const [current, pending, declined] = await Promise.all([
    Deactivation.findOne({ user: user._id, active: true }).sort({ createdAt: -1 }).lean(),
    ReactivationRequest.findOne({ user: user._id, status: 'Pending' }).lean(),
    ReactivationRequest.findOne({ user: user._id, status: 'Declined' })
      .sort({ resolvedAt: -1 })
      .lean(),
  ]);

  // A decline only matters if it came after the current deactivation began
  const lastDecline =
    declined && (!current || declined.createdAt >= current.createdAt) ? declined : null;

  return {
    message: 'Your account has been deactivated.',
    code: 'ACCOUNT_DEACTIVATED',
    email: user.email,
    archived: Boolean(user.archived), // archived accounts cannot send a reactivation request
    deactivation: {
      reason: current ? current.reason : '',
      source: current ? current.source : '',
      date: current ? current.createdAt : null,
    },
    request: pending ? { status: 'Pending', date: pending.createdAt } : null,
    lastDecline: lastDecline ? { note: lastDecline.adminNote, date: lastDecline.resolvedAt } : null,
  };
};

// Verify OTP hash against stored hash and track attempt limits
const OTP_SELECT = '+resetPasswordOtp +resetPasswordOtpExpires +resetPasswordOtpAttempts';

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

  const stored = Buffer.from(user.resetPasswordOtp, 'hex');
  const given = Buffer.from(hashOtp(otp), 'hex');
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
  contactNumber: user.contactNumber || '',
  role: user.role,
  accountStatus: user.accountStatus,
  profileComplete: Boolean(user.idNumber),
  avatar: user.avatar || '',
});

// --- Controllers ---------------------------------------------------------

// Runs every sign-up check once, so "send code" and "create account" can't disagree.
// Returns { status, error, field } or the cleaned values.
const checkSignupFields = async (body) => {
  const { firstName, lastName, email, idNumber, password, confirmPassword, termsAgreement } = body;

  if (![firstName, lastName, email, idNumber, password, confirmPassword].every(isString)) {
    return { status: 400, error: 'All fields are required.' };
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
    return { status: 400, error: 'All fields are required.' };
  }

  const pwProblem = passwordProblem(password);
  if (pwProblem) return { status: 400, error: pwProblem, field: 'password' };
  if (password !== confirmPassword) {
    return { status: 400, error: 'Passwords do not match.', field: 'confirmPassword' };
  }
  if (termsAgreement !== true) {
    return { status: 400, error: 'You must agree to the Terms and Conditions and Privacy Policy.' };
  }

  const role = resolveRoleFromEmail(cleanEmail);
  if (!role) {
    return {
      status: 400,
      error: 'Please use a valid BukSU institutional email address.',
      field: 'email',
    };
  }
  const emailErr = emailShapeProblem(cleanEmail);
  if (emailErr) return { status: 400, error: emailErr, field: 'email' };

  const firstErr = nameProblem(firstName, 'First name');
  if (firstErr) return { status: 400, error: firstErr, field: 'firstName' };
  const lastErr = nameProblem(lastName, 'Last name');
  if (lastErr) return { status: 400, error: lastErr, field: 'lastName' };

  const cleanId = idNumber.trim().toUpperCase();
  const idErr = idProblem(role, cleanId);
  if (idErr) return { status: 400, error: idErr, field: 'idNumber' };

  if (await User.findOne({ email: cleanEmail })) {
    return { status: 409, error: 'An account with this email already exists.', field: 'email' };
  }
  if (await User.findOne({ idNumber: cleanId })) {
    return { status: 409, error: 'This ID number is already registered.', field: 'idNumber' };
  }

  return {
    cleanEmail,
    role,
    cleanId,
    first: formatName(firstName),
    last: formatName(lastName),
  };
};

const CODE_MAIL = {
  subject: 'BukSUPPLY Email Verification Code',
  heading: 'Verify your email',
  intro: 'Use this code to finish creating your BukSUPPLY account.',
};

/** POST /api/auth/signup/send-code (the sign-up form fields + recaptchaToken) */
exports.sendSignupCode = asyncHandler(async (req, res) => {
  // reCAPTCHA runs here, because this is the step that sends an email
  if (!(await verifyRecaptcha(req.body.recaptchaToken, req.ip))) {
    return res.status(400).json({ message: 'reCAPTCHA verification failed. Please try again.' });
  }

  const check = await checkSignupFields(req.body);
  if (check.error) {
    return res.status(check.status).json({ message: check.error, field: check.field });
  }

  const wait = await emailCodes.secondsUntilResend(check.cleanEmail, 'signup');
  if (wait > 0) {
    return res
      .status(429)
      .json({ message: `Please wait ${wait} seconds before requesting another code.` });
  }

  try {
    await emailCodes.issueCode(check.cleanEmail, 'signup', CODE_MAIL);
  } catch (err) {
    console.error('signup code email error:', err.message);
    return res
      .status(500)
      .json({ message: 'Could not send the code. Check the email address and try again.' });
  }
  return res.status(200).json({ message: `A 6-digit code was sent to ${check.cleanEmail}.` });
});

/** POST /api/auth/signup/resend-code { email } (only after a code was requested) */
exports.resendSignupCode = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!isString(email) || !email.trim()) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  const cleanEmail = normalizeEmail(email);
  if (!resolveRoleFromEmail(cleanEmail) || !(await emailCodes.hasPending(cleanEmail, 'signup'))) {
    return res.status(400).json({ message: 'Please go back and submit the form again.' });
  }
  if (await User.findOne({ email: cleanEmail })) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const wait = await emailCodes.secondsUntilResend(cleanEmail, 'signup');
  if (wait > 0) {
    return res
      .status(429)
      .json({ message: `Please wait ${wait} seconds before requesting another code.` });
  }

  try {
    await emailCodes.issueCode(cleanEmail, 'signup', CODE_MAIL);
  } catch (err) {
    console.error('signup resend email error:', err.message);
    return res.status(500).json({ message: 'Could not send the code. Please try again.' });
  }
  return res.status(200).json({ message: 'A new code was sent.' });
});

/** POST /api/auth/signup (+ emailCode) */
exports.signUp = async (req, res) => {
  try {
    const check = await checkSignupFields(req.body);
    if (check.error) {
      return res.status(check.status).json({ message: check.error, field: check.field });
    }
    const { cleanEmail, role, cleanId, first, last } = check;

    // The emailed code replaces the reCAPTCHA check at this step
    const codeResult = await emailCodes.checkCode(cleanEmail, 'signup', req.body.emailCode);
    if (codeResult !== 'ok') {
      return res
        .status(400)
        .json({ message: emailCodes.messageFor(codeResult), field: 'emailCode' });
    }

    const user = new User({
      firstName: first,
      lastName: last,
      email: cleanEmail,
      idNumber: cleanId,
      password: req.body.password,
      role,
      authProvider: 'local',
      accountStatus: 'Active',
      agreedToTerms: true,
    });
    await user.save();

    // Only now, so a failed save lets the user retry with the same code
    await emailCodes.consumeCode(cleanEmail, 'signup');

    await logActivity(
      user,
      { category: 'Account', action: 'SIGN_UP', description: 'Created an account' },
      req
    );

    return res.status(201).json({ message: 'Account created successfully!' });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(err.errors)[0].message });
    }
    if (err.code === 11000) {
      if (err.keyPattern && err.keyPattern.idNumber) {
        return res.status(409).json({ message: 'This ID number is already registered.' });
      }
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    console.error('signUp error:', err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

/** POST /api/auth/signin */
exports.signIn = asyncHandler(async (req, res) => {
  const { email, password, recaptchaToken } = req.body;

  // reCAPTCHA check (bots get stopped before touching the database)
  if (!(await verifyRecaptcha(recaptchaToken, req.ip))) {
    return res.status(400).json({ message: 'reCAPTCHA verification failed. Please try again.' });
  }

  if (!isString(email) || !isString(password) || !email.trim() || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: normalizeEmail(email) }).select('+password');
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  if (!user.password) {
    return res.status(400).json({ message: GOOGLE_ONLY_MESSAGE });
  }

  if (!(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  if (user.accountStatus === 'Deactivated') {
    return res.status(403).json(await deactivatedPayload(user));
  }

  await logActivity(
    user,
    { category: 'Account', action: 'SIGN_IN', description: 'Signed in with email and password' },
    req
  );

  return res.status(200).json({
    message: 'Signed in successfully.',
    token: signToken(user),
    user: publicUser(user),
  });
});

/**
 * POST /api/auth/google
 * Verifies a Google ID token, enforces the BukSU domain restriction,
 * and creates / logs in the user. New users must also send agreedToTerms
 * and an idNumber.
 */
exports.googleSignIn = async (req, res) => {
  try {
    const { credential, agreedToTerms, idNumber } = req.body;
    const cfg = settings.get();

    if (!cfg.googleEnabled || !cfg.googleClientId) {
      return res.status(403).json({ message: 'Google sign-in is turned off.' });
    }

    if (!isString(credential) || !credential) {
      return res.status(400).json({ message: 'Missing Google credential.' });
    }

    // Step 1: verify the token is real and issued for THIS app
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: cfg.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ message: 'Invalid Google credential.' });
    }

    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(403).json({ message: 'Google account email is not verified.' });
    }

    const email = normalizeEmail(payload.email);

    // Step 2: server-side domain check (never trust the client for this)
    const role = resolveRoleFromEmail(email);
    if (!role) {
      return res.status(403).json({
        message: 'Please use a valid BukSU institutional Google account.',
      });
    }

    let user = await User.findOne({ email }).select('+googleId');
    let isNewUser = false;

    if (user && user.accountStatus === 'Deactivated') {
      return res.status(403).json(await deactivatedPayload(user));
    }

    if (!user) {
      if (agreedToTerms !== true) {
        return res.status(428).json({
          requiresTerms: true,
          requiresIdNumber: true,
          email,
          message: 'Please agree to the Terms and Conditions and Privacy Policy to continue.',
        });
      }

      const cleanId = isString(idNumber) ? idNumber.trim().toUpperCase() : '';
      const idErr = idProblem(role, cleanId);
      if (idErr) {
        return res.status(400).json({ message: idErr, field: 'idNumber' });
      }

      user = new User({
        firstName: payload.given_name || payload.name || 'Unknown',
        lastName: payload.family_name || '-',
        email,
        idNumber: cleanId,
        role,
        authProvider: 'google',
        googleId: payload.sub,
        avatar: payload.picture || '',
        agreedToTerms: true,
      });
      await user.save();
      isNewUser = true;
    } else if (!user.googleId) {
      user.googleId = payload.sub;
      await user.save();
    } else if (user.googleId !== payload.sub) {
      return res.status(403).json({
        message: 'This email is linked to a different Google account.',
      });
    }

    // Keep the Google profile picture current on every Google sign-in
    if (payload.picture && user.avatar !== payload.picture) {
      user.avatar = payload.picture;
      await user.save();
    }

    await logActivity(
      user,
      isNewUser
        ? { category: 'Account', action: 'SIGN_UP', description: 'Created an account with Google' }
        : { category: 'Account', action: 'SIGN_IN', description: 'Signed in with Google' },
      req
    );

    return res.status(200).json({
      message: 'Signed in successfully.',
      token: signToken(user),
      user: publicUser(user),
      isNewUser,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const first = Object.values(err.errors)[0];
      return res.status(400).json({
        message: first.message,
        field: first.path === 'idNumber' ? 'idNumber' : undefined,
      });
    }
    if (err.code === 11000) {
      if (err.keyPattern && err.keyPattern.idNumber) {
        return res.status(409).json({
          message: 'This ID number is already registered.',
          field: 'idNumber',
        });
      }
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    console.error('googleSignIn error:', err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

/** POST /api/auth/forgot-password/request-code */
exports.requestOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!isString(email) || !email.trim()) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  // Same response whether or not the account exists (no email enumeration)
  const genericResponse = {
    message: 'If that email is registered, a verification code has been sent.',
  };

  const user = await User.findOne({ email: normalizeEmail(email) });
  if (!user || user.accountStatus === 'Deactivated' || user.authProvider === 'google') {
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
});

/** POST /api/auth/forgot-password/verify-code */
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!isString(email) || !email.trim() || !(isString(otp) || typeof otp === 'number')) {
    return res.status(400).json({ message: 'Email and verification code are required.' });
  }

  const user = await User.findOne({ email: normalizeEmail(email) }).select(OTP_SELECT);

  if (!(await checkOtp(user, otp))) {
    return res.status(400).json({ message: 'Invalid or expired verification code.' });
  }

  return res.status(200).json({ message: 'Verification code confirmed.' });
});

/** POST /api/auth/forgot-password/reset-password */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword, confirmPassword } = req.body;

  if (
    !isString(email) ||
    !email.trim() ||
    !(isString(otp) || typeof otp === 'number') ||
    !isString(newPassword) ||
    !isString(confirmPassword) ||
    !newPassword ||
    !confirmPassword
  ) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  const pwProblem = passwordProblem(newPassword);
  if (pwProblem) {
    return res.status(400).json({ message: pwProblem });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }

  const user = await User.findOne({ email: normalizeEmail(email) }).select(
    `${OTP_SELECT} +password`
  );

  if (!(await checkOtp(user, otp))) {
    return res.status(400).json({ message: 'Invalid or expired verification code.' });
  }

  // Assigning triggers the pre-save bcrypt hook. Never use
  // findOneAndUpdate() here, since it would store the password in plain text.
  user.password = newPassword;
  user.resetPasswordOtpUsed = true;
  user.resetPasswordOtp = undefined;
  user.resetPasswordOtpExpires = undefined;
  user.resetPasswordOtpAttempts = 0;
  await user.save();

  return res.status(200).json({ message: 'Password reset successful! You may now sign in.' });
});

/**
 * POST /api/auth/reactivation-request
 * A deactivated user asks the administrator to reactivate the account.
 * Body: { message, email + password }  or  { message, credential }  (Google sign-in token)
 * The person must prove they own the account again, so nobody can send requests for
 * someone else's email.
 */
exports.requestReactivation = asyncHandler(async (req, res) => {
  const { email, password, credential } = req.body;
  const message = isString(req.body.message) ? req.body.message.trim() : '';

  if (message.length < REACTIVATION_MIN) {
    return res.status(400).json({
      message: `Please tell the administrator why you would like your account back (at least ${REACTIVATION_MIN} characters).`,
    });
  }
  if (message.length > REACTIVATION_MAX) {
    return res.status(400).json({
      message: `Your message must be ${REACTIVATION_MAX} characters or fewer.`,
    });
  }

  const NOT_VERIFIED = {
    message: 'We could not verify your account. Please go back and sign in again.',
  };
  let user = null;

  if (isString(credential) && credential) {
    // Google account: same token check as the Google sign-in
    const cfg = settings.get();
    if (!cfg.googleEnabled || !cfg.googleClientId) {
      return res.status(403).json({ message: 'Google sign-in is turned off.' });
    }
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: cfg.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json(NOT_VERIFIED);
    }
    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(403).json({ message: 'Google account email is not verified.' });
    }
    user = await User.findOne({ email: normalizeEmail(payload.email) }).select('+googleId');
    if (user && user.googleId && user.googleId !== payload.sub) user = null;
  } else {
    // Email and password
    if (!isString(email) || !isString(password) || !email.trim() || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    user = await User.findOne({ email: normalizeEmail(email) }).select('+password');
    if (!user || !user.password || !(await user.comparePassword(password))) user = null;
  }

  if (!user) return res.status(401).json(NOT_VERIFIED);

  if (user.accountStatus !== 'Deactivated') {
    return res.status(409).json({ message: 'This account is not deactivated.' });
  }

  // An archived account is hidden from the administrator's lists, so a request would be lost
  if (user.archived) {
    return res.status(403).json({
      message: 'This account has been archived. Please contact the administrator in person.',
    });
  }

  const already = { message: 'You already sent a request. Please wait for the administrator.' };
  if (await ReactivationRequest.exists({ user: user._id, status: 'Pending' })) {
    return res.status(409).json(already);
  }

  let request;
  try {
    request = await ReactivationRequest.create({ user: user._id, message });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json(already); // two clicks at once
    throw err;
  }

  // Tell every active administrator (never blocks the response)
  User.find({ role: 'Administrator', accountStatus: 'Active' })
    .select('_id')
    .then((admins) =>
      admins.length
        ? Notification.insertMany(
            admins.map((a) => ({
              user: a._id,
              title: 'Reactivation Request',
              message: `${fullName(user)} (${user.email}) asked to have their account reactivated. Review it in User Management.`,
              type: 'info',
              link: '/admin/users',
            }))
          )
        : null
    )
    .catch((e) => console.error('reactivation notify error:', e));

  await logActivity(
    user,
    {
      category: 'Account',
      action: 'REACTIVATION_REQUESTED',
      description: 'Asked the administrator to reactivate the account',
    },
    req
  );

  return res.status(201).json({
    message: 'Request sent. The administrator will review it.',
    request: { status: 'Pending', date: request.createdAt },
  });
});
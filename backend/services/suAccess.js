const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const settings = require('./settings');
const { sendEmail } = require('../utils/sendEmail');

const SU_EMAIL = (process.env.SU_EMAIL || '').trim().toLowerCase();
const SU_PIN = process.env.SU_PIN || '';

// Fail closed: without these, System Settings must stay locked.
if (!SU_EMAIL || !SU_PIN) {
  throw new Error('SU_EMAIL and SU_PIN must be set in .env.');
}

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const OTP_MINUTES = 10;
const UNLOCK_MINUTES = 15;

const failures = new Map(); // userId -> { count, lockedUntil }
const challenges = new Map(); // userId -> { hash, expires, attempts }

const sha = (v) => crypto.createHash('sha256').update(String(v)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

const fail = (msg) => {
  throw new Error(msg);
};

const checkLock = (userId) => {
  const f = failures.get(userId);
  if (f && f.lockedUntil > Date.now()) {
    const mins = Math.ceil((f.lockedUntil - Date.now()) / 60000);
    fail(`Too many attempts. Try again in ${mins} minute(s).`);
  }
};

const registerFail = (userId) => {
  const f = failures.get(userId) || { count: 0, lockedUntil: 0 };
  f.count += 1;
  if (f.count >= MAX_ATTEMPTS) {
    f.count = 0;
    f.lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
  }
  failures.set(userId, f);
};

const smtpReady = () => {
  const s = settings.get();
  return !!(s.smtpHost && s.smtpUser && s.smtpPassword);
};

const issueToken = (userId) =>
  jwt.sign({ userId, purpose: 'settings-unlock' }, process.env.JWT_SECRET, {
    expiresIn: `${UNLOCK_MINUTES}m`,
  });

// Step 1: email + PIN
async function start(userId, email, pin) {
  checkLock(userId);

  // Evaluate both so timing doesn't reveal which one was wrong
  const emailOk = safeEqual(
    String(email || '')
      .trim()
      .toLowerCase(),
    SU_EMAIL
  );
  const pinOk = safeEqual(String(pin || ''), SU_PIN);
  if (!(emailOk && pinOk)) {
    registerFail(userId);
    fail('Incorrect email or PIN.');
  }
  failures.delete(userId);

  if (!smtpReady()) {
    return { otpRequired: false, token: issueToken(userId) };
  }

  const otp = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  challenges.set(userId, {
    hash: sha(otp),
    expires: Date.now() + OTP_MINUTES * 60 * 1000,
    attempts: 0,
  });

  await sendEmail({
    to: SU_EMAIL,
    subject: 'BukSUPPLY System Settings Unlock Code',
    text: `Your System Settings unlock code is ${otp}. It expires in ${OTP_MINUTES} minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; border: 1px solid #dfd8cc; border-radius: 8px;">
        <h2 style="color: #8c5839; margin-top: 0;">System Settings Unlock</h2>
        <p style="color: #594d46;">Use this code to open System Settings:</p>
        <div style="background-color: #faf7f2; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2c1a14; font-family: monospace;">${otp}</span>
        </div>
        <p style="color: #594d46;">It expires in <strong>${OTP_MINUTES} minutes</strong>. If you didn't request this, change the SU PIN.</p>
      </div>
    `,
  });

  return { otpRequired: true };
}

// Step 2: emailed code
function verify(userId, otp) {
  checkLock(userId);

  const c = challenges.get(userId);
  if (!c || c.expires <= Date.now()) {
    challenges.delete(userId);
    fail('That code expired. Start again.');
  }

  const given = String(otp || '').trim();
  if (given && crypto.timingSafeEqual(sha(given), c.hash)) {
    challenges.delete(userId);
    return { token: issueToken(userId) };
  }

  c.attempts += 1;
  if (c.attempts >= MAX_ATTEMPTS) {
    challenges.delete(userId);
    registerFail(userId);
    fail('Too many wrong codes. Start again.');
  }
  fail('Incorrect code.');
}

// Middleware: every settings route (except unlock) needs a valid token
function requireUnlock(req, res, next) {
  const locked = (message) => res.status(403).json({ code: 'SU_LOCKED', message });

  try {
    const decoded = jwt.verify(req.headers['x-settings-token'] || '', process.env.JWT_SECRET);
    const me = String(req.user?._id ?? req.user?.id ?? '');
    if (decoded.purpose !== 'settings-unlock' || String(decoded.userId) !== me) {
      return locked('System Settings is locked.');
    }
    return next();
  } catch {
    return locked('System Settings is locked. Enter your SU email and PIN.');
  }
}

module.exports = { start, verify, requireUnlock };

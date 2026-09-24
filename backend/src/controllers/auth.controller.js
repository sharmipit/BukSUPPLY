const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const C = require('../database/constants');
const { Account, PasswordReset } = require('../database/models');
const { text, clean, sendError } = require('../utils/helpers');
const { sendResetCode } = require('../utils/mailer');

const STATUS_MESSAGES = {
  pending: 'Your account is pending approval.',
  rejected: 'Your account registration was rejected. Please contact the administrator.',
  deactivated: 'Your account has been deactivated. Please contact the administrator.',
};
const DASHBOARD = { user: '/dashboard', staff: '/staff/dashboard', admin: '/admin/dashboard' };

// Used so sign in takes the same time whether or not the email exists
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

// Only these fields are copied from the request, so a client can never set its own role or status
const COMMON = ['firstName', 'lastName', 'email', 'contactNumber', 'affiliation', 'acceptedTerms', 'acceptedPrivacy'];
const SIGNUP_FIELDS = {
  user: [...COMMON, 'idNumber', 'userType', 'organizationName', 'organizationPosition'],
  staff: [...COMMON, 'employeeId', 'position', 'affiliationType'],
};

/* GET /options  -> dropdown data for the sign-up forms */
exports.getOptions = (_req, res) => {
  res.json({
    success: true,
    userTypes: C.USER_TYPES,
    colleges: C.COLLEGES,
    offices: C.OFFICES,
    organizationPositions: C.ORG_POSITIONS,
    emailDomains: C.DOMAIN,
  });
};

/* POST /signup/user  |  /signup/staff */
exports.signUp = (role) => async (req, res) => {
  try {
    const body = req.body || {};
    if (typeof body.password !== 'string' || body.password !== body.confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
        errors: { confirmPassword: 'Passwords do not match.' },
      });
    }

    // Only staff wait for admin approval; students, faculty and non-teaching staff can sign in right away
    const data = { role, status: role === 'staff' ? 'pending' : 'approved' };
    for (const field of SIGNUP_FIELDS[role]) {
      if (body[field] !== undefined) data[field] = body[field];
    }

    const account = new Account(data);
    account.password = body.password; // hashed by the model
    await account.save();

    const message = role === 'staff'
      ? 'Account created. Your account is pending approval by an administrator.'
      : 'Account created. You can now sign in.';
    res.status(201).json({ success: true, message });
  } catch (err) {
    sendError(res, err);
  }
};

/* POST /signin/user  |  /signin/staff  |  /signin/admin */
exports.signIn = (allowedRoles) => async (req, res) => {
  try {
    const account = await Account.findOne({ email: clean(req.body?.email) }).select('+passwordHash');
    const passwordOk = await bcrypt.compare(String(req.body?.password ?? ''), account ? account.passwordHash : DUMMY_HASH);
    const ok = account && passwordOk && allowedRoles.includes(account.role);

    // One message for every failure so attackers can't tell which emails exist
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    if (account.status !== 'approved') {
      return res.status(403).json({ success: false, message: STATUS_MESSAGES[account.status], accountStatus: account.status });
    }

    const token = jwt.sign({ sub: account.id, role: account.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });
    res.json({ success: true, token, role: account.role, redirectTo: DASHBOARD[account.role], account: account.toJSON() });
  } catch (err) {
    sendError(res, err);
  }
};

/* POST /forgot-password   body: { email } */
exports.forgotPassword = async (req, res) => {
  const email = clean(req.body?.email);
  try {
    const account = await Account.findOne({ email }).select('status');
    if (account && account.status !== 'deactivated') {
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      await PasswordReset.deleteMany({ email });
      await PasswordReset.create({
        email,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      });
      await sendResetCode(email, code);
    }
    // Same reply whether or not the email exists
    res.json({ success: true, message: 'If that email is registered, a verification code has been sent.' });
  } catch (err) {
    sendError(res, err);
  }
};

/* POST /verify-reset-code   body: { email, code }  (lets the frontend move on to the "new password" screen) */
exports.verifyResetCode = async (req, res) => {
  try {
    const email = clean(req.body?.email);
    const invalid = () => res.status(400).json({ success: false, message: 'Invalid or expired code.' });

    const record = await PasswordReset.findOne({ email });
    if (!record || record.expiresAt < new Date() || record.attempts >= 5) return invalid();

    if (!(await bcrypt.compare(text(req.body?.code), record.codeHash))) {
      await PasswordReset.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
      return invalid();
    }
    res.json({ success: true, message: 'Code verified.' }); // code is NOT consumed; reset-password checks it again
  } catch (err) {
    sendError(res, err);
  }
};

/* POST /reset-password   body: { email, code, newPassword, confirmPassword } */
exports.resetPassword = async (req, res) => {
  try {
    const { code, newPassword, confirmPassword } = req.body || {};
    const email = clean(req.body?.email);

    if (typeof newPassword !== 'string' || newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    const invalid = () => res.status(400).json({ success: false, message: 'Invalid or expired code.' });

    const record = await PasswordReset.findOne({ email });
    if (!record || record.expiresAt < new Date() || record.attempts >= 5) return invalid();

    if (!(await bcrypt.compare(text(code), record.codeHash))) {
      await PasswordReset.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
      return invalid();
    }

    const account = await Account.findOne({ email });
    if (!account || account.status === 'deactivated') return invalid();

    account.password = newPassword; // a weak password is rejected by the model and the code stays valid
    await account.save();
    await PasswordReset.deleteMany({ email });

    res.json({ success: true, message: 'Password updated. You can now sign in.' });
  } catch (err) {
    sendError(res, err);
  }
};
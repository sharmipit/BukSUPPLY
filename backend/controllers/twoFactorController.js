const jwt = require('jsonwebtoken');
const User = require('../models/User');
const tf = require('../services/twoFactor');

const SERVER_ERROR = { message: 'Something went wrong. Please try again.' };

// Signed with a DIFFERENT secret so it can never be used as a normal session token
const CHALLENGE_SECRET = () => `${process.env.JWT_SECRET}:2fa`;

exports.signChallenge = (user) =>
  jwt.sign({ userId: user._id }, CHALLENGE_SECRET(), { expiresIn: '5m' });

/** POST /api/auth/2fa/setup (admin, signed in) */
exports.setup = async (req, res) => {
  try {
    if (req.user.twoFactorEnabled) {
      return res.status(409).json({ message: 'Two-step verification is already on.' });
    }
    const secret = tf.newSecret();
    req.user.twoFactorSecret = tf.encrypt(secret); // saved, but not active until confirmed
    await req.user.save();
    res.json({ qr: await tf.qrFor(req.user.email, secret), secret });
  } catch (err) {
    console.error('2fa setup error:', err);
    res.status(500).json(SERVER_ERROR);
  }
};

/** POST /api/auth/2fa/enable { code } (admin, signed in) */
exports.enable = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+twoFactorSecret');
    if (!user.twoFactorSecret) return res.status(400).json({ message: 'Start setup first.' });

    if (!tf.checkCode(tf.decrypt(user.twoFactorSecret), req.body.code)) {
      return res.status(400).json({ message: 'That code is not correct. Try the newest one.' });
    }
    const { plain, hashed } = tf.makeBackupCodes();
    user.twoFactorEnabled = true;
    user.twoFactorBackupCodes = hashed;
    await user.save();
    res.json({ message: 'Two-step verification is on.', backupCodes: plain });
  } catch (err) {
    console.error('2fa enable error:', err);
    res.status(500).json(SERVER_ERROR);
  }
};

/** POST /api/auth/2fa/disable { code } (admin, signed in) */
exports.disable = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+twoFactorSecret');
    if (!user.twoFactorEnabled) return res.status(400).json({ message: 'It is already off.' });

    if (!tf.checkCode(tf.decrypt(user.twoFactorSecret), req.body.code)) {
      return res.status(400).json({ message: 'That code is not correct.' });
    }
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = [];
    await user.save();
    res.json({ message: 'Two-step verification is off.' });
  } catch (err) {
    console.error('2fa disable error:', err);
    res.status(500).json(SERVER_ERROR);
  }
};

/** POST /api/auth/2fa/verify { challengeToken, code } (during login, not signed in yet) */
exports.verifyLogin = async (req, res) => {
  try {
    const { challengeToken, code } = req.body;
    let decoded;
    try {
      decoded = jwt.verify(String(challengeToken || ''), CHALLENGE_SECRET());
    } catch {
      return res.status(401).json({ message: 'Your sign-in expired. Please sign in again.' });
    }

    const user = await User.findById(decoded.userId).select('+twoFactorSecret +twoFactorBackupCodes');
    if (!user || user.accountStatus === 'Deactivated' || !user.twoFactorEnabled) {
      return res.status(401).json({ message: 'Invalid sign-in.' });
    }

    const input = String(code || '').trim().toLowerCase();
    let ok = tf.checkCode(tf.decrypt(user.twoFactorSecret), input);

    // Backup code: works once, then is removed
    if (!ok) {
      const h = tf.hashCode(input);
      if (user.twoFactorBackupCodes.includes(h)) {
        user.twoFactorBackupCodes = user.twoFactorBackupCodes.filter((c) => c !== h);
        await user.save();
        ok = true;
      }
    }
    if (!ok) return res.status(401).json({ message: 'That code is not correct.' });

    const { issueSession } = require('./authController');
    res.json(issueSession(user));
  } catch (err) {
    console.error('2fa verify error:', err);
    res.status(500).json(SERVER_ERROR);
  }
};
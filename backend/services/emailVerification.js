const crypto = require('crypto');
const EmailVerification = require('../models/EmailVerification');
const { sendEmail } = require('../utils/sendEmail');

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 30;

const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

exports.hasPending = async (email, purpose) =>
  !!(await EmailVerification.exists({ email, purpose }));

exports.secondsUntilResend = async (email, purpose) => {
  const doc = await EmailVerification.findOne({ email, purpose });
  if (!doc) return 0;
  return Math.max(Math.ceil((doc.sentAt.getTime() + RESEND_SECONDS * 1000 - Date.now()) / 1000), 0);
};

exports.issueCode = async (email, purpose, { subject, heading, intro }) => {
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');

  await EmailVerification.findOneAndUpdate(
    { email, purpose },
    {
      codeHash: hash(code),
      expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
      attempts: 0,
      sentAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await sendEmail({
    to: email,
    subject,
    text: `${intro} Your verification code is ${code}. It expires in ${CODE_MINUTES} minutes. If you didn't expect this, ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; border: 1px solid #dfd8cc; border-radius: 8px;">
        <h2 style="color: #8c5839; margin-top: 0;">${heading}</h2>
        <p style="color: #594d46;">${intro}</p>
        <div style="background-color: #faf7f2; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2c1a14; font-family: monospace;">${code}</span>
        </div>
        <p style="color: #594d46;">It expires in <strong>${CODE_MINUTES} minutes</strong>. If you didn't expect this email, you can ignore it.</p>
      </div>`,
  });
};

// 'ok' | 'wrong' | 'expired' | 'locked' | 'missing'. Does not consume the code.
exports.checkCode = async (email, purpose, code) => {
  const doc = await EmailVerification.findOne({ email, purpose });
  if (!doc) return 'missing';
  if (doc.expiresAt.getTime() <= Date.now()) return 'expired';
  if (doc.attempts >= MAX_ATTEMPTS) return 'locked';

  const given = hash(String(code || '').trim());
  const match = crypto.timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(doc.codeHash, 'hex'));

  if (!match) {
    doc.attempts += 1;
    await doc.save();
    return 'wrong';
  }
  return 'ok';
};

// Call only after the account was actually created
exports.consumeCode = (email, purpose) => EmailVerification.deleteOne({ email, purpose });

exports.messageFor = (result) =>
  ({
    missing: 'Request a verification code first.',
    expired: 'That code expired. Request a new one.',
    locked: 'Too many wrong codes. Request a new code.',
    wrong: 'Incorrect verification code.',
  })[result];
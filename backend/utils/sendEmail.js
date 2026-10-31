const nodemailer = require('nodemailer');
const settings = require('../services/settings');

// Cached transporter. It is rebuilt automatically when the saved settings change.
let cachedTransporter = null;
let cachedSignature = '';

const getTransporter = () => {
  const s = settings.get();

  if (!s.smtpEnabled) {
    throw new Error('Email is turned off in System Settings.');
  }
  if (!s.smtpHost || !s.smtpUser || !s.smtpPassword) {
    throw new Error(
      'Email is not configured. Fill in the Email (SMTP) section in System Settings.'
    );
  }

  const port = Number(s.smtpPort) || 587;
  const signature = [s.smtpHost, port, s.smtpUser, s.smtpPassword].join('|');

  if (cachedTransporter && signature === cachedSignature) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: s.smtpHost,
    port,
    secure: port === 465, // true for port 465, false for 587/others
    auth: {
      user: s.smtpUser,
      pass: s.smtpPassword,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
  cachedSignature = signature;

  return cachedTransporter;
};

/**
 * Generic mail sender.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();
  const s = settings.get();

  const from = s.smtpFrom || `BukSUPPLY Support <${s.smtpUser}>`;

  await transporter.sendMail({
    from,
    to,
    subject,
    text: text || undefined,
    html,
  });
};

/**
 * Sends the 6-digit OTP used in the forgot-password flow.
 */
const sendOtpEmail = async (to, otp) => {
  const subject = 'BukSUPPLY Password Reset Code';
  const text = `Your BukSUPPLY password reset code is ${otp}. This code expires in 15 minutes. If you did not request this, you can safely ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #2b6cb0; margin-top: 0;">BukSUPPLY Password Reset</h2>
      <p style="color: #4a5568;">We received a request to reset your BukSUPPLY account password. Use the verification code below to continue:</p>
      <div style="background-color: #f7fafc; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2d3748; font-family: monospace;">
          ${otp}
        </span>
      </div>
      <p style="color: #4a5568;">This code expires in <strong>15 minutes</strong> and can only be used once.</p>
      <p style="color: #718096; font-size: 14px;">If you did not request a password reset, please ignore this email.</p>
    </div>
  `;

  await sendEmail({ to, subject, html, text });
};

module.exports = { sendEmail, sendOtpEmail };

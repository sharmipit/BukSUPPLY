const nodemailer = require("nodemailer");

/**
 * Builds a reusable Nodemailer transporter from the EMAIL_* env vars
 * defined in .env.example.
 */
const buildTransporter = () => {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    throw new Error(
      "Email is not configured. Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in .env."
    );
  }

  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT) || 587,
    secure: Number(EMAIL_PORT) === 465, // true for port 465, false for 587/others
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
};

/**
 * Generic mail sender.
 * @param {Object} options
 * @param {string} options.to - recipient email address
 * @param {string} options.subject - email subject line
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - plain-text fallback body
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = buildTransporter();

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

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
 * @param {string} to - recipient email address
 * @param {string} otp - 6-digit numeric OTP string
 */
const sendOtpEmail = async (to, otp) => {
  const subject = "BukSUPPLY Password Reset Code";
  const text = `Your BukSUPPLY password reset code is ${otp}. This code expires in 15 minutes. If you did not request this, you can safely ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #2b6cb0;">BukSUPPLY Password Reset</h2>
      <p>We received a request to reset your BukSUPPLY account password. Use the verification code below to continue:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; text-align: center; margin: 24px 0;">
        ${otp}
      </p>
      <p>This code expires in <strong>15 minutes</strong> and can only be used once.</p>
      <p>If you did not request a password reset, please ignore this email.</p>
    </div>
  `;

  await sendEmail({ to, subject, html, text });
};

module.exports = { sendEmail, sendOtpEmail };
const nodemailer = require('nodemailer');

async function sendResetCode(to, code) {
  if (!process.env.SMTP_HOST) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured');
    console.log(`[DEV ONLY] Reset code for ${to}: ${code}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: 'Your password reset code',
    text: `Your code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
  });
}

module.exports = { sendResetCode };
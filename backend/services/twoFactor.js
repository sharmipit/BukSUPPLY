const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

authenticator.options = { window: 1 }; // tolerates ~30s of clock drift

const key = () => Buffer.from(process.env.TWOFA_ENCRYPTION_KEY || '', 'hex');

// AES-256-GCM, so the secret is unreadable even if the database leaks
exports.encrypt = (text) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('hex')).join(':');
};

exports.decrypt = (stored) => {
  const [iv, tag, enc] = stored.split(':').map((h) => Buffer.from(h, 'hex'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
};

exports.newSecret = () => authenticator.generateSecret();
exports.checkCode = (secret, code) => authenticator.check(String(code || '').trim(), secret);

exports.qrFor = async (email, secret) =>
  QRCode.toDataURL(authenticator.keyuri(email, 'BukSUPPLY', secret));

const hash = (c) => crypto.createHash('sha256').update(c).digest('hex');
exports.hashCode = hash;

// 8 one-time codes for a lost phone. Shown once, stored hashed.
exports.makeBackupCodes = () => {
  const plain = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex'));
  return { plain, hashed: plain.map(hash) };
};
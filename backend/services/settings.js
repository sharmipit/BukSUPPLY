const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '../data/settings.json');
const KEY = Buffer.from(process.env.SETTINGS_KEY || '', 'hex');

if (KEY.length !== 32) {
  throw new Error('SETTINGS_KEY must be 64 hex characters (32 bytes). Check your .env.');
}

const SECRETS = [
  'mongoUri',
  'googleClientSecret',
  'recaptchaSecretKey',
  'smtpPassword',
  'pdfshiftApiKey',
  'nutrientApiKey',
];

const DEFAULTS = {
  mongoDbName: '',
  mongoUri: '',
  googleEnabled: true,
  googleClientId: '',
  googleClientSecret: '',
  recaptchaEnabled: false,
  recaptchaVersion: 'v2',
  recaptchaSiteKey: '',
  recaptchaSecretKey: '',
  smtpEnabled: true,
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  smtpFrom: '',
  pdfshiftEnabled: true,
  pdfshiftApiKey: '',
  nutrientEnabled: true,
  nutrientApiKey: '',
};

// ---- encryption helpers ----
const enc = (text) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
};

const dec = (str) => {
  const [iv, tag, data] = str.split('.').map((x) => Buffer.from(x, 'base64'));
  const c = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  c.setAuthTag(tag);
  return Buffer.concat([c.update(data), c.final()]).toString('utf8');
};

// ---- load / cache ----
let cache = null;

function get() {
  if (cache) return cache;

  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    /* first run: no file yet */
  }

  const loaded = { ...DEFAULTS };
  try {
    for (const [k, v] of Object.entries(raw)) {
      loaded[k] = SECRETS.includes(k) && v ? dec(v) : v;
    }
  } catch {
    throw new Error(
      'Could not decrypt data/settings.json. SETTINGS_KEY does not match the key it was saved with. ' +
        'Restore the original key, or delete data/settings.json and re-enter the settings.'
    );
  }

  // Fallback to .env until an admin saves the value from the System Settings page.
  if (!loaded.mongoUri) loaded.mongoUri = process.env.MONGODB_URI || '';

  if (!loaded.googleClientId) loaded.googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  if (!loaded.googleClientSecret)
    loaded.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  if (!loaded.recaptchaSiteKey) loaded.recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY || ''; // NEW
  if (!loaded.recaptchaSecretKey)
    loaded.recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY || '';

  if (!loaded.smtpHost) loaded.smtpHost = process.env.EMAIL_HOST || '';
  if (!raw.smtpPort) loaded.smtpPort = Number(process.env.EMAIL_PORT) || 587;
  if (!loaded.smtpUser) loaded.smtpUser = process.env.EMAIL_USER || '';
  if (!loaded.smtpPassword) loaded.smtpPassword = process.env.EMAIL_PASS || '';
  if (!loaded.smtpFrom) loaded.smtpFrom = process.env.EMAIL_FROM || '';

  if (!loaded.pdfshiftApiKey) loaded.pdfshiftApiKey = process.env.PDFSHIFT_API_KEY || '';
  if (!loaded.nutrientApiKey) loaded.nutrientApiKey = process.env.NUTRIENT_API_KEY || '';

  // Until a setting is saved, reCAPTCHA is on only when BOTH keys exist,
  // so the server and the sign-in page always agree.
  if (!('recaptchaEnabled' in raw)) {
    loaded.recaptchaEnabled = !!(loaded.recaptchaSecretKey && loaded.recaptchaSiteKey);
  }

  cache = loaded;
  return cache;
}

// Safe version for the browser: secrets removed, "xxxSet" flags added
function publicView() {
  const s = get();
  const out = {};
  for (const k of Object.keys(DEFAULTS)) {
    if (SECRETS.includes(k)) {
      out[k] = '';
      out[`${k}Set`] = !!s[k];
    } else {
      out[k] = s[k];
    }
  }
  return out;
}

function update(patch) {
  const next = { ...get() };

  for (const k of Object.keys(DEFAULTS)) {
    if (!(k in patch)) continue;
    if (SECRETS.includes(k) && !patch[k]) continue; // empty secret = keep saved one
    next[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k];
  }

  // Server-side validation (never trust the browser)
  if (next.mongoUri && !/^mongodb(\+srv)?:\/\//.test(next.mongoUri)) {
    throw new Error('The MongoDB connection string must start with mongodb:// or mongodb+srv://.');
  }

  const port = Number(next.smtpPort);
  if (next.smtpHost && !(port >= 1 && port <= 65535)) {
    throw new Error('Enter an SMTP port between 1 and 65535.');
  }
  next.smtpPort = port || 587;

  if (next.recaptchaEnabled && (!next.recaptchaSiteKey || !next.recaptchaSecretKey)) {
    throw new Error('Add both the reCAPTCHA site key and secret key, or turn reCAPTCHA off.');
  }

  // Encrypt secrets and write to disk
  const out = {};
  for (const [k, v] of Object.entries(next)) {
    out[k] = SECRETS.includes(k) && v ? enc(v) : v;
  }

  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(out, null, 2));

  cache = next;
  return publicView();
}

module.exports = { get, publicView, update };

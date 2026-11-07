const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '../data/settings.json');
const KEY = Buffer.from(process.env.SETTINGS_KEY || '', 'hex');

if (KEY.length !== 32) {
  throw new Error('SETTINGS_KEY must be 64 hex characters (32 bytes). Check your .env.');
}

// Encrypted on disk, never sent to the browser
const SECRETS = [
  'googleClientSecret',
  'recaptchaSecretKey',
  'smtpPassword',
  'pdfshiftApiKey',
  'nutrientApiKey',
];

// Public values that are shown masked ("12345**************") and never sent in full
const MASKED = ['googleClientId', 'recaptchaSiteKey'];

// Empty value on save = keep the saved one
const KEEP_IF_EMPTY = [...SECRETS, ...MASKED];

const SECTIONS = {
  google: ['googleEnabled', 'googleClientId', 'googleClientSecret'],
  recaptcha: ['recaptchaEnabled', 'recaptchaSiteKey', 'recaptchaSecretKey'],
  smtp: ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'smtpFrom'],
  pdfshift: ['pdfshiftEnabled', 'pdfshiftApiKey'],
  nutrient: ['nutrientEnabled', 'nutrientApiKey'],
};

const DEFAULTS = {
  googleEnabled: true,
  googleClientId: '',
  googleClientSecret: '',
  recaptchaEnabled: false,
  recaptchaVersion: 'v2',
  recaptchaSiteKey: '',
  recaptchaSecretKey: '',
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
      if (!(k in DEFAULTS)) continue; // ignores old keys such as mongoUri and smtpEnabled
      loaded[k] = SECRETS.includes(k) && v ? dec(v) : v;
    }
  } catch {
    throw new Error(
      'Could not decrypt data/settings.json. SETTINGS_KEY does not match the key it was saved with. ' +
        'Restore the original key, or delete data/settings.json and re-enter the settings.'
    );
  }

  // Fallback to .env until an admin saves the value from the System Settings page.
  if (!loaded.googleClientId) loaded.googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  if (!loaded.googleClientSecret)
    loaded.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  if (!loaded.recaptchaSiteKey) loaded.recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY || '';
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

// Database settings come ONLY from .env and can't be changed from the admin page.
function database() {
  return {
    uri: process.env.MONGODB_URI || '',
    name: process.env.MONGODB_DB || '',
  };
}

// "123456789-abc..." -> "12345**************" (fixed length, so the real length isn't leaked)
const mask = (v) => (v ? `${v.slice(0, 5)}${'*'.repeat(14)}` : '');

// Safe version for the browser: secrets and public keys removed,
// "xxxSet" flags added (and "xxxMasked" previews for public keys)
function publicView() {
  const s = get();
  const out = {};
  for (const k of Object.keys(DEFAULTS)) {
    if (SECRETS.includes(k)) {
      out[k] = '';
      out[`${k}Set`] = !!s[k];
    } else if (MASKED.includes(k)) {
      out[k] = '';
      out[`${k}Set`] = !!s[k];
      out[`${k}Masked`] = mask(s[k]);
    } else {
      out[k] = s[k];
    }
  }
  return out;
}

// ---- validation ----
const RE = {
  googleClientId: /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i,
  recaptchaKey: /^6L[A-Za-z0-9_-]{38}$/,
  host: /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i,
  from: /^(?:[^<>]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/,
};

const fail = (msg) => {
  throw new Error(msg);
};

const badSecret = (v, min) => v.length < min || /\s/.test(v);

// next = merged settings, typed = only the values the admin just entered
const VALIDATORS = {
  google(next, typed) {
    if (typed.googleClientId && !RE.googleClientId.test(typed.googleClientId)) {
      fail(
        'That does not look like a Google Client ID. It should look like 123456789-abc.apps.googleusercontent.com.'
      );
    }
    if (typed.googleClientSecret && badSecret(typed.googleClientSecret, 20)) {
      fail(
        'The client secret looks too short or contains spaces. Copy it again from Google Cloud Console.'
      );
    }
    if (next.googleEnabled && (!next.googleClientId || !next.googleClientSecret)) {
      fail('Add both the Client ID and client secret, or turn Google sign-in off.');
    }
  },

  recaptcha(next, typed) {
    if (typed.recaptchaSiteKey && !RE.recaptchaKey.test(typed.recaptchaSiteKey)) {
      fail(
        'That does not look like a reCAPTCHA site key. It should start with 6L and be 40 characters long.'
      );
    }
    if (typed.recaptchaSecretKey && !RE.recaptchaKey.test(typed.recaptchaSecretKey)) {
      fail(
        'That does not look like a reCAPTCHA secret key. It should start with 6L and be 40 characters long.'
      );
    }
    if (next.recaptchaEnabled && (!next.recaptchaSiteKey || !next.recaptchaSecretKey)) {
      fail('Add both the reCAPTCHA site key and secret key, or turn reCAPTCHA off.');
    }
  },

  smtp(next) {
    if (!next.smtpHost) fail('Enter the SMTP host.');
    if (!RE.host.test(next.smtpHost)) fail('The SMTP host is not a valid server address.');
    const port = Number(next.smtpPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      fail('Enter an SMTP port between 1 and 65535.');
    }
    if (!next.smtpUser) fail('Enter the SMTP username.');
    if (!next.smtpPassword) fail('Enter the SMTP password or app password.');
    if (next.smtpFrom && !RE.from.test(next.smtpFrom)) {
      fail('"Send from" must be an email address or "Name <address@example.com>".');
    }
  },

  pdfshift(next, typed) {
    if (typed.pdfshiftApiKey && badSecret(typed.pdfshiftApiKey, 10)) {
      fail('The PDFShift API key looks too short or contains spaces.');
    }
    if (next.pdfshiftEnabled && !next.pdfshiftApiKey) {
      fail('Add the PDFShift API key, or turn PDF downloads off.');
    }
  },

  nutrient(next, typed) {
    if (typed.nutrientApiKey && badSecret(typed.nutrientApiKey, 10)) {
      fail('The Nutrient API key looks too short or contains spaces.');
    }
    if (next.nutrientEnabled && !next.nutrientApiKey) {
      fail('Add the Nutrient API key, or turn Excel downloads off.');
    }
  },
};

// Google answers "invalid-input-secret" only when the secret itself is wrong.
// With a valid secret and a dummy response it answers "invalid-input-response".
async function verifyRecaptchaSecret(secret) {
  let data;
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: 'settings-check' }),
      signal: AbortSignal.timeout(8000),
    });
    data = await res.json();
  } catch {
    // Change this to `return;` if you'd rather allow saving when Google is unreachable.
    fail('Could not reach Google to check the secret key. Try again in a moment.');
  }
  if ((data['error-codes'] || []).includes('invalid-input-secret')) {
    fail('Google rejected this secret key. Copy it again from the reCAPTCHA admin console.');
  }
}

async function update(section, patch = {}) {
  const fields = SECTIONS[section];
  if (!fields) fail('Unknown settings section.');

  // Only the values typed for THIS section
  const typed = {};
  for (const k of fields) {
    if (!(k in patch)) continue;
    let v = patch[k];
    if (typeof v === 'string') v = v.trim();
    if (KEEP_IF_EMPTY.includes(k) && !v) continue; // empty = keep saved one
    if (k.endsWith('Enabled')) v = !!v;
    if (k === 'smtpPort') v = Number(v) || 587;
    typed[k] = v;
  }

  // Server-side validation (never trust the browser)
  VALIDATORS[section]({ ...get(), ...typed }, typed);
  if (section === 'recaptcha' && typed.recaptchaSecretKey) {
    await verifyRecaptchaSecret(typed.recaptchaSecretKey);
  }

  // Re-read after the await so a parallel save of another section isn't overwritten
  const next = { ...get(), ...typed };

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

module.exports = { get, publicView, update, database };

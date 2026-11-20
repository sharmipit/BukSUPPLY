const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
  'driveClientSecret',
  'driveRefreshToken',
  'formsCredentials',
  'formsCodeSecret',
];

// Values that are shown masked ("12345**************") and never sent in full.
// A saved value is only replaced when the admin clicks "Change" and types a new one.
const MASKED = [
  'googleClientId',
  'recaptchaSiteKey',
  'driveClientId',
  'smtpUser',
  'formsFormId',
];

// Empty value on save = keep the saved one
const KEEP_IF_EMPTY = [...SECRETS, ...MASKED];

const SECTIONS = {
  google: ['googleEnabled', 'googleClientId', 'googleClientSecret'],
  recaptcha: ['recaptchaEnabled', 'recaptchaSiteKey', 'recaptchaSecretKey'],
  smtp: ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'smtpFrom'],
  pdfshift: ['pdfshiftEnabled', 'pdfshiftApiKey'],
  nutrient: ['nutrientEnabled', 'nutrientApiKey'],
  drive: [
    'driveEnabled',
    'driveClientId',
    'driveClientSecret',
    'driveRefreshToken',
    'driveFolderName',
  ],
  forms: [
    'formsEnabled',
    'formsFormId',
    'formsCredentials',
    'formsPrefillUrl',
    'formsQSlip',
    'formsQCode',
    'formsQRating',
    'formsQComment',
    'formsCodeSecret',
  ],
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
  driveEnabled: true,
  driveClientId: '',
  driveClientSecret: '',
  driveRefreshToken: '',
  driveFolderName: '',
  formsEnabled: false,
  formsFormId: '',
  formsCredentials: '',
  formsPrefillUrl: '',
  formsQSlip: '',
  formsQCode: '',
  formsQRating: '',
  formsQComment: '',
  formsCodeSecret: '',
};

// Which .env variable backs each setting
const ENV_KEYS = {
  googleClientId: 'GOOGLE_CLIENT_ID',
  googleClientSecret: 'GOOGLE_CLIENT_SECRET',
  recaptchaSiteKey: 'RECAPTCHA_SITE_KEY',
  recaptchaSecretKey: 'RECAPTCHA_SECRET_KEY',
  smtpHost: 'EMAIL_HOST',
  smtpUser: 'EMAIL_USER',
  smtpPassword: 'EMAIL_PASS',
  smtpFrom: 'EMAIL_FROM',
  pdfshiftApiKey: 'PDFSHIFT_API_KEY',
  nutrientApiKey: 'NUTRIENT_API_KEY',
  driveClientId: 'GOOGLE_DRIVE_CLIENT_ID',
  driveClientSecret: 'GOOGLE_DRIVE_CLIENT_SECRET',
  driveRefreshToken: 'GOOGLE_DRIVE_REFRESH_TOKEN',
  driveFolderName: 'GOOGLE_DRIVE_FOLDER_NAME',
  formsFormId: 'GFORMS_FORM_ID',
  formsCredentials: 'GFORMS_CREDENTIALS_B64',
  formsPrefillUrl: 'GFORMS_PREFILL_URL',
  formsQSlip: 'GFORMS_Q_SLIP',
  formsQCode: 'GFORMS_Q_CODE',
  formsQRating: 'GFORMS_Q_RATING',
  formsQComment: 'GFORMS_Q_COMMENT',
  formsCodeSecret: 'GFORMS_CODE_SECRET',
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

function readRaw() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {}; // first run: no file yet
  }
}

function writeRaw(raw) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 2));
}

function get() {
  if (cache) return cache;

  const raw = readRaw();

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

  // Fallback to the default values until an admin saves the value from the System Settings page.
  for (const [k, envName] of Object.entries(ENV_KEYS)) {
    if (!loaded[k]) loaded[k] = process.env[envName] || '';
  }
  if (!raw.smtpPort) loaded.smtpPort = Number(process.env.EMAIL_PORT) || 587;

  // Until a setting is saved, reCAPTCHA is on only when BOTH keys exist,
  // so the server and the sign-in page always agree.
  if (!('recaptchaEnabled' in raw)) {
    loaded.recaptchaEnabled = !!(loaded.recaptchaSecretKey && loaded.recaptchaSiteKey);
  }

  // Until a setting is saved, Google Forms feedback follows GFORMS_ENABLED from .env
  if (!('formsEnabled' in raw)) {
    loaded.formsEnabled = process.env.GFORMS_ENABLED === 'true';
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
  // The site key is public by design (it is in the login page's HTML). The browser needs
  // it to show the "I'm not a robot" check when the admin confirms new reCAPTCHA keys.
  out.recaptchaSiteKeyPublic = s.recaptchaSiteKey;

  // The service account's email is not a secret. The admin needs it to share the form
  // with the right account (Editor access).
  const account = parseServiceAccount(s.formsCredentials);
  out.formsServiceEmail = account ? String(account.client_email) : '';
  return out;
}

// ---- validation (format only) ----
const RE = {
  googleClientId: /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i,
  recaptchaKey: /^6L[A-Za-z0-9_-]{38}$/,
  host: /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i,
  from: /^(?:[^<>]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/,
  driveRefreshToken: /^1\/\/[A-Za-z0-9._-]{20,}$/,
};

const fail = (msg) => {
  throw new Error(msg);
};

const badSecret = (v, min) => v.length < min || /\s/.test(v);

// Accepts the service account JSON key, or the same JSON as Base64 text (GFORMS_CREDENTIALS_B64).
// Returns the parsed key, or null when it can't be read.
function parseServiceAccount(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    const json = text.startsWith('{')
      ? text
      : Buffer.from(text.replace(/\s+/g, ''), 'base64').toString('utf8');
    const key = JSON.parse(json);
    return key && key.client_email && key.private_key ? key : null;
  } catch {
    return null;
  }
}

// Accepts the bare Form ID or the form editor address (.../forms/d/<ID>/edit).
// The published address (.../forms/d/e/...) is left as it is, so the validator can explain it.
function extractFormId(value) {
  const v = String(value || '').trim();
  const m = v.match(/\/forms\/d\/([A-Za-z0-9_-]+)/);
  return m && m[1] !== 'e' ? m[1] : v;
}

const FORMS_QUESTIONS = {
  formsQSlip: 'Slip number',
  formsQCode: 'Verification code',
  formsQRating: 'Rating',
  formsQComment: 'Comment',
};
const formsPlaceholder = (name) => new RegExp(`(?:\\{\\{|%7B%7B)${name}(?:\\}\\}|%7D%7D)`, 'i');

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
    if (typed.pdfshiftApiKey && !typed.pdfshiftApiKey.startsWith('sk_')) {
      fail('PDFShift API keys start with "sk_". Copy it again from your PDFShift dashboard.');
    }
    if (next.pdfshiftEnabled && !next.pdfshiftApiKey) {
      fail('Add the PDFShift API key, or turn PDF downloads off.');
    }
  },

  nutrient(next, typed) {
    if (typed.nutrientApiKey && badSecret(typed.nutrientApiKey, 10)) {
      fail('The Nutrient API key looks too short or contains spaces.');
    }
    if (typed.nutrientApiKey && !/^pdf_(live|test)_/.test(typed.nutrientApiKey)) {
      fail('Nutrient API keys start with "pdf_live_". Copy it again from your Nutrient dashboard.');
    }
    if (next.nutrientEnabled && !next.nutrientApiKey) {
      fail('Add the Nutrient API key, or turn Excel downloads off.');
    }
  },

  drive(next, typed) {
    if (typed.driveClientId && !RE.googleClientId.test(typed.driveClientId)) {
      fail(
        'That does not look like a Google Client ID. It should look like 123456789-abc.apps.googleusercontent.com.'
      );
    }
    if (typed.driveClientSecret && badSecret(typed.driveClientSecret, 20)) {
      fail(
        'The client secret looks too short or contains spaces. Copy it again from Google Cloud Console.'
      );
    }
    if (typed.driveRefreshToken && !RE.driveRefreshToken.test(typed.driveRefreshToken)) {
      fail('That does not look like a Google refresh token. It usually starts with 1//.');
    }
    if (typed.driveFolderName && typed.driveFolderName.length > 100) {
      fail('The folder name must be 100 characters or fewer.');
    }
    if (
      next.driveEnabled &&
      (!next.driveClientId || !next.driveClientSecret || !next.driveRefreshToken)
    ) {
      fail('Add the Client ID, client secret and refresh token, or turn Google Drive off.');
    }
  },

  forms(next, typed) {
    if (typed.formsFormId && !/^[A-Za-z0-9_-]{10,}$/.test(typed.formsFormId)) {
      fail(
        /\/forms\/d\/e\//.test(typed.formsFormId)
          ? 'That is the published form link. Open the form editor and copy the ID between /d/ and /edit.'
          : 'That does not look like a Google Form ID. Copy the part between /d/ and /edit in the form editor address.'
      );
    }
    if (typed.formsCredentials && !parseServiceAccount(typed.formsCredentials)) {
      fail(
        'The service account key could not be read. Paste the full JSON key file, or its Base64 text.'
      );
    }
    if (typed.formsCodeSecret && badSecret(typed.formsCodeSecret, 8)) {
      fail('The verification secret must be at least 8 characters long with no spaces.');
    }
    for (const [key, label] of Object.entries(FORMS_QUESTIONS)) {
      if (String(typed[key] ?? '').length > 200) {
        fail(`The ${label.toLowerCase()} question must be 200 characters or fewer.`);
      }
    }
    if (typed.formsPrefillUrl) {
      if (typed.formsPrefillUrl.length > 2000) {
        fail('The pre-filled link must be 2000 characters or fewer.');
      }
      if (!/^https:\/\/docs\.google\.com\/forms\//i.test(typed.formsPrefillUrl)) {
        fail('The pre-filled link must start with https://docs.google.com/forms/.');
      }
      if (!formsPlaceholder('SLIP').test(typed.formsPrefillUrl)) {
        fail('The pre-filled link must contain {{SLIP}} where the slip number goes.');
      }
    }
    const usedQuestions = Object.keys(FORMS_QUESTIONS)
      .map((k) => String(next[k] || '').trim().toLowerCase())
      .filter(Boolean);
    if (new Set(usedQuestions).size !== usedQuestions.length) {
      fail('Each question field must point to a different question.');
    }
    if (
      ('formsPrefillUrl' in typed || 'formsQCode' in typed) &&
      next.formsQCode &&
      next.formsPrefillUrl &&
      !formsPlaceholder('CODE').test(next.formsPrefillUrl)
    ) {
      fail('A verification code question is set, so the pre-filled link must contain {{CODE}}.');
    }

    if (next.formsEnabled) {
      if (!next.formsFormId) fail('Add the Form ID, or turn feedback off.');
      if (!parseServiceAccount(next.formsCredentials)) {
        fail('Add the service account key, or turn feedback off.');
      }
      if (!next.formsPrefillUrl) fail('Add the pre-filled link, or turn feedback off.');
      if (!next.formsQSlip) fail('Add the slip number question, or turn feedback off.');
    }
  },
};

// ---- live checks: ask the real provider whether the value exists ----

// Network call that turns "service unreachable" into a clear error
async function call(url, opts = {}) {
  try {
    return await fetch(url, { ...opts, signal: AbortSignal.timeout(8000) });
  } catch {
    fail('Could not reach the service to check this value. Try again in a moment.');
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const debug = (...args) => {
  if (process.env.NODE_ENV !== 'production') console.log(...args);
};

// Runs only when the admin typed something new, so saved values aren't re-checked.
// patch = the raw request body (the reCAPTCHA check needs the solved token from it).
const LIVE = {
  // A real ID+secret pair gets "invalid_grant" for a fake code.
  // A wrong ID or wrong secret gets "invalid_client".
  async google(next, typed) {
    if (!typed.googleClientId && !typed.googleClientSecret) return;
    if (!next.googleClientId || !next.googleClientSecret) return;

    const probe = async () => {
      const res = await call('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: next.googleClientId,
          client_secret: next.googleClientSecret,
          code: 'settings-check',
          grant_type: 'authorization_code',
          redirect_uri: 'http://localhost',
        }),
      });
      const data = await res.json().catch(() => ({}));
      debug('[google check]', res.status, data.error, data.error_description);
      return data;
    };

    let data = await probe();

    // Retry once: the same pair can get a different answer on a second try
    if (data.error === 'invalid_client') {
      await sleep(1000);
      data = await probe();
    }

    if (data.error === 'invalid_client') {
      const reason = data.error_description || 'no reason given';
      if (/not found/i.test(reason)) {
        fail('Google does not recognise this Client ID. Copy it again from Google Cloud Console.');
      }
      fail(
        `Google rejected this Client ID and secret pair (${reason}). ` +
          'Enter both fields together, copied from the same credential.'
      );
    }
  },

  // Google reports a fake token as the problem before it looks at the secret, so a wrong
  // secret can't be caught with a fake token. The admin solves the real "I'm not a robot"
  // check in the browser, and that token is verified here with the secret key.
  async recaptcha(next, typed, patch = {}) {
    if (!typed.recaptchaSiteKey && !typed.recaptchaSecretKey) return;
    if (!next.recaptchaSiteKey || !next.recaptchaSecretKey) return;

    const token = String(patch.recaptchaToken || '').trim();
    if (!token) {
      fail('Tick the "I\'m not a robot" box to confirm these keys, then save again.');
    }

    const res = await call('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: next.recaptchaSecretKey, response: token }),
    });
    const data = await res.json().catch(() => ({}));
    debug('[recaptcha check]', data.success, data['error-codes']);

    if (data.success) return;

    const codes = data['error-codes'] || [];
    if (codes.includes('invalid-input-secret')) {
      fail('Google rejected this secret key. Copy it again from the reCAPTCHA admin console.');
    }
    fail(
      'Google could not confirm that the site key and secret key belong together. ' +
        'Check both keys and try again.'
    );
  },

  async smtp(next, typed) {
    if (!['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword'].some((k) => k in typed)) return;
    const port = Number(next.smtpPort);
    const transport = nodemailer.createTransport({
      host: next.smtpHost,
      port,
      secure: port === 465,
      auth: { user: next.smtpUser, pass: next.smtpPassword },
      // Same rule as utils/sendEmail.js, so the check behaves like a real send
      tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });
    try {
      await transport.verify();
    } catch (e) {
      if (e.code === 'EAUTH' || e.responseCode === 535) {
        fail('The email server rejected the username or password.');
      }
      if (/certificate|self.signed|SSL|TLS/i.test(e.message || '')) {
        fail(
          `The secure connection to ${next.smtpHost}:${port} failed (${e.message}). ` +
            'Check that the port matches the security type: 587 for TLS, 465 for SSL.'
        );
      }
      if (['ECONNECTION', 'ESOCKET', 'ETIMEDOUT', 'EDNS', 'ECONNREFUSED'].includes(e.code)) {
        fail(`Could not connect to ${next.smtpHost}:${port}. Check the host and port.`);
      }
      fail(`The email server check failed: ${e.message}`);
    } finally {
      transport.close();
    }
  },

  async pdfshift(next, typed) {
    if (!typed.pdfshiftApiKey) return;
    // Official credits endpoint. Only a valid key can read it.
    const res = await call('https://api.pdfshift.io/v3/credits/usage', {
      headers: { 'X-API-Key': typed.pdfshiftApiKey },
    });
    debug('[pdfshift check]', res.status);
    if (res.status === 401 || res.status === 403) {
      fail('PDFShift does not recognise this API key. Copy it again from your PDFShift dashboard.');
    }
    if (!res.ok) fail(`PDFShift could not check this key (error ${res.status}). Try again.`);
  },

  async nutrient(next, typed) {
    if (!typed.nutrientApiKey) return;
    // No documented "check key" endpoint, so send an empty request to /build.
    // Bad key -> 401/403. Good key -> 400 (instructions missing), and no credit is used.
    const res = await call('https://api.nutrient.io/build', {
      method: 'POST',
      headers: { Authorization: `Bearer ${typed.nutrientApiKey}` },
    });
    debug('[nutrient check]', res.status);
    if (res.status === 401 || res.status === 403) {
      fail('Nutrient does not recognise this API key. Copy it again from your Nutrient dashboard.');
    }
    if (res.status >= 500 || res.status === 429) {
      fail(`Nutrient could not check this key (error ${res.status}). Try again.`);
    }
    // 200, 400 or 422 all mean the key itself was accepted
  },

  // Exchanging the refresh token proves the ID, secret and token all belong together.
  async drive(next, typed) {
    if (!['driveClientId', 'driveClientSecret', 'driveRefreshToken'].some((k) => k in typed)) {
      return;
    }
    if (!next.driveClientId || !next.driveClientSecret || !next.driveRefreshToken) return;

    const res = await call('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: next.driveClientId,
        client_secret: next.driveClientSecret,
        refresh_token: next.driveRefreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data = await res.json().catch(() => ({}));
    debug('[drive check]', res.status, data.error, data.error_description);

    if (res.ok) {
      if (!/auth\/drive(\.file)?(\s|$)/.test(String(data.scope || ''))) {
        fail(
          'This refresh token was not granted Google Drive access. Authorize it again with the drive.file scope.'
        );
      }
      return;
    }
    if (data.error === 'invalid_client') {
      fail('Google rejected this Client ID and secret pair. Copy both from the same credential.');
    }
    if (data.error === 'invalid_grant') {
      fail(
        'Google rejected this refresh token. It may be expired, revoked, or created with a different Client ID.'
      );
    }
    fail(`Google could not check these credentials (${data.error || res.status}). Try again.`);
  },

  // Reads the form with the service account, so a wrong ID, a form that was not shared with the
  // service account, or a mistyped question is caught before it is saved.
  async forms(next, typed) {
    // Turning feedback OFF must always work, even if the form or the key is already gone
    if (!next.formsEnabled) return;
    const watched = [
      'formsEnabled',
      'formsFormId',
      'formsCredentials',
      ...Object.keys(FORMS_QUESTIONS),
    ];
    if (!watched.some((k) => k in typed)) return;
    if (!next.formsFormId || !next.formsCredentials) return;

    const creds = parseServiceAccount(next.formsCredentials);
    if (!creds) fail('The service account key could not be read. Paste it again.');

    const { google } = require('googleapis');
    let data;
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/forms.body.readonly'],
      });
      const res = await google
        .forms({ version: 'v1', auth })
        .forms.get({ formId: next.formsFormId }, { timeout: 10000 });
      data = res.data;
    } catch (e) {
      const status = Number(e.response?.status || e.code) || 0;
      debug('[forms check]', status, e.message);
      if (status === 404) fail('Google could not find a form with that ID. Check the Form ID.');
      if (status === 403) {
        fail(
          `Google refused access to the form. Share it with ${creds.client_email} as an Editor, and make sure the Google Forms API is enabled.`
        );
      }
      if (status === 401 || /invalid_grant|invalid_client|unauthorized/i.test(e.message || '')) {
        fail('Google rejected the service account key. Download a fresh key and paste it again.');
      }
      if (status === 400) fail('Google could not use that Form ID. Check the Form ID.');
      if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|ECONNRESET|timeout/i.test(`${e.code} ${e.message}`)) {
        fail('Could not reach Google to check the form. Try again in a moment.');
      }
      fail(`The Google Forms check failed: ${e.message}`);
    }

    // Each question may be its title, its question ID or its item ID (same rule as services/feedback.js)
    const known = new Set();
    (data.items || []).forEach((item) => {
      const q = item.questionItem && item.questionItem.question;
      if (!q || !q.questionId) return;
      [item.title, item.itemId, q.questionId].forEach((v) => {
        if (v) known.add(String(v).trim().toLowerCase());
      });
    });
    for (const [key, label] of Object.entries(FORMS_QUESTIONS)) {
      const value = String(next[key] || '').trim();
      if (value && !known.has(value.toLowerCase())) {
        fail(
          `The ${label.toLowerCase()} question "${value}" was not found in the form. Use the question title, question ID or item ID.`
        );
      }
    }
  },
};

// ---- update / reset ----
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
    if (k === 'formsFormId') v = extractFormId(v);
    typed[k] = v;
  }

  // Server-side validation (never trust the browser)
  VALIDATORS[section]({ ...get(), ...typed }, typed);
  await LIVE[section]({ ...get(), ...typed }, typed, patch);

  // Re-read the file after the awaits so a parallel save of another section isn't overwritten.
  // Only the typed values are written; everything else keeps falling back to the defaults.
  const raw = readRaw();
  for (const [k, v] of Object.entries(typed)) {
    raw[k] = SECRETS.includes(k) && v ? enc(v) : v;
  }
  writeRaw(raw);

  cache = null;
  return publicView();
}

// Reset = forget what was saved for this section, so get() falls back to the defaults again.
function reset(section) {
  const fields = SECTIONS[section];
  if (!fields) fail('Unknown settings section.');

  // Google Forms feedback can always be reset: with no .env values its default is "off and empty"
  const hasDefaults =
    section === 'forms' || fields.some((k) => ENV_KEYS[k] && process.env[ENV_KEYS[k]]);
  if (!hasDefaults) fail('There are no default values for this section to reset to.');

  const raw = readRaw();
  fields.forEach((k) => delete raw[k]);
  writeRaw(raw);

  cache = null;
  return publicView();
}

module.exports = { get, publicView, update, reset, database, parseServiceAccount };
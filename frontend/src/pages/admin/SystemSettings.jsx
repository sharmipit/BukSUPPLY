import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../../styles/admin/Dashboard.css';
import '../../styles/admin/SystemSettings.css';
import SettingsUnlock from './SettingsUnlock';

const API = import.meta.env.VITE_API_URL || '';

const authHeaders = (settingsToken) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${sessionStorage.getItem('token')}`,
  'X-Settings-Token': settingsToken || '',
});

const INITIAL = {
  googleEnabled: true,
  googleClientId: '',
  googleClientIdSet: false,
  googleClientIdMasked: '',
  googleClientSecret: '',
  googleClientSecretSet: false,

  recaptchaEnabled: false,
  recaptchaVersion: 'v2',
  recaptchaSiteKey: '',
  recaptchaSiteKeySet: false,
  recaptchaSiteKeyMasked: '',
  recaptchaSiteKeyPublic: '',
  recaptchaSecretKey: '',
  recaptchaSecretKeySet: false,

  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpUserSet: false,
  smtpUserMasked: '',
  smtpPassword: '',
  smtpPasswordSet: false,
  smtpFrom: '',

  pdfshiftEnabled: true,
  pdfshiftApiKey: '',
  pdfshiftApiKeySet: false,

  nutrientEnabled: true,
  nutrientApiKey: '',
  nutrientApiKeySet: false,

  driveEnabled: true,
  driveClientId: '',
  driveClientIdSet: false,
  driveClientIdMasked: '',
  driveClientSecret: '',
  driveClientSecretSet: false,
  driveRefreshToken: '',
  driveRefreshTokenSet: false,
  driveFolderName: '',

  formsEnabled: false,
  formsFormId: '',
  formsFormIdSet: false,
  formsFormIdMasked: '',
  formsCredentials: '',
  formsCredentialsSet: false,
  formsServiceEmail: '',
  formsPrefillUrl: '',
  formsQSlip: '',
  formsQCode: '',
  formsQRating: '',
  formsQComment: '',
  formsCodeSecret: '',
  formsCodeSecretSet: false,
};

// Fields that belong to each card. Each card saves on its own.
const SECTION_FIELDS = {
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

const SECTION_TITLE = {
  google: 'Google sign-in',
  recaptcha: 'reCAPTCHA',
  smtp: 'Email (SMTP)',
  pdfshift: 'PDF reports',
  nutrient: 'Excel reports',
  drive: 'Google Drive',
  forms: 'Google Forms feedback',
};

// Includes the server's "xxxSet" / "xxxMasked" helper keys
const keysFor = (section) => SECTION_FIELDS[section].flatMap((f) => [f, `${f}Set`, `${f}Masked`]);

// ---- validation ----
// The server checks everything again, and also asks Google whether the values really work.
// Every check below returns a message, or '' when the value is fine. The page shows the
// message right under the field, after the user leaves the field or tries to save.
const RE = {
  googleClientId: /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i,
  recaptchaKey: /^6L[A-Za-z0-9_-]{38}$/,
  host: /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i,
  from: /^(?:[^<>]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/,
  driveRefreshToken: /^1\/\/[A-Za-z0-9._-]{20,}$/,
  formId: /^[A-Za-z0-9_-]{10,}$/,
  slipPlaceholder: /(?:\{\{|%7B%7B)SLIP(?:\}\}|%7D%7D)/i,
  codePlaceholder: /(?:\{\{|%7B%7B)CODE(?:\}\}|%7D%7D)/i,
};

// Same limits the inputs enforce while typing (maxLength) and the server enforces on save
const LIMITS = {
  host: 253,
  smtpUser: 254,
  smtpFrom: 200,
  secret: 300,
  folder: 100,
  formId: 200,
  key: 10000,
  url: 2000,
  question: 200,
};

const t = (v) => (v === undefined || v === null ? '' : String(v)).trim();
const badSecret = (v, min) => v.length < min || /\s/.test(v);

// The service account key: the JSON file's text, or the same text as Base64.
// Returns the parsed key, or null when it can't be read (same rule as the server).
const parseServiceAccount = (raw) => {
  const text = t(raw);
  if (!text) return null;
  try {
    let json = text;
    if (!text.startsWith('{')) {
      const binary = atob(text.replace(/\s+/g, ''));
      json = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    }
    const key = JSON.parse(json);
    return key && key.client_email && key.private_key ? key : null;
  } catch {
    return null;
  }
};

// Accepts the bare Form ID or the form editor address (.../forms/d/<ID>/edit).
// The published address (.../forms/d/e/...) is left alone so the checker can explain it.
const extractFormId = (value) => {
  const v = t(value);
  const m = v.match(/\/forms\/d\/([A-Za-z0-9_-]+)/);
  return m && m[1] !== 'e' ? m[1] : v;
};

const CLIENT_ID_MSG =
  'That does not look like a Google Client ID. It should look like 123456789-abc.apps.googleusercontent.com.';
const CLIENT_SECRET_MSG =
  'The client secret looks too short or contains spaces. Copy it again from Google Cloud Console.';

const QUESTION_FIELDS = ['formsQSlip', 'formsQCode', 'formsQRating', 'formsQComment'];

const questionProblem = (f, field) => {
  const v = t(f[field]);
  if (v.length > LIMITS.question) return `Keep it to ${LIMITS.question} characters or fewer.`;
  const earlier = QUESTION_FIELDS.slice(0, QUESTION_FIELDS.indexOf(field));
  if (v && earlier.some((o) => t(f[o]).toLowerCase() === v.toLowerCase()))
    return 'Already used for another question. Each field needs a different question.';
  return '';
};

// One check per field. `f` is the whole form, so a check can look at the toggle
// ("required while turned on") and at saved values (a saved secret counts as filled).
const FIELD_CHECK = {
  // Google sign-in
  googleClientId: (f) => {
    const v = t(f.googleClientId);
    if (v && !RE.googleClientId.test(v)) return CLIENT_ID_MSG;
    if (f.googleEnabled && !v && !f.googleClientIdSet)
      return 'Add the Client ID, or turn Google sign-in off.';
    return '';
  },
  googleClientSecret: (f) => {
    const v = t(f.googleClientSecret);
    if (v && badSecret(v, 20)) return CLIENT_SECRET_MSG;
    if (f.googleEnabled && !v && !f.googleClientSecretSet)
      return 'Add the client secret, or turn Google sign-in off.';
    return '';
  },

  // reCAPTCHA
  recaptchaSiteKey: (f) => {
    const v = t(f.recaptchaSiteKey);
    if (v && !RE.recaptchaKey.test(v))
      return 'That does not look like a reCAPTCHA site key. It should start with 6L and be 40 characters long.';
    if (f.recaptchaEnabled && !v && !f.recaptchaSiteKeySet)
      return 'Add the reCAPTCHA site key, or turn reCAPTCHA off.';
    return '';
  },
  recaptchaSecretKey: (f) => {
    const v = t(f.recaptchaSecretKey);
    if (v && !RE.recaptchaKey.test(v))
      return 'That does not look like a reCAPTCHA secret key. It should start with 6L and be 40 characters long.';
    if (f.recaptchaEnabled && !v && !f.recaptchaSecretKeySet)
      return 'Add the reCAPTCHA secret key, or turn reCAPTCHA off.';
    return '';
  },

  // Email (SMTP): always on, so every required field is always required
  smtpHost: (f) => {
    const v = t(f.smtpHost);
    if (!v) return 'Enter the SMTP host.';
    if (/^[a-z]+:\/\//i.test(v) || v.includes('/'))
      return 'Enter only the server address, without http:// or a path.';
    if (!RE.host.test(v)) return 'The SMTP host is not a valid server address.';
    return '';
  },
  smtpPort: (f) => {
    const raw = t(f.smtpPort);
    const port = Number(raw);
    if (!raw || !Number.isInteger(port) || port < 1 || port > 65535)
      return 'Enter an SMTP port between 1 and 65535.';
    return '';
  },
  smtpUser: (f) => {
    const v = t(f.smtpUser);
    if (!v && !f.smtpUserSet) return 'Enter the SMTP username.';
    if (/\s/.test(v)) return 'The username cannot contain spaces.';
    if (v.length > LIMITS.smtpUser) return `Keep it to ${LIMITS.smtpUser} characters or fewer.`;
    return '';
  },
  smtpPassword: (f) => {
    const v = t(f.smtpPassword);
    if (!v && !f.smtpPasswordSet) return 'Enter the SMTP password or app password.';
    return '';
  },
  smtpFrom: (f) => {
    const v = t(f.smtpFrom);
    if (v && !RE.from.test(v))
      return '"Send from" must be an email address or "Name <address@example.com>".';
    return '';
  },

  // PDF and Excel services
  pdfshiftApiKey: (f) => {
    const v = t(f.pdfshiftApiKey);
    if (v && badSecret(v, 10)) return 'The PDFShift API key looks too short or contains spaces.';
    if (v && !v.startsWith('sk_'))
      return 'PDFShift API keys start with "sk_". Copy it again from your PDFShift dashboard.';
    if (f.pdfshiftEnabled && !v && !f.pdfshiftApiKeySet)
      return 'Add the PDFShift API key, or turn PDF downloads off.';
    return '';
  },
  nutrientApiKey: (f) => {
    const v = t(f.nutrientApiKey);
    if (v && badSecret(v, 10)) return 'The Nutrient API key looks too short or contains spaces.';
    if (v && !/^pdf_(live|test)_/.test(v))
      return 'Nutrient API keys start with "pdf_live_". Copy it again from your Nutrient dashboard.';
    if (f.nutrientEnabled && !v && !f.nutrientApiKeySet)
      return 'Add the Nutrient API key, or turn Excel downloads off.';
    return '';
  },

  // Google Drive
  driveClientId: (f) => {
    const v = t(f.driveClientId);
    if (v && !RE.googleClientId.test(v)) return CLIENT_ID_MSG;
    if (f.driveEnabled && !v && !f.driveClientIdSet)
      return 'Add the Client ID, or turn Google Drive off.';
    return '';
  },
  driveClientSecret: (f) => {
    const v = t(f.driveClientSecret);
    if (v && badSecret(v, 20)) return CLIENT_SECRET_MSG;
    if (f.driveEnabled && !v && !f.driveClientSecretSet)
      return 'Add the client secret, or turn Google Drive off.';
    return '';
  },
  driveRefreshToken: (f) => {
    const v = t(f.driveRefreshToken);
    if (v && !RE.driveRefreshToken.test(v))
      return 'That does not look like a Google refresh token. It usually starts with 1//.';
    if (f.driveEnabled && !v && !f.driveRefreshTokenSet)
      return 'Add the refresh token, or turn Google Drive off.';
    return '';
  },
  driveFolderName: (f) =>
    t(f.driveFolderName).length > LIMITS.folder
      ? `The folder name must be ${LIMITS.folder} characters or fewer.`
      : '',

  // Google Forms feedback
  formsFormId: (f) => {
    const v = extractFormId(f.formsFormId);
    if (v && !RE.formId.test(v))
      return /\/forms\/d\/e\//.test(v)
        ? 'That is the published form link. Copy the ID from the form editor address instead.'
        : 'That does not look like a Google Form ID. Copy the part between /d/ and /edit in the form editor address.';
    if (f.formsEnabled && !v && !f.formsFormIdSet)
      return 'Add the Form ID, or turn feedback off.';
    return '';
  },
  formsCredentials: (f) => {
    const v = t(f.formsCredentials);
    if (v && !parseServiceAccount(v))
      return 'The service account key could not be read. Paste the full JSON key file, or its Base64 text.';
    if (f.formsEnabled && !v && !f.formsCredentialsSet)
      return 'Add the service account key, or turn feedback off.';
    return '';
  },
  formsPrefillUrl: (f) => {
    const v = t(f.formsPrefillUrl);
    if (v.length > LIMITS.url) return `The link must be ${LIMITS.url} characters or fewer.`;
    if (v && !/^https:\/\/docs\.google\.com\/forms\//i.test(v))
      return 'The pre-filled link must start with https://docs.google.com/forms/.';
    if (v && !RE.slipPlaceholder.test(v))
      return 'The pre-filled link must contain {{SLIP}} where the slip number goes.';
    if (v && t(f.formsQCode) && !RE.codePlaceholder.test(v))
      return 'A verification code question is set, so the link must also contain {{CODE}}.';
    if (f.formsEnabled && !v) return 'Add the pre-filled link, or turn feedback off.';
    return '';
  },
  formsQSlip: (f) => {
    const problem = questionProblem(f, 'formsQSlip');
    if (problem) return problem;
    if (f.formsEnabled && !t(f.formsQSlip)) return 'Add the slip number question, or turn feedback off.';
    return '';
  },
  formsQCode: (f) => questionProblem(f, 'formsQCode'),
  formsQRating: (f) => questionProblem(f, 'formsQRating'),
  formsQComment: (f) => questionProblem(f, 'formsQComment'),
  formsCodeSecret: (f) => {
    const v = t(f.formsCodeSecret);
    if (v && badSecret(v, 8))
      return 'The verification secret must be at least 8 characters long with no spaces.';
    return '';
  },
};

// Touching one field can change the message of another one
const TOUCH_ALSO = { formsQCode: ['formsPrefillUrl'] };

// Which card a field belongs to
const FIELD_SECTION = Object.fromEntries(
  Object.entries(SECTION_FIELDS).flatMap(([section, fields]) => fields.map((k) => [k, section]))
);

// { fieldName: 'message' } for the fields of one card (only the ones with a problem)
const fieldProblems = (section, form) => {
  const out = {};
  SECTION_FIELDS[section].forEach((k) => {
    const check = FIELD_CHECK[k];
    const msg = check ? check(form) : '';
    if (msg) out[k] = msg;
  });
  return out;
};

// Trim every text value and turn a pasted form editor link into the bare Form ID
const tidyValue = (field, value) =>
  typeof value !== 'string' ? value : field === 'formsFormId' ? extractFormId(value) : value.trim();

const tidyForm = (form) => {
  const next = { ...form };
  Object.keys(FIELD_SECTION).forEach((k) => {
    next[k] = tidyValue(k, form[k]);
  });
  return next;
};

// ---- Google reCAPTCHA script (loaded once, only when the admin confirms new keys) ----
let recaptchaLoader = null;
const loadRecaptcha = () => {
  if (window.grecaptcha && window.grecaptcha.render) return Promise.resolve(window.grecaptcha);
  if (!recaptchaLoader) {
    recaptchaLoader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      s.async = true;
      s.onload = () => window.grecaptcha.ready(() => resolve(window.grecaptcha));
      s.onerror = () => {
        recaptchaLoader = null;
        reject(new Error('Could not load reCAPTCHA from Google. Check your connection.'));
      };
      document.head.appendChild(s);
    });
  }
  return recaptchaLoader;
};

// ---- small components ----
// Plain text box. Field passes `invalid` and `describedBy` to it, so it turns red and is
// linked to its message for screen readers.
const TextInput = ({ invalid, describedBy, className = '', ...rest }) => (
  <input
    type="text"
    autoComplete="off"
    spellCheck={false}
    className={`ss-input${invalid ? ' ss-input-invalid' : ''} ${className}`.trim()}
    aria-invalid={invalid || undefined}
    aria-describedby={describedBy}
    {...rest}
  />
);

const SecretInput = ({
  id,
  value,
  isSet,
  onChange,
  onBlur,
  placeholder,
  invalid,
  describedBy,
  maxLength = LIMITS.secret,
}) => {
  const [show, setShow] = useState(false);
  return (
    <div className="ss-input-wrap">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        spellCheck={false}
        maxLength={maxLength}
        className={`ss-input ss-input-secret${invalid ? ' ss-input-invalid' : ''}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={isSet ? '•••••••• (saved)' : placeholder}
      />
      <button
        type="button"
        className="ss-eye"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide value' : 'Show value'}
      >
        <i className={`bi ${show ? 'bi-eye-slash' : 'bi-eye'}`}></i>
      </button>
    </div>
  );
};

// Saved ID/key/username. When one is saved, only the first 5 characters are shown
// (e.g. "6LcAb**************") as a locked value with a "Change" button.
// Click "Change" to type a replacement. Parent remounts this (via `key`)
// after every save/discard/reset so it always returns to the locked state.
const MaskedInput = ({
  id,
  value,
  isSet,
  masked,
  onChange,
  onBlur,
  placeholder,
  invalid,
  describedBy,
  maxLength = LIMITS.secret,
}) => {
  const [editing, setEditing] = useState(false);

  if (isSet && !editing) {
    return (
      <div className="ss-input-wrap">
        <input
          id={id}
          type="text"
          className="ss-input ss-input-locked"
          value={masked}
          readOnly
          tabIndex={-1}
          aria-label="Saved value, only the first 5 characters are shown"
        />
        <button type="button" className="ss-change" onClick={() => setEditing(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="ss-input-wrap">
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        autoFocus={isSet}
        maxLength={maxLength}
        className={`ss-input${invalid ? ' ss-input-invalid' : ''}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
      />
      {isSet && (
        <button
          type="button"
          className="ss-change"
          onClick={() => {
            onChange('');
            setEditing(false);
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
};

// One labelled field.
//  - A problem message replaces the hint and turns the box red.
//  - A normal hint stays hidden until the box is focused (so the cards stay short and calm).
//  - `persistent` keeps a hint visible all the time. Use it only for something people must
//    know BEFORE they type (for example a warning).
//  - `optional` adds a small "Optional" tag next to the label.
const Field = ({ id, label, hint, error, optional, persistent, children }) => {
  const messageId = `${id}-msg`;
  const describedBy = error || hint ? messageId : undefined;
  const control = React.isValidElement(children)
    ? React.cloneElement(children, { invalid: Boolean(error), describedBy })
    : children;

  return (
    <div className={`ss-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="ss-optional">Optional</span>}
      </label>
      {control}
      {error ? (
        <span id={messageId} className="ss-error-text">
          <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
          <span>{error}</span>
        </span>
      ) : hint ? (
        <div className={`ss-hint-wrap${persistent ? ' persist' : ''}`}>
          <span id={messageId} className="ss-hint">
            {hint}
          </span>
        </div>
      ) : null}
    </div>
  );
};

// complete = turned on and all required values saved
// setup    = turned on but something is missing
// off      = turned off by the admin
const STATUS_LABEL = { complete: 'Complete', setup: 'Needs setup', off: 'Off' };

const Status = ({ state }) => (
  <span className={`db-badge ss-status ss-status-${state} ${state === 'complete' ? 'active' : ''}`}>
    {STATUS_LABEL[state]}
  </span>
);

const getStatus = (enabled, complete) => {
  if (!enabled) return 'off';
  return complete ? 'complete' : 'setup';
};

const ToggleRow = ({ id, label, hint, checked, onChange }) => (
  <div className="ss-row">
    <div className="ss-row-text">
      <label htmlFor={id} className="ss-row-label">
        {label}
      </label>
      <span className="ss-hint">{hint}</span>
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      className={`ss-switch ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="ss-switch-knob"></span>
    </button>
  </div>
);

// Confirmation dialog that matches the settings cards
const ConfirmModal = ({
  title,
  confirmLabel,
  cancelLabel = 'Cancel',
  busyLabel = 'Resetting...',
  icon = 'bi-arrow-counterclockwise',
  busy,
  onConfirm,
  onCancel,
  children,
}) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="ss-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="db-section-card ss-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ss-modal-title"
      >
        <div className="ss-card-head">
          <div className="db-stat-icon-circle ss-card-icon">
            <i className={`bi ${icon}`} aria-hidden="true"></i>
          </div>
          <div className="ss-card-headtext">
            <h2 id="ss-modal-title" className="ss-card-title">
              {title}
            </h2>
          </div>
        </div>

        <div className="ss-modal-body">{children}</div>

        <div className="ss-card-foot">
          <button type="button" className="db-btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className="db-btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// Shows Google's real "I'm not a robot" box so the server can confirm the keys work together
const RecaptchaModal = ({ siteKey, onToken, onCancel }) => {
  const boxRef = useRef(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [problem, setProblem] = useState('');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  useEffect(() => {
    let cancelled = false;
    loadRecaptcha()
      .then((grecaptcha) => {
        if (cancelled || !boxRef.current) return;
        grecaptcha.render(boxRef.current, {
          sitekey: siteKey,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => setProblem('The check expired. Tick the box again.'),
          'error-callback': () =>
            setProblem(
              'Google could not run the check. Make sure the site key is correct and allowed for this website.'
            ),
        });
      })
      .catch((e) => {
        if (!cancelled) setProblem(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  return (
    <div
      className="ss-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="db-section-card ss-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ss-captcha-title"
      >
        <div className="ss-card-head">
          <div className="db-stat-icon-circle ss-card-icon">
            <i className="bi bi-shield-check" aria-hidden="true"></i>
          </div>
          <div className="ss-card-headtext">
            <h2 id="ss-captcha-title" className="ss-card-title">
              Confirm your reCAPTCHA keys
            </h2>
          </div>
        </div>

        <div className="ss-modal-body">
          <p>
            Tick the box below. Google will check that the site key and secret key are real and
            belong together, and the keys are saved right after.
          </p>
          <div className="ss-captcha" ref={boxRef}></div>
          {problem && <p className="ss-captcha-problem">{problem}</p>}
        </div>

        <div className="ss-card-foot">
          <button type="button" className="db-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// One card = one API = its own Save button
const SettingsCard = ({
  icon,
  title,
  sub,
  status,
  error,
  dirty,
  saving,
  disabled,
  onSave,
  onDiscard,
  onReset,
  children,
}) => (
  <div className="db-section-card ss-card">
    <div className="ss-card-head">
      <div className="db-stat-icon-circle ss-card-icon">
        <i className={`bi ${icon}`} aria-hidden="true"></i>
      </div>
      <div className="ss-card-headtext">
        <h2 className="ss-card-title">{title}</h2>
        <p className="ss-card-sub">{sub}</p>
      </div>
      {status && <Status state={status} />}
    </div>

    <div className="ss-card-body">{children}</div>

    {error && (
      <div className="db-error-box ss-error ss-card-error" role="alert">
        <strong>Could not save or reset</strong>
        <p>{error}</p>
      </div>
    )}

    <div className="ss-card-foot ss-card-actions">
      <span className="ss-card-foot-text" role="status">
        {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
      </span>
      <button
        type="button"
        className="db-btn-secondary"
        onClick={onReset}
        disabled={saving || disabled}
        title="Restore the default values"
      >
        Reset to default
      </button>
      <button
        type="button"
        className="db-btn-secondary"
        onClick={onDiscard}
        disabled={!dirty || saving}
      >
        Discard
      </button>
      <button
        type="button"
        className="db-btn-primary"
        onClick={onSave}
        disabled={!dirty || saving || disabled}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  </div>
);

function SystemSettingsContent({ token, onLock }) {
  const [saved, setSaved] = useState(INITIAL);
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState(null);
  const [errors, setErrors] = useState({}); // { google: '...', smtp: '...' }
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [resetSection, setResetSection] = useState(null); // card waiting for reset confirmation
  const [captchaOpen, setCaptchaOpen] = useState(false); // reCAPTCHA key confirmation
  const [touched, setTouched] = useState({}); // fields the user already left (show their problem)
  const [attempted, setAttempted] = useState({}); // cards where Save was clicked (show all problems)
  const [leaveTarget, setLeaveTarget] = useState(null); // page the user tried to open (leave confirmation)
  const navigate = useNavigate();
  // Bumped after save/discard/reset so MaskedInput returns to its locked state
  const [version, setVersion] = useState({});

  // Load the saved settings from the server
  useEffect(() => {
    fetch(`${API}/api/admin/settings`, { headers: authHeaders(token) })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (data.code === 'SU_LOCKED') onLock();
          throw new Error(data.message || 'Could not load the settings.');
        }
        return data;
      })
      .then((data) => {
        setSaved(data);
        setForm(data);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Browser tab title (the lock screen sets its own in SettingsUnlock)
  useEffect(() => {
    document.title = 'System Settings | BukSUPPLY';
    return () => {
      document.title = 'BukSUPPLY';
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const setError = (section, msg) => setErrors((prev) => ({ ...prev, [section]: msg }));
  const bump = (section) => setVersion((v) => ({ ...v, [section]: (v[section] || 0) + 1 }));

  // Editing a field clears the card's old "could not save" message
  const set = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    const section = FIELD_SECTION[field];
    setErrors((prev) => (prev[section] ? { ...prev, [section]: '' } : prev));
  };
  const onText = (field) => (e) => set(field)(e.target.value);

  // Leaving a field: remember it, and tidy the text (trim spaces, pasted form link -> Form ID)
  const blur = (field) => () => {
    setTouched((prev) => {
      const next = { ...prev, [field]: true };
      (TOUCH_ALSO[field] || []).forEach((k) => {
        next[k] = true;
      });
      return next;
    });
    setForm((prev) => {
      const current = prev[field];
      const tidy = tidyValue(field, current);
      return tidy === current ? prev : { ...prev, [field]: tidy };
    });
  };

  // Props for plain inputs (they give an event) and for Secret/Masked inputs (they give a value)
  const bindText = (field) => ({ value: form[field], onChange: onText(field), onBlur: blur(field) });
  const bindValue = (field) => ({ value: form[field], onChange: set(field), onBlur: blur(field) });

  // After a save, discard or reset the card starts clean again
  const resetTouched = (section) => {
    setTouched((prev) => {
      const next = { ...prev };
      SECTION_FIELDS[section].forEach((k) => {
        delete next[k];
      });
      return next;
    });
    setAttempted((prev) => ({ ...prev, [section]: false }));
  };

  // A field shows its problem once the user left it, or after Save was clicked on its card
  const problems = Object.keys(SECTION_FIELDS).reduce(
    (all, section) => ({ ...all, ...fieldProblems(section, form) }),
    {}
  );
  const err = (field) =>
    touched[field] || attempted[FIELD_SECTION[field]] ? problems[field] || '' : '';

  const isDirty = (section) =>
    SECTION_FIELDS[section].some((k) => String(form[k]) !== String(saved[k]));
  const anyDirty = Object.keys(SECTION_FIELDS).some(isDirty);

  // Leaving this page locks the settings again, so ask first when the user clicks
  // a link to another page of the app (sidebar, header, etc.).
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // open in new tab
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) {
        return;
      }
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return; // same page
      }
      e.preventDefault();
      e.stopPropagation();
      setLeaveTarget(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Refreshing or closing the tab also locks the page, so let the browser ask first.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Badges reflect what is saved on the server, so they don't flicker while typing
  const status = {
    google: getStatus(saved.googleEnabled, saved.googleClientIdSet && saved.googleClientSecretSet),
    recaptcha: getStatus(
      saved.recaptchaEnabled,
      saved.recaptchaSiteKeySet && saved.recaptchaSecretKeySet
    ),
    // Email has no on/off switch: it is either ready or it needs setup
    smtp:
      saved.smtpHost.trim() && saved.smtpUserSet && saved.smtpPasswordSet
        ? 'complete'
        : 'setup',
    pdfshift: getStatus(saved.pdfshiftEnabled, saved.pdfshiftApiKeySet),
    nutrient: getStatus(saved.nutrientEnabled, saved.nutrientApiKeySet),
    drive: getStatus(
      saved.driveEnabled,
      saved.driveClientIdSet && saved.driveClientSecretSet && saved.driveRefreshTokenSet
    ),
    forms: getStatus(
      saved.formsEnabled,
      saved.formsFormIdSet &&
        saved.formsCredentialsSet &&
        saved.formsPrefillUrl.trim() &&
        saved.formsQSlip.trim()
    ),
  };

  // Used after both Save and Reset: take the server's answer for this card only,
  // so edits in other cards are kept
  const applyServerData = (section, data) => {
    setSaved(data);
    setForm((prev) => {
      const next = { ...prev };
      keysFor(section).forEach((k) => {
        if (k in data) next[k] = data[k];
      });
      return next;
    });
    bump(section);
    resetTouched(section);
  };

  // The site key the confirmation box should use: the new one if typed, else the saved one
  const captchaSiteKey = t(form.recaptchaSiteKey) || saved.recaptchaSiteKeyPublic || '';

  // `extra` carries the solved reCAPTCHA token on the second pass
  const handleSave = async (section, extra = {}) => {
    if (!isDirty(section) || savingSection) return;
    setError(section, '');
    setAttempted((prev) => ({ ...prev, [section]: true }));

    // Check the tidied values; every problem is shown under its own field
    const clean = tidyForm(form);
    if (Object.keys(fieldProblems(section, clean)).length) {
      return setError(section, 'Please fix the highlighted fields, then save again.');
    }

    // New reCAPTCHA keys must be confirmed with a real "I'm not a robot" check first
    if (
      section === 'recaptcha' &&
      !extra.recaptchaToken &&
      (t(form.recaptchaSiteKey) || t(form.recaptchaSecretKey)) &&
      captchaSiteKey &&
      (t(form.recaptchaSecretKey) || saved.recaptchaSecretKeySet)
    ) {
      return setCaptchaOpen(true);
    }

    setSavingSection(section);
    try {
      // Send only this card's fields. Empty secret / public key = server keeps the saved one
      const body = {};
      SECTION_FIELDS[section].forEach((k) => {
        body[k] = clean[k];
      });
      if (section === 'smtp') body.smtpPort = Number(clean.smtpPort) || 587;
      if (extra.recaptchaToken) body.recaptchaToken = extra.recaptchaToken;

      const res = await fetch(`${API}/api/admin/settings/${section}`, {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'SU_LOCKED') onLock();
        throw new Error(data.message || 'Could not save the settings.');
      }

      applyServerData(section, data);
      setNotice({ type: 'success', text: `${SECTION_TITLE[section]} settings were saved.` });
    } catch (err) {
      setError(section, err.message || 'Could not save the settings.');
    } finally {
      setSavingSection(null);
    }
  };

  // Called from the confirmation modal
  const handleReset = async (section) => {
    if (savingSection) return;

    setError(section, '');
    setSavingSection(section);
    try {
      const res = await fetch(`${API}/api/admin/settings/${section}/reset`, {
        method: 'POST',
        headers: authHeaders(token),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'SU_LOCKED') onLock();
        throw new Error(data.message || 'Could not reset the settings.');
      }

      applyServerData(section, data);
      setNotice({
        type: 'success',
        text: `${SECTION_TITLE[section]} was reset to default.`,
      });
    } catch (err) {
      setError(section, err.message || 'Could not reset the settings.');
    } finally {
      setSavingSection(null);
      setResetSection(null);
    }
  };

  const handleDiscard = (section) => {
    setError(section, '');
    setForm((prev) => {
      const next = { ...prev };
      SECTION_FIELDS[section].forEach((k) => {
        next[k] = saved[k];
      });
      return next;
    });
    bump(section);
    resetTouched(section);
  };

  // Shared props for each card
  const cardProps = (section) => ({
    status: status[section],
    error: errors[section],
    dirty: isDirty(section),
    saving: savingSection === section,
    disabled: !!savingSection && savingSection !== section,
    onSave: () => handleSave(section),
    onDiscard: () => handleDiscard(section),
    onReset: () => setResetSection(section),
  });

  // The email address the form must be shared with: the one in the key being typed,
  // otherwise the one from the saved key
  const typedKey = parseServiceAccount(form.formsCredentials);
  const serviceEmail = typedKey
    ? String(typedKey.client_email)
    : t(form.formsCredentials)
      ? ''
      : saved.formsServiceEmail || '';

  // Must come after all hooks
  if (loading) return <div className="dashboard ss-page">Loading…</div>;

  return (
    <div className="dashboard ss-page">
      {/* Header card */}
      <div className="db-header-card">
        <div className="db-header-text">
          <h1 className="db-title">System settings</h1>
          <p className="db-subtitle">
            Manage the keys and connections used by <strong>BukSUPPLY</strong>. Each section is
            saved on its own. Saved keys are hidden; leave a field empty to keep its current value.
            Use <em>Reset to default</em> to go back to the original values. Database settings are
            managed in the server configuration.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="db-error-box ss-error" role="alert">
          <strong>Could not load</strong>
          <p>{loadError}</p>
        </div>
      )}

      {/* Google sign-in */}
      <SettingsCard
        icon="bi-google"
        title="Google sign-in"
        sub="OAuth credentials from Google Cloud Console."
        {...cardProps('google')}
      >
        <ToggleRow
          id="ss-g-on"
          label="Turn on Google sign-in"
          hint="When off, the “Sign in with Google” button is hidden."
          checked={form.googleEnabled}
          onChange={set('googleEnabled')}
        />

        <div className="ss-divider"></div>

        <div className="ss-grid ss-grid-2">
          <Field
            id="ss-g-id"
            label="Client ID"
            hint="Shown to Google when users sign in."
            error={err('googleClientId')}
          >
            <MaskedInput
              key={`g-${version.google || 0}`}
              id="ss-g-id"
              isSet={form.googleClientIdSet}
              masked={form.googleClientIdMasked}
              placeholder="123456789-abc.apps.googleusercontent.com"
              {...bindValue('googleClientId')}
            />
          </Field>
          <Field
            id="ss-g-secret"
            label="Client secret"
            hint="Used by the server only."
            error={err('googleClientSecret')}
          >
            <SecretInput
              id="ss-g-secret"
              isSet={form.googleClientSecretSet}
              placeholder="GOCSPX-..."
              {...bindValue('googleClientSecret')}
            />
          </Field>
        </div>
      </SettingsCard>

      {/* reCAPTCHA */}
      <SettingsCard
        icon="bi-shield-check"
        title="reCAPTCHA"
        sub="Blocks bots on the login and sign-up forms."
        {...cardProps('recaptcha')}
      >
        <ToggleRow
          id="ss-rc-on"
          label="Turn on reCAPTCHA"
          hint="Forms will ask visitors to pass the check."
          checked={form.recaptchaEnabled}
          onChange={set('recaptchaEnabled')}
        />

        <div className="ss-divider"></div>

        <div className="ss-grid ss-grid-2">
          <Field
            id="ss-rc-site"
            label="Site key"
            hint="Used in the browser. It starts with 6L."
            error={err('recaptchaSiteKey')}
          >
            <MaskedInput
              key={`rc-${version.recaptcha || 0}`}
              id="ss-rc-site"
              isSet={form.recaptchaSiteKeySet}
              masked={form.recaptchaSiteKeyMasked}
              placeholder="6LcA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S"
              {...bindValue('recaptchaSiteKey')}
            />
          </Field>
          <Field
            id="ss-rc-secret"
            label="Secret key"
            hint="New keys are confirmed with Google when you save."
            error={err('recaptchaSecretKey')}
          >
            <SecretInput
              id="ss-rc-secret"
              isSet={form.recaptchaSecretKeySet}
              placeholder="6Lc..."
              {...bindValue('recaptchaSecretKey')}
            />
          </Field>
        </div>
      </SettingsCard>

      {/* Email: always on, so no toggle */}
      <SettingsCard
        icon="bi-envelope"
        title="Email (SMTP)"
        sub="Used for password resets and request notices."
        {...cardProps('smtp')}
      >
        <div className="ss-grid ss-grid-3">
          <Field
            id="ss-smtp-host"
            label="Host"
            hint="Your email provider's server address."
            error={err('smtpHost')}
          >
            <TextInput
              id="ss-smtp-host"
              maxLength={LIMITS.host}
              placeholder="smtp.gmail.com"
              {...bindText('smtpHost')}
            />
          </Field>
          <Field
            id="ss-smtp-port"
            label="Port"
            hint="Usually 587 (TLS) or 465 (SSL)."
            error={err('smtpPort')}
          >
            <TextInput
              id="ss-smtp-port"
              type="number"
              inputMode="numeric"
              min="1"
              max="65535"
              placeholder="587"
              {...bindText('smtpPort')}
            />
          </Field>
          <Field
            id="ss-smtp-from"
            label="Send from"
            hint="The name and address recipients will see."
            error={err('smtpFrom')}
            optional
          >
            <TextInput
              id="ss-smtp-from"
              maxLength={LIMITS.smtpFrom}
              placeholder="BukSUPPLY Support <supply@buksu.edu.ph>"
              {...bindText('smtpFrom')}
            />
          </Field>
          <Field
            id="ss-smtp-user"
            label="Username"
            hint="Usually your full email address."
            error={err('smtpUser')}
          >
            <MaskedInput
              key={`smtp-${version.smtp || 0}`}
              id="ss-smtp-user"
              isSet={form.smtpUserSet}
              masked={form.smtpUserMasked}
              maxLength={LIMITS.smtpUser}
              placeholder="supply@buksu.edu.ph"
              {...bindValue('smtpUser')}
            />
          </Field>
          <Field
            id="ss-smtp-pass"
            label="Password or app password"
            hint="Use an app password if 2-step verification is on."
            error={err('smtpPassword')}
          >
            <SecretInput
              id="ss-smtp-pass"
              isSet={form.smtpPasswordSet}
              placeholder="16-character app password"
              {...bindValue('smtpPassword')}
            />
          </Field>
        </div>
      </SettingsCard>

      {/* PDF reports */}
      <SettingsCard
        icon="bi-file-earmark-pdf"
        title="PDF reports (PDFShift)"
        sub="Converts report pages into downloadable PDF files."
        {...cardProps('pdfshift')}
      >
        <ToggleRow
          id="ss-pdf-on"
          label="Turn on PDF downloads"
          hint="When off, PDF downloads are unavailable."
          checked={form.pdfshiftEnabled}
          onChange={set('pdfshiftEnabled')}
        />

        <div className="ss-divider"></div>

        <div className="ss-grid ss-grid-2">
          <Field
            id="ss-pdf-key"
            label="API key"
            hint="Each PDF download uses one PDFShift credit."
            error={err('pdfshiftApiKey')}
          >
            <SecretInput
              id="ss-pdf-key"
              isSet={form.pdfshiftApiKeySet}
              placeholder="sk_..."
              {...bindValue('pdfshiftApiKey')}
            />
          </Field>
        </div>
      </SettingsCard>

      {/* Excel reports */}
      <SettingsCard
        icon="bi-file-earmark-excel"
        title="Excel reports (Nutrient)"
        sub="Converts report data into downloadable Excel files."
        {...cardProps('nutrient')}
      >
        <ToggleRow
          id="ss-xlsx-on"
          label="Turn on Excel downloads"
          hint="When off, Excel downloads are unavailable."
          checked={form.nutrientEnabled}
          onChange={set('nutrientEnabled')}
        />

        <div className="ss-divider"></div>

        <div className="ss-grid ss-grid-2">
          <Field
            id="ss-xlsx-key"
            label="API key"
            hint="Each Excel download uses Nutrient credits."
            error={err('nutrientApiKey')}
          >
            <SecretInput
              id="ss-xlsx-key"
              isSet={form.nutrientApiKeySet}
              placeholder="pdf_live_..."
              {...bindValue('nutrientApiKey')}
            />
          </Field>
        </div>
      </SettingsCard>

      {/* Google Drive */}
      <SettingsCard
        icon="bi-cloud-arrow-up"
        title="Google Drive"
        sub="Saves a copy of each downloaded report or slip and emails the owner a private link."
        {...cardProps('drive')}
      >
        <ToggleRow
          id="ss-drive-on"
          label="Turn on Google Drive copies"
          hint="When off, downloads still work but no copy is uploaded or emailed."
          checked={form.driveEnabled}
          onChange={set('driveEnabled')}
        />

        <div className="ss-divider"></div>

        <div className="ss-grid ss-grid-2">
          <Field
            id="ss-drive-id"
            label="Client ID"
            hint="From the OAuth credential used to authorize Drive."
            error={err('driveClientId')}
          >
            <MaskedInput
              key={`drive-${version.drive || 0}`}
              id="ss-drive-id"
              isSet={form.driveClientIdSet}
              masked={form.driveClientIdMasked}
              placeholder="123456789-abc.apps.googleusercontent.com"
              {...bindValue('driveClientId')}
            />
          </Field>
          <Field
            id="ss-drive-secret"
            label="Client secret"
            hint="Used by the server only."
            error={err('driveClientSecret')}
          >
            <SecretInput
              id="ss-drive-secret"
              isSet={form.driveClientSecretSet}
              placeholder="GOCSPX-..."
              {...bindValue('driveClientSecret')}
            />
          </Field>
          <Field
            id="ss-drive-refresh"
            label="Refresh token"
            hint="New credentials are checked with Google when you save."
            error={err('driveRefreshToken')}
          >
            <SecretInput
              id="ss-drive-refresh"
              isSet={form.driveRefreshTokenSet}
              placeholder="1//0g..."
              {...bindValue('driveRefreshToken')}
            />
          </Field>
          <Field
            id="ss-drive-folder"
            label="Folder name"
            hint="Created in the connected Drive if it doesn't exist. Empty = BukSUPPLY Exports."
            error={err('driveFolderName')}
            optional
          >
            <TextInput
              id="ss-drive-folder"
              maxLength={LIMITS.folder}
              placeholder="BukSUPPLY Exports"
              {...bindText('driveFolderName')}
            />
          </Field>
        </div>
      </SettingsCard>

      {/* Google Forms feedback */}
      <SettingsCard
        icon="bi-chat-square-text"
        title="Google Forms feedback"
        sub="Lets requesters rate a received request through a Google Form."
        {...cardProps('forms')}
      >
        <ToggleRow
          id="ss-forms-on"
          label="Turn on feedback"
          hint="When off, the “Send Feedback” button is hidden in the requisition slip details."
          checked={form.formsEnabled}
          onChange={set('formsEnabled')}
        />

        <div className="ss-divider"></div>

        <div className="ss-grid ss-grid-2">
          <Field
            id="ss-forms-id"
            label="Form ID"
            hint="The part between /d/ and /edit in the form editor address. Pasting the whole editor link also works."
            error={err('formsFormId')}
          >
            <MaskedInput
              key={`forms-id-${version.forms || 0}`}
              id="ss-forms-id"
              isSet={form.formsFormIdSet}
              masked={form.formsFormIdMasked}
              maxLength={LIMITS.formId}
              placeholder="1AbCdEfGh..."
              {...bindValue('formsFormId')}
            />
          </Field>
          <Field
            id="ss-forms-creds"
            label="Service account key"
            hint={
              serviceEmail ? (
                <>
                  Share the form with <strong className="ss-key-email">{serviceEmail}</strong> as
                  an Editor.
                </>
              ) : (
                'Paste the JSON key file or its Base64 text. Then share the form with the key’s email address as an Editor.'
              )
            }
            error={err('formsCredentials')}
          >
            <SecretInput
              id="ss-forms-creds"
              isSet={form.formsCredentialsSet}
              maxLength={LIMITS.key}
              placeholder="Paste the JSON key or its Base64 text"
              {...bindValue('formsCredentials')}
            />
          </Field>

          <Field
            id="ss-forms-url"
            label="Pre-filled link"
            hint={
              <>
                Use <code>{'{{SLIP}}'}</code> where the slip number goes. Optional placeholders:{' '}
                <code>{'{{CODE}}'}</code> <code>{'{{NAME}}'}</code> <code>{'{{EMAIL}}'}</code>{' '}
                <code>{'{{ID}}'}</code> <code>{'{{ROLE}}'}</code> <code>{'{{DEPT}}'}</code>
              </>
            }
            error={err('formsPrefillUrl')}
          >
            <TextInput
              id="ss-forms-url"
              maxLength={LIMITS.url}
              placeholder="https://docs.google.com/forms/d/e/.../viewform?entry.123={{SLIP}}"
              {...bindText('formsPrefillUrl')}
            />
          </Field>
          <Field
            id="ss-forms-q-slip"
            label="Slip number question"
            hint="The question's title, question ID or item ID."
            error={err('formsQSlip')}
          >
            <TextInput
              id="ss-forms-q-slip"
              maxLength={LIMITS.question}
              placeholder="Requisition slip number"
              {...bindText('formsQSlip')}
            />
          </Field>

          <Field
            id="ss-forms-q-code"
            label="Verification code question"
            hint="When set, a response only counts if its code matches the slip. The link must then contain {{CODE}}."
            error={err('formsQCode')}
            optional
          >
            <TextInput
              id="ss-forms-q-code"
              maxLength={LIMITS.question}
              placeholder="Verification code"
              {...bindText('formsQCode')}
            />
          </Field>
          <Field
            id="ss-forms-secret"
            label="Verification secret"
            hint={
              form.formsCodeSecretSet
                ? 'Changing it makes the codes of earlier responses stop matching.'
                : 'At least 8 characters. Leave empty to use the server secret.'
            }
            persistent={form.formsCodeSecretSet}
            error={err('formsCodeSecret')}
            optional
          >
            <SecretInput
              id="ss-forms-secret"
              isSet={form.formsCodeSecretSet}
              placeholder="Leave empty to use the server secret"
              {...bindValue('formsCodeSecret')}
            />
          </Field>

          <Field
            id="ss-forms-q-rating"
            label="Rating question"
            hint="Used for the average on the staff feedback summary."
            error={err('formsQRating')}
            optional
          >
            <TextInput
              id="ss-forms-q-rating"
              maxLength={LIMITS.question}
              placeholder="Overall rating"
              {...bindText('formsQRating')}
            />
          </Field>
          <Field
            id="ss-forms-q-comment"
            label="Comment question"
            hint="Shown under recent comments on the staff feedback summary."
            error={err('formsQComment')}
            optional
          >
            <TextInput
              id="ss-forms-q-comment"
              maxLength={LIMITS.question}
              placeholder="Comments"
              {...bindText('formsQComment')}
            />
          </Field>
        </div>
      </SettingsCard>

      {/* reCAPTCHA key confirmation */}
      {captchaOpen && (
        <RecaptchaModal
          siteKey={captchaSiteKey}
          onToken={(recaptchaToken) => {
            setCaptchaOpen(false);
            handleSave('recaptcha', { recaptchaToken });
          }}
          onCancel={() => setCaptchaOpen(false)}
        />
      )}

      {/* Reset confirmation */}
      {resetSection && (
        <ConfirmModal
          title={`Reset ${SECTION_TITLE[resetSection]}?`}
          confirmLabel="Reset to default"
          busy={savingSection === resetSection}
          onConfirm={() => handleReset(resetSection)}
          onCancel={() => setResetSection(null)}
        >
          <p>This replaces the saved values for this section with the default values.</p>
          {resetSection === 'forms' && (
            <p>
              Feedback goes back to the server defaults. Unless the server configuration turns it
              on, it will be off and the “Send Feedback” button will be hidden.
            </p>
          )}
          <p>Any unsaved changes in this card will also be discarded.</p>
        </ConfirmModal>
      )}

      {/* Leave confirmation */}
      {leaveTarget && (
        <ConfirmModal
          title="Leave System Settings?"
          icon="bi-lock"
          confirmLabel="Leave page"
          cancelLabel="Stay on page"
          onConfirm={() => navigate(leaveTarget)}
          onCancel={() => setLeaveTarget(null)}
        >
          <p>
            System settings lock again when you leave. You will need the Super Admin email, PIN and
            a new verification code to open them.
          </p>
          {anyDirty && <p>You also have unsaved changes that will be lost.</p>}
        </ConfirmModal>
      )}

      {/* Toast */}
      {notice && (
        <div className={`db-notice-toast ${notice.type}`} role="status">
          <span>{notice.text}</span>
          <button
            type="button"
            className="db-notice-close"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}
    </div>
  );
}

// Gate: the unlock token lives in memory only, so leaving the page
// or refreshing shows the lock screen again.
export default function SystemSettings() {
  const [token, setToken] = useState('');

  if (!token) return <SettingsUnlock onUnlock={setToken} />;
  return <SystemSettingsContent token={token} onLock={() => setToken('')} />;
}
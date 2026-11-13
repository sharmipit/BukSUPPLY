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
  smtpPassword: '',
  smtpPasswordSet: false,
  smtpFrom: '',

  pdfshiftEnabled: true,
  pdfshiftApiKey: '',
  pdfshiftApiKeySet: false,

  nutrientEnabled: true,
  nutrientApiKey: '',
  nutrientApiKeySet: false,
};

// Fields that belong to each card. Each card saves on its own.
const SECTION_FIELDS = {
  google: ['googleEnabled', 'googleClientId', 'googleClientSecret'],
  recaptcha: ['recaptchaEnabled', 'recaptchaSiteKey', 'recaptchaSecretKey'],
  smtp: ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'smtpFrom'],
  pdfshift: ['pdfshiftEnabled', 'pdfshiftApiKey'],
  nutrient: ['nutrientEnabled', 'nutrientApiKey'],
};

const SECTION_TITLE = {
  google: 'Google sign-in',
  recaptcha: 'reCAPTCHA',
  smtp: 'Email (SMTP)',
  pdfshift: 'PDF reports',
  nutrient: 'Excel reports',
};

// Includes the server's "xxxSet" / "xxxMasked" helper keys
const keysFor = (section) => SECTION_FIELDS[section].flatMap((f) => [f, `${f}Set`, `${f}Masked`]);

// ---- validation (the server checks again, and also checks with the real provider) ----
const RE = {
  googleClientId: /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i,
  recaptchaKey: /^6L[A-Za-z0-9_-]{38}$/,
  host: /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i,
  from: /^(?:[^<>]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/,
};
const t = (v) => (v || '').toString().trim();
const badSecret = (v, min) => v.length < min || /\s/.test(v);

const VALIDATE = {
  google: (f) => {
    const id = t(f.googleClientId);
    const secret = t(f.googleClientSecret);
    if (id && !RE.googleClientId.test(id))
      return 'That does not look like a Google Client ID. It should look like 123456789-abc.apps.googleusercontent.com.';
    if (secret && badSecret(secret, 20))
      return 'The client secret looks too short or contains spaces. Copy it again from Google Cloud Console.';
    if (f.googleEnabled && !(id || f.googleClientIdSet))
      return 'Add the Client ID, or turn Google sign-in off.';
    if (f.googleEnabled && !(secret || f.googleClientSecretSet))
      return 'Add the client secret, or turn Google sign-in off.';
    return '';
  },
  recaptcha: (f) => {
    const site = t(f.recaptchaSiteKey);
    const secret = t(f.recaptchaSecretKey);
    if (site && !RE.recaptchaKey.test(site))
      return 'That does not look like a reCAPTCHA site key. It should start with 6L and be 40 characters long.';
    if (secret && !RE.recaptchaKey.test(secret))
      return 'That does not look like a reCAPTCHA secret key. It should start with 6L and be 40 characters long.';
    if (f.recaptchaEnabled && !(site || f.recaptchaSiteKeySet))
      return 'Add the reCAPTCHA site key, or turn reCAPTCHA off.';
    if (f.recaptchaEnabled && !(secret || f.recaptchaSecretKeySet))
      return 'Add the reCAPTCHA secret key, or turn reCAPTCHA off.';
    return '';
  },
  smtp: (f) => {
    const host = t(f.smtpHost);
    const port = Number(f.smtpPort);
    if (!host) return 'Enter the SMTP host.';
    if (!RE.host.test(host)) return 'The SMTP host is not a valid server address.';
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      return 'Enter an SMTP port between 1 and 65535.';
    if (!t(f.smtpUser)) return 'Enter the SMTP username.';
    if (!(t(f.smtpPassword) || f.smtpPasswordSet))
      return 'Enter the SMTP password or app password.';
    if (t(f.smtpFrom) && !RE.from.test(t(f.smtpFrom)))
      return '"Send from" must be an email address or "Name <address@example.com>".';
    return '';
  },
  pdfshift: (f) => {
    const key = t(f.pdfshiftApiKey);
    if (key && badSecret(key, 10))
      return 'The PDFShift API key looks too short or contains spaces.';
    if (key && !key.startsWith('sk_'))
      return 'PDFShift API keys start with "sk_". Copy it again from your PDFShift dashboard.';
    if (f.pdfshiftEnabled && !(key || f.pdfshiftApiKeySet))
      return 'Add the PDFShift API key, or turn PDF downloads off.';
    return '';
  },
  nutrient: (f) => {
    const key = t(f.nutrientApiKey);
    if (key && badSecret(key, 10))
      return 'The Nutrient API key looks too short or contains spaces.';
    if (key && !/^pdf_(live|test)_/.test(key))
      return 'Nutrient API keys start with "pdf_live_". Copy it again from your Nutrient dashboard.';
    if (f.nutrientEnabled && !(key || f.nutrientApiKeySet))
      return 'Add the Nutrient API key, or turn Excel downloads off.';
    return '';
  },
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
const SecretInput = ({ id, value, isSet, onChange, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="ss-input-wrap">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        className="ss-input ss-input-secret"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

// Public ID/key. When one is saved, only the first 5 characters are shown
// (e.g. "6LcAb**************") as a locked value with a "Change" button.
// Click "Change" to type a replacement. Parent remounts this (via `key`)
// after every save/discard/reset so it always returns to the locked state.
const MaskedInput = ({ id, value, isSet, masked, onChange, placeholder }) => {
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
        className="ss-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

const Field = ({ id, label, hint, children }) => (
  <div className="ss-field">
    <label htmlFor={id}>{label}</label>
    {children}
    {hint && <span className="ss-hint">{hint}</span>}
  </div>
);

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

    <div className="ss-card-foot">
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

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));
  const onText = (field) => (e) => set(field)(e.target.value);
  const setError = (section, msg) => setErrors((prev) => ({ ...prev, [section]: msg }));
  const bump = (section) => setVersion((v) => ({ ...v, [section]: (v[section] || 0) + 1 }));

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
      saved.smtpHost.trim() && saved.smtpUser.trim() && saved.smtpPasswordSet
        ? 'complete'
        : 'setup',
    pdfshift: getStatus(saved.pdfshiftEnabled, saved.pdfshiftApiKeySet),
    nutrient: getStatus(saved.nutrientEnabled, saved.nutrientApiKeySet),
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
  };

  // The site key the confirmation box should use: the new one if typed, else the saved one
  const captchaSiteKey = t(form.recaptchaSiteKey) || saved.recaptchaSiteKeyPublic || '';

  // `extra` carries the solved reCAPTCHA token on the second pass
  const handleSave = async (section, extra = {}) => {
    if (!isDirty(section) || savingSection) return;
    setError(section, '');

    const problem = VALIDATE[section](form);
    if (problem) return setError(section, problem);

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
        body[k] = form[k];
      });
      if (section === 'smtp') body.smtpPort = Number(form.smtpPort) || 587;
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
            hint={
              form.googleClientIdSet
                ? 'Saved. Only the first 5 characters are shown. Click Change to replace it.'
                : 'Public. Shown to Google when users sign in.'
            }
          >
            <MaskedInput
              key={`g-${version.google || 0}`}
              id="ss-g-id"
              value={form.googleClientId}
              isSet={form.googleClientIdSet}
              masked={form.googleClientIdMasked}
              onChange={set('googleClientId')}
              placeholder="123456789-abc.apps.googleusercontent.com"
            />
          </Field>
          <Field id="ss-g-secret" label="Client secret" hint="Private. Used by the server.">
            <SecretInput
              id="ss-g-secret"
              value={form.googleClientSecret}
              isSet={form.googleClientSecretSet}
              onChange={set('googleClientSecret')}
              placeholder="GOCSPX-..."
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
            hint={
              form.recaptchaSiteKeySet
                ? 'Saved. Only the first 5 characters are shown. Click Change to replace it.'
                : 'Public. Used in the browser.'
            }
          >
            <MaskedInput
              key={`rc-${version.recaptcha || 0}`}
              id="ss-rc-site"
              value={form.recaptchaSiteKey}
              isSet={form.recaptchaSiteKeySet}
              masked={form.recaptchaSiteKeyMasked}
              onChange={set('recaptchaSiteKey')}
              placeholder="6LcA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S"
            />
          </Field>
          <Field
            id="ss-rc-secret"
            label="Secret key"
            hint="Private. New keys are confirmed with Google when you save."
          >
            <SecretInput
              id="ss-rc-secret"
              value={form.recaptchaSecretKey}
              isSet={form.recaptchaSecretKeySet}
              onChange={set('recaptchaSecretKey')}
              placeholder="6Lc..."
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
            hint="Public. Your email provider's server address."
          >
            <input
              id="ss-smtp-host"
              type="text"
              className="ss-input"
              value={form.smtpHost}
              onChange={onText('smtpHost')}
              placeholder="smtp.gmail.com"
              spellCheck={false}
            />
          </Field>
          <Field id="ss-smtp-port" label="Port" hint="Public. Usually 587 (TLS) or 465 (SSL).">
            <input
              id="ss-smtp-port"
              type="number"
              min="1"
              max="65535"
              className="ss-input"
              value={form.smtpPort}
              onChange={onText('smtpPort')}
              placeholder="587"
            />
          </Field>
          <Field
            id="ss-smtp-from"
            label="Send from"
            hint="Public. Name and address recipients will see."
          >
            <input
              id="ss-smtp-from"
              type="text"
              className="ss-input"
              value={form.smtpFrom}
              onChange={onText('smtpFrom')}
              placeholder="BukSUPPLY Support <supply@buksu.edu.ph>"
            />
          </Field>
          <Field
            id="ss-smtp-user"
            label="Username"
            hint="Private. Usually your full email address."
          >
            <input
              id="ss-smtp-user"
              type="text"
              autoComplete="off"
              className="ss-input"
              value={form.smtpUser}
              onChange={onText('smtpUser')}
              placeholder="supply@buksu.edu.ph"
              spellCheck={false}
            />
          </Field>
          <Field
            id="ss-smtp-pass"
            label="Password or app password"
            hint="Private. Use an app password if 2-step verification is on."
          >
            <SecretInput
              id="ss-smtp-pass"
              value={form.smtpPassword}
              isSet={form.smtpPasswordSet}
              onChange={set('smtpPassword')}
              placeholder="16-character app password"
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
            hint="Private. Each PDF download uses one PDFShift credit."
          >
            <SecretInput
              id="ss-pdf-key"
              value={form.pdfshiftApiKey}
              isSet={form.pdfshiftApiKeySet}
              onChange={set('pdfshiftApiKey')}
              placeholder="sk_..."
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
            hint="Private. Each Excel download uses Nutrient credits."
          >
            <SecretInput
              id="ss-xlsx-key"
              value={form.nutrientApiKey}
              isSet={form.nutrientApiKeySet}
              onChange={set('nutrientApiKey')}
              placeholder="pdf_live_..."
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
            System settings lock again when you leave. You will need the Super Admin email, PIN
            and a new verification code to open them.
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
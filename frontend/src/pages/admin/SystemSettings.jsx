import React, { useState, useEffect, useMemo } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../../styles/admin/Dashboard.css';
import '../../styles/admin/SystemSettings.css';

const API = import.meta.env.VITE_API_URL || '';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${sessionStorage.getItem('token')}`,
});

const INITIAL = {
  mongoDbName: '',
  mongoUri: '',
  mongoUriSet: false,

  googleEnabled: true,
  googleClientId: '',
  googleClientSecret: '',
  googleClientSecretSet: false,

  recaptchaEnabled: false,
  recaptchaVersion: 'v2',
  recaptchaSiteKey: '',
  recaptchaSecretKey: '',
  recaptchaSecretKeySet: false,

  smtpEnabled: true,
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

const Field = ({ id, label, hint, children }) => (
  <div className="ss-field">
    <label htmlFor={id}>{label}</label>
    {children}
    {hint && <span className="ss-hint">{hint}</span>}
  </div>
);

// Three states, based on what is SAVED on the server (not what is being typed):
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

export default function SystemSettings() {
  const [saved, setSaved] = useState(INITIAL);
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  // Load the saved settings from the server
  useEffect(() => {
    fetch(`${API}/api/admin/settings`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.message || 'Could not load the settings.');
        return data;
      })
      .then((data) => {
        setSaved(data);
        setForm(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));
  const onText = (field) => (e) => set(field)(e.target.value);

  // Still used by handleSave to validate the reCAPTCHA keys
  const recaptchaOk =
    !!form.recaptchaSiteKey.trim() && (form.recaptchaSecretKeySet || !!form.recaptchaSecretKey);

  // Badges reflect what is saved on the server, so they don't flicker while typing
  const status = {
    google: getStatus(
      saved.googleEnabled,
      !!saved.googleClientId.trim() && saved.googleClientSecretSet
    ),
    recaptcha: getStatus(
      saved.recaptchaEnabled,
      !!saved.recaptchaSiteKey.trim() && saved.recaptchaSecretKeySet
    ),
    smtp: getStatus(saved.smtpEnabled, !!saved.smtpHost.trim() && !!saved.smtpFrom.trim()),
    pdfshift: getStatus(saved.pdfshiftEnabled, saved.pdfshiftApiKeySet),
    nutrient: getStatus(saved.nutrientEnabled, saved.nutrientApiKeySet),
  };

  const handleSave = async () => {
    if (!dirty || saving) return;
    setError('');

    if (form.mongoUri && !/^mongodb(\+srv)?:\/\//.test(form.mongoUri.trim())) {
      return setError(
        'The MongoDB connection string must start with mongodb:// or mongodb+srv://.'
      );
    }
    if (form.recaptchaEnabled && !recaptchaOk) {
      return setError('Add both the reCAPTCHA site key and secret key, or turn reCAPTCHA off.');
    }
    const port = Number(form.smtpPort);
    if (form.smtpHost.trim() && !(port >= 1 && port <= 65535)) {
      return setError('Enter an SMTP port between 1 and 65535.');
    }

    // Database changes only apply after the server restarts
    const dbChanged = !!form.mongoUri || form.mongoDbName.trim() !== saved.mongoDbName;

    setSaving(true);
    try {
      // Empty secret = server keeps the saved one
      const res = await fetch(`${API}/api/admin/settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ ...form, smtpPort: port || 587 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not save the settings.');

      setForm(data); // server returns the safe version (secrets cleared, *Set flags updated)
      setSaved(data);
      setNotice({
        type: 'success',
        text: dbChanged
          ? 'Saved. Restart the server to apply the database changes.'
          : 'System settings were saved.',
      });
    } catch (err) {
      setError(err.message || 'Could not save the settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setError('');
    setForm(saved);
  };

  // Must come after all hooks
  if (loading) return <div className="dashboard ss-page">Loading…</div>;

  return (
    <div className="dashboard ss-page">
      {/* Header card */}
      <div className="db-header-card">
        <div className="db-header-text">
          <h1 className="db-title">System settings</h1>
          <p className="db-subtitle">
            Manage the keys and connections used by <strong>BukSUPPLY</strong>. Saved secrets are
            hidden. Leave a secret field empty to keep its current value.
          </p>
        </div>
      </div>

      {error && (
        <div className="db-error-box ss-error">
          <strong>Could not save</strong>
          <p>{error}</p>
        </div>
      )}

      {/* Database */}
      <div className="db-section-card ss-card">
        <div className="ss-card-head">
          <div className="db-stat-icon-circle ss-card-icon">
            <i className="bi bi-database" aria-hidden="true"></i>
          </div>
          <div className="ss-card-headtext">
            <h2 className="ss-card-title">Database (MongoDB Atlas)</h2>
            <p className="ss-card-sub">Cloud database that stores inventory, requests and users.</p>
          </div>
        </div>
        <div className="ss-card-body">
          <div className="ss-grid ss-grid-2">
            <Field
              id="ss-mongo-uri"
              label="Connection string"
              hint="Private. Leave empty to keep the current connection. Changes apply after the server restarts."
            >
              <SecretInput
                id="ss-mongo-uri"
                value={form.mongoUri}
                isSet={form.mongoUriSet}
                onChange={set('mongoUri')}
                placeholder="mongodb+srv://user:password@cluster.mongodb.net"
              />
            </Field>
            <Field
              id="ss-mongo-db"
              label="Database name"
              hint="Public. Leave unchanged to keep the current database."
            >
              <input
                id="ss-mongo-db"
                type="text"
                className="ss-input"
                value={form.mongoDbName}
                onChange={onText('mongoDbName')}
                placeholder="buksupply_dev"
                spellCheck={false}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Google sign-in */}
      <div className="db-section-card ss-card">
        <div className="ss-card-head">
          <div className="db-stat-icon-circle ss-card-icon">
            <i className="bi bi-google" aria-hidden="true"></i>
          </div>
          <div className="ss-card-headtext">
            <h2 className="ss-card-title">Google sign-in</h2>
            <p className="ss-card-sub">OAuth credentials from Google Cloud Console.</p>
          </div>
          <Status state={status.google} />
        </div>
        <div className="ss-card-body">
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
              hint="Public. Shown to Google when users sign in."
            >
              <input
                id="ss-g-id"
                type="text"
                className="ss-input"
                value={form.googleClientId}
                onChange={onText('googleClientId')}
                placeholder="123456789-abc.apps.googleusercontent.com"
                spellCheck={false}
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
        </div>
      </div>

      {/* reCAPTCHA */}
      <div className="db-section-card ss-card">
        <div className="ss-card-head">
          <div className="db-stat-icon-circle ss-card-icon">
            <i className="bi bi-shield-check" aria-hidden="true"></i>
          </div>
          <div className="ss-card-headtext">
            <h2 className="ss-card-title">reCAPTCHA</h2>
            <p className="ss-card-sub">Blocks bots on the login and sign-up forms.</p>
          </div>
          <Status state={status.recaptcha} />
        </div>
        <div className="ss-card-body">
          <ToggleRow
            id="ss-rc-on"
            label="Turn on reCAPTCHA"
            hint="Forms will ask visitors to pass the check."
            checked={form.recaptchaEnabled}
            onChange={set('recaptchaEnabled')}
          />

          <div className="ss-divider"></div>

          <div className="ss-grid ss-grid-2">
            <Field id="ss-rc-site" label="Site key" hint="Public. Used in the browser.">
              <input
                id="ss-rc-site"
                type="text"
                className="ss-input"
                value={form.recaptchaSiteKey}
                onChange={onText('recaptchaSiteKey')}
                placeholder="6Lc..."
                spellCheck={false}
              />
            </Field>
            <Field id="ss-rc-secret" label="Secret key" hint="Private. Used by the server.">
              <SecretInput
                id="ss-rc-secret"
                value={form.recaptchaSecretKey}
                isSet={form.recaptchaSecretKeySet}
                onChange={set('recaptchaSecretKey')}
                placeholder="6Lc..."
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Email */}
      <div className="db-section-card ss-card">
        <div className="ss-card-head">
          <div className="db-stat-icon-circle ss-card-icon">
            <i className="bi bi-envelope" aria-hidden="true"></i>
          </div>
          <div className="ss-card-headtext">
            <h2 className="ss-card-title">Email (SMTP)</h2>
            <p className="ss-card-sub">Used for password resets and request notices.</p>
          </div>
          <Status state={status.smtp} />
        </div>
        <div className="ss-card-body">
          <ToggleRow
            id="ss-smtp-on"
            label="Turn on email"
            hint="When off, no emails are sent."
            checked={form.smtpEnabled}
            onChange={set('smtpEnabled')}
          />

          <div className="ss-divider"></div>

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
        </div>
      </div>

      {/* PDF reports */}
      <div className="db-section-card ss-card">
        <div className="ss-card-head">
          <div className="db-stat-icon-circle ss-card-icon">
            <i className="bi bi-file-earmark-pdf" aria-hidden="true"></i>
          </div>
          <div className="ss-card-headtext">
            <h2 className="ss-card-title">PDF reports (PDFShift)</h2>
            <p className="ss-card-sub">Converts report pages into downloadable PDF files.</p>
          </div>
          <Status state={status.pdfshift} />
        </div>
        <div className="ss-card-body">
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
        </div>
      </div>

      {/* Excel reports */}
      <div className="db-section-card ss-card">
        <div className="ss-card-head">
          <div className="db-stat-icon-circle ss-card-icon">
            <i className="bi bi-file-earmark-excel" aria-hidden="true"></i>
          </div>
          <div className="ss-card-headtext">
            <h2 className="ss-card-title">Excel reports (Nutrient)</h2>
            <p className="ss-card-sub">Converts report data into downloadable Excel files.</p>
          </div>
          <Status state={status.nutrient} />
        </div>
        <div className="ss-card-body">
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
        </div>
      </div>

      {/* Save bar */}
      <div className="ss-savebar">
        <span className="ss-savebar-text" role="status">
          {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
        </span>
        <div className="ss-savebar-actions">
          <button
            type="button"
            className="db-btn-secondary"
            onClick={handleReset}
            disabled={!dirty || saving}
          >
            Discard changes
          </button>
          <button
            type="button"
            className="db-btn-primary"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

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

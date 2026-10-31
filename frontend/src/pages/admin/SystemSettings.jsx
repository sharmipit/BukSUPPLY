import React, { useState, useEffect, useMemo } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
// Dashboard styles first (shared tokens), then this page's styles.
import '../../styles/admin/Dashboard.css';
import '../../styles/admin/SystemSettings.css';

// Starting values. Replace with a fetch from your settings API.
// Secrets should NEVER be sent back to the browser: the server only says
// whether one is saved (the *Set flags), and the form field stays empty.
const INITIAL = {
  // Database (MongoDB Atlas) - always on
  mongoDbName: '',
  mongoUri: '',
  mongoUriSet: false,

  // Google sign-in
  googleEnabled: true,
  googleClientId: '',
  googleClientSecret: '',
  googleClientSecretSet: false,

  // reCAPTCHA
  recaptchaEnabled: false,
  recaptchaVersion: 'v2',
  recaptchaSiteKey: '',
  recaptchaSecretKey: '',
  recaptchaSecretKeySet: false,

  // Email (SMTP)
  smtpEnabled: true,
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  smtpPasswordSet: false,
  smtpFrom: '',

  // PDF reports (PDFShift)
  pdfshiftEnabled: true,
  pdfshiftApiKey: '',
  pdfshiftApiKeySet: false,

  // Excel reports (Nutrient)
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

const Status = ({ ok, enabled = true }) => {
  if (!ok) return null;
  return <span className="db-badge active ss-status">Configured</span>;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));
  const onText = (field) => (e) => set(field)(e.target.value);

  const mongoOk = !!form.mongoDbName.trim() && (form.mongoUriSet || !!form.mongoUri);
  const googleOk =
    !!form.googleClientId.trim() && (form.googleClientSecretSet || !!form.googleClientSecret);
  const recaptchaOk =
    !!form.recaptchaSiteKey.trim() && (form.recaptchaSecretKeySet || !!form.recaptchaSecretKey);
  const smtpOk = !!form.smtpHost.trim() && !!form.smtpFrom.trim();
  const pdfshiftOk = form.pdfshiftApiKeySet || !!form.pdfshiftApiKey;
  const nutrientOk = form.nutrientApiKeySet || !!form.nutrientApiKey;

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

    setSaving(true);
    try {
      // TODO: send `form` to your settings API. Only send a secret when its
      // field is not empty; an empty secret means "keep the saved one".
      const next = {
        ...form,
        mongoDbName: form.mongoDbName.trim(),
        googleClientId: form.googleClientId.trim(),
        recaptchaSiteKey: form.recaptchaSiteKey.trim(),
        smtpHost: form.smtpHost.trim(),
        smtpUser: form.smtpUser.trim(),
        smtpFrom: form.smtpFrom.trim(),
        smtpPort: port || 587,
        mongoUriSet: form.mongoUriSet || !!form.mongoUri,
        googleClientSecretSet: form.googleClientSecretSet || !!form.googleClientSecret,
        recaptchaSecretKeySet: form.recaptchaSecretKeySet || !!form.recaptchaSecretKey,
        smtpPasswordSet: form.smtpPasswordSet || !!form.smtpPassword,
        pdfshiftApiKeySet: form.pdfshiftApiKeySet || !!form.pdfshiftApiKey,
        nutrientApiKeySet: form.nutrientApiKeySet || !!form.nutrientApiKey,
        mongoUri: '',
        googleClientSecret: '',
        recaptchaSecretKey: '',
        smtpPassword: '',
        pdfshiftApiKey: '',
        nutrientApiKey: '',
      };
      setForm(next);
      setSaved(next);
      setNotice({ type: 'success', text: 'System settings were saved.' });
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
          <Status ok={mongoOk} />
        </div>
        <div className="ss-card-body">
          <div className="ss-grid ss-grid-2">
            <Field
              id="ss-mongo-uri"
              label="Connection string"
              hint="Private. Changes apply after the server restarts."
            >
              <SecretInput
                id="ss-mongo-uri"
                value={form.mongoUri}
                isSet={form.mongoUriSet}
                onChange={set('mongoUri')}
                placeholder="mongodb+srv://user:password@cluster.mongodb.net"
              />
            </Field>
            <Field id="ss-mongo-db" label="Database name">
              <input
                id="ss-mongo-db"
                type="text"
                className="ss-input"
                value={form.mongoDbName}
                onChange={onText('mongoDbName')}
                placeholder="buksupply"
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
          <Status ok={googleOk} enabled={form.googleEnabled} />
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
            <Field id="ss-g-id" label="Client ID">
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
            <Field id="ss-g-secret" label="Client secret">
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
          <Status ok={recaptchaOk} enabled={form.recaptchaEnabled} />
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

          <div className="ss-grid ss-grid-3">
            <Field id="ss-rc-site" label="Site key" hint="Public. Used in the browser.">
              <input
                id="ss-rc-site"
                type="text"
                className="ss-input"
                value={form.recaptchaSiteKey}
                onChange={onText('recaptchaSiteKey')}
                spellCheck={false}
              />
            </Field>
            <Field id="ss-rc-secret" label="Secret key" hint="Private. Used by the server.">
              <SecretInput
                id="ss-rc-secret"
                value={form.recaptchaSecretKey}
                isSet={form.recaptchaSecretKeySet}
                onChange={set('recaptchaSecretKey')}
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
          <Status ok={smtpOk} enabled={form.smtpEnabled} />
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
            <Field id="ss-smtp-host" label="Host">
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
            <Field id="ss-smtp-port" label="Port" hint="Usually 587 (TLS) or 465 (SSL).">
              <input
                id="ss-smtp-port"
                type="number"
                min="1"
                max="65535"
                className="ss-input"
                value={form.smtpPort}
                onChange={onText('smtpPort')}
              />
            </Field>
            <Field id="ss-smtp-from" label="Send from">
              <input
                id="ss-smtp-from"
                type="email"
                className="ss-input"
                value={form.smtpFrom}
                onChange={onText('smtpFrom')}
                placeholder="supply@buksu.edu.ph"
              />
            </Field>
            <Field id="ss-smtp-user" label="Username">
              <input
                id="ss-smtp-user"
                type="text"
                autoComplete="off"
                className="ss-input"
                value={form.smtpUser}
                onChange={onText('smtpUser')}
                spellCheck={false}
              />
            </Field>
            <Field id="ss-smtp-pass" label="Password or app password">
              <SecretInput
                id="ss-smtp-pass"
                value={form.smtpPassword}
                isSet={form.smtpPasswordSet}
                onChange={set('smtpPassword')}
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
          <Status ok={pdfshiftOk} enabled={form.pdfshiftEnabled} />
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
          <Status ok={nutrientOk} enabled={form.nutrientEnabled} />
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

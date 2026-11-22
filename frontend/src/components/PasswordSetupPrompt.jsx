import React, { useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PasswordStrength from './PasswordStrength';
import { typePassword, passwordProblem, confirmProblem } from '../utils/fieldRules';
import '../styles/PasswordSetupPrompt.css';

// "Remind me later" is remembered for this browser tab only. A new sign-in clears it
// (see finishSignIn in Signin.jsx), so the reminder returns on every login until a password is set.
export const SNOOZE_KEY = 'buksupply.pwPromptSnoozed';

const EMPTY = { password: '', confirm: '' };

export default function PasswordSetupPrompt() {
  const { user, updateUser, setUser } = useAuth();

  const [snoozed, setSnoozed] = useState(() => sessionStorage.getItem(SNOOZE_KEY) === '1');
  const [step, setStep] = useState('prompt'); // 'prompt' | 'form'
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [notices, setNotices] = useState({});
  const [visible, setVisible] = useState({ password: false, confirm: false });
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);

  // Only accounts that really have no password yet (created with Google) see this
  const open = Boolean(user) && user.hasPassword === false && !snoozed;

  const snooze = () => {
    if (busy) return;
    sessionStorage.setItem(SNOOZE_KEY, '1');
    setSnoozed(true);
    setStep('prompt');
    setValues(EMPTY);
    setErrors({});
    setNotices({});
    setServerError('');
  };

  // Escape = "Remind me later"
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && snooze();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Success message disappears by itself
  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setDone(false), 5000);
    return () => clearTimeout(t);
  }, [done]);

  const onPasswordChange = (e) => {
    const { value, notice } = typePassword(e.target.value);
    setValues((v) => ({ ...v, password: value }));
    setNotices((n) => ({ ...n, password: notice }));
    setErrors((er) => ({
      ...er,
      ...(er.password ? { password: passwordProblem(value) || undefined } : {}),
      ...(er.confirm ? { confirm: confirmProblem(value, values.confirm) || undefined } : {}),
    }));
    setServerError('');
  };

  const onConfirmChange = (e) => {
    const { value, notice } = typePassword(e.target.value);
    // As many characters as the password, but different: already a mismatch
    const mismatch = value.length >= values.password.length && value !== values.password;
    setValues((v) => ({ ...v, confirm: value }));
    setNotices((n) => ({ ...n, confirm: notice || (mismatch ? 'Passwords do not match.' : '') }));
    if (errors.confirm) {
      setErrors((er) => ({ ...er, confirm: confirmProblem(values.password, value) || undefined }));
    }
    setServerError('');
  };

  const onBlur = (name) => () => {
    setNotices((n) => ({ ...n, [name]: '' }));
    const value = values[name];
    if (!value) return;
    const problem =
      name === 'password' ? passwordProblem(value) : confirmProblem(values.password, value);
    setErrors((er) => ({ ...er, [name]: problem || undefined }));
  };

  const shown = (name) => notices[name] || errors[name];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;

    const found = {};
    const pwProblem = passwordProblem(values.password);
    const cfProblem = confirmProblem(values.password, values.confirm);
    if (pwProblem) found.password = pwProblem;
    if (cfProblem) found.confirm = cfProblem;
    setNotices({});
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    setServerError('');
    try {
      const { data } = await api.post('/user/password', {
        newPassword: values.password,
        confirmPassword: values.confirm,
      });

      const saved = data.user || { hasPassword: true };
      if (typeof updateUser === 'function') updateUser(saved);
      else if (typeof setUser === 'function') setUser({ ...user, ...saved });

      sessionStorage.removeItem(SNOOZE_KEY);
      setValues(EMPTY);
      setStep('prompt');
      setDone(true);
    } catch (err) {
      const field = err.response?.data?.field;
      const message = errMsg(err);
      if (field === 'newPassword') setErrors({ password: message });
      else if (field === 'confirmPassword') setErrors({ confirm: message });
      else setServerError(message);
    } finally {
      setBusy(false);
    }
  };

  const eye = (name) => (
    <button
      type="button"
      className="psp-eye"
      aria-label={visible[name] ? 'Hide password' : 'Show password'}
      onClick={() => setVisible((v) => ({ ...v, [name]: !v[name] }))}
    >
      <i className={`bi ${visible[name] ? 'bi-eye-slash' : 'bi-eye'}`}></i>
    </button>
  );

  return (
    <>
      {open && step === 'prompt' && (
        <div className="psp-overlay">
          <div
            className="psp-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="psp-prompt-title"
          >
            <div className="psp-icon">
              <i className="bi bi-shield-lock"></i>
            </div>
            <h3 className="psp-title" id="psp-prompt-title">
              Set an account password?
            </h3>
            <p className="psp-desc">
              You signed up with Google, so your account has no password yet. Adding one lets you
              sign in with your email and password too, in case Google sign-in is ever turned off
              or unavailable.
            </p>
            <p className="psp-desc psp-desc-sub">
              This is optional. We will remind you each time you sign in until you set one.
            </p>

            <div className="psp-actions">
              <button type="button" className="psp-btn psp-btn-secondary" onClick={snooze}>
                Remind me later
              </button>
              <button
                type="button"
                className="psp-btn psp-btn-primary"
                onClick={() => setStep('form')}
                autoFocus
              >
                Set up now
              </button>
            </div>
          </div>
        </div>
      )}

      {open && step === 'form' && (
        <div className="psp-overlay">
          <div
            className="psp-card psp-card-form"
            role="dialog"
            aria-modal="true"
            aria-labelledby="psp-form-title"
          >
            <h3 className="psp-title psp-title-left" id="psp-form-title">
              Create your password
            </h3>
            <p className="psp-desc psp-desc-left">
              Use at least 8 characters with a letter and a number.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className={`psp-field${shown('password') ? ' has-error' : ''}`}>
                <label htmlFor="psp-password">New password</label>
                <div className="psp-input-wrap">
                  <input
                    id="psp-password"
                    type={visible.password ? 'text' : 'password'}
                    className="psp-input"
                    placeholder="8+ characters, letter & number"
                    autoComplete="new-password"
                    value={values.password}
                    onChange={onPasswordChange}
                    onBlur={onBlur('password')}
                    autoFocus
                  />
                  {eye('password')}
                </div>
                <PasswordStrength password={values.password} />
                {shown('password') && (
                  <span className="psp-error" role="alert">
                    {shown('password')}
                  </span>
                )}
              </div>

              <div className={`psp-field${shown('confirm') ? ' has-error' : ''}`}>
                <label htmlFor="psp-confirm">Confirm password</label>
                <div className="psp-input-wrap">
                  <input
                    id="psp-confirm"
                    type={visible.confirm ? 'text' : 'password'}
                    className="psp-input"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    value={values.confirm}
                    onChange={onConfirmChange}
                    onBlur={onBlur('confirm')}
                  />
                  {eye('confirm')}
                </div>
                {shown('confirm') && (
                  <span className="psp-error" role="alert">
                    {shown('confirm')}
                  </span>
                )}
              </div>

              {serverError && (
                <div className="psp-server-error" role="alert">
                  <strong>Could not save your password</strong>
                  <p>{serverError}</p>
                </div>
              )}

              <div className="psp-actions psp-actions-form">
                <button
                  type="button"
                  className="psp-btn psp-btn-secondary"
                  onClick={() => setStep('prompt')}
                  disabled={busy}
                >
                  Back
                </button>
                <button type="submit" className="psp-btn psp-btn-primary" disabled={busy}>
                  {busy ? 'Saving...' : 'Save password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {done && (
        <div className="psp-toast" role="status">
          <i className="bi bi-check-circle-fill"></i>
          <span>Your password was saved. You can now sign in with your email and password.</span>
          <button type="button" onClick={() => setDone(false)} aria-label="Dismiss">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}
    </>
  );
}
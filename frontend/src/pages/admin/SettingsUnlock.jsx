import React, { useState } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../../styles/admin/Dashboard.css';
import '../../styles/admin/SystemSettings.css';

const API = import.meta.env.VITE_API_URL || '';

const post = async (path, body) => {
  const res = await fetch(`${API}/api/admin/settings/unlock/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionStorage.getItem('token')}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
};

export default function SettingsUnlock({ onUnlock }) {
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn) => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitCredentials = (e) => {
    e.preventDefault();
    if (!email.trim() || !pin) return setError('Enter the SU email and PIN.');
    run(async () => {
      const data = await post('start', { email: email.trim(), pin });
      if (data.otpRequired) {
        setPin('');
        setStep('otp');
      } else {
        onUnlock(data.token);
      }
    });
  };

  const submitOtp = (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) return setError('Enter the 6-digit code.');
    run(async () => {
      const data = await post('verify', { otp: otp.trim() });
      onUnlock(data.token);
    });
  };

  return (
    <div className="dashboard ss-page">
      <div className="db-section-card ss-card ss-unlock">
        <div className="ss-card-head">
          <div className="db-stat-icon-circle ss-card-icon">
            <i className="bi bi-lock" aria-hidden="true"></i>
          </div>
          <div className="ss-card-headtext">
            <h2 className="ss-card-title">System settings are locked</h2>
            <p className="ss-card-sub">
              {step === 'credentials'
                ? 'Enter the SU email and PIN to continue.'
                : 'We sent a 6-digit code to the SU email. Enter it below.'}
            </p>
          </div>
        </div>

        {step === 'credentials' ? (
          <form onSubmit={submitCredentials} noValidate>
            <div className="ss-card-body">
              <div className="ss-field">
                <label htmlFor="su-email">SU email</label>
                <input
                  id="su-email"
                  type="email"
                  autoComplete="off"
                  className="ss-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="supply.superuser@buksu.edu.ph"
                  spellCheck={false}
                  autoFocus
                />
              </div>
              <div className="ss-field">
                <label htmlFor="su-pin">SU PIN</label>
                <div className="ss-input-wrap">
                  <input
                    id="su-pin"
                    type={showPin ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="ss-input ss-input-secret"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter PIN"
                  />
                  <button
                    type="button"
                    className="ss-eye"
                    onClick={() => setShowPin((s) => !s)}
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    <i className={`bi ${showPin ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="db-error-box ss-error ss-card-error" role="alert">
                <strong>Could not unlock</strong>
                <p>{error}</p>
              </div>
            )}

            <div className="ss-card-foot">
              <button type="submit" className="db-btn-primary" disabled={busy}>
                {busy ? 'Checking...' : 'Continue'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitOtp} noValidate>
            <div className="ss-card-body">
              <div className="ss-field">
                <label htmlFor="su-otp">Verification code</label>
                <input
                  id="su-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className="ss-input"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  autoFocus
                />
                <span className="ss-hint">The code expires in 10 minutes.</span>
              </div>
            </div>

            {error && (
              <div className="db-error-box ss-error ss-card-error" role="alert">
                <strong>Could not unlock</strong>
                <p>{error}</p>
              </div>
            )}

            <div className="ss-card-foot">
              <button
                type="button"
                className="db-btn-secondary"
                onClick={() => {
                  setError('');
                  setOtp('');
                  setStep('credentials');
                }}
                disabled={busy}
              >
                Back
              </button>
              <button type="submit" className="db-btn-primary" disabled={busy}>
                {busy ? 'Checking...' : 'Unlock'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function TwoFactorSetup() {
  const { user, updateUser } = useAuth();
  const [setup, setSetup] = useState(null);   // { qr, secret }
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState(null); // shown once
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  if (user?.role !== 'Administrator') return null;

  const fail = (err) => setMsg({ type: 'error', text: errMsg(err) });

  const start = async () => {
    setBusy(true);
    setMsg({ type: '', text: '' });
    try {
      setSetup((await api.post('/auth/2fa/setup')).data);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/auth/2fa/enable', { code: code.trim() });
      setBackup(res.data.backupCodes);
      setSetup(null);
      setCode('');
      setMsg({ type: '', text: '' });
      updateUser({ twoFactorEnabled: true });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/2fa/disable', { code: code.trim() });
      setCode('');
      setBackup(null);
      setMsg({ type: 'success', text: 'Two-step verification is off.' });
      updateUser({ twoFactorEnabled: false });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const codeInput = (
    <input
      className="pf-input"
      value={code}
      onChange={(e) => setCode(e.target.value)}
      inputMode="numeric"
      maxLength={10}
      placeholder="6-digit code"
      autoComplete="one-time-code"
      required
    />
  );

  return (
    <section className="profile-section">
      <h2 className="profile-section-label">Two-Step Verification</h2>

      <div className="profile-card pf-2fa">
        {backup && (
          <div className="pf-2fa-backup">
            <p>
              <strong>Save these backup codes now.</strong> Each works once, and they won&apos;t be
              shown again.
            </p>
            <pre>{backup.join('\n')}</pre>
          </div>
        )}

        {!user.twoFactorEnabled && !setup && (
          <>
            <p className="pf-2fa-text">
              Add a second step to your sign-in using an authenticator app such as Google
              Authenticator.
            </p>
            <div className="pf-actions">
              <button type="button" className="pf-btn brown" onClick={start} disabled={busy}>
                <i className="bi bi-shield-lock"></i> Turn on
              </button>
            </div>
          </>
        )}

        {setup && (
          <form onSubmit={confirm} className="pf-2fa-form">
            <p className="pf-2fa-text">1. Scan this QR code with your authenticator app.</p>
            <img src={setup.qr} alt="Two-step verification QR code" width="180" height="180" />
            <p className="pf-2fa-text">
              Can&apos;t scan? Enter this key manually: <code>{setup.secret}</code>
            </p>
            <p className="pf-2fa-text">2. Type the 6-digit code the app shows.</p>
            {codeInput}
            <div className="pf-actions">
              <button
                type="button"
                className="pf-btn outline"
                onClick={() => { setSetup(null); setCode(''); }}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" className="pf-btn brown" disabled={busy}>
                {busy ? 'Checking...' : 'Confirm'}
              </button>
            </div>
          </form>
        )}

        {user.twoFactorEnabled && (
          <form onSubmit={turnOff} className="pf-2fa-form">
            <p className="pf-2fa-text">
              Two-step verification is <strong>on</strong>. To turn it off, enter a current code.
            </p>
            {codeInput}
            <div className="pf-actions">
              <button type="submit" className="pf-btn outline" disabled={busy}>
                Turn off
              </button>
            </div>
          </form>
        )}

        {msg.text && (
          <p className={`pf-2fa-msg ${msg.type}`} role="status">{msg.text}</p>
        )}
      </div>
    </section>
  );
}
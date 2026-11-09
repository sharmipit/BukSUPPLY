import React, { useState } from 'react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function TwoFactorSetup() {
  const { user, updateUser } = useAuth();
  const [setup, setSetup] = useState(null);   // { qr, secret }
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState(null); // shown once
  const [msg, setMsg] = useState('');

  const start = async () => {
    try { setMsg(''); setSetup((await api.post('/auth/2fa/setup')).data); }
    catch (err) { setMsg(errMsg(err)); }
  };

  const confirm = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/2fa/enable', { code });
      setBackup(res.data.backupCodes);
      setSetup(null); setCode('');
      updateUser({ twoFactorEnabled: true });
    } catch (err) { setMsg(errMsg(err)); }
  };

  const turnOff = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/2fa/disable', { code });
      setCode(''); setMsg('Two-step verification is off.');
      updateUser({ twoFactorEnabled: false });
    } catch (err) { setMsg(errMsg(err)); }
  };

  if (user?.role !== 'Administrator') return null;

  return (
    <section className="profile-card">
      <h3>Two-Step Verification</h3>

      {backup && (
        <div>
          <p><strong>Save these backup codes now.</strong> Each works once, and they won't be shown again.</p>
          <pre>{backup.join('\n')}</pre>
        </div>
      )}

      {!user.twoFactorEnabled && !setup && (
        <button type="button" className="pf-btn brown" onClick={start}>Turn on</button>
      )}

      {setup && (
        <form onSubmit={confirm}>
          <p>1. Scan this with Google Authenticator.</p>
          <img src={setup.qr} alt="2FA QR code" width="180" />
          <p>Can't scan? Enter this key manually: <code>{setup.secret}</code></p>
          <p>2. Type the 6-digit code it shows.</p>
          <input className="pf-input" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" required />
          <button type="submit" className="pf-btn brown">Confirm</button>
        </form>
      )}

      {user.twoFactorEnabled && (
        <form onSubmit={turnOff}>
          <p>Two-step verification is <strong>on</strong>. To turn it off, enter a current code.</p>
          <input className="pf-input" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" required />
          <button type="submit" className="pf-btn outline">Turn off</button>
        </form>
      )}

      {msg && <p>{msg}</p>}
    </section>
  );
}
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { DEACTIVATED_EVENT } from '../api/client';
import '../styles/DeactivatedNotice.css';

// Mounted once inside the layout. The API client (api/client.js) fires an event as soon as any
// request fails because the account was deactivated. This shows a notice that cannot be dismissed:
// the only way out is to go back to the sign-in page.
export default function DeactivatedNotice() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [info, setInfo] = useState(null);

  // Listen for the event from the API client (only the first one is used)
  useEffect(() => {
    const onDeactivated = (e) => setInfo((current) => current || e.detail || {});
    window.addEventListener(DEACTIVATED_EVENT, onDeactivated);
    return () => window.removeEventListener(DEACTIVATED_EVENT, onDeactivated);
  }, []);

  // Check again when the person returns to the tab, so a deactivation is noticed right away.
  // The notification bell already polls every 30 seconds, which covers the rest of the time.
  useEffect(() => {
    if (info) return undefined;
    const check = () => {
      if (document.visibilityState === 'visible') {
        api.get('/notifications').catch(() => {}); // the API client does the detecting
      }
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [info]);

  // While the notice is open, the page behind it cannot scroll
  useEffect(() => {
    if (!info) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [info]);

  if (!info) return null;

  const reason = info.deactivation?.reason || info.reason || '';

  const handleContinue = () => {
    logout();
    navigate('/signin', { replace: true });
  };

  return (
    <div className="da-overlay" role="alertdialog" aria-modal="true" aria-labelledby="da-title">
      <div className="da-card">
        <div className="da-icon">
          <i className="bi bi-person-x"></i>
        </div>
        <h2 className="da-title" id="da-title">
          Account deactivated
        </h2>
        <p className="da-desc">
          An administrator has deactivated your <strong>BukSUPPLY</strong> account, so you can no
          longer use the system. Sign in again to see the details or to request reactivation.
        </p>

        {reason && (
          <div className="da-reason">
            <span className="da-reason-label">Reason from the administrator</span>
            <p>{reason}</p>
          </div>
        )}

        <button type="button" className="da-btn" onClick={handleContinue} autoFocus>
          Back to Sign In
        </button>
      </div>
    </div>
  );
}
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/NotificationDetailsModal.css';

// Label and icon for each notification type
const TYPE_META = {
  success: { label: 'Success', icon: 'bi-check-circle-fill' },
  info: { label: 'Information', icon: 'bi-bell-fill' },
  warning: { label: 'Alert', icon: 'bi-exclamation-triangle-fill' },
};

// Pages each role can open, keyed by the part of the path after /user, /staff or /admin
const BASE_OF = { Administrator: '/admin', Admin: '/admin', Moderator: '/staff' };
const PAGES = {
  '/user': {
    '/requests': 'Item Request',
    '/history': 'Request History',
    '/notifications': 'Notifications',
    '/activity': 'Activity Log',
    '/profile': 'Profile',
    '/help': 'Help & Support',
  },
  '/staff': {
    '/requests': 'Requests',
    '/inventory': 'Inventory',
    '/reports-logs': 'System Reports',
    '/notifications': 'Notifications',
    '/activity': 'Activity Log',
    '/profile': 'Profile',
  },
  '/admin': {
    '/requests': 'Requests',
    '/inventory': 'Inventory',
    '/users': 'User Management',
    '/reports-logs': 'System Reports',
    '/settings': 'System Settings',
    '/notifications': 'Notifications',
    '/activity': 'Activity Log',
    '/profile': 'Profile',
  },
};

// Notifications saved earlier may point to another role's route tree (for example /staff/inventory
// for an administrator). This maps the link onto the signed-in user's own routes, so the button
// never lands on the wrong layout or gets bounced to the dashboard.
function resolveLink(link, role) {
  if (!link) return null;
  const base = BASE_OF[role] || '/user';
  const pages = PAGES[base];

  const match = String(link).match(/^\/(user|staff|admin)(\/[^?#]*)?/);
  if (!match) return { to: link, label: 'Related page' };

  const rest = (match[2] || '').replace(/\/+$/, '');
  if (rest && pages[rest]) return { to: `${base}${rest}`, label: pages[rest] };
  return { to: base, label: 'Dashboard' };
}

// Shows the full details of one notification.
// Props: notification (object from /api/notifications), onClose, onDelete (optional)
export default function NotificationDetailsModal({ notification, onClose, onDelete }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Close on Escape and stop the page behind from scrolling
  useEffect(() => {
    if (!notification) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [notification, onClose]);

  if (!notification) return null;

  const meta = TYPE_META[notification.type] || TYPE_META.info;
  const target = resolveLink(notification.link, user?.role);
  const linkLabel = target ? target.label : '';

  const goToLink = () => {
    onClose();
    navigate(target.to);
  };

  return createPortal(
    <div
      className="nd-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nd-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="nd-card">
        <div className="nd-header">
          <div className="nd-header-main">
            <span className={`nd-icon ${notification.type}`}>
              <i className={`bi ${meta.icon}`}></i>
            </span>
            <div className="nd-header-text">
              <h3 className="nd-title" id="nd-title">
                Notification Details
              </h3>
              <p className="nd-subtitle">Full message and information about this alert.</p>
            </div>
          </div>
          <button type="button" className="nd-close" aria-label="Close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="nd-body">
          <div className="nd-grid">
            <div className="nd-field">
              <span className="nd-label">Type</span>
              <span className={`nd-chip ${notification.type}`}>{meta.label}</span>
            </div>
            <div className="nd-field">
              <span className="nd-label">Received</span>
              <span className="nd-value">{notification.date || '-'}</span>
            </div>
            {linkLabel && (
              <div className="nd-field nd-field-wide">
                <span className="nd-label">Related page</span>
                <span className="nd-value">{linkLabel}</span>
              </div>
            )}
          </div>

          <div className="nd-section">
            <span className="nd-label">Subject</span>
            <div className="nd-box">
              <p className="nd-text nd-strong">{notification.title || '-'}</p>
            </div>
          </div>

          <div className="nd-section">
            <span className="nd-label">Message</span>
            <div className="nd-box">
              <p className="nd-text">{notification.message || '-'}</p>
            </div>
          </div>
        </div>

        <div className="nd-footer">
          {onDelete && (
            <button
              type="button"
              className="nd-btn nd-btn-danger"
              onClick={() => onDelete(notification)}
            >
              <i className="bi bi-trash3"></i> Delete
            </button>
          )}
          <button type="button" className="nd-btn nd-btn-secondary" onClick={onClose}>
            Close
          </button>
          {target && (
            <button type="button" className="nd-btn nd-btn-primary" onClick={goToLink}>
              Go to {linkLabel} <i className="bi bi-arrow-right"></i>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import '../styles/NotificationsModal.css';

// How many of the latest notifications the popup shows. The rest are on the full page.
const MAX_SHOWN = 8;

/**
 * Bell button + notifications popup for the top bar.
 * `base` is the role's base path ('/user', '/staff' or '/admin'),
 * used for the "View all notifications" link.
 */
export default function NotificationsModal({ base }) {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const wrapRef = useRef(null);
  const panelRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const shown = notifications.slice(0, MAX_SHOWN);

  const load = useCallback(
    (first) =>
      api
        .get('/notifications')
        .then((res) => {
          setNotifications(res.data.notifications || []);
          setError('');
        })
        .catch((err) => {
          if (first) setError(errMsg(err)); // background refresh failures stay silent
        })
        .finally(() => {
          if (first) setLoading(false);
        }),
    []
  );

  // Loads on mount, then quietly re-checks every 30 seconds so the badge stays current
  useEffect(() => {
    load(true);
    const timer = setInterval(() => load(false), 30000);
    return () => clearInterval(timer);
  }, [load]);

  const toggle = () => {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + 10,
        right: Math.max(12, document.documentElement.clientWidth - r.right),
      });
      load(false); // refresh when opening
    }
    setOpen((o) => !o);
  };

  // Close on outside click, Escape, resize, or page scroll
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onMouseDown = (e) => {
      const inTrigger = wrapRef.current && wrapRef.current.contains(e.target);
      const inPanel = panelRef.current && panelRef.current.contains(e.target);
      if (!inTrigger && !inPanel) close();
    };
    const onKey = (e) => e.key === 'Escape' && close();
    const onScroll = (e) => {
      // Scrolling the list inside the popup should not close it
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      close();
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  // The screen updates immediately; the server call saves it in the background
  const handleMarkAsRead = (id) => {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    api.patch(`/notifications/${id}/read`).catch(() => {});
  };

  const handleMarkAllAsRead = () => {
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
    api.patch('/notifications/read-all').catch(() => {});
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate(`${base}/notifications`);
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div className="np-empty">
          <div className="np-empty-icon">
            <i className="bi bi-hourglass-split"></i>
          </div>
          <h4>Loading...</h4>
          <p>Fetching your notifications.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="np-empty">
          <div className="np-empty-icon">
            <i className="bi bi-exclamation-circle"></i>
          </div>
          <h4>Could not load notifications</h4>
          <p>{error}</p>
        </div>
      );
    }

    if (shown.length === 0) {
      return (
        <div className="np-empty">
          <div className="np-empty-icon">
            <i className="bi bi-bell-slash"></i>
          </div>
          <h4>No notifications</h4>
          <p>You're all caught up!</p>
        </div>
      );
    }

    return shown.map((notif) => (
      <button
        type="button"
        key={notif.id}
        className={`np-item ${notif.read ? 'read' : 'unread'}`}
        onClick={() => !notif.read && handleMarkAsRead(notif.id)}
      >
        <span className={`np-item-icon ${notif.type}`}>
          {notif.type === 'success' && <i className="bi bi-check-circle-fill"></i>}
          {notif.type === 'info' && <i className="bi bi-bell-fill"></i>}
          {notif.type === 'warning' && <i className="bi bi-exclamation-triangle-fill"></i>}
        </span>

        <span className="np-item-content">
          <span className="np-item-top">
            <span className="np-item-title">{notif.title}</span>
            {!notif.read && <span className="np-unread-dot"></span>}
          </span>
          <span className="np-item-message">{notif.message}</span>
          <span className="np-item-date">{notif.date}</span>
        </span>
      </button>
    ));
  };

  return (
    <div className="np-wrap" ref={wrapRef}>
      <button
        type="button"
        className="icon-btn bell np-bell"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <i className="bi bi-bell"></i>
        {unreadCount > 0 && (
          <span className="np-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open &&
        createPortal(
          <div className="np-panel" style={pos} role="dialog" aria-label="Notifications" ref={panelRef}>
            <div className="np-header">
              <div>
                <h3 className="np-title">Notifications</h3>
                <span className="np-sub">
                  {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
                </span>
              </div>
              {unreadCount > 0 && (
                <button type="button" className="np-mark-all" onClick={handleMarkAllAsRead}>
                  <i className="bi bi-check2"></i> Mark all as read
                </button>
              )}
            </div>

            <div className="np-list">{renderBody()}</div>

            <button type="button" className="np-footer" onClick={handleViewAll}>
              View all notifications <i className="bi bi-arrow-right"></i>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
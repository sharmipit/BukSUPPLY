import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import NotificationDetailsModal from './NotificationDetailsModal';
import '../styles/NotificationsModal.css';

const MAX_SHOWN = 8;

export default function NotificationsModal({ base }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // The notification whose full details are shown (stored by id so it stays current)
  const [selectedId, setSelectedId] = useState(null);

  const wrapRef = useRef(null);
  const panelRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const shown = notifications.slice(0, MAX_SHOWN);
  const selected = notifications.find((n) => n.id === selectedId) || null;

  const load = useCallback(
    (first) =>
      api
        .get('/notifications')
        .then((res) => {
          setNotifications(res.data.notifications || []);
          setError('');
        })
        .catch((err) => {
          if (first) setError(errMsg(err));
        })
        .finally(() => {
          if (first) setLoading(false);
        }),
    []
  );

  useEffect(() => {
    load(true);
    const timer = setInterval(() => load(false), 30000);
    return () => clearInterval(timer);
  }, [load]);

  const toggle = () => {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const top = r.bottom + 10;
      // Never wider than the screen (minus a 12px margin on each side)
      const width = Math.min(400, vw - 24);
      // Line it up under the bell, but never push it past the left or right edge
      const right = Math.max(12, Math.min(vw - r.right, vw - width - 12));
      setPos({
        top,
        right,
        width,
        maxHeight: Math.max(220, window.innerHeight - top - 12),
      });
      load(false);
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // On phones the address bar showing/hiding fires "resize" with the same width,
    // so only close when the width really changes (rotation, window resize)
    let lastWidth = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth !== lastWidth) close();
    };
    const onMouseDown = (e) => {
      const inTrigger = wrapRef.current && wrapRef.current.contains(e.target);
      const inPanel = panelRef.current && panelRef.current.contains(e.target);
      if (!inTrigger && !inPanel) close();
    };
    const onKey = (e) => e.key === 'Escape' && close();
    const onScroll = (e) => {

      if (panelRef.current && panelRef.current.contains(e.target)) return;
      close();
    };

    const onLinkClick = (e) => {
      const inPanel = panelRef.current && panelRef.current.contains(e.target);
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (inPanel && link) setTimeout(close, 0);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onLinkClick, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onLinkClick, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const handleMarkAsRead = (id) => {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    api.patch(`/notifications/${id}/read`).catch(() => {});
  };

  const handleMarkAllAsRead = () => {
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
    api.patch('/notifications/read-all').catch(() => {});
  };

  // Clicking a notification closes the popup, opens its details, and marks it as read
  const openDetails = (notif) => {
    if (!notif.read) handleMarkAsRead(notif.id);
    setOpen(false);
    setSelectedId(notif.id);
  };

  const handleDelete = (notif) => {
    setSelectedId(null);
    setNotifications((list) => list.filter((n) => n.id !== notif.id));
    api.delete(`/notifications/${notif.id}`).catch(() => {});
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
        onClick={() => openDetails(notif)}
        aria-label={`View details of ${notif.title}`}
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

            <Link to={`${base}/notifications`} className="np-footer">
              View all notifications <i className="bi bi-arrow-right"></i>
            </Link>
          </div>,
          document.body
        )}

      {/* Notification details modal (renders in document.body, so it works while the popup is closed) */}
      <NotificationDetailsModal
        notification={selected}
        onClose={() => setSelectedId(null)}
        onDelete={handleDelete}
      />
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import api, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ClearNotificationsModal from '../../components/ClearNotificationsModal';
import '../../styles/user/Notifications.css';

export default function Notifications() {
  useEffect(() => {
    document.title = 'Notifications | BukSUPPLY';
  }, []);

  const { user } = useAuth();
  const isStaff = ['Moderator', 'Administrator'].includes(user?.role);

  // Real notifications from the API (replaces the old hardcoded array)
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterTab, setFilterTab] = useState('All');
  const [clearModalOpen, setClearModalOpen] = useState(false);

  // Loads on open, then quietly re-checks every 30 seconds for new alerts
  useEffect(() => {
    const load = (first) =>
      api.get('/notifications')
        .then((res) => {
          setNotifications(res.data.notifications);
          setError('');
        })
        .catch((err) => {
          if (first) setError(errMsg(err)); // background refresh failures stay silent
        })
        .finally(() => {
          if (first) setLoading(false);
        });

    load(true);
    const timer = setInterval(() => load(false), 30000);
    return () => clearInterval(timer);
  }, []);

  // Filter logic
  const filteredNotifications = notifications.filter((notif) => {
    if (filterTab === 'Unread') return !notif.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  // The screen updates immediately; the server call saves it in the background
  const handleMarkAsRead = (id) => {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    api.patch(`/notifications/${id}/read`).catch(() => {});
  };

  const handleMarkAllAsRead = () => {
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
    api.patch('/notifications/read-all').catch(() => {});
  };

  const handleDeleteNotification = (e, id) => {
    e.stopPropagation();
    setNotifications((list) => list.filter((n) => n.id !== id));
    api.delete(`/notifications/${id}`).catch(() => {});
  };

  const handleConfirmClearAll = () => {
    setNotifications([]);
    setClearModalOpen(false);
    api.delete('/notifications').catch(() => {});
  };

  return (
    <div className="notifications-container">
      {/* Top Banner Header */}
      <div className="hub-header-card">
        <div>
          <h1 className="hub-title">Notifications</h1>
          <p className="hub-subtitle">
            {isStaff ? (
              'Get alerted when new requisitions are filed and need your review.'
            ) : (
              <>
                Stay updated with real-time alerts regarding your requisition approvals, window pickups,
                <br />
                and administrative announcements.
              </>
            )}
          </p>
        </div>
        <div className="header-actions-group">
          {unreadCount > 0 && (
            <button
              className="btn-mark-all"
              onClick={handleMarkAllAsRead}
              title="Mark all notifications as read"
            >
              <i className="bi bi-check2"></i> Mark All as Read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              className="btn-clear-notifs"
              onClick={() => setClearModalOpen(true)}
              title="Clear all notifications"
            >
              <i className="bi bi-trash3"></i> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="hub-filter-bar">
        <div className="status-filter-tabs">
          <button
            className={`filter-tab-btn ${filterTab === 'All' ? 'active' : ''}`}
            onClick={() => setFilterTab('All')}
          >
            All Notifications ({notifications.length})
          </button>
          <button
            className={`filter-tab-btn ${filterTab === 'Unread' ? 'active' : ''}`}
            onClick={() => setFilterTab('Unread')}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {/* Notifications List Card */}
      <div className="dashboard-section-card">
        <div className="notifications-list-wrapper">
          {loading ? (
            <div className="empty-state-container">
              <div className="empty-icon-circle">
                <i className="bi bi-hourglass-split"></i>
              </div>
              <h4>Loading...</h4>
              <p>Fetching your notifications.</p>
            </div>
          ) : error ? (
            <div className="empty-state-container">
              <div className="empty-icon-circle">
                <i className="bi bi-exclamation-circle"></i>
              </div>
              <h4>Could not load notifications</h4>
              <p>{error}</p>
            </div>
          ) : filteredNotifications.length > 0 ? (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`notification-item-card ${notif.read ? 'read' : 'unread'}`}
                onClick={() => !notif.read && handleMarkAsRead(notif.id)}
              >
                <div className={`notif-icon-badge ${notif.type}`}>
                  {notif.type === 'success' && <i className="bi bi-check-circle-fill"></i>}
                  {notif.type === 'info' && <i className="bi bi-bell-fill"></i>}
                  {notif.type === 'warning' && <i className="bi bi-exclamation-triangle-fill"></i>}
                </div>

                <div className="notif-content-area">
                  <div className="notif-header-row">
                    <h4 className="notif-title">
                      {notif.title}
                      {!notif.read && <span className="unread-dot-indicator"></span>}
                    </h4>
                    <span className="notif-date">{notif.date}</span>
                  </div>
                  <p className="notif-message">{notif.message}</p>
                </div>

                <div className="notif-actions">
                  {!notif.read && (
                    <button
                      className="btn-icon-action"
                      onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notif.id); }}
                      title="Mark as read"
                    >
                      <i className="bi bi-check"></i>
                    </button>
                  )}
                  <button
                    className="btn-icon-action delete"
                    onClick={(e) => handleDeleteNotification(e, notif.id)}
                    title="Delete notification"
                  >
                    <i className="bi bi-trash3"></i>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state-container">
              <div className="empty-icon-circle">
                <i className="bi bi-bell-slash"></i>
              </div>
              <h4>No Notifications Found</h4>
              <p>You're all caught up! There are no alerts matching your current filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* Clear All Notifications Confirmation Modal */}
      <ClearNotificationsModal
        isOpen={clearModalOpen}
        title="Clear All Notifications?"
        message="Are you sure you want to delete all your notifications? This action cannot be undone."
        onConfirm={handleConfirmClearAll}
        onClose={() => setClearModalOpen(false)}
      />
    </div>
  );
}
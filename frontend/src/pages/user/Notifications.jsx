import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import ClearNotificationsModal from '../../components/ClearNotificationsModal';
import '../../styles/user/Notifications.css';

export default function Notifications() {
  const { user } = useAuth();

  // Dummy notifications state matching BukSUPPLY system events
  const [notifications, setNotifications] = useState([
    {
      id: 'NOTIF-01',
      title: 'Requisition Approved & Ready',
      message: 'Your requisition slip REQ-2026-092 for "Markers replenishment" has been approved by the moderator. Please proceed to Property Window 1 for pickup.',
      date: '2026-10-09 10:30 AM',
      read: false,
      type: 'success', // success, info, warning
      link: '/user/requests'
    },
    {
      id: 'NOTIF-02',
      title: 'New Status Update: Pending',
      message: 'Your requisition slip REQ-2026-089 has been successfully submitted and is currently awaiting moderator review.',
      date: '2026-10-05 02:15 PM',
      read: false,
      type: 'info',
      link: '/user/requests'
    },
    {
      id: 'NOTIF-03',
      title: 'Requisition Denied',
      message: 'Your requisition slip REQ-2026-061 was denied. Reason: Out of stock inventory category. You can click "Request Again" in the Requisition Hub.',
      date: '2026-09-15 04:00 PM',
      read: true,
      type: 'warning',
      link: '/user/requests'
    },
    {
      id: 'NOTIF-04',
      title: 'Item Issued Successfully',
      message: 'Requisition slip REQ-2026-012 has been marked as claimed and archived to your request history.',
      date: '2026-08-22 11:00 AM',
      read: true,
      type: 'success',
      link: '/user/history'
    }
  ]);

  const [filterTab, setFilterTab] = useState('All'); // 'All' or 'Unread'
  const [clearModalOpen, setClearModalOpen] = useState(false);

  // Filter logic
  const filteredNotifications = notifications.filter(notif => {
    if (filterTab === 'Unread') return !notif.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id) => {
    // BACKEND DEV NOTE: Make API PUT call to mark single notification as read: PUT /api/user/notifications/:id/read
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllAsRead = () => {
    // BACKEND DEV NOTE: Make API PUT call to mark all notifications as read: PUT /api/user/notifications/read-all
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const handleDeleteNotification = (e, id) => {
    e.stopPropagation(); 
    // BACKEND DEV NOTE: Make API DELETE call: DELETE /api/user/notifications/:id
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const handleConfirmClearAll = () => {
    // BACKEND DEV NOTE: Make API DELETE call: DELETE /api/user/notifications
    setNotifications([]);
    setClearModalOpen(false);
  };

  return (
    <div className="notifications-container">
      {/* Top Banner Header */}
      <div className="hub-header-card">
        <div>
          <h1 className="hub-title">Notifications</h1>
          <p className="hub-subtitle">
            Stay updated with real-time alerts regarding your requisition approvals, window pickups, and administrative announcements.
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
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`notification-item-card ${notif.read ? 'read' : 'unread'}`}
                onClick={() => handleMarkAsRead(notif.id)}
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
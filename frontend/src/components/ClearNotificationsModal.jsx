import React, { useState } from 'react';
import '../styles/ClearNotificationsModal.css';

export default function ClearNotificationsModal({ isOpen, title, message, onConfirm, onClose }) {
  const [showToast, setShowToast] = useState(false);

  if (!isOpen) return null;

  const handleClearClick = () => {
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      onConfirm();
    }, 1500);
  };

  return (
    <div className={`cn-overlay ${isOpen ? 'active' : ''}`} role="dialog" aria-modal="true">
      {/* Toast Notification Container */}
      <div className={`cn-toast-notification ${showToast ? 'show' : ''}`}>
        <i className="bi bi-trash3-fill"></i>
        <span>All notifications successfully cleared!</span>
      </div>

      <div className="cn-card">
        <div className="cn-icon danger">
          <i className="bi bi-trash3"></i>
        </div>
        <h2 className="cn-title">{title || "Clear All Notifications?"}</h2>
        <p className="cn-desc">
          {message || "Are you sure you want to delete all your notifications? This action cannot be undone."}
        </p>
        <div className="cn-actions">
          <button type="button" className="cn-btn cn-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="cn-btn cn-btn-confirm" onClick={handleClearClick}>
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import '../styles/ClearHistoryModal.css';

export default function ClearHistoryModal({ isOpen, title, message, onConfirm, onClose }) {
  const [showToast, setShowToast] = useState(false);

  if (!isOpen) return null;

  const handleClearClick = () => {
    // Show toast notification
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
      onConfirm();
    }, 1500);
  };

  return (
    <div className={`ch-overlay ${isOpen ? 'active' : ''}`} role="dialog" aria-modal="true">
      {/* Toast Notification Container positioned at top of viewport */}
      <div className={`ch-toast-notification ${showToast ? 'show' : ''}`}>
        <i className="bi bi-trash3-fill"></i>
        <span>Transaction history successfully cleared!</span>
      </div>

      <div className="ch-card">
        <div className="ch-icon danger">
          <i className="bi bi-trash3"></i>
        </div>
        <h2 className="ch-title">{title || "Clear History Archive?"}</h2>
        <p className="ch-desc">
          {message || "Are you sure you want to clear your complete transaction history? This action cannot be undone and all logs will be removed."}
        </p>
        <div className="ch-actions">
          <button type="button" className="ch-btn ch-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ch-btn ch-btn-confirm" onClick={handleClearClick}>
            Clear History
          </button>
        </div>
      </div>
    </div>
  );
}
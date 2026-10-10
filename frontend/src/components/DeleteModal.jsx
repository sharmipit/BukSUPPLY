import React, { useState } from "react";
import "../styles/DeleteModal.css";

export default function DeleteModal({ isOpen, title, message, onConfirm, onClose }) {
  const [showToast, setShowToast] = useState(false);

  if (!isOpen) return null;

  const handleDeleteClick = () => {
    // Show toast notification
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
      onConfirm();
    }, 1500);
  };

  return (
    <div className={`lo-overlay ${isOpen ? "active" : ""}`} role="dialog" aria-modal="true">
      {/* Toast Notification Container positioned at top of viewport */}
      <div className={`lo-toast-notification ${showToast ? 'show' : ''}`}>
        <i className="bi bi-trash3-fill"></i>
        <span>Requisition successfully deleted!</span>
      </div>

      <div className="lo-card">
        <div className="lo-icon danger">
          <i className="bi bi-trash3"></i>
        </div>
        <h2 className="lo-title">{title || "Delete Requisition?"}</h2>
        <p className="modal-description lo-desc">
          {message || "Are you sure you want to delete this requisition slip? This action cannot be undone."}
        </p>
        <div className="lo-actions">
          <button type="button" className="lo-btn lo-cancel lo-btn-danger-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="lo-btn lo-confirm-danger" onClick={handleDeleteClick}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
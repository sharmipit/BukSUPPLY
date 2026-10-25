import React, { useState } from "react";
import "../styles/DeleteModal.css";

export default function DeleteModal({
  isOpen,
  title,
  message,
  onConfirm,
  onClose,
  confirmLabel = "Cancel",
  cancelLabel = "Keep",
  icon = "bi-x-circle",
  toastIcon = "bi-x-circle-fill",
  toastMessage = "Requisition successfully cancelled!",
}) {
  const [showToast, setShowToast] = useState(false);

  if (!isOpen) return null;

  const handleConfirmClick = () => {

    if (showToast) return;

    // Show toast notification
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
      onConfirm();
    }, 1500);
  };

  return (
    <div className={`lo-overlay ${isOpen ? "active" : ""}`} role="dialog" aria-modal="true">

      <div className={`lo-toast-notification ${showToast ? 'show' : ''}`}>
        <i className={`bi ${toastIcon}`}></i>
        <span>{toastMessage}</span>
      </div>

      <div className="lo-card">
        <div className="lo-icon danger">
          <i className={`bi ${icon}`}></i>
        </div>
        <h2 className="lo-title">{title || "Cancel Requisition?"}</h2>
        <p className="modal-description lo-desc">
          {message || "Are you sure you want to cancel this requisition slip? This action cannot be undone."}
        </p>
        <div className="lo-actions">
          <button
            type="button"
            className="lo-btn lo-cancel lo-btn-danger-cancel"
            onClick={onClose}
            disabled={showToast}
          >
            {cancelLabel}
          </button>
          <button type="button" className="lo-btn lo-confirm-danger" onClick={handleConfirmClick}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
import React from "react";

export default function DeactivateModal({ isOpen, onClose, onConfirm, busy = false }) {
  if (!isOpen) return null;

  return (
    <div className={`lo-overlay ${isOpen ? "active" : ""}`} role="dialog" aria-modal="true">
      <div className="lo-card">
        <div className="lo-icon">
          <i className="bi bi-person-x"></i>
        </div>
        <h2 className="lo-title">Deactivate account?</h2>
        <p className="modal-description lo-desc">
          Your <strong>BukSUPPLY</strong> account will be disabled and you will no
          longer be able to access your account. You will be logged out right away.
          Only deactivate if you are sure.
        </p>
        <div className="lo-actions">
          <button
            type="button"
            className="lo-btn lo-cancel"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="lo-btn lo-confirm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Deactivating..." : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}
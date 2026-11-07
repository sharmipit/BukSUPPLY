import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

export default function LogoutModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);

    // Record the sign-out while the token still exists. Never block logout on this.
    try {
      await api.post("/activity/logout", null, { timeout: 3000 });
    } catch {
      // ignore: logging out must always work
    }

    logout();
    navigate("/signin");
  };

  return (
    <div className={`lo-overlay ${isOpen ? "active" : ""}`} role="dialog" aria-modal="true">
      <div className="lo-card">
        <div className="lo-icon">
          <i className="bi bi-box-arrow-right"></i>
        </div>
        <h2 className="lo-title">Log out?</h2>
        <p className="modal-description lo-desc">
          Are you sure you want to log out of <strong>BukSUPPLY</strong>?
          You will need to sign in again to access your account.
        </p>
        <div className="lo-actions">
          <button type="button" className="lo-btn lo-cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="lo-btn lo-confirm" onClick={handleConfirm} disabled={busy}>
            {busy ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}
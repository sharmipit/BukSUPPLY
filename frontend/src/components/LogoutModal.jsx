import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LogoutModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  if (!isOpen) return null;

  const handleConfirm = () => {
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
          You will need to sign in again to access your dashboard.
        </p>
        <div className="lo-actions">
          <button type="button" className="lo-btn lo-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="lo-btn lo-confirm" onClick={handleConfirm}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
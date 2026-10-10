import React from "react";
import "../styles/DeleteModal.css";

export default function DeleteModal({ isOpen, title, message, onConfirm, onClose }) {
  if (!isOpen) return null;

  return (
    <div className={`lo-overlay ${isOpen ? "active" : ""}`} role="dialog" aria-modal="true">
      <div className="lo-card">
        <div className="lo-icon danger">
          <i className="bi bi-trash3"></i>
        </div>
        <h2 className="lo-title">{title || "Delete Requisition?"}</h2>
        <p className="modal-description lo-desc">
          {message || "Are you sure you want to delete this requisition slip? This action cannot be undone."}
        </p>
        <div className="lo-actions">
          <button type="button" className="lo-btn lo-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="lo-btn lo-confirm-danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
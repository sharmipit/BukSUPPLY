import React from 'react';
import '../styles/DeleteModal.css';

export default function DeleteModal({ isOpen, title, message, onConfirm, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon-container">
          <i className="bi bi-exclamation-triangle-fill"></i>
        </div>
        <h3 className="modal-title">{title || 'Confirm Deletion'}</h3>
        <p className="modal-message">
          {message || 'Are you sure you want to delete this item? This action cannot be undone.'}
        </p>
        <div className="modal-actions">
          <button className="btn-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-modal-confirm" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
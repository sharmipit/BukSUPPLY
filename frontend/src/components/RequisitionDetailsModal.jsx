import React from 'react';
import '../styles/RequisitionDetailsModal.css';

function ItemList({ items, noteLabel, showUnit = false }) {
  return (
    <ul className="details-item-list">
      {items.map((it, idx) => (
        <li key={idx} className="details-item">
          <div className="details-item-top">
            <span className="details-item-name">{it.name || '-'}</span>
            <span className="details-item-qty">
              Qty: {it.qty ?? '-'}
              {showUnit && it.unit ? ` ${it.unit}` : ''}
            </span>
          </div>

          {noteLabel && it.reason && (
            <div className="details-item-note">
              <span className="details-item-note-label">{noteLabel}</span>
              <p>{it.reason}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// The Request & Issuance Slip can be previewed once the request is approved
const SLIP_STATUSES = ['Approved', 'Accepted'];

export default function RequisitionDetailsModal({ isOpen, onClose, requisition, onViewSlip }) {
  if (!isOpen || !requisition) return null;

  const stockItems = Array.isArray(requisition.itemsList) ? requisition.itemsList : null;
  const canViewSlip = SLIP_STATUSES.includes(requisition.status);

  return (
    <div className={`details-modal-overlay ${isOpen ? 'active' : ''}`} role="dialog" aria-modal="true">
      <div className="details-modal-card">
        <div className="details-modal-header">
          <div>
            <h3 className="details-modal-title">
              Requisition Details <span className="text-accent">#{requisition.id}</span>
            </h3>
            <p className="details-modal-subtitle">
              Comprehensive summary of slip information and processing status.
            </p>
          </div>
          <button className="details-modal-close-btn" onClick={onClose} type="button">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="details-modal-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Requisition ID</span>
              <span className="detail-value fw-semibold">{requisition.id || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Department</span>
              <span className="detail-value">{requisition.department || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Date Filed</span>
              <span className="detail-value">{requisition.date || requisition.dateFiled || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status</span>
              <div>
                <span className={`badge-status ${(requisition.status || '').toLowerCase()}`}>
                  {requisition.status || '-'}
                </span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <span className="detail-label">Request Title</span>
            <div className="detail-card-box">
              <p className="detail-text fw-semibold">{requisition.title || '-'}</p>
            </div>
          </div>

          <div className="detail-section">
            <span className="detail-label">Purpose</span>
            <div className="detail-card-box">
              <p className="detail-text">{requisition.purpose || '-'}</p>
            </div>
          </div>

          <div className="detail-section">
            <span className="detail-label">Requested Items</span>
            <div className="detail-card-box">
              {stockItems === null ? (
                <p className="detail-text">{requisition.item || '-'}</p>
              ) : stockItems.length > 0 ? (
                <ItemList
                  items={stockItems}
                  showUnit
                  noteLabel="Reason for exceeding the usual limit"
                />
              ) : (
                <p className="detail-text text-body-secondary">-</p>
              )}
            </div>
          </div>

          <div className="detail-section">
            <span className="detail-label">Admin Remarks / Window Notes</span>
            <div className="detail-card-box">
              <p className="detail-text text-body-secondary">{requisition.remarks || '-'}</p>
            </div>
          </div>
        </div>

        <div className="details-modal-footer">
          <button type="button" className="btn-modal-cancel" onClick={onClose}>
            Close
          </button>
          {canViewSlip && (
            // TODO: wire this up once the office's Request & Issuance Slip format is available.
            // Pass an `onViewSlip` handler from the page to open the preview.
            <button type="button" className="details-btn-slip" onClick={onViewSlip}>
              <i className="bi bi-file-earmark-text"></i> Request &amp; Issuance Slip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
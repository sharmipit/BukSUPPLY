import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import IssuanceSlipPreview from './IssuanceSlipPreview';
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

// The Issuance Slip can be previewed once the request is approved
const SLIP_STATUSES = ['Approved', 'Accepted'];

export default function RequisitionDetailsModal({
  isOpen,
  onClose,
  requisition,
  generatedBy,
  onDownloadSlip,
}) {
  const [showSlip, setShowSlip] = useState(false);
  const [slipBusy, setSlipBusy] = useState(false);

  if (!isOpen || !requisition) return null;

  const stockItems = Array.isArray(requisition.itemsList) ? requisition.itemsList : null;
  const canViewSlip = SLIP_STATUSES.includes(requisition.status);

  const slipReq = { ...requisition, date: requisition.date || requisition.dateFiled };
  const slipLines = (stockItems ?? (requisition.item ? [{ name: requisition.item, qty: '-' }] : [])).map(
    (it) => ({ name: it.name || '-', qty: it.qty ?? '-', unit: it.unit })
  );

  const handleClose = () => {
    setShowSlip(false);
    onClose();
  };

  const handleDownload = async () => {
    if (!onDownloadSlip) return;
    setSlipBusy(true);
    try {
      await onDownloadSlip(requisition);
    } finally {
      setSlipBusy(false);
    }
  };

  return (
    <>
      {/* Not rendered while the slip preview is open, so only one modal shows and nothing animates between them */}
      {!showSlip && (
        <div className="details-modal-overlay active" role="dialog" aria-modal="true">
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
              <button className="details-modal-close-btn" onClick={handleClose} type="button">
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
                <span className="detail-label">Remarks</span>
                <div className="detail-card-box">
                  <p className="detail-text text-body-secondary">{requisition.remarks || '-'}</p>
                </div>
              </div>
            </div>

            <div className="details-modal-footer">
              <button type="button" className="btn-modal-cancel" onClick={handleClose}>
                Close
              </button>
              {canViewSlip && (
                <button type="button" className="details-btn-slip" onClick={() => setShowSlip(true)}>
                  <i className="bi bi-file-earmark-text"></i> Issuance Slip
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showSlip &&
        createPortal(
          <IssuanceSlipPreview
            req={slipReq}
            lines={slipLines}
            generatedBy={generatedBy || '—'}
            busy={slipBusy}
            onClose={() => setShowSlip(false)}
            onDownload={handleDownload}
          />,
          document.body
        )}
    </>
  );
}
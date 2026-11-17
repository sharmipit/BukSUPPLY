import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import useInventory from '../hooks/useInventory';
import api, { errMsg } from '../api/client'; // FEEDBACK
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

const SLIP_STATUSES = ['Approved', 'Accepted'];

const norm = (s) =>
  String(s || '')
    .trim()
    .toLowerCase();

export default function RequisitionDetailsModal({
  isOpen,
  onClose,
  requisition,
  generatedBy,
  onDownloadSlip,
  allowFeedback = false, // FEEDBACK: true only on the requester's own pages
}) {
  const [showSlip, setShowSlip] = useState(false);
  const [slipBusy, setSlipBusy] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false); // FEEDBACK
  const { items = [] } = useInventory();

  if (!isOpen || !requisition) return null;

  const stockItems = Array.isArray(requisition.itemsList) ? requisition.itemsList : null;
  const canViewSlip = SLIP_STATUSES.includes(requisition.status);
  const canSendFeedback = allowFeedback && requisition.status === 'Accepted'; // FEEDBACK

  // Map requestor's name and ensure dates/status are aligned with the requests page
  const slipReq = {
    ...requisition,
    date: requisition.date || requisition.dateFiled,
    requestedBy:
      requisition.requestedBy ||
      (typeof requisition.requester === 'object'
        ? [requisition.requester?.firstName, requisition.requester?.lastName]
            .filter(Boolean)
            .join(' ')
        : '') ||
      '-',
  };

  const slipLines = (
    stockItems ?? (requisition.item ? [{ name: requisition.item, qty: '-' }] : [])
  ).map((it) => {
    const inv =
      items.find((i) => i._id === String(it.inventoryItemId)) ||
      items.find((i) => norm(i.name) === norm(it.name));
    return {
      code: it.code || inv?.id || inv?.code || '',
      name: it.name || inv?.name || '-',
      qty: it.qty ?? '-',
      unit: inv?.unit || it.unit || '',
    };
  });

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

  // FEEDBACK: opens the Google Form with the slip number prefilled
  const handleFeedback = async () => {
    if (feedbackBusy) return;
    setFeedbackBusy(true);
    // Open the tab first, or the popup blocker stops it after the await
    const tab = window.open('', '_blank');
    try {
      const { data } = await api.get(`/feedback/link/${requisition.id}`);
      if (tab) tab.location.href = data.url;
      else window.location.href = data.url;
    } catch (err) {
      if (tab) tab.close();
      alert(errMsg(err));
    } finally {
      setFeedbackBusy(false);
    }
  };

  return (
    <>
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
                  <span className="detail-value">
                    {requisition.date || requisition.dateFiled || '-'}
                  </span>
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
                <button
                  type="button"
                  className="details-btn-slip"
                  onClick={() => setShowSlip(true)}
                >
                  <i className="bi bi-file-earmark-text"></i> Issuance Slip
                </button>
              )}
              {/* FEEDBACK: only for the requester, only once the items are received */}
              {canSendFeedback && (
                <button
                  type="button"
                  className="details-btn-feedback"
                  onClick={handleFeedback}
                  disabled={feedbackBusy}
                >
                  {feedbackBusy ? 'Opening...' : 'Send Feedback'}
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
import React, { useState, useEffect } from 'react';
import useInventory from '../hooks/useInventory';
import RequestStockModal, { validateStockLines } from './RequestStockModal';
import '../styles/EditRequisitionModal.css';

const PURPOSE_MAX_LENGTH = 250;

export default function EditRequisitionModal({
  isOpen,
  onClose,
  requisitionData,
  onSave,
  isCreateMode,
}) {
  const { items: inventory, refresh: refreshInventory } = useInventory();

  // Slip details
  const [department, setDepartment] = useState('');
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');

  // Items from stock, edited in their own modal
  const [stockLines, setStockLines] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Toasts and saving state
  const [showToast, setShowToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Load the slip into the form each time it opens
  useEffect(() => {
    if (requisitionData) {
      setDepartment(requisitionData.department || '');
      setTitle(requisitionData.title || '');
      setPurpose(requisitionData.purpose || '');

      setStockLines(
        (requisitionData.itemsList || [])
          .filter((i) => i.name && String(i.name).trim())
          .map((i) => ({ ...i }))
      );

      setPickerOpen(false);
      setErrorMessage('');
      setShowErrorToast(false);
      setSaving(false);
    }
  }, [requisitionData, isOpen]);

  // Reload stock each time the form opens so the numbers are current
  useEffect(() => {
    if (isOpen) refreshInventory();
  }, [isOpen, refreshInventory]);

  if (!isOpen) return null;

  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorToast(true);
    setTimeout(() => setShowErrorToast(false), 3500);
  };

  const handleClose = () => {
    setPickerOpen(false);
    onClose();
  };

  const isOverLimit = (line) => Number(line.qty) > Number(line.maxNormal || 10);

  // Waits for the server before showing success
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return; // ignore double clicks

    if (stockLines.length === 0) {
      showError('Add at least one item from stock.');
      return;
    }

    // Quick check against current stock. The server checks again.
    if (inventory.length > 0) {
      const problem = validateStockLines(stockLines, inventory);
      if (problem) {
        showError(problem);
        return;
      }
    }

    setShowErrorToast(false);
    setErrorMessage('');

    const currentDate = new Date().toISOString().split('T')[0];

    const payload = {
      ...requisitionData,
      department,
      title,
      purpose,
      itemsList: stockLines,
      item: stockLines.map((i) => `${i.name} (${i.qty})`).join(', '),
      date: requisitionData?.date || currentDate,
      status: requisitionData?.status || 'Pending',
      remarks: requisitionData?.remarks || 'Awaiting moderator review.',
    };

    setSaving(true);
    try {
      await onSave(payload);
    } catch (err) {
      showError(err?.response?.data?.message || 'Could not save. Please try again.');
      setSaving(false);
      return;
    }
    setSaving(false);

    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      handleClose();
    }, 1500);
  };

  return (
    <div className="req-modal-overlay active">
      {/* Success toast */}
      <div className={`req-toast-notification ${showToast ? 'show' : ''}`}>
        <i className="bi bi-check-circle-fill"></i>
        <span>
          {isCreateMode
            ? 'Requisition successfully filed!'
            : `Changes successfully saved for Requisition #${requisitionData?.id}!`}
        </span>
      </div>

      {/* Error toast */}
      <div className={`req-toast-notification req-toast-error ${showErrorToast ? 'show' : ''}`}>
        <i className="bi bi-exclamation-octagon-fill" style={{ color: '#EF4444' }}></i>
        <span>{errorMessage}</span>
      </div>

      <div className="req-modal-card">
        <div className="req-modal-header">
          <div>
            <h3 className="req-modal-title">
              {isCreateMode ? 'File New Requisition Slip' : 'Edit Requisition Slip'}
              {!isCreateMode && <span className="text-accent"> #{requisitionData?.id}</span>}
            </h3>
            <p className="req-modal-subtitle">
              {isCreateMode
                ? 'Fill in the details, then add the items you need from stock.'
                : 'Update your requested items or requisition details before moderator approval.'}
            </p>
          </div>
          <button className="req-modal-close-btn" onClick={handleClose} type="button">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="req-modal-form">
          <div className="req-modal-body">
            <div className="form-group">
              <label className="form-label">Department or Organization</label>
              <input
                type="text"
                className="form-control custom-input"
                value={department}
                placeholder="e.g. College of Technologies"
                onChange={(e) => setDepartment(e.target.value)}
                required
              />
            </div>

            {/* Request title */}
            <div className="form-group">
              <label className="form-label">Request Title</label>
              <input
                type="text"
                className="form-control custom-input"
                value={title}
                placeholder="e.g. Midterm Lab Supplies"
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Purpose */}
            <div className="form-group">
              <div className="d-flex justify-content-between align-items-center">
                <label className="form-label mb-0">Purpose</label>
                <span
                  className={`char-counter ${purpose.length > PURPOSE_MAX_LENGTH ? 'text-danger' : ''}`}
                >
                  {purpose.length}/{PURPOSE_MAX_LENGTH}
                </span>
              </div>
              <textarea
                className="form-control custom-input mt-1"
                rows="3"
                maxLength={PURPOSE_MAX_LENGTH}
                value={purpose}
                placeholder="e.g. For the midterm laboratory activity"
                onChange={(e) => setPurpose(e.target.value)}
                required
              />
            </div>

            {/* Items from stock: picked in their own modal */}
            <section className="req-section">
              <div className="req-section-head">
                <div className="req-section-id">
                  <span className="req-section-icon" aria-hidden="true">
                    <i className="bi bi-box-seam"></i>
                  </span>
                  <div>
                    <h4 className="req-section-title">Requested items</h4>
                    <p className="req-section-desc">Supplies the property office has on hand.</p>
                  </div>
                </div>
                <button type="button" className="req-section-btn" onClick={() => setPickerOpen(true)}>
                  <i className={`bi ${stockLines.length ? 'bi-pencil-square' : 'bi-plus-lg'}`}></i>{' '}
                  {stockLines.length ? 'Edit items' : 'Add items'}
                </button>
              </div>

              {stockLines.length > 0 ? (
                <ul className="req-summary-list">
                  {stockLines.map((line, idx) => (
                    <li key={`${line.inventoryItemId}-${idx}`} className="req-summary-item">
                      <div className="req-summary-text">
                        <div className="req-summary-name">{line.name}</div>
                        {isOverLimit(line) && (
                          <div className="req-summary-sub">Over the usual limit, reason given</div>
                        )}
                      </div>
                      <span className="req-summary-qty">
                        {line.qty} {line.unit || ''}
                      </span>
                      <button
                        type="button"
                        className="btn-remove-item req-summary-remove"
                        onClick={() => setStockLines((prev) => prev.filter((_, i) => i !== idx))}
                        title="Remove item"
                        aria-label={`Remove ${line.name}`}
                      >
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="req-section-empty">No items added yet.</p>
              )}
            </section>
          </div>

          {/* Pinned footer */}
          <div className="req-modal-actions">
            <button type="button" className="btn-modal-cancel" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn-modal-save" disabled={saving}>
              {saving ? 'Saving...' : isCreateMode ? 'Submit Requisition' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Item picker opens on top of the slip form */}
      {pickerOpen && (
        <RequestStockModal
          inventory={inventory}
          selected={stockLines}
          onSave={(lines) => {
            setStockLines(lines);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
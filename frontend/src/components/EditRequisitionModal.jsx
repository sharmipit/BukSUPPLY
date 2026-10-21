import React, { useState, useEffect } from 'react';
import '../styles/EditRequisitionModal.css';

// Dummy stock database matching your system items
const MOCK_INVENTORY = [
  { id: '1', name: 'A4 bond paper (ream)', available: 8, maxNormal: 10 },
  { id: '2', name: 'Long bond paper (ream)', available: 15, maxNormal: 10 },
  { id: '3', name: 'Ballpen (blue)', available: 200, maxNormal: 30 },
  { id: '4', name: 'Ballpen (black)', available: 150, maxNormal: 30 },
  { id: '5', name: 'Pencil', available: 120, maxNormal: 30 },
  { id: '6', name: 'Whiteboard Marker (Black)', available: 45, maxNormal: 5 },
];

export default function EditRequisitionModal({ isOpen, onClose, requisitionData, onSave, isCreateMode }) {
  const [department, setDepartment] = useState('');
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [items, setItems] = useState([]);
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState(null);

  // Toast state notifications & validation error state
  const [showToast, setShowToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const PURPOSE_MAX_LENGTH = 250;

  useEffect(() => {
    if (requisitionData) {
      // No hardcoded fallback: empty stays empty so the placeholder shows
      setDepartment(requisitionData.department || '');
      setTitle(requisitionData.title || '');
      setPurpose(requisitionData.purpose || '');

      // Copy the rows so editing here never changes the table's data until the save actually succeeds
      if (requisitionData.itemsList && requisitionData.itemsList.length > 0) {
        setItems(requisitionData.itemsList.map((i) => ({ ...i })));
      } else {
        setItems([
          { id: '1', name: '', qty: 1, reason: '', maxNormal: 10 }
        ]);
      }

      setPurchaseItems((requisitionData.purchaseItems || []).map((p) => ({ ...p })));
      setErrorMessage('');
      setShowErrorToast(false);
      setSaving(false);
    }
  }, [requisitionData, isOpen]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([...items, { id: Date.now().toString(), name: '', qty: 1, reason: '', maxNormal: 10 }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleAddPurchaseItem = () => {
    setPurchaseItems([...purchaseItems, { id: Date.now().toString(), name: '', qty: 1, reason: '' }]);
  };

  const handleRemovePurchaseItem = (index) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const handlePurchaseItemChange = (index, field, value) => {
    const updated = [...purchaseItems];
    updated[index] = { ...updated[index], [field]: value };
    setPurchaseItems(updated);
  };

  const handleSelectItem = (index, selectedProduct) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      name: selectedProduct.name,
      maxNormal: selectedProduct.maxNormal,
    };
    setItems(updated);
    setActiveSearchIndex(null);
    setSearchTerm('');
  };

  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorToast(true);
    setTimeout(() => setShowErrorToast(false), 3500);
  };

  // async, waits for the server before showing success
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return; // ignore double clicks

    // Verify that at least one item or purchase item is validly specified
    const hasValidBodegaItem = items.some(i => i.name && i.name.trim() !== '');
    const hasValidPurchaseItem = purchaseItems.some(p => p.name && p.name.trim() !== '');

    if (!hasValidBodegaItem && !hasValidPurchaseItem) {
      showError('Please specify at least one requested item or external purchase item.');
      return;
    }

    setShowErrorToast(false);
    setErrorMessage('');

    const currentDate = new Date().toISOString().split('T')[0];

    // The server decides id, date, status and remarks and ignores the extra fields, but other pages that reuse this modal may still read them.
    const payload = {
      ...requisitionData,
      department,
      title,
      purpose,
      itemsList: items,
      purchaseItems: purchaseItems,
      item: items.filter(i => i.name && i.name.trim() !== '').map(i => `${i.name} (${i.qty})`).join(', ') ||
            purchaseItems.filter(p => p.name && p.name.trim() !== '').map(p => `${p.name} (${p.qty})`).join(', '),
      date: requisitionData?.date || currentDate,
      status: requisitionData?.status || 'Pending',
      remarks: requisitionData?.remarks || 'Awaiting admin review.'
    };

    setSaving(true);
    try {
      // Waits for the API call.
      await onSave(payload);
    } catch (err) {
      showError(err?.response?.data?.message || 'Could not save. Please try again.');
      setSaving(false);
      return; // keep the modal open so nothing the user typed is lost
    }
    setSaving(false);

    // Only reached when the save really succeeded
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      onClose();
    }, 1500);
  };

  return (
    <div className={`req-modal-overlay ${isOpen ? 'active' : ''}`}>
      {/* Success Toast Notification */}
      <div className={`req-toast-notification ${showToast ? 'show' : ''}`}>
        <i className="bi bi-check-circle-fill"></i>
        <span>
          {isCreateMode
            ? "Requisition successfully filed!"
            : `Changes successfully saved for Requisition #${requisitionData?.id}!`}
        </span>
      </div>

      {/* Error Toast Notification */}
      <div className={`req-toast-notification req-toast-error ${showErrorToast ? 'show' : ''}`}>
        <i className="bi bi-exclamation-octagon-fill" style={{ color: '#EF4444' }}></i>
        <span>{errorMessage}</span>
      </div>

      <div className="req-modal-card">
        <div className="req-modal-header">
          <div>
            <h3 className="req-modal-title">
              {isCreateMode ? "File New Requisition Slip" : `Edit Requisition Slip`}
              {!isCreateMode && <span className="text-accent"> #{requisitionData?.id}</span>}
            </h3>
            <p className="req-modal-subtitle">
              {isCreateMode
                ? "Submit a new departmental request for bodega stock or external purchasing."
                : "Update your requested items or requisition details before moderator approval."}
            </p>
          </div>
          <button className="req-modal-close-btn" onClick={onClose} type="button">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="req-modal-body">
          {/* Department / Organization */}
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

          {/* Request Title */}
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

          {/* Purpose with constraints */}
          <div className="form-group">
            <div className="d-flex justify-content-between align-items-center">
              <label className="form-label mb-0">Purpose</label>
              <span className={`char-counter ${purpose.length > PURPOSE_MAX_LENGTH ? 'text-danger' : ''}`}>
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

          {/* Items Section (Bodega Stock) */}
          <div className="items-section">
            <label className="form-label font-bold">Requested Items (Bodega Stock)</label>

            {items.map((item, index) => {
              const needsReason = item.qty > (item.maxNormal || 10);
              const filteredProducts = MOCK_INVENTORY.filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase())
              );

              return (
                <div key={index} className="item-row-card">
                  <div className="item-main-inputs">
                    <div className="search-input-wrapper">
                      <input
                        type="text"
                        className="form-control custom-input"
                        placeholder="Search item by name..."
                        value={activeSearchIndex === index ? searchTerm : item.name}
                        onFocus={() => {
                          setActiveSearchIndex(index);
                          setSearchTerm(item.name || '');
                        }}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          handleItemChange(index, 'name', e.target.value);
                        }}
                      />

                      {/* Dropdown inventory list with no-results check */}
                      {activeSearchIndex === index && searchTerm.length >= 1 && (
                        <div className="inventory-dropdown">
                          {filteredProducts.length > 0 ? (
                            filteredProducts.map(product => (
                              <div
                                key={product.id}
                                className="inventory-dropdown-item"
                                onClick={() => handleSelectItem(index, product)}
                              >
                                <span>{product.name}</span>
                                <span className="stock-badge">{product.available} available</span>
                              </div>
                            ))
                          ) : (
                            <div className="inventory-dropdown-empty">
                              <i className="bi bi-search"></i> No items found matching "{searchTerm}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="qty-input-wrapper">
                      <input
                        type="number"
                        min="1"
                        className="form-control custom-input text-center"
                        value={item.qty}
                        onChange={(e) => handleItemChange(index, 'qty', parseInt(e.target.value) || 1)}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-remove-item"
                      onClick={() => handleRemoveItem(index)}
                      title="Remove item"
                      disabled={items.length === 1 && purchaseItems.length === 0}
                    >
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>

                  {needsReason && (
                    <div className="reason-box mt-3">
                      <div className="warning-banner">
                        <i className="bi bi-exclamation-triangle"></i>
                        <span>Maximum {item.maxNormal || 10} per request. Please provide a justification.</span>
                      </div>
                      <input
                        type="text"
                        className="form-control custom-input mt-2"
                        placeholder="Explain why you need this quantity..."
                        value={item.reason || ''}
                        onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              className="btn-add-item-row"
              onClick={handleAddItem}
            >
              <i className="bi bi-plus-lg"></i> Add bodega item
            </button>
          </div>

          {/* External Purchase / Out-of-Stock Items Section */}
          <div className="items-section mt-4 pt-3 border-top">
            <label className="form-label font-bold text-warning-dark">External Purchase / Out-of-Stock Items</label>
            <p className="small text-muted mb-2">Use this section if items are not available in the bodega and need university purchasing.</p>

            {purchaseItems.map((pItem, index) => (
              <div key={index} className="item-row-card border-warning">
                <div className="item-main-inputs">
                  <div className="search-input-wrapper">
                    <input
                      type="text"
                      className="form-control custom-input"
                      placeholder="Enter unlisted item name..."
                      value={pItem.name}
                      onChange={(e) => handlePurchaseItemChange(index, 'name', e.target.value)}
                      required
                    />
                  </div>

                  <div className="qty-input-wrapper">
                    <input
                      type="number"
                      min="1"
                      className="form-control custom-input text-center"
                      value={pItem.qty}
                      onChange={(e) => handlePurchaseItemChange(index, 'qty', parseInt(e.target.value) || 1)}
                      required
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-remove-item"
                    onClick={() => handleRemovePurchaseItem(index)}
                    title="Remove purchase item"
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
                <input
                  type="text"
                  className="form-control custom-input mt-2"
                  placeholder="Justification or specification for purchase..."
                  value={pItem.reason || ''}
                  onChange={(e) => handlePurchaseItemChange(index, 'reason', e.target.value)}
                  required
                />
              </div>
            ))}

            <button
              type="button"
              className="btn-add-item-row border-warning text-warning-dark"
              onClick={handleAddPurchaseItem}
            >
              <i className="bi bi-plus-lg"></i> Add item for university purchase
            </button>
          </div>

          <div className="req-modal-actions">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-modal-save" disabled={saving}>
              {saving ? 'Saving...' : isCreateMode ? 'Submit Requisition' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

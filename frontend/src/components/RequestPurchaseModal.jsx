import React, { useState } from 'react';

// Unique key for a row that has no id yet
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const blankRow = (name = '') => ({ id: makeId(), name, qty: 1, reason: '' });

export default function RequestPurchaseModal({ items, prefillName, onSave, onClose }) {
  const [rows, setRows] = useState(() => {
    const base = items.map((i) => ({ ...i, id: i.id || makeId() }));
    const name = String(prefillName || '').trim();
    const alreadyThere = base.some((r) => String(r.name).trim().toLowerCase() === name.toLowerCase());

    if (name && !alreadyThere) base.push(blankRow(name));
    return base.length ? base : [blankRow()];
  });
  const [error, setError] = useState('');

  const filledCount = rows.filter((r) => String(r.name).trim()).length;

  const nothingToSave = filledCount === 0 && items.length === 0;

  const patchRow = (id, patch) => {
    setError('');
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleSave = () => {
    if (nothingToSave) return;

    const filled = rows.filter((r) => String(r.name).trim());

    for (const r of filled) {
      if (!(Math.floor(Number(r.qty)) >= 1)) {
        return setError(`${r.name.trim()}: enter a quantity of at least 1.`);
      }
      if (!String(r.reason).trim()) {
        return setError(`${r.name.trim()}: add a justification or specification for the purchase.`);
      }
    }

    onSave(
      filled.map((r) => ({
        ...r,
        name: r.name.trim(),
        qty: Math.floor(Number(r.qty)),
        reason: r.reason.trim(),
      }))
    );
  };

  return (
    <div className="req-modal-overlay active req-modal-overlay--top">
      <div
        className="req-modal-card req-modal-card--picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="req-purchase-title"
      >
        <div className="req-modal-header">
          <div>
            <h3 className="req-modal-title" id="req-purchase-title">
              Request item purchase
            </h3>
            <p className="req-modal-subtitle">
              For items that are out of stock or not in the inventory.
            </p>
          </div>
          <button className="req-modal-close-btn" onClick={onClose} type="button" aria-label="Close">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="req-pick-list req-purchase-body">
          <div className="warning-banner">
            <i className="bi bi-info-circle"></i>
            <span>
              These items will be bought by the university purchasing office, so the request goes
              through a Purchasing step before pickup.
            </span>
          </div>

          {rows.map((row) => (
            <div key={row.id} className="item-row-card">
              <div className="item-main-inputs">
                <div className="search-input-wrapper">
                  <input
                    type="text"
                    className="form-control custom-input"
                    placeholder="Item name"
                    value={row.name}
                    onChange={(e) => patchRow(row.id, { name: e.target.value })}
                    aria-label="Item name"
                  />
                </div>
                <div className="qty-input-wrapper">
                  <input
                    type="number"
                    min="1"
                    className="form-control custom-input text-center"
                    value={row.qty}
                    onChange={(e) => patchRow(row.id, { qty: e.target.value })}
                    aria-label="Quantity"
                  />
                </div>
                <button
                  type="button"
                  className="btn-remove-item"
                  onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                  title="Remove item"
                  aria-label="Remove item"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <input
                type="text"
                className="form-control custom-input"
                placeholder="Justification or specification (brand, size, color, why it is needed)..."
                value={row.reason}
                onChange={(e) => patchRow(row.id, { reason: e.target.value })}
                aria-label="Justification"
              />
            </div>
          ))}

          <button
            type="button"
            className="btn-add-item-row"
            onClick={() => setRows((prev) => [...prev, blankRow()])}
          >
            <i className="bi bi-plus-lg"></i> Add another item
          </button>
        </div>

        {error && (
          <div className="req-inline-error" role="alert">
            <i className="bi bi-exclamation-octagon-fill"></i> {error}
          </div>
        )}

        <div className="req-picker-footer">
          <span className="req-picker-count">{filledCount} item(s) to purchase</span>
          <div className="req-picker-footer-right">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-modal-save"
              onClick={handleSave}
              disabled={nothingToSave}
              title={nothingToSave ? 'Add at least one item first' : undefined}
            >
              Save items
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
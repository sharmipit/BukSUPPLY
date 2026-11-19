import React, { useState, useMemo } from 'react';
import FilterDropdown from './FilterDropdown';

const ALL = 'All';

// Length limits for the free-text inputs in this modal
export const REASON_MAX_LENGTH = 150;
const SEARCH_MAX_LENGTH = 50;

export function validateStockLines(lines, inventory) {
  for (const line of lines) {
    const inv = inventory.find((p) => String(p._id) === String(line.inventoryItemId));
    if (!inv) return `"${line.name}" is no longer in the inventory. Please remove it.`;
    if (inv.quantity <= 0) {
      return `"${inv.name}" is out of stock now. Please remove it from your slip.`;
    }

    const qty = Math.floor(Number(line.qty));
    const limit = inv.maxNormal ?? line.maxNormal ?? 10;
    if (!(qty >= 1)) return `${inv.name}: enter a quantity of at least 1.`;
    if (qty > inv.quantity) return `Only ${inv.quantity} ${inv.unit} of ${inv.name} in stock.`;
    const reason = String(line.reason || '').trim();
    if (qty > limit && !reason) {
      return `${inv.name}: please explain why you need more than ${limit}.`;
    }
    if (reason.length > REASON_MAX_LENGTH) {
      return `${inv.name}: the reason must be ${REASON_MAX_LENGTH} characters or fewer.`;
    }
  }
  return '';
}

export default function RequestStockModal({ inventory, selected, onSave, onClose }) {
  const [lines, setLines] = useState(() => selected.map((l) => ({ ...l })));
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);
  const [error, setError] = useState('');

  const sameId = (a, b) => String(a) === String(b);
  const lineOf = (item) => lines.find((l) => sameId(l.inventoryItemId, item._id));

  const nothingToSave = lines.length === 0 && selected.length === 0;

  const categories = useMemo(
    () =>
      [...new Set(inventory.map((i) => i.category).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [inventory]
  );

  // Options for the category dropdown
  const categoryOptions = useMemo(
    () => [{ value: ALL, label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))],
    [categories]
  );

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    return inventory
      .filter((i) => {
        const matchesSearch =
          !q ||
          i.name.toLowerCase().includes(q) ||
          (i.category || '').toLowerCase().includes(q) ||
          String(i.id || '').toLowerCase().includes(q);
        const matchesCategory = category === ALL || i.category === category;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => (a.quantity <= 0) - (b.quantity <= 0) || a.name.localeCompare(b.name));
  }, [inventory, search, category]);

  const orphans = lines.filter((l) => !inventory.some((p) => sameId(p._id, l.inventoryItemId)));

  const patchLine = (id, patch) => {
    setError('');
    setLines((prev) => prev.map((l) => (sameId(l.inventoryItemId, id) ? { ...l, ...patch } : l)));
  };

  const removeLine = (id) => {
    setError('');
    setLines((prev) => prev.filter((l) => !sameId(l.inventoryItemId, id)));
  };

  const addItem = (item) => {
    if (item.quantity <= 0) return;
    setError('');
    setLines((prev) => [
      ...prev,
      {
        inventoryItemId: item._id,
        name: item.name,
        unit: item.unit,
        maxNormal: item.maxNormal,
        qty: 1,
        reason: '',
      },
    ]);
  };

  const changeQty = (item, raw) => {
    // If input is cleared (backspace / delete), keep empty string in state so user can type cleanly
    if (raw === '' || raw === null || raw === undefined) {
      patchLine(item._id, { qty: '' });
      return;
    }

    const clean = String(raw).replace(/[^\d]/g, '');
    if (!clean) {
      patchLine(item._id, { qty: '' });
      return;
    }

    const n = parseInt(clean, 10);
    if (!Number.isFinite(n)) return;

    patchLine(item._id, { qty: Math.min(n, item.quantity) });
  };

  const handleQtyBlur = (item, line) => {
    const rawVal = line?.qty;
    if (rawVal === '' || rawVal === null || rawVal === undefined) {
      patchLine(item._id, { qty: 1 });
      return;
    }
    const n = Math.floor(Number(rawVal));
    if (!Number.isFinite(n) || n < 1) {
      patchLine(item._id, { qty: 1 });
    } else if (n > item.quantity) {
      patchLine(item._id, { qty: item.quantity });
    } else {
      patchLine(item._id, { qty: n });
    }
  };

  const handleSave = () => {
    if (nothingToSave) return;

    const problem = validateStockLines(lines, inventory);
    if (problem) return setError(problem);

    onSave(
      lines.map((l) => {
        const inv = inventory.find((p) => sameId(p._id, l.inventoryItemId));
        const qty = Math.floor(Number(l.qty));
        const over = qty > (inv.maxNormal ?? 10);

        return { ...l, qty, reason: over ? String(l.reason).trim().slice(0, REASON_MAX_LENGTH) : '' };
      })
    );
  };

  const typed = search.trim();

  return (
    <div className="req-modal-overlay active req-modal-overlay--top">
      <div
        className="req-modal-card req-modal-card--picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="req-stock-title"
      >
        <div className="req-modal-header">
          <div>
            <h3 className="req-modal-title" id="req-stock-title">
              Request in-stock items
            </h3>
            <p className="req-modal-subtitle">
              Browse what the property office has on hand and add what you need.
            </p>
          </div>
          <button className="req-modal-close-btn" onClick={onClose} type="button" aria-label="Close">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Search + category filter */}
        <div className="req-pick-toolbar">
          <div className="req-pick-search">
            <i className="bi bi-search"></i>
            <input
              type="text"
              className="form-control custom-input"
              placeholder="Search by name or category, e.g. paper..."
              value={search}
              maxLength={SEARCH_MAX_LENGTH}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          {categories.length > 0 && (
            <FilterDropdown
              className="fd--compact"
              options={categoryOptions}
              value={category}
              onChange={setCategory}
              icon={null}
              ariaLabel="Filter by category"
              allValue={ALL}
            />
          )}
        </div>

        <ul className="req-pick-list">
          {orphans.map((l) => (
            <li key={`gone-${l.inventoryItemId}`} className="req-pick-row is-out">
              <div className="req-pick-main">
                <div className="req-pick-info">
                  <div className="req-pick-name">{l.name}</div>
                  <div className="req-pick-meta">No longer in the inventory</div>
                </div>
                <button
                  type="button"
                  className="req-btn-soft req-btn-soft--sm"
                  onClick={() => removeLine(l.inventoryItemId)}
                >
                  <i className="bi bi-trash3"></i> Remove from slip
                </button>
              </div>
            </li>
          ))}

          {visible.map((item) => {
            const out = item.quantity <= 0;
            const line = lineOf(item);
            const limit = item.maxNormal ?? 10;
            const overLimit = line && Number(line.qty) > limit;

            return (
              <li
                key={item._id}
                className={`req-pick-row ${out ? 'is-out' : ''} ${line ? 'is-selected' : ''}`}
              >
                <div className="req-pick-main">
                  <div className="req-pick-info">
                    <div className="req-pick-name">{item.name}</div>
                    <div className="req-pick-meta">
                      {item.category ? `${item.category} · ` : ''}Usual limit {limit} per request
                    </div>
                  </div>

                  <span className={`stock-badge ${out ? 'is-out' : ''}`}>
                    {out ? 'Out of stock' : `${item.quantity} ${item.unit} available`}
                  </span>

                  {/* Out-of-stock items cannot be requested */}
                  {!out && (
                    <div className="req-pick-action">
                      {line ? (
                        <>
                          <div className="req-stepper">
                            <button
                              type="button"
                              className="req-stepper-btn"
                              onClick={() => {
                                const cur = Math.floor(Number(line.qty)) || 1;
                                changeQty(item, Math.max(1, cur - 1));
                              }}
                              disabled={(Math.floor(Number(line.qty)) || 1) <= 1}
                              title="Decrease quantity"
                              aria-label={`Decrease quantity of ${item.name}`}
                            >
                              <i className="bi bi-dash-lg"></i>
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={item.quantity}
                              className="form-control custom-input req-pick-qty"
                              value={line.qty}
                              onChange={(e) => changeQty(item, e.target.value)}
                              onBlur={() => handleQtyBlur(item, line)}
                              onKeyDown={(e) => {
                                if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                                  e.preventDefault();
                                }
                              }}
                              aria-label={`Quantity of ${item.name}`}
                            />
                            <button
                              type="button"
                              className="req-stepper-btn"
                              onClick={() => {
                                const cur = Math.floor(Number(line.qty)) || 0;
                                changeQty(item, Math.min(item.quantity, cur + 1));
                              }}
                              disabled={(Math.floor(Number(line.qty)) || 0) >= item.quantity}
                              title="Increase quantity"
                              aria-label={`Increase quantity of ${item.name}`}
                            >
                              <i className="bi bi-plus-lg"></i>
                            </button>
                          </div>
                          <button
                            type="button"
                            className="btn-remove-item"
                            onClick={() => removeLine(item._id)}
                            title="Remove item"
                            aria-label={`Remove ${item.name}`}
                          >
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </>
                      ) : (
                        <button type="button" className="req-pick-add" onClick={() => addItem(item)}>
                          <i className="bi bi-plus-lg"></i> Add
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {overLimit && (
                  <div className="req-pick-reason">
                    <div className="warning-banner">
                      <i className="bi bi-exclamation-triangle"></i>
                      <span>Usual limit is {limit} per request. Please explain why you need more.</span>
                    </div>
                    <input
                      type="text"
                      className="form-control custom-input"
                      placeholder="Explain why you need this quantity..."
                      value={line.reason || ''}
                      maxLength={REASON_MAX_LENGTH}
                      onChange={(e) => patchLine(item._id, { reason: e.target.value })}
                    />
                    <span
                      className={`char-counter ${
                        String(line.reason || '').length >= REASON_MAX_LENGTH ? 'text-danger' : ''
                      }`}
                      style={{ alignSelf: 'flex-end' }}
                    >
                      {String(line.reason || '').length}/{REASON_MAX_LENGTH}
                    </span>
                  </div>
                )}
              </li>
            );
          })}

          {visible.length === 0 && (
            <li className="req-cta">
              <div className="req-cta-icon">
                <i className="bi bi-search"></i>
              </div>
              {inventory.length === 0 ? (
                <p className="req-cta-text">There are no items in the inventory yet.</p>
              ) : typed ? (
                <p className="req-cta-text">
                  No item matches <strong>“{typed}”</strong>.
                </p>
              ) : (
                <p className="req-cta-text">No items in this category.</p>
              )}
              <p className="req-cta-text">
                Only items kept by the property office can be requested here. For anything not
                listed, please coordinate with the Property Office.
              </p>
            </li>
          )}
        </ul>

        {error && (
          <div className="req-inline-error" role="alert">
            <i className="bi bi-exclamation-octagon-fill"></i> {error}
          </div>
        )}

        <div className="req-picker-footer">
          <span className="req-picker-count">
            {lines.length} item{lines.length === 1 ? '' : 's'} selected
          </span>
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
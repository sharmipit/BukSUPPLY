import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import useInventory from '../hooks/useInventory';
import { errMsg } from '../api/client';
import { shortName } from '../utils/formatName';
import FilterDropdown from '../components/FilterDropdown';
import '../styles/Inventory.css';

// Starting categories. Any category typed into the form is added automatically.
const DEFAULT_CATEGORIES = [
  'Paper Products',
  'Writing Supplies',
  'Office Supplies',
  'Lab Materials',
  'Cleaning Supplies',
];
const NEW_CATEGORY = '__new__';
const STATUS_TABS = ['All', 'In Stock', 'Low Stock', 'Out of Stock'];
// Colour dots reuse the FilterDropdown tones (green / amber / red)
const STATUS_TONES = {
  'In Stock': 'accepted',
  'Low Stock': 'pending',
  'Out of Stock': 'denied',
};
const STATUS_OPTIONS = STATUS_TABS.map((s) => ({
  value: s,
  label: s === 'All' ? 'All statuses' : s,
  tone: STATUS_TONES[s],
}));

const EMPTY_FORM = {
  name: '',
  category: DEFAULT_CATEGORIES[0],
  unit: 'pcs',
  quantity: 0,
  reorderLevel: 10,
  maxNormal: 10,
};

const getStockStatus = (item) => {
  if (item.quantity <= 0) return 'Out of Stock';
  if (item.quantity <= item.reorderLevel) return 'Low Stock';
  return 'In Stock';
};

const statusClass = (status) => status.toLowerCase().replace(/\s+/g, '-');

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

export default function Inventory() {
  useEffect(() => {
    document.title = 'Inventory | BukSUPPLY';
  }, []);

  const { user } = useAuth();
  // Only used for the "recorded by" note. The server records the real user.
  const actorName =
    [user?.firstName, user?.lastName].filter((n) => n && n !== '-').join(' ') ||
    user?.email ||
    'Unknown user';

  // Real data from the API
  const { items, loading, error, create, update, adjust, remove } = useInventory();

  // Category list = defaults + every category currently used by an item
  const categories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    items.forEach((i) => i.category && set.add(i.category));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Filtering and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Dropdown options for the shared FilterDropdown
  const categoryOptions = useMemo(
    () => [
      { value: 'All', label: 'All categories' },
      ...categories.map((c) => ({ value: c, label: c })),
    ],
    [categories]
  );

  // If the selected category no longer exists (its last item was deleted), reset
  useEffect(() => {
    if (categoryFilter !== 'All' && !categories.includes(categoryFilter)) {
      setCategoryFilter('All');
    }
  }, [categories, categoryFilter]);

  // Toast notice
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Add / edit modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [customCategory, setCustomCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Adjust modal
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustMode, setAdjustMode] = useState('add');
  const [adjustReference, setAdjustReference] = useState('');
  const [adjustRemark, setAdjustRemark] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // History modal (stores the id so it always shows the latest data)
  const [historyId, setHistoryId] = useState(null);
  const historyItem = items.find((i) => i.id === historyId) || null;

  // Delete modal (available to both admin and moderator)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const stats = useMemo(() => {
    const low = items.filter((i) => getStockStatus(i) === 'Low Stock').length;
    const out = items.filter((i) => getStockStatus(i) === 'Out of Stock').length;
    return { total: items.length, inStock: items.length - low - out, low, out };
  }, [items]);

  const statCards = [
    { title: 'Total Items', count: stats.total, icon: 'bi-boxes' },
    { title: 'In Stock', count: stats.inStock, icon: 'bi-check-circle' },
    { title: 'Low Stock', count: stats.low, icon: 'bi-exclamation-triangle' },
    { title: 'Out of Stock', count: stats.out, icon: 'bi-x-octagon' },
  ];

  const filteredItems = items.filter((item) => {
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch =
      query === '' ||
      item.id.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'All' || getStockStatus(item) === statusFilter;
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // If the current page disappears (e.g. the last item on it was deleted), step back
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filteredItems.length, currentPage]);

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirst, indexOfLast);

  // ---------- Add / edit ----------
  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCustomCategory('');
    setFormError('');
    setFormModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      reorderLevel: item.reorderLevel,
      maxNormal: item.maxNormal,
    });
    setCustomCategory('');
    setFormError('');
    setFormModalOpen(true);
  };

  const handleFormChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const isNewCategory = form.category === NEW_CATEGORY;
  const canSave = form.name.trim() && (!isNewCategory || customCategory.trim());

  const handleSaveItem = async () => {
    if (!canSave || saving) return;

    // Resolve the category. Reuse an existing spelling if it matches ignoring case.
    let category = form.category;
    if (isNewCategory) {
      const typed = customCategory.trim();
      category = categories.find((c) => c.toLowerCase() === typed.toLowerCase()) || typed;
    }

    const cleaned = {
      name: form.name.trim(),
      category,
      unit: form.unit.trim() || 'pcs',
      quantity: Math.max(0, Number(form.quantity) || 0),
      reorderLevel: Math.max(0, Number(form.reorderLevel) || 0),
      maxNormal: Math.max(1, Number(form.maxNormal) || 1),
    };

    setSaving(true);
    setFormError('');
    try {
      // The server records who did it and writes the history entry
      if (editingId) await update(editingId, cleaned);
      else await create(cleaned);
      setFormModalOpen(false);
      setNotice({
        type: 'success',
        text: editingId
          ? `${cleaned.name} was updated.`
          : `${cleaned.name} was added to the inventory.`,
      });
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  // ---------- Adjust stock ----------
  const openAdjustModal = (item) => {
    setAdjustTarget(item);
    setAdjustAmount('');
    setAdjustMode('add');
    setAdjustReference('');
    setAdjustRemark('');
    setAdjustError('');
  };

  const adjustQty = Math.abs(Number(adjustAmount) || 0);
  const overWithdraw = adjustTarget && adjustMode === 'remove' && adjustQty > adjustTarget.quantity;
  const adjustPreview = adjustTarget
    ? adjustMode === 'add'
      ? adjustTarget.quantity + adjustQty
      : Math.max(0, adjustTarget.quantity - adjustQty)
    : 0;

  const handleConfirmAdjust = async () => {
    if (!adjustTarget || adjustQty === 0 || overWithdraw || adjusting) return;
    setAdjusting(true);
    setAdjustError('');
    try {
      await adjust(adjustTarget.id, {
        mode: adjustMode,
        amount: adjustQty,
        reference: adjustReference.trim(),
        remark: adjustRemark.trim(),
      });
      setNotice({
        type: 'success',
        text: `${adjustTarget.name}: stock ${
          adjustMode === 'add' ? 'received' : 'withdrawn'
        } (${adjustTarget.quantity} → ${adjustPreview} ${adjustTarget.unit}).`,
      });
      setAdjustTarget(null);
    } catch (err) {
      setAdjustError(errMsg(err));
    } finally {
      setAdjusting(false);
    }
  };

  // ---------- Delete (admin and moderator) ----------
  const openDeleteModal = (item) => {
    setDeleteError('');
    setDeleteTarget(item);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteError('');
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await remove(deleteTarget.id);
      setNotice({
        type: 'success',
        text: `${deleteTarget.name} (${deleteTarget.id}) was deleted.`,
      });
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(errMsg(err));
    } finally {
      setDeleting(false);
    }
  };

  // One helper for the loading / error / empty rows
  const messageRow = (icon, title, text) => (
    <tr>
      <td colSpan="6" className="inv-empty-cell">
        <div className="inv-empty-content">
          <div className="inv-empty-icon">
            <i className={`bi ${icon}`}></i>
          </div>
          <h4>{title}</h4>
          <p>{text}</p>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="inventory-container">
      {/* Header card with divider and stats */}
      <div className="inv-header-card">
        <div className="inv-header-top">
          <div className="inv-header-text">
            <h1 className="inv-title">Inventory</h1>
            <p className="inv-subtitle">
              Track supply stock levels, record deliveries and withdrawals, and see who changed
              what.
            </p>
          </div>
          <button className="inv-btn-add" onClick={openAddModal}>
            <i className="bi bi-plus-lg"></i> Add Item
          </button>
        </div>

        <div className="inv-header-divider"></div>

        <div className="inv-stats-grid">
          {statCards.map((stat) => (
            <div key={stat.title} className="inv-stat-card">
              <div className="inv-stat-info">
                <span className="inv-stat-title">{stat.title}</span>
                <h2 className="inv-stat-count">{loading ? '–' : stat.count}</h2>
              </div>
              <div className="inv-stat-icon-circle">
                <i className={`bi ${stat.icon}`}></i>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating bottom-right toast */}
      {notice && (
        <div className={`inv-notice-toast ${notice.type}`} role="status">
          <span>{notice.text}</span>
          <button className="inv-notice-close" onClick={() => setNotice(null)} aria-label="Dismiss">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="inv-filter-bar">
        <div className="inv-search-wrapper">
          <i className="bi bi-search"></i>
          <input
            type="text"
            className="form-control custom-input"
            placeholder="Search by item ID or name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="inv-filter-group">
          <FilterDropdown
            icon="bi-tag"
            ariaLabel="Filter by category"
            options={categoryOptions}
            value={categoryFilter}
            onChange={(value) => {
              setCategoryFilter(value);
              setCurrentPage(1);
            }}
          />
          <FilterDropdown
            icon="bi-funnel"
            ariaLabel="Filter by status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="inv-section-card">
        <div className="inv-table-wrapper">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="inv-col-item">Item</th>
                <th className="inv-col-category">Category</th>
                <th className="inv-col-stock">Stock Level</th>
                <th className="inv-col-updated">Last Updated</th>
                <th className="inv-col-status">Status</th>
                <th className="inv-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? messageRow('bi-hourglass-split', 'Loading...', 'Fetching inventory items.')
                : error
                  ? messageRow('bi-exclamation-circle', 'Could not load inventory', error)
                  : currentItems.length > 0
                    ? currentItems.map((item) => {
                        const status = getStockStatus(item);
                        const fill =
                          item.reorderLevel > 0
                            ? Math.min(
                                100,
                                Math.round((item.quantity / (item.reorderLevel * 2)) * 100)
                              )
                            : item.quantity > 0
                              ? 100
                              : 0;
                        const reorderNote = `Reorder at ${item.reorderLevel} · Usual limit ${item.maxNormal} per request`;

                        return (
                          <tr
                            key={item.id}
                            className="inv-row-clickable"
                            onClick={() => setHistoryId(item.id)}
                          >
                            <td className="inv-cell-item">
                              <div className="inv-item-name inv-clamp" title={item.name}>
                                {item.name}
                              </div>
                              <div className="inv-item-id inv-clamp" title={item.id}>
                                {item.id}
                              </div>
                            </td>
                            <td>
                              <div className="inv-clamp" title={item.category}>
                                {item.category}
                              </div>
                            </td>
                            <td className="inv-cell-stock">
                              <div className="inv-stock-text">
                                <strong>{item.quantity}</strong> {item.unit}
                              </div>
                              <div className="inv-stock-bar" aria-hidden="true">
                                <div
                                  className={`inv-stock-fill ${statusClass(status)}`}
                                  style={{ width: `${fill}%` }}
                                ></div>
                              </div>
                              <div className="inv-reorder-text inv-clamp" title={reorderNote}>
                                {reorderNote}
                              </div>
                            </td>
                            <td>
                              <div className="inv-nowrap">{fmtDate(item.updated)}</div>
                              <div className="inv-updated-by inv-clamp" title={item.updatedBy}>
                                by {shortName(item.updatedBy)}
                              </div>
                            </td>
                            <td>
                              <span className={`inv-badge ${statusClass(status)}`}>{status}</span>
                            </td>
                            <td className="inv-cell-actions" onClick={(e) => e.stopPropagation()}>
                              <div className="inv-action-buttons">
                                <button
                                  className="inv-btn-action inv-btn-icon inv-btn-adjust"
                                  onClick={() => openAdjustModal(item)}
                                  title="Adjust stock"
                                  aria-label="Adjust stock"
                                >
                                  <i className="bi bi-arrow-down-up"></i>
                                </button>
                                <button
                                  className="inv-btn-action inv-btn-icon inv-btn-neutral"
                                  onClick={() => openEditModal(item)}
                                  title="Edit item"
                                  aria-label="Edit item"
                                >
                                  <i className="bi bi-pencil-square"></i>
                                </button>
                                <button
                                  className="inv-btn-action inv-btn-icon inv-btn-delete"
                                  onClick={() => openDeleteModal(item)}
                                  title="Delete item"
                                  aria-label="Delete item"
                                >
                                  <i className="bi bi-trash3"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    : messageRow(
                        'bi-box-seam',
                        'No Items Found',
                        items.length === 0
                          ? 'The inventory is empty. Click Add Item to create the first one.'
                          : 'No inventory items match your search, category, or status filter.'
                      )}
            </tbody>
          </table>
        </div>

        <div className="inv-footer-bar">
          <span>
            Showing {currentItems.length} of {filteredItems.length} items
          </span>
          <div className="inv-pagination">
            <button
              className="inv-btn-action inv-btn-neutral"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="inv-page-indicator">Page {currentPage}</span>
            <button
              className="inv-btn-action inv-btn-neutral"
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={indexOfLast >= filteredItems.length}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {formModalOpen && (
        <div className="inv-modal-backdrop" onClick={() => setFormModalOpen(false)}>
          <div
            className="inv-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-header">
              <h3>{editingId ? 'Edit item' : 'Add item'}</h3>
              <button
                className="inv-modal-close"
                onClick={() => setFormModalOpen(false)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="inv-modal-body">
              <div className="inv-field">
                <label htmlFor="inv-name">Item name</label>
                <input
                  id="inv-name"
                  type="text"
                  className="form-control custom-input"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g. A4 bond paper"
                />
              </div>

              <div className="inv-field-row">
                <div className="inv-field">
                  <label htmlFor="inv-category">Category</label>
                  <select
                    id="inv-category"
                    className="form-control custom-input inv-select"
                    value={form.category}
                    onChange={(e) => handleFormChange('category', e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value={NEW_CATEGORY}>+ Add new category…</option>
                  </select>

                  {isNewCategory && (
                    <input
                      type="text"
                      className="form-control custom-input inv-new-category"
                      placeholder="e.g. Electrical Supplies"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      aria-label="New category name"
                      autoFocus
                    />
                  )}
                </div>
                <div className="inv-field">
                  <label htmlFor="inv-unit">Unit</label>
                  <input
                    id="inv-unit"
                    type="text"
                    className="form-control custom-input"
                    value={form.unit}
                    onChange={(e) => handleFormChange('unit', e.target.value)}
                    placeholder="pcs, ream, box"
                  />
                </div>
              </div>

              <div className="inv-field-row">
                <div className="inv-field">
                  <label htmlFor="inv-qty">Quantity on hand</label>
                  <input
                    id="inv-qty"
                    type="number"
                    min="0"
                    className="form-control custom-input"
                    value={form.quantity}
                    onChange={(e) => handleFormChange('quantity', e.target.value)}
                  />
                </div>
                <div className="inv-field">
                  <label htmlFor="inv-reorder">Reorder level</label>
                  <input
                    id="inv-reorder"
                    type="number"
                    min="0"
                    className="form-control custom-input"
                    value={form.reorderLevel}
                    onChange={(e) => handleFormChange('reorderLevel', e.target.value)}
                  />
                </div>
              </div>

              <div className="inv-field">
                <label htmlFor="inv-max">Normal limit per request</label>
                <input
                  id="inv-max"
                  type="number"
                  min="1"
                  className="form-control custom-input"
                  value={form.maxNormal}
                  onChange={(e) => handleFormChange('maxNormal', e.target.value)}
                />
                <span className="inv-field-hint">
                  Users can still request more, but they must explain why.
                </span>
              </div>

              <p className="inv-audit-note">
                {editingId ? 'This edit will be recorded' : 'This item will be recorded as added'}{' '}
                by <strong>{actorName}</strong>.
              </p>

              {formError && (
                <div className="inv-error-box">
                  <strong>Could not save</strong>
                  <p>{formError}</p>
                </div>
              )}
            </div>

            <div className="inv-modal-footer">
              <button className="inv-btn-secondary" onClick={() => setFormModalOpen(false)}>
                Cancel
              </button>
              <button
                className="inv-btn-primary"
                onClick={handleSaveItem}
                disabled={!canSave || saving}
              >
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustTarget && (
        <div className="inv-modal-backdrop" onClick={() => setAdjustTarget(null)}>
          <div
            className="inv-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-header">
              <h3>Adjust stock</h3>
              <button
                className="inv-modal-close"
                onClick={() => setAdjustTarget(null)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="inv-modal-body">
              <p className="inv-adjust-item">
                <strong>{adjustTarget.name}</strong> · {adjustTarget.quantity} {adjustTarget.unit}{' '}
                on hand
              </p>

              <div className="inv-segmented">
                <button
                  className={adjustMode === 'add' ? 'active' : ''}
                  onClick={() => setAdjustMode('add')}
                >
                  <i className="bi bi-box-arrow-in-down"></i> Receive stock
                </button>
                <button
                  className={adjustMode === 'remove' ? 'active' : ''}
                  onClick={() => setAdjustMode('remove')}
                >
                  <i className="bi bi-box-arrow-up"></i> Withdraw stock
                </button>
              </div>

              <div className="inv-field">
                <label htmlFor="inv-adjust-amount">Quantity ({adjustTarget.unit})</label>
                <input
                  id="inv-adjust-amount"
                  type="number"
                  min="1"
                  className="form-control custom-input"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
                {overWithdraw && (
                  <span className="inv-field-error">
                    Only {adjustTarget.quantity} {adjustTarget.unit} on hand. Enter a smaller
                    quantity.
                  </span>
                )}
              </div>

              <div className="inv-field">
                <label htmlFor="inv-adjust-ref">
                  {adjustMode === 'add' ? 'Delivery or PO reference' : 'Requisition slip'}{' '}
                  (optional)
                </label>
                <input
                  id="inv-adjust-ref"
                  type="text"
                  className="form-control custom-input"
                  value={adjustReference}
                  onChange={(e) => setAdjustReference(e.target.value)}
                  placeholder={adjustMode === 'add' ? 'e.g. DR-2026-114' : 'e.g. REQ-2026-075'}
                />
              </div>

              <div className="inv-field">
                <label htmlFor="inv-adjust-remark">Remark (optional)</label>
                <textarea
                  id="inv-adjust-remark"
                  className="form-control custom-input inv-textarea"
                  rows="2"
                  value={adjustRemark}
                  onChange={(e) => setAdjustRemark(e.target.value)}
                  placeholder="Anything worth noting about this change"
                />
              </div>

              <p className="inv-adjust-preview">
                New stock level:{' '}
                <strong>
                  {adjustPreview} {adjustTarget.unit}
                </strong>{' '}
                · recorded by <strong>{actorName}</strong>
              </p>

              {adjustError && (
                <div className="inv-error-box">
                  <strong>Could not save</strong>
                  <p>{adjustError}</p>
                </div>
              )}
            </div>

            <div className="inv-modal-footer">
              <button className="inv-btn-secondary" onClick={() => setAdjustTarget(null)}>
                Cancel
              </button>
              <button
                className="inv-btn-primary"
                onClick={handleConfirmAdjust}
                disabled={adjustQty === 0 || overWithdraw || adjusting}
              >
                {adjusting
                  ? 'Saving...'
                  : adjustMode === 'add'
                    ? 'Receive stock'
                    : 'Withdraw stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Details & Movement History Modal */}
      {historyItem && (
        <div className="inv-modal-backdrop" onClick={() => setHistoryId(null)}>
          <div
            className="inv-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-header">
              <div>
                <h3>{historyItem.name}</h3>
                <div className="inv-item-id">
                  {historyItem.id} · {historyItem.category}
                </div>
              </div>
              <button
                className="inv-modal-close"
                onClick={() => setHistoryId(null)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="inv-modal-body">
              <div className="inv-meta-grid">
                <div>
                  <span className="inv-meta-label">On hand</span>
                  <span className="inv-meta-value">
                    {historyItem.quantity} {historyItem.unit}
                  </span>
                </div>
                <div>
                  <span className="inv-meta-label">Added by</span>
                  <span className="inv-meta-value">{historyItem.addedBy}</span>
                  <span className="inv-meta-sub">{fmtDateTime(historyItem.dateAdded)}</span>
                </div>
                <div>
                  <span className="inv-meta-label">Last updated by</span>
                  <span className="inv-meta-value">{historyItem.updatedBy}</span>
                  <span className="inv-meta-sub">{fmtDateTime(historyItem.updated)}</span>
                </div>
              </div>

              <h4 className="inv-history-title">Stock history</h4>
              <ul className="inv-timeline">
                {[...(historyItem.movements || [])].reverse().map((m) => (
                  <li key={m.id} className="inv-timeline-item">
                    <span className={`inv-move-dot ${m.type.toLowerCase()}`}></span>
                    <div className="inv-move-head">
                      <span className={`inv-move-badge ${m.type.toLowerCase()}`}>{m.type}</span>
                      <span className="inv-move-qty">
                        {m.type === 'Received' && `+${m.qty}`}
                        {m.type === 'Withdrawn' && `−${m.qty}`}
                        {m.type === 'Created' && `${m.after} ${historyItem.unit}`}
                        {m.type === 'Edited' &&
                          (m.before !== m.after
                            ? `${m.before} → ${m.after}`
                            : 'No quantity change')}
                      </span>
                      <span className="inv-move-date">{fmtDateTime(m.date)}</span>
                    </div>
                    <div className="inv-move-meta">
                      by {m.by}
                      {m.type !== 'Created' &&
                        m.type !== 'Edited' &&
                        ` · ${m.before} → ${m.after} ${historyItem.unit}`}
                      {m.reference && ` · Ref: ${m.reference}`}
                    </div>
                    {m.remark && <div className="inv-move-remark">{m.remark}</div>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="inv-modal-footer">
              <button className="inv-btn-secondary" onClick={() => setHistoryId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (admin and moderator).
          Same width as the others, but its height fits the content. */}
      {deleteTarget && (
        <div className="inv-modal-backdrop inv-modal-backdrop-top" onClick={closeDeleteModal}>
          <div
            className="inv-modal inv-modal-auto"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="inv-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-header">
              <h3 id="inv-delete-title">Delete inventory item?</h3>
              <button
                className="inv-modal-close"
                onClick={closeDeleteModal}
                aria-label="Close"
                disabled={deleting}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="inv-modal-body">
              <p className="inv-confirm-text">
                <strong>{deleteTarget.name}</strong> · {deleteTarget.id}
              </p>

              <div className="inv-error-box">
                <strong>This action cannot be undone</strong>
                <p>
                  Are you sure you want to delete item {deleteTarget.id}?
                  {deleteTarget.quantity > 0 &&
                    ` It still has ${deleteTarget.quantity} ${deleteTarget.unit} on hand.`}
                </p>
              </div>

              {deleteError && (
                <div className="inv-error-box">
                  <strong>Could not delete</strong>
                  <p>{deleteError}</p>
                </div>
              )}
            </div>

            <div className="inv-modal-footer">
              <button className="inv-btn-secondary" onClick={closeDeleteModal} disabled={deleting}>
                Cancel
              </button>
              <button className="inv-btn-danger" onClick={handleConfirmDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
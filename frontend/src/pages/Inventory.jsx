import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import DeleteModal from "../components/DeleteModal";
import "../styles/Inventory.css";

// Starting categories. Any category typed into the form is added automatically.
const DEFAULT_CATEGORIES = [
  "Paper Products",
  "Writing Supplies",
  "Office Supplies",
  "Lab Materials",
  "Cleaning Supplies",
];
const NEW_CATEGORY = "__new__";
const STATUS_TABS = ["All", "In Stock", "Low Stock", "Out of Stock"];

const EMPTY_FORM = {
  name: "",
  category: DEFAULT_CATEGORIES[0],
  unit: "pcs",
  quantity: 0,
  reorderLevel: 10,
  maxNormal: 10,
  location: "",
};

const getStockStatus = (item) => {
  if (item.quantity <= 0) return "Out of Stock";
  if (item.quantity <= item.reorderLevel) return "Low Stock";
  return "In Stock";
};

const statusClass = (status) => status.toLowerCase().replace(/\s+/g, "-");

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// Builds a sample item with a starting "Created" log entry
const makeItem = (
  id,
  name,
  category,
  unit,
  quantity,
  reorderLevel,
  maxNormal,
  location,
  addedBy,
  dateAdded,
  updatedBy,
  updated,
) => ({
  id,
  name,
  category,
  unit,
  quantity,
  reorderLevel,
  maxNormal,
  location,
  addedBy,
  dateAdded,
  updatedBy,
  updated,
  movements: [
    {
      id: `${id}-m1`,
      type: "Created",
      qty: quantity,
      before: 0,
      after: quantity,
      by: addedBy,
      date: dateAdded,
      reference: "",
      remark: "Initial stock",
    },
  ],
});

// Sample data. Replace with an API fetch when the backend is ready.
const SAMPLE_ITEMS = [
  makeItem(
    "ITM-001",
    "A4 bond paper",
    "Paper Products",
    "ream",
    48,
    15,
    10,
    "Storage Room A",
    "Admin Reyes",
    "2026-08-03T09:15:00",
    "Admin Reyes",
    "2026-10-12T10:20:00",
  ),
  makeItem(
    "ITM-002",
    "Long bond paper",
    "Paper Products",
    "ream",
    12,
    15,
    10,
    "Storage Room A",
    "Admin Reyes",
    "2026-08-03T09:20:00",
    "Mod Santos",
    "2026-10-10T14:05:00",
  ),
  makeItem(
    "ITM-003",
    "Pencil",
    "Writing Supplies",
    "pcs",
    120,
    40,
    30,
    "Storage Room B",
    "Mod Santos",
    "2026-08-05T11:00:00",
    "Mod Santos",
    "2026-10-02T08:45:00",
  ),
  makeItem(
    "ITM-004",
    "Ballpen (Black)",
    "Writing Supplies",
    "pcs",
    0,
    30,
    20,
    "Storage Room B",
    "Mod Santos",
    "2026-08-05T11:10:00",
    "Admin Reyes",
    "2026-10-09T16:30:00",
  ),
  makeItem(
    "ITM-005",
    "Whiteboard Marker (Black)",
    "Writing Supplies",
    "pcs",
    8,
    10,
    5,
    "Storage Room B",
    "Admin Reyes",
    "2026-08-06T13:00:00",
    "Mod Santos",
    "2026-10-08T09:10:00",
  ),
  makeItem(
    "ITM-006",
    "Stapler",
    "Office Supplies",
    "pcs",
    22,
    5,
    2,
    "Storage Room C",
    "Admin Reyes",
    "2026-08-10T10:00:00",
    "Admin Reyes",
    "2026-09-29T15:00:00",
  ),
  makeItem(
    "ITM-007",
    "3D Printer Filament",
    "Lab Materials",
    "roll",
    3,
    4,
    2,
    "Tech Lab Cabinet",
    "Mod Santos",
    "2026-08-12T14:30:00",
    "Mod Santos",
    "2026-10-11T11:40:00",
  ),
  makeItem(
    "ITM-008",
    "Disinfectant Spray",
    "Cleaning Supplies",
    "bottle",
    35,
    10,
    6,
    "Storage Room C",
    "Admin Reyes",
    "2026-08-15T08:50:00",
    "Admin Reyes",
    "2026-10-01T09:00:00",
  ),
];

export default function Inventory() {
  useEffect(() => {
    document.title = "Inventory | BukSUPPLY";
  }, []);

  const { user } = useAuth();
  const isAdmin = ["admin", "administrator"].includes(
    String(user?.role || "").toLowerCase(),
  );
  // Adjust these field names to match your auth user object
  const actorName =
    user?.name || user?.fullName || user?.username || "Unknown user";

  const [items, setItems] = useState(SAMPLE_ITEMS);

  // Category list = defaults + every category currently used by an item
  const categories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    items.forEach((i) => i.category && set.add(i.category));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Filtering and pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // If the selected category no longer exists (its last item was deleted), reset
  useEffect(() => {
    if (categoryFilter !== "All" && !categories.includes(categoryFilter)) {
      setCategoryFilter("All");
    }
  }, [categories, categoryFilter]);

  // Add / edit modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [customCategory, setCustomCategory] = useState("");

  // Adjust modal
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustMode, setAdjustMode] = useState("add");
  const [adjustReference, setAdjustReference] = useState("");
  const [adjustRemark, setAdjustRemark] = useState("");

  // History modal (stores the id so it always shows the latest data)
  const [historyId, setHistoryId] = useState(null);
  const historyItem = items.find((i) => i.id === historyId) || null;

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);

  const stats = useMemo(() => {
    const low = items.filter((i) => getStockStatus(i) === "Low Stock").length;
    const out = items.filter(
      (i) => getStockStatus(i) === "Out of Stock",
    ).length;
    return { total: items.length, inStock: items.length - low - out, low, out };
  }, [items]);

  const filteredItems = items.filter((item) => {
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch =
      query === "" ||
      item.id.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      item.location.toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "All" || getStockStatus(item) === statusFilter;
    const matchesCategory =
      categoryFilter === "All" || item.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirst, indexOfLast);

  const nowIso = () => new Date().toISOString();

  // ---------- Add / edit ----------
  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCustomCategory("");
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
      location: item.location,
    });
    setCustomCategory("");
    setFormModalOpen(true);
  };

  const handleFormChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isNewCategory = form.category === NEW_CATEGORY;
  const canSave = form.name.trim() && (!isNewCategory || customCategory.trim());

  const handleSaveItem = () => {
    if (!canSave) return;

    // Resolve the category. Reuse an existing spelling if it matches ignoring case.
    let category = form.category;
    if (isNewCategory) {
      const typed = customCategory.trim();
      category =
        categories.find((c) => c.toLowerCase() === typed.toLowerCase()) ||
        typed;
    }

    const cleaned = {
      name: form.name.trim(),
      category,
      unit: form.unit.trim() || "pcs",
      location: form.location.trim(),
      quantity: Math.max(0, Number(form.quantity) || 0),
      reorderLevel: Math.max(0, Number(form.reorderLevel) || 0),
      maxNormal: Math.max(1, Number(form.maxNormal) || 1),
    };
    const stamp = nowIso();

    if (editingId) {
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== editingId) return i;
          const entry = {
            id: `${i.id}-m${i.movements.length + 1}`,
            type: "Edited",
            qty: Math.abs(cleaned.quantity - i.quantity),
            before: i.quantity,
            after: cleaned.quantity,
            by: actorName,
            date: stamp,
            reference: "",
            remark:
              cleaned.quantity !== i.quantity
                ? "Quantity corrected during edit"
                : "Item details edited",
          };
          return {
            ...i,
            ...cleaned,
            updatedBy: actorName,
            updated: stamp,
            movements: [...i.movements, entry],
          };
        }),
      );
    } else {
      setItems((prev) => {
        const nextNumber =
          prev.reduce(
            (max, i) => Math.max(max, parseInt(i.id.split("-")[1], 10) || 0),
            0,
          ) + 1;
        const id = `ITM-${String(nextNumber).padStart(3, "0")}`;
        const newItem = {
          id,
          ...cleaned,
          addedBy: actorName,
          dateAdded: stamp,
          updatedBy: actorName,
          updated: stamp,
          movements: [
            {
              id: `${id}-m1`,
              type: "Created",
              qty: cleaned.quantity,
              before: 0,
              after: cleaned.quantity,
              by: actorName,
              date: stamp,
              reference: "",
              remark: "Initial stock",
            },
          ],
        };
        return [newItem, ...prev];
      });
    }
    setFormModalOpen(false);
  };

  // ---------- Adjust stock ----------
  const openAdjustModal = (item) => {
    setAdjustTarget(item);
    setAdjustAmount("");
    setAdjustMode("add");
    setAdjustReference("");
    setAdjustRemark("");
  };

  const adjustQty = Math.abs(Number(adjustAmount) || 0);
  const overWithdraw =
    adjustTarget &&
    adjustMode === "remove" &&
    adjustQty > adjustTarget.quantity;
  const adjustPreview = adjustTarget
    ? adjustMode === "add"
      ? adjustTarget.quantity + adjustQty
      : Math.max(0, adjustTarget.quantity - adjustQty)
    : 0;

  const handleConfirmAdjust = () => {
    if (!adjustTarget || adjustQty === 0 || overWithdraw) return;
    const stamp = nowIso();
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== adjustTarget.id) return i;
        const after =
          adjustMode === "add"
            ? i.quantity + adjustQty
            : i.quantity - adjustQty;
        const entry = {
          id: `${i.id}-m${i.movements.length + 1}`,
          type: adjustMode === "add" ? "Received" : "Withdrawn",
          qty: adjustQty,
          before: i.quantity,
          after,
          by: actorName,
          date: stamp,
          reference: adjustReference.trim(),
          remark: adjustRemark.trim(),
        };
        return {
          ...i,
          quantity: after,
          updatedBy: actorName,
          updated: stamp,
          movements: [...i.movements, entry],
        };
      }),
    );
    setAdjustTarget(null);
  };

  // ---------- Delete (admin only) ----------
  const handleDeleteClick = (id) => {
    setSelectedItemId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedItemId) {
      setItems((prev) => prev.filter((i) => i.id !== selectedItemId));
    }
    setDeleteModalOpen(false);
    setSelectedItemId(null);
  };

  return (
    <div className="inventory-container">
      {/* Header */}
      <div className="inv-header-card">
        <div>
          <h1 className="inv-title">Inventory</h1>
          <p className="inv-subtitle">
            Track supply stock levels, record deliveries and withdrawals, and
            see who changed what.
          </p>
        </div>
        <button className="btn-add-item" onClick={openAddModal}>
          <i className="bi bi-plus-lg"></i> Add Item
        </button>
      </div>

      {/* Stats */}
      <div className="inv-stats-row">
        <div className="inv-stat-card">
          <span className="inv-stat-label">Total items</span>
          <span className="inv-stat-value">{stats.total}</span>
        </div>
        <div className="inv-stat-card">
          <span className="inv-stat-label">In stock</span>
          <span className="inv-stat-value stat-ok">{stats.inStock}</span>
        </div>
        <div className="inv-stat-card">
          <span className="inv-stat-label">Low stock</span>
          <span className="inv-stat-value stat-warn">{stats.low}</span>
        </div>
        <div className="inv-stat-card">
          <span className="inv-stat-label">Out of stock</span>
          <span className="inv-stat-value stat-danger">{stats.out}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="inv-filter-bar">
        <div className="inv-search-wrapper">
          <i className="bi bi-search"></i>
          <input
            type="text"
            className="form-control custom-input"
            placeholder="Search by item ID, name, or location..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <select
          className="inv-category-select"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setCurrentPage(1);
          }}
          aria-label="Filter by category"
        >
          <option value="All">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="inv-status-tabs">
          {STATUS_TABS.map((status) => (
            <button
              key={status}
              className={`inv-tab-btn ${statusFilter === status ? "active" : ""}`}
              onClick={() => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="inv-section-card">
        <div className="inv-table-wrapper">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="col-item">Item</th>
                <th className="col-category">Category</th>
                <th className="col-stock">Stock Level</th>
                <th className="col-location">Location</th>
                <th className="col-updated">Last Updated</th>
                <th className="col-status">Status</th>
                <th className="col-actions text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                currentItems.map((item) => {
                  const status = getStockStatus(item);
                  const fill =
                    item.reorderLevel > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (item.quantity / (item.reorderLevel * 2)) * 100,
                          ),
                        )
                      : item.quantity > 0
                        ? 100
                        : 0;

                  return (
                    <tr
                      key={item.id}
                      className="inv-row-clickable"
                      onClick={() => setHistoryId(item.id)}
                    >
                      <td className="align-middle">
                        <div
                          className="inv-item-name cell-clamp"
                          title={item.name}
                        >
                          {item.name}
                        </div>
                        <div className="inv-item-id">{item.id}</div>
                      </td>
                      <td className="align-middle">
                        <div className="cell-clamp" title={item.category}>
                          {item.category}
                        </div>
                      </td>
                      <td className="align-middle">
                        <div className="inv-stock-text">
                          <strong>{item.quantity}</strong> {item.unit}
                        </div>
                        <div className="inv-stock-bar" aria-hidden="true">
                          <div
                            className={`inv-stock-fill ${statusClass(status)}`}
                            style={{ width: `${fill}%` }}
                          ></div>
                        </div>
                        <div className="inv-reorder-text">
                          Reorder at {item.reorderLevel} · Usual limit{" "}
                          {item.maxNormal} per request
                        </div>
                      </td>
                      <td className="align-middle">
                        <div className="cell-clamp" title={item.location}>
                          {item.location || "—"}
                        </div>
                      </td>
                      <td className="align-middle nowrap-cell">
                        <div>{fmtDate(item.updated)}</div>
                        <div className="inv-updated-by" title={item.updatedBy}>
                          by {item.updatedBy}
                        </div>
                      </td>
                      <td className="align-middle nowrap-cell">
                        <span className={`badge-status ${statusClass(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td
                        className="text-end align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="action-buttons">
                          <button
                            className="btn-action btn-adjust"
                            onClick={() => openAdjustModal(item)}
                            title="Adjust stock"
                          >
                            <i className="bi bi-arrow-down-up"></i> Adjust
                          </button>
                          <button
                            className="btn-action btn-edit"
                            onClick={() => openEditModal(item)}
                            title="Edit item"
                          >
                            <i className="bi bi-pencil-square"></i> Edit
                          </button>
                          {isAdmin && (
                            <button
                              className="btn-action btn-delete"
                              onClick={() => handleDeleteClick(item.id)}
                              title="Delete item"
                            >
                              <i className="bi bi-trash3"></i> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="empty-state-cell">
                    <div className="empty-state-content">
                      <div className="empty-icon-circle">
                        <i className="bi bi-box-seam"></i>
                      </div>
                      <h4>No Items Found</h4>
                      <p>
                        No inventory items match your search, category, or
                        status filter.
                      </p>
                    </div>
                  </td>
                </tr>
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
              className="btn-action btn-edit"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="inv-page-indicator">Page {currentPage}</span>
            <button
              className="btn-action btn-edit"
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
        <div
          className="inv-modal-backdrop"
          onClick={() => setFormModalOpen(false)}
        >
          <div
            className="inv-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-header">
              <h3>{editingId ? "Edit item" : "Add item"}</h3>
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
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  placeholder="e.g. A4 bond paper"
                />
              </div>

              <div className="inv-field-row">
                <div className="inv-field">
                  <label htmlFor="inv-category">Category</label>
                  <select
                    id="inv-category"
                    className="form-control custom-input"
                    value={form.category}
                    onChange={(e) =>
                      handleFormChange("category", e.target.value)
                    }
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
                    onChange={(e) => handleFormChange("unit", e.target.value)}
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
                    onChange={(e) =>
                      handleFormChange("quantity", e.target.value)
                    }
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
                    onChange={(e) =>
                      handleFormChange("reorderLevel", e.target.value)
                    }
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
                  onChange={(e) =>
                    handleFormChange("maxNormal", e.target.value)
                  }
                />
                <span className="inv-field-hint">
                  Users can still request more, but they must explain why.
                </span>
              </div>

              <div className="inv-field">
                <label htmlFor="inv-location">
                  Storage location (optional)
                </label>
                <input
                  id="inv-location"
                  type="text"
                  className="form-control custom-input"
                  value={form.location}
                  onChange={(e) => handleFormChange("location", e.target.value)}
                  placeholder="e.g. Storage Room A"
                />
              </div>

              <p className="inv-audit-note">
                {editingId
                  ? "This edit will be recorded"
                  : "This item will be recorded as added"}{" "}
                by <strong>{actorName}</strong>.
              </p>
            </div>

            <div className="inv-modal-footer">
              <button
                className="btn-modal-secondary"
                onClick={() => setFormModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn-modal-primary"
                onClick={handleSaveItem}
                disabled={!canSave}
              >
                {editingId ? "Save changes" : "Add item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustTarget && (
        <div
          className="inv-modal-backdrop"
          onClick={() => setAdjustTarget(null)}
        >
          <div
            className="inv-modal inv-modal-sm"
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
                <strong>{adjustTarget.name}</strong> · {adjustTarget.quantity}{" "}
                {adjustTarget.unit} on hand
              </p>

              <div className="inv-segmented">
                <button
                  className={adjustMode === "add" ? "active" : ""}
                  onClick={() => setAdjustMode("add")}
                >
                  <i className="bi bi-box-arrow-in-down"></i> Receive stock
                </button>
                <button
                  className={adjustMode === "remove" ? "active" : ""}
                  onClick={() => setAdjustMode("remove")}
                >
                  <i className="bi bi-box-arrow-up"></i> Withdraw stock
                </button>
              </div>

              <div className="inv-field">
                <label htmlFor="inv-adjust-amount">
                  Quantity ({adjustTarget.unit})
                </label>
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
                    Only {adjustTarget.quantity} {adjustTarget.unit} on hand.
                    Enter a smaller quantity.
                  </span>
                )}
              </div>

              <div className="inv-field">
                <label htmlFor="inv-adjust-ref">
                  {adjustMode === "add"
                    ? "Delivery or PO reference"
                    : "Requisition slip"}{" "}
                  (optional)
                </label>
                <input
                  id="inv-adjust-ref"
                  type="text"
                  className="form-control custom-input"
                  value={adjustReference}
                  onChange={(e) => setAdjustReference(e.target.value)}
                  placeholder={
                    adjustMode === "add"
                      ? "e.g. DR-2026-114"
                      : "e.g. REQ-2026-075"
                  }
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
                New stock level:{" "}
                <strong>
                  {adjustPreview} {adjustTarget.unit}
                </strong>{" "}
                · recorded by <strong>{actorName}</strong>
              </p>
            </div>

            <div className="inv-modal-footer">
              <button
                className="btn-modal-secondary"
                onClick={() => setAdjustTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn-modal-primary"
                onClick={handleConfirmAdjust}
                disabled={adjustQty === 0 || overWithdraw}
              >
                {adjustMode === "add" ? "Receive stock" : "Withdraw stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Details & Movement History Modal */}
      {historyItem && (
        <div className="inv-modal-backdrop" onClick={() => setHistoryId(null)}>
          <div
            className="inv-modal inv-modal-lg"
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
                  <span className="inv-meta-label">Location</span>
                  <span className="inv-meta-value">
                    {historyItem.location || "—"}
                  </span>
                </div>
                <div>
                  <span className="inv-meta-label">Added by</span>
                  <span className="inv-meta-value">{historyItem.addedBy}</span>
                  <span className="inv-meta-sub">
                    {fmtDateTime(historyItem.dateAdded)}
                  </span>
                </div>
                <div>
                  <span className="inv-meta-label">Last updated by</span>
                  <span className="inv-meta-value">
                    {historyItem.updatedBy}
                  </span>
                  <span className="inv-meta-sub">
                    {fmtDateTime(historyItem.updated)}
                  </span>
                </div>
              </div>

              <h4 className="inv-history-title">Stock history</h4>
              <ul className="inv-timeline">
                {[...historyItem.movements].reverse().map((m) => (
                  <li key={m.id} className="inv-timeline-item">
                    <span
                      className={`inv-move-dot ${m.type.toLowerCase()}`}
                    ></span>
                    <div className="inv-move-head">
                      <span
                        className={`inv-move-badge ${m.type.toLowerCase()}`}
                      >
                        {m.type}
                      </span>
                      <span className="inv-move-qty">
                        {m.type === "Received" && `+${m.qty}`}
                        {m.type === "Withdrawn" && `−${m.qty}`}
                        {m.type === "Created" &&
                          `${m.after} ${historyItem.unit}`}
                        {m.type === "Edited" &&
                          (m.before !== m.after
                            ? `${m.before} → ${m.after}`
                            : "No quantity change")}
                      </span>
                      <span className="inv-move-date">
                        {fmtDateTime(m.date)}
                      </span>
                    </div>
                    <div className="inv-move-meta">
                      by {m.by}
                      {m.type !== "Created" &&
                        m.type !== "Edited" &&
                        ` · ${m.before} → ${m.after} ${historyItem.unit}`}
                      {m.reference && ` · Ref: ${m.reference}`}
                    </div>
                    {m.remark && (
                      <div className="inv-move-remark">{m.remark}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="inv-modal-footer">
              <button
                className="btn-modal-secondary"
                onClick={() => setHistoryId(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (admin only) */}
      <DeleteModal
        isOpen={deleteModalOpen}
        title="Delete Inventory Item?"
        message={`Are you sure you want to delete item ${selectedItemId}? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}

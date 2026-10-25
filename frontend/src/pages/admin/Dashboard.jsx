import React, { useState, useEffect, useMemo } from "react";
import "bootstrap-icons/font/bootstrap-icons.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import useInventory from "../../hooks/useInventory";
import useAllRequisitions from "../../hooks/useAllRequisitions";
import { errMsg } from "../../api/client";
import "../../styles/admin/Dashboard.css";

const OPEN_STATUSES = ["Pending", "Processing", "Purchasing"];
// Each summary table only previews the first few rows
const PREVIEW_LIMIT = 5;

// Starting categories. Any category typed into the form is added automatically.
const DEFAULT_CATEGORIES = [
  "Paper Products",
  "Writing Supplies",
  "Office Supplies",
  "Lab Materials",
  "Cleaning Supplies",
];
const NEW_CATEGORY = "__new__";

// Works whether or not VITE_API_URL ends in "/api" (same as User Management)
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5001")
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${API_BASE}/api/admin/users${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

// Where each dashboard shortcut goes. Change these to match your router.
const ROUTES = {
  requests: "/admin/requests",
  inventory: "/admin/inventory",
  users: "/admin/users",
};

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

const getStockFill = (item) => {
  if (item.reorderLevel > 0) {
    return Math.min(
      100,
      Math.round((item.quantity / (item.reorderLevel * 2)) * 100)
    );
  }
  return item.quantity > 0 ? 100 : 0;
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

// Short "Item (qty), Item (qty)" text for a slip (same as the Requests page)
const summarize = (req) => {
  if (req.item) return req.item;
  const all = [
    ...(req.itemsList || []).map((l) => `${l.name} (${l.qty})`),
    ...(req.purchaseItems || []).map((l) => `${l.name} (${l.qty})`),
  ];
  return all.join(", ") || "—";
};

const Dashboard = ({
  inventory: inventoryProp, // optional: falls back to the live inventory hook
  outOfStockCount,
  activeModerators,
  onViewRequests, // optional overrides; by default they navigate to ROUTES
  onViewInventory,
  onViewUsers,
  onItemAdded = () => {},
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = [user?.firstName, user?.lastName]
    .filter((n) => n && n !== "-")
    .join(" ");
  // Only used for the "recorded by" note. The server records the real user.
  const actorName = displayName || user?.email || "Unknown user";

  // Live inventory (also used to add new items)
  const { items, create: createInventoryItem } = useInventory();
  const inventory = inventoryProp ?? items;

  // Live requisition slips (same hook as the Requests page)
  const {
    requisitions,
    loading: slipsLoading,
    error: slipsError,
  } = useAllRequisitions();

  // Pending first, then newest (same order as the Requests page)
  const slips = useMemo(
    () =>
      [...requisitions].sort((a, b) => {
        const ap = a.status === "Pending" ? 0 : 1;
        const bp = b.status === "Pending" ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return new Date(b.date) - new Date(a.date);
      }),
    [requisitions]
  );

  // Live user accounts (same API as the User Management page)
  const [users, setUsers] = useState([]);
  const [moderatorCount, setModeratorCount] = useState(0);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setUsersLoading(true);
      setUsersError("");
      try {
        const listParams = new URLSearchParams({
          filter: "All",
          search: "",
          page: 1,
          limit: PREVIEW_LIMIT,
        });
        const modParams = new URLSearchParams({
          filter: "Moderator",
          search: "",
          page: 1,
          limit: 100,
        });
        const [list, mods] = await Promise.all([
          apiFetch(`?${listParams}`, { signal: controller.signal }),
          apiFetch(`?${modParams}`, { signal: controller.signal }),
        ]);
        setUsers(list.users || []);
        setModeratorCount(
          (mods.users || []).filter((u) => u.status === "Active").length
        );
      } catch (err) {
        if (err.name !== "AbortError") setUsersError(err.message);
      } finally {
        if (!controller.signal.aborted) setUsersLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // Category list = defaults + every category currently used by an item
  const categories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    inventory.forEach((i) => i.category && set.add(i.category));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [inventory]);

  // Toast notice
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Add item modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [customCategory, setCustomCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const openAddModal = () => {
    setForm(EMPTY_FORM);
    setCustomCategory("");
    setFormError("");
    setFormModalOpen(true);
  };

  const handleFormChange = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isNewCategory = form.category === NEW_CATEGORY;
  const canSave =
    form.name.trim() && (!isNewCategory || customCategory.trim());

  const handleSaveItem = async () => {
    if (!canSave || saving) return;

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

    setSaving(true);
    setFormError("");
    try {
      // The server records who did it and writes the history entry
      await createInventoryItem(cleaned);
      setFormModalOpen(false);
      setNotice({
        type: "success",
        text: `${cleaned.name} was added to the inventory.`,
      });
      onItemAdded(cleaned);
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const stats = [
    {
      id: "total",
      label: "Total Requests",
      value: slips.length,
      icon: "bi-file-earmark-text",
    },
    {
      id: "pending",
      label: "Pending Requests",
      value: slips.filter((s) => s.status === "Pending").length,
      icon: "bi-clock-history",
    },
    {
      id: "outofstock",
      label: "Out of Stock Items",
      value:
        outOfStockCount ?? inventory.filter((i) => i.quantity <= 0).length,
      icon: "bi-box-seam",
    },
    {
      id: "moderators",
      label: "Active Moderators",
      value: activeModerators ?? moderatorCount,
      icon: "bi-people",
    },
  ];

  const handleGeneratePDF = () => {
    // Placeholder: swap in your PDF library (jsPDF, react-to-print, etc.)
    window.print();
  };

  // Navigation shortcuts (quick action + "View ..." links in the table footers)
  const handleViewRequests = onViewRequests ?? (() => navigate(ROUTES.requests));
  const handleViewInventory =
    onViewInventory ?? (() => navigate(ROUTES.inventory));
  const handleViewUsers = onViewUsers ?? (() => navigate(ROUTES.users));

  const quickActions = [
    { id: "process", label: "Process Slip", onClick: handleViewRequests },
    { id: "item", label: "Add Item", onClick: openAddModal },
    { id: "users", label: "Manage Users", onClick: handleViewUsers },
    { id: "pdf", label: "Generate PDF", onClick: handleGeneratePDF },
  ];

  // Preview rows for each table
  const currentItems = slips.slice(0, PREVIEW_LIMIT);
  const currentInvItems = inventory.slice(0, PREVIEW_LIMIT);
  const currentUsers = users.slice(0, PREVIEW_LIMIT);

  return (
    <div className="dashboard">
      {/* Greeting header card */}
      <div className="db-header-card">
        <div className="db-header-text">
          <h1 className="db-title">
            Good day! <span className="db-name">{displayName || "there"}!</span>
          </h1>
          <p className="db-subtitle">
            Here is your daily operational summary for{" "}
            <strong>BukSU Supply &amp; Property Management</strong>. Review
            pending departmental slips, coordinate physical window issuances,
            or manage asset inventory below.
          </p>
        </div>

        <div className="db-header-divider"></div>

        <div className="db-actions-block">
          <h2 className="db-section-label">Quick Operational Actions</h2>
          <div className="db-quick-actions">
            {quickActions.map((a) => (
              <button
                key={a.id}
                type="button"
                className="db-quick-btn"
                onClick={a.onClick}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="db-stats-grid">
        {stats.map((s) => (
          <div key={s.id} className="db-stat-card">
            <div className="db-stat-info">
              <span className="db-stat-title">{s.label}</span>
              <h2 className="db-stat-count">{s.value}</h2>
            </div>
            <div className="db-stat-icon-circle">
              <i className={`bi ${s.icon}`} aria-hidden="true"></i>
            </div>
          </div>
        ))}
      </div>

      {/* Requisition queue */}
      <div className="db-section-card">
        <div className="db-table-wrapper">
          <table className="db-table">
            <thead>
              <tr>
                <th className="col-slip">Requisition Slip</th>
                <th className="col-requester">Requested By</th>
                <th className="col-title">Title &amp; Purpose</th>
                <th className="col-items">Item &amp; Quantity</th>
                <th className="col-status">Status</th>
                <th className="col-actions db-text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {slipsLoading ? (
                <tr>
                  <td colSpan="6" className="db-empty-cell">
                    <div className="db-empty-content">
                      <div className="db-empty-icon">
                        <i
                          className="bi bi-hourglass-split"
                          aria-hidden="true"
                        ></i>
                      </div>
                      <h4>Loading...</h4>
                      <p>Fetching requisition slips.</p>
                    </div>
                  </td>
                </tr>
              ) : slipsError ? (
                <tr>
                  <td colSpan="6" className="db-empty-cell">
                    <div className="db-empty-content">
                      <div className="db-empty-icon">
                        <i
                          className="bi bi-exclamation-circle"
                          aria-hidden="true"
                        ></i>
                      </div>
                      <h4>Could not load requests</h4>
                      <p>{slipsError}</p>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length > 0 ? (
                currentItems.map((req) => (
                  <tr key={req.id}>
                    <td className="db-nowrap-cell">
                      <div className="db-slip-id">{req.id}</div>
                      <div className="db-sub">{fmtDate(req.date)}</div>
                    </td>
                    <td>
                      <div
                        className="db-strong db-cell-clamp"
                        title={req.requestedBy}
                      >
                        {req.requestedBy || "—"}
                      </div>
                      <div
                        className="db-sub db-cell-clamp"
                        title={req.department}
                      >
                        {req.department}
                      </div>
                    </td>
                    <td>
                      <div className="db-strong db-cell-clamp" title={req.title}>
                        {req.title}
                      </div>
                      <div className="db-sub db-cell-clamp" title={req.purpose}>
                        {req.purpose}
                      </div>
                    </td>
                    <td>
                      <div className="db-cell-clamp" title={summarize(req)}>
                        {summarize(req)}
                      </div>
                    </td>
                    <td className="db-nowrap-cell">
                      <span className={`db-badge ${req.status.toLowerCase()}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="db-text-end">
                      <div className="db-action-buttons">
                        {OPEN_STATUSES.includes(req.status) ? (
                          <button
                            type="button"
                            className="db-btn-action db-btn-review"
                            tabIndex={-1}
                          >
                            <i className="bi bi-clipboard-check"></i> Review
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="db-btn-action db-btn-view"
                            tabIndex={-1}
                          >
                            <i className="bi bi-eye"></i> View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="db-empty-cell">
                    <div className="db-empty-content">
                      <div className="db-empty-icon">
                        <i className="bi bi-check-circle" aria-hidden="true"></i>
                      </div>
                      <h4>No Requests Found</h4>
                      <p>
                        No requisition slips have been submitted yet.
                        New requests will appear here automatically.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="db-footer-bar">
          <button
            type="button"
            className="db-view-btn"
            onClick={handleViewRequests}
          >
            View all requests
            <span className="db-view-arrow">
              <i className="bi bi-arrow-right"></i>
            </span>
          </button>
        </div>
      </div>

      {/* Inventory summary + User summary, side by side */}
      <div className="db-split-row">
        {/* Inventory summary */}
        <div className="db-section-card">
          <div className="db-table-wrapper">
            <table className="db-table db-inv-table">
              <thead>
                <tr>
                  <th className="col-inv-item">Item</th>
                  <th className="col-inv-category">Category</th>
                  <th className="col-inv-stock">Stock Level</th>
                  <th className="col-inv-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {currentInvItems.length > 0 ? (
                  currentInvItems.map((item) => {
                    const status = getStockStatus(item);
                    return (
                      <tr key={item.id}>
                        <td>
                          <div
                            className="db-strong db-cell-clamp"
                            title={item.name}
                          >
                            {item.name}
                          </div>
                          <div className="db-sub">{item.id}</div>
                        </td>
                        <td>
                          <div className="db-cell-clamp" title={item.category}>
                            {item.category}
                          </div>
                        </td>
                        <td>
                          <div className="db-stock-text">
                            <strong>{item.quantity}</strong> {item.unit}
                          </div>
                          <div className="db-stock-bar" aria-hidden="true">
                            <div
                              className={`db-stock-fill ${statusClass(status)}`}
                              style={{ width: `${getStockFill(item)}%` }}
                            ></div>
                          </div>
                          <div className="db-reorder-text">
                            Reorder at {item.reorderLevel}
                          </div>
                        </td>
                        <td className="db-nowrap-cell">
                          <span className={`db-badge ${statusClass(status)}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="db-empty-cell">
                      <div className="db-empty-content">
                        <div className="db-empty-icon">
                          <i className="bi bi-box-seam" aria-hidden="true"></i>
                        </div>
                        <h4>No Inventory Items</h4>
                        <p>
                          Inventory items will appear here once they are added.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="db-footer-bar">
            <button
              type="button"
              className="db-view-btn"
              onClick={handleViewInventory}
            >
              View inventory
              <span className="db-view-arrow">
                <i className="bi bi-arrow-right"></i>
              </span>
            </button>
          </div>
        </div>

        {/* User management summary */}
        <div className="db-section-card">
          <div className="db-table-wrapper">
            <table className="db-table db-users-table">
              <thead>
                <tr>
                  <th className="col-user-id">ID</th>
                  <th className="col-user-name">Name</th>
                  <th className="col-user-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td colSpan="3" className="db-empty-cell">
                      <div className="db-empty-content">
                        <div className="db-empty-icon">
                          <i
                            className="bi bi-hourglass-split"
                            aria-hidden="true"
                          ></i>
                        </div>
                        <h4>Loading...</h4>
                        <p>Fetching user accounts.</p>
                      </div>
                    </td>
                  </tr>
                ) : usersError ? (
                  <tr>
                    <td colSpan="3" className="db-empty-cell">
                      <div className="db-empty-content">
                        <div className="db-empty-icon">
                          <i
                            className="bi bi-exclamation-circle"
                            aria-hidden="true"
                          ></i>
                        </div>
                        <h4>Could not load users</h4>
                        <p>{usersError}</p>
                      </div>
                    </td>
                  </tr>
                ) : currentUsers.length > 0 ? (
                  currentUsers.map((u) => (
                    <tr key={u._id || u.id}>
                      <td className="db-user-id">{u.id}</td>
                      <td>
                        <div className="db-strong db-cell-clamp" title={u.name}>
                          {u.name}
                        </div>
                        <div className="db-sub">{u.role}</div>
                      </td>
                      <td className="db-nowrap-cell">
                        <span className={`db-badge ${u.status.toLowerCase()}`}>
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="db-empty-cell">
                      <div className="db-empty-content">
                        <div className="db-empty-icon">
                          <i className="bi bi-people" aria-hidden="true"></i>
                        </div>
                        <h4>No Users Found</h4>
                        <p>User accounts will appear here once they exist.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="db-footer-bar">
            <button
              type="button"
              className="db-view-btn"
              onClick={handleViewUsers}
            >
              View users
              <span className="db-view-arrow">
                <i className="bi bi-arrow-right"></i>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating bottom-right toast */}
      {notice && (
        <div className={`db-notice-toast ${notice.type}`} role="status">
          <span>{notice.text}</span>
          <button
            type="button"
            className="db-notice-close"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      {/* Add Item Modal */}
      {formModalOpen && (
        <div
          className="db-modal-backdrop"
          onClick={() => setFormModalOpen(false)}
        >
          <div
            className="db-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="db-modal-header">
              <h3>Add item</h3>
              <button
                type="button"
                className="db-modal-close"
                onClick={() => setFormModalOpen(false)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="db-modal-body">
              <div className="db-field">
                <label htmlFor="db-name">Item name</label>
                <input
                  id="db-name"
                  type="text"
                  className="db-input"
                  value={form.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  placeholder="e.g. A4 bond paper"
                />
              </div>

              <div className="db-field-row">
                <div className="db-field">
                  <label htmlFor="db-category">Category</label>
                  <select
                    id="db-category"
                    className="db-input db-select"
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
                      className="db-input db-new-category"
                      placeholder="e.g. Electrical Supplies"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      aria-label="New category name"
                      autoFocus
                    />
                  )}
                </div>
                <div className="db-field">
                  <label htmlFor="db-unit">Unit</label>
                  <input
                    id="db-unit"
                    type="text"
                    className="db-input"
                    value={form.unit}
                    onChange={(e) => handleFormChange("unit", e.target.value)}
                    placeholder="pcs, ream, box"
                  />
                </div>
              </div>

              <div className="db-field-row">
                <div className="db-field">
                  <label htmlFor="db-qty">Quantity on hand</label>
                  <input
                    id="db-qty"
                    type="number"
                    min="0"
                    className="db-input"
                    value={form.quantity}
                    onChange={(e) =>
                      handleFormChange("quantity", e.target.value)
                    }
                  />
                </div>
                <div className="db-field">
                  <label htmlFor="db-reorder">Reorder level</label>
                  <input
                    id="db-reorder"
                    type="number"
                    min="0"
                    className="db-input"
                    value={form.reorderLevel}
                    onChange={(e) =>
                      handleFormChange("reorderLevel", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="db-field">
                <label htmlFor="db-max">Normal limit per request</label>
                <input
                  id="db-max"
                  type="number"
                  min="1"
                  className="db-input"
                  value={form.maxNormal}
                  onChange={(e) =>
                    handleFormChange("maxNormal", e.target.value)
                  }
                />
                <span className="db-field-hint">
                  Users can still request more, but they must explain why.
                </span>
              </div>

              <div className="db-field">
                <label htmlFor="db-location">Storage location (optional)</label>
                <input
                  id="db-location"
                  type="text"
                  className="db-input"
                  value={form.location}
                  onChange={(e) =>
                    handleFormChange("location", e.target.value)
                  }
                  placeholder="e.g. Storage Room A"
                />
              </div>

              <p className="db-audit-note">
                This item will be recorded as added by{" "}
                <strong>{actorName}</strong>.
              </p>

              {formError && (
                <div className="db-error-box">
                  <strong>Could not save</strong>
                  <p>{formError}</p>
                </div>
              )}
            </div>

            <div className="db-modal-footer">
              <button
                type="button"
                className="db-btn-secondary"
                onClick={() => setFormModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="db-btn-primary"
                onClick={handleSaveItem}
                disabled={!canSave || saving}
              >
                {saving ? "Saving..." : "Add item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
import React, { useState, useEffect } from "react";
import "../../styles/admin/UserManagement.css";

const FILTERS = ["All", "User", "Moderator", "Deactivated"];
const ITEMS_PER_PAGE = 5;

// Works whether or not VITE_API_URL ends in "/api"
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
  if (!res.ok) {
    const err = new Error(data.message || "Something went wrong.");
    err.field = data.field;
    throw err;
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Modals                                                              */
/* ------------------------------------------------------------------ */

function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}) {
  if (!isOpen) return null;
  return (
    <div className="um-modal-backdrop" onClick={onClose}>
      <div
        className="um-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="um-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um-modal-header">
          <h3 id="um-confirm-title">{title}</h3>
          <button
            type="button"
            className="um-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="um-modal-body">
          <p className="um-confirm-text">{message}</p>
        </div>

        <div className="um-modal-footer">
          <button type="button" className="um-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="um-btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  idNumber: "",
  firstName: "",
  lastName: "",
  email: "",
  // contact: "",
  password: "",
  confirmPassword: "",
};

function CreateModeratorModal({ isOpen, onClose, onCreate }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setErrors({});
      setShowPassword(false);
      setShowConfirm(false);
      setServerError("");
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setServerError("");
  };

  const validate = () => {
    const next = {};
    if (!form.idNumber.trim()) next.idNumber = "ID number is required.";
    else if (!/^[A-Za-z0-9-]{3,20}$/.test(form.idNumber.trim()))
      next.idNumber = "Use 3-20 letters, numbers, or hyphens.";
    // Stricter option if moderator IDs always look like P-1234:
    // else if (!/^P-\d{4}$/i.test(form.idNumber.trim()))
    //   next.idNumber = "Use the format P-1234.";
    if (!form.firstName.trim()) next.firstName = "First name is required.";
    if (!form.lastName.trim()) next.lastName = "Last name is required.";
    if (!form.email.trim()) next.email = "Email address is required.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email))
      next.email = "Enter a valid email address.";
    // if (!form.contact.trim()) next.contact = "Contact number is required.";
    // else if (!/^09\d{9}$/.test(form.contact))
    //   next.contact = "Use an 11-digit number starting with 09.";
    if (form.password.length < 8)
      next.password = "Password must be at least 8 characters.";
    if (form.confirmPassword !== form.password)
      next.confirmPassword = "Passwords do not match.";
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSubmitting(true);
    setServerError("");
    try {
      await onCreate({
        idNumber: form.idNumber.trim().toUpperCase(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        // contact: form.contact.trim(),
        password: form.password, // sent over HTTPS only; the server hashes it
      });
    } catch (err) {
      if (err.field)
        setErrors((prev) => ({ ...prev, [err.field]: err.message }));
      else setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="um-modal-backdrop" onClick={onClose}>
      <div
        className="um-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="um-create-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um-modal-header">
          <div>
            <h3 id="um-create-title">Create moderator account</h3>
            <p className="um-modal-subtitle">
              Set up login credentials for a new Supply &amp; Property
              moderator.
            </p>
          </div>
          <button
            type="button"
            className="um-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <form className="um-modal-form" onSubmit={handleSubmit} noValidate>
          <div className="um-modal-body">
            <div className="um-field">
              <label htmlFor="um-id-number">ID number</label>
              <input
                id="um-id-number"
                name="idNumber"
                type="text"
                className="um-input"
                placeholder="e.g. P-1234"
                value={form.idNumber}
                onChange={handleChange}
              />
              {errors.idNumber && (
                <span className="um-field-error">{errors.idNumber}</span>
              )}
            </div>

            <div className="um-field-row">
              <div className="um-field">
                <label htmlFor="um-first-name">First name</label>
                <input
                  id="um-first-name"
                  name="firstName"
                  type="text"
                  className="um-input"
                  placeholder="First name"
                  value={form.firstName}
                  onChange={handleChange}
                />
                {errors.firstName && (
                  <span className="um-field-error">{errors.firstName}</span>
                )}
              </div>
              <div className="um-field">
                <label htmlFor="um-last-name">Last name</label>
                <input
                  id="um-last-name"
                  name="lastName"
                  type="text"
                  className="um-input"
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={handleChange}
                />
                {errors.lastName && (
                  <span className="um-field-error">{errors.lastName}</span>
                )}
              </div>
            </div>

            <div className="um-field">
              <label htmlFor="um-email">Email address</label>
              <input
                id="um-email"
                name="email"
                type="email"
                className="um-input"
                placeholder="moderator@buksu.edu.ph"
                value={form.email}
                onChange={handleChange}
              />
              {errors.email && (
                <span className="um-field-error">{errors.email}</span>
              )}
            </div>

            {/*
            <div className="um-field">
              <label htmlFor="um-contact">Contact number</label>
              <input
                id="um-contact"
                name="contact"
                type="tel"
                className="um-input"
                maxLength={11}
                placeholder="09XXXXXXXXX"
                value={form.contact}
                onChange={handleChange}
              />
              {errors.contact && (
                <span className="um-field-error">{errors.contact}</span>
              )}
            </div>
            */}

            <div className="um-field-row">
              <div className="um-field">
                <label htmlFor="um-password">Password</label>
                <div className="um-input-wrap">
                  <input
                    id="um-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className="um-input"
                    placeholder="At least 8 characters"
                    value={form.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    className="um-eye-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    <i
                      className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}
                    ></i>
                  </button>
                </div>
                {errors.password && (
                  <span className="um-field-error">{errors.password}</span>
                )}
              </div>
              <div className="um-field">
                <label htmlFor="um-confirm">Confirm password</label>
                <div className="um-input-wrap">
                  <input
                    id="um-confirm"
                    name="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    className="um-input"
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    className="um-eye-btn"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    <i
                      className={`bi ${showConfirm ? "bi-eye-slash" : "bi-eye"}`}
                    ></i>
                  </button>
                </div>
                {errors.confirmPassword && (
                  <span className="um-field-error">
                    {errors.confirmPassword}
                  </span>
                )}
              </div>
            </div>

            {serverError && (
              <div className="um-error-box">
                <strong>Could not create account</strong>
                <p>{serverError}</p>
              </div>
            )}
          </div>

          <div className="um-modal-footer">
            <button
              type="button"
              className="um-btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="um-btn-primary"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function UserManagement() {
  useEffect(() => {
    document.title = "User Management | BukSUPPLY";
  }, []);

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [reactivateTarget, setReactivateTarget] = useState(null);

  // Toast notice
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  /* ---- Debounce search so we don't hit the API on every keystroke ---- */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  /* ---- Fetch users whenever filter / search / page changes ---- */
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const params = new URLSearchParams({
          filter: activeFilter,
          search: debouncedSearch.trim(),
          page: currentPage,
          limit: ITEMS_PER_PAGE,
        });
        const data = await apiFetch(`?${params}`, {
          signal: controller.signal,
        });
        setUsers(data.users);
        setTotal(data.total);
      } catch (err) {
        if (err.name !== "AbortError") setLoadError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [activeFilter, debouncedSearch, currentPage, refreshKey]);

  /* ---- Pagination (server-side) ---- */
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  /* ---- Actions ---- */
  const handleCreateModerator = async (data) => {
    // Throws on error; the modal catches it and shows the message
    await apiFetch("/moderators", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setCreateModalOpen(false);
    setActiveFilter("All");
    setSearchTerm("");
    setDebouncedSearch("");
    setCurrentPage(1);
    setRefreshKey((k) => k + 1);
    setNotice({
      type: "success",
      text: `Moderator account created for ${data.firstName} ${data.lastName}.`,
    });
  };

  const handleConfirmReactivate = async () => {
    if (reactivateTarget) {
      try {
        await apiFetch(`/${reactivateTarget._id}/reactivate`, {
          method: "PATCH",
        });
        setRefreshKey((k) => k + 1);
        setNotice({
          type: "success",
          text: `${reactivateTarget.name} (${reactivateTarget.id}) was reactivated.`,
        });
      } catch (err) {
        setLoadError(err.message);
      }
    }
    setReactivateTarget(null);
  };

  // One helper for the loading / empty rows
  const messageRow = (icon, title, text) => (
    <tr>
      <td colSpan="6" className="um-empty-cell">
        <div className="um-empty-content">
          <div className="um-empty-icon">
            <i className={`bi ${icon}`}></i>
          </div>
          <h4>{title}</h4>
          <p>{text}</p>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="um-page">
      {/* Header card */}
      <div className="um-header-card">
        <div className="um-header-text">
          <h1 className="um-title">User Management</h1>
          <p className="um-subtitle">
            Manage user accounts and system access for{" "}
            <strong>BukSU Supply &amp; Property Management</strong>. Create new
            moderator credentials or monitor active staff and student accounts,
            and manage deactivated accounts.
          </p>
        </div>
        <button
          type="button"
          className="um-btn-add"
          onClick={() => setCreateModalOpen(true)}
        >
          <i className="bi bi-plus-lg"></i> Create Moderator Account
        </button>
      </div>

      {/* Floating bottom-right toast */}
      {notice && (
        <div className={`um-notice-toast ${notice.type}`} role="status">
          <span>{notice.text}</span>
          <button
            type="button"
            className="um-notice-close"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      {/* Search + filter tabs */}
      <div className="um-filter-bar">
        <div className="um-search-wrapper">
          <i className="bi bi-search"></i>
          <input
            type="text"
            placeholder="Search by ID or name..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>

        <div className="um-status-tabs" role="tablist">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              role="tab"
              aria-selected={activeFilter === filter}
              className={`um-tab-btn ${activeFilter === filter ? "active" : ""}`}
              onClick={() => handleFilterChange(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="um-error-box" role="alert">
          {loadError}
        </div>
      )}

      {/* Users table */}
      <div className="um-section-card">
        <div className="um-table-wrapper">
          <table className="um-table">
            <thead>
              <tr>
                <th className="um-col-id">ID</th>
                <th className="um-col-name">Name</th>
                <th className="um-col-email">Email Address</th>
                <th className="um-col-contact">Contact Number</th>
                <th className="um-col-status">Status</th>
                <th className="um-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? messageRow(
                    "bi-hourglass-split",
                    "Loading...",
                    "Fetching user accounts."
                  )
                : users.length > 0
                  ? users.map((u) => (
                      <tr key={u._id}>
                        <td className="um-cell-id">{u.id}</td>
                        <td>
                          <div className="um-name um-clamp" title={u.name}>
                            {u.name}
                          </div>
                          <div className="um-role">{u.role}</div>
                        </td>
                        <td>
                          <div className="um-clamp" title={u.email}>
                            {u.email}
                          </div>
                        </td>
                        <td>{u.contact || "—"}</td>
                        <td>
                          <span
                            className={`um-badge ${u.status.toLowerCase()}`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td>
                          {u.status === "Deactivated" ? (
                            <button
                              type="button"
                              className="um-btn-action um-btn-reactivate"
                              onClick={() => setReactivateTarget(u)}
                              aria-label={`Reactivate ${u.name}`}
                            >
                              <i className="bi bi-arrow-counterclockwise"></i>{" "}
                              Reactivate
                            </button>
                          ) : (
                            <span className="um-no-action">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  : messageRow(
                      "bi-people",
                      "No Users Found",
                      "No accounts match your current search or filter."
                    )}
            </tbody>
          </table>
        </div>

        <div className="um-footer-bar">
          <span>
            Showing {users.length} of {total} users
          </span>

          <div className="um-pagination">
            <button
              type="button"
              className="um-btn-action um-btn-neutral"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="um-page-indicator">Page {currentPage}</span>
            <button
              type="button"
              className="um-btn-action um-btn-neutral"
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateModeratorModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateModerator}
      />

      <ConfirmModal
        isOpen={!!reactivateTarget}
        title="Reactivate account?"
        message={
          reactivateTarget
            ? `${reactivateTarget.name} (${reactivateTarget.id}) will regain access to the system.`
            : ""
        }
        confirmLabel="Reactivate"
        onConfirm={handleConfirmReactivate}
        onClose={() => setReactivateTarget(null)}
      />
    </div>
  );
}
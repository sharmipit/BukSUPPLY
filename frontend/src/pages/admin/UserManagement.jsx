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
  icon,
  iconClass,
  title,
  message,
  confirmLabel,
  confirmClass,
  onConfirm,
  onClose,
}) {
  if (!isOpen) return null;
  return (
    <div className="um-modal-overlay" onClick={onClose}>
      <div
        className="um-modal um-modal-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`um-modal-icon ${iconClass}`}>
          <i className={`bi ${icon}`}></i>
        </div>
        <h3 className="um-modal-title um-center">{title}</h3>
        <p className="um-modal-text um-center">{message}</p>
        <div className="um-modal-actions">
          <button
            type="button"
            className="um-btn um-btn-outline"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`um-btn ${confirmClass}`}
            onClick={onConfirm}
          >
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
    <div className="um-modal-overlay" onClick={onClose}>
      <div className="um-modal" onClick={(e) => e.stopPropagation()}>
        <div className="um-modal-header">
          <div>
            <h3 className="um-modal-title">Create Moderator Account</h3>
            <p className="um-modal-text">
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

        <form onSubmit={handleSubmit} noValidate>
          <div className="um-form-group">
            <label htmlFor="um-id-number">ID Number</label>
            <input
              id="um-id-number"
              name="idNumber"
              type="text"
              placeholder="e.g. P-1234"
              value={form.idNumber}
              onChange={handleChange}
            />
            {errors.idNumber && (
              <span className="um-error">{errors.idNumber}</span>
            )}
          </div>

          <div className="um-form-row">
            <div className="um-form-group">
              <label htmlFor="um-first-name">First Name</label>
              <input
                id="um-first-name"
                name="firstName"
                type="text"
                placeholder="First name"
                value={form.firstName}
                onChange={handleChange}
              />
              {errors.firstName && (
                <span className="um-error">{errors.firstName}</span>
              )}
            </div>
            <div className="um-form-group">
              <label htmlFor="um-last-name">Last Name</label>
              <input
                id="um-last-name"
                name="lastName"
                type="text"
                placeholder="Last name"
                value={form.lastName}
                onChange={handleChange}
              />
              {errors.lastName && (
                <span className="um-error">{errors.lastName}</span>
              )}
            </div>
          </div>

          <div className="um-form-group">
            <label htmlFor="um-email">Email Address</label>
            <input
              id="um-email"
              name="email"
              type="email"
              placeholder="moderator@buksu.edu.ph"
              value={form.email}
              onChange={handleChange}
            />
            {errors.email && <span className="um-error">{errors.email}</span>}
          </div>

          {/*
          <div className="um-form-group">
            <label htmlFor="um-contact">Contact Number</label>
            <input
              id="um-contact"
              name="contact"
              type="tel"
              maxLength={11}
              placeholder="09XXXXXXXXX"
              value={form.contact}
              onChange={handleChange}
            />
            {errors.contact && (
              <span className="um-error">{errors.contact}</span>
            )}
          </div>
          */}

          <div className="um-form-row">
            <div className="um-form-group">
              <label htmlFor="um-password">Password</label>
              <div className="um-input-wrap">
                <input
                  id="um-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="um-eye-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <i
                    className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}
                  ></i>
                </button>
              </div>
              {errors.password && (
                <span className="um-error">{errors.password}</span>
              )}
            </div>
            <div className="um-form-group">
              <label htmlFor="um-confirm">Confirm Password</label>
              <div className="um-input-wrap">
                <input
                  id="um-confirm"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
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
                <span className="um-error">{errors.confirmPassword}</span>
              )}
            </div>
          </div>

          {serverError && <span className="um-error">{serverError}</span>}

          <div className="um-modal-actions">
            <button
              type="button"
              className="um-btn um-btn-outline"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="um-btn-primary"
              disabled={submitting}
            >
              <i className="bi bi-plus-lg"></i>{" "}
              {submitting ? "Creating..." : "Create Account"}
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
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  // Kebab (three dots) menu: { id, top, right } or null
  const [openMenu, setOpenMenu] = useState(null);

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [reactivateTarget, setReactivateTarget] = useState(null);

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

  /* ---- Close the row menu on outside click / scroll / resize ---- */
  useEffect(() => {
    if (!openMenu) return undefined;
    const close = () => setOpenMenu(null);
    document.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [openMenu]);

  /* ---- Pagination (server-side) ---- */
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const currentUsers = users;

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  /* ---- Row menu ---- */
  const handleMenuToggle = (e, userId) => {
    e.stopPropagation();
    if (openMenu?.id === userId) {
      setOpenMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenMenu({
      id: userId,
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  };

  const menuUser = openMenu ? users.find((u) => u._id === openMenu.id) : null;

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
  };

  const handleConfirmReactivate = async () => {
    if (reactivateTarget) {
      try {
        await apiFetch(`/${reactivateTarget._id}/reactivate`, {
          method: "PATCH",
        });
        setRefreshKey((k) => k + 1);
      } catch (err) {
        setLoadError(err.message);
      }
    }
    setReactivateTarget(null);
  };

  return (
    <div className="um-page">
      {/* 1. Header card */}
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
          onClick={() => setCreateModalOpen(true)}
          className="um-btn-primary um-create-btn"
        >
          <i className="bi bi-plus-lg"></i> Create Moderator Account
        </button>
      </div>

      {/* 2. Search + filter pills */}
      <div className="um-toolbar">
        <div className="um-search">
          <i className="bi bi-search"></i>
          <input
            type="text"
            placeholder="Search by ID or name..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>

        <div className="um-filter-pills" role="tablist">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              role="tab"
              aria-selected={activeFilter === filter}
              className={`um-pill ${activeFilter === filter ? "active" : ""}`}
              onClick={() => handleFilterChange(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="um-error" role="alert">
          {loadError}
        </div>
      )}

      {/* 3. Users table */}
      <div className="um-card">
        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email Address</th>
                <th>Contact Number</th>
                <th>Status</th>
                <th className="um-actions-col"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="um-empty-cell">
                    Loading users...
                  </td>
                </tr>
              ) : currentUsers.length > 0 ? (
                currentUsers.map((u) => (
                  <tr key={u._id}>
                    <td className="um-id-cell">{u.id}</td>
                    <td>
                      <div className="um-name">{u.name}</div>
                      <div className="um-role">{u.role}</div>
                    </td>
                    <td>{u.email}</td>
                    <td>{u.contact || "-"}</td>
                    <td>
                      <span className={`um-badge ${u.status.toLowerCase()}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="um-actions-cell">
                      <button
                        type="button"
                        className="um-kebab-btn"
                        onClick={(e) => handleMenuToggle(e, u._id)}
                        aria-label={`Actions for ${u.name}`}
                        aria-haspopup="menu"
                        aria-expanded={openMenu?.id === u._id}
                      >
                        <i className="bi bi-three-dots-vertical"></i>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="um-empty-cell">
                    <div className="um-empty-content">
                      <div className="um-empty-icon">
                        <i className="bi bi-people"></i>
                      </div>
                      <h4>No Users Found</h4>
                      <p>No accounts match your current search or filter.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="um-table-footer">
          <span>
            Showing {currentUsers.length} of {total} Users
          </span>

          <div className="um-pagination">
            <button
              type="button"
              className="um-btn um-btn-outline"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="um-page-indicator">Page {currentPage}</span>
            <button
              type="button"
              className="um-btn um-btn-outline"
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Row action menu (fixed-position so the table wrapper never clips it) */}
      {openMenu && menuUser && (
        <div
          className="um-row-menu"
          role="menu"
          style={{ top: openMenu.top, right: openMenu.right }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Reactivate is always shown, but only clickable when the account is Deactivated */}
          <button
            type="button"
            role="menuitem"
            className="um-row-menu-item"
            disabled={menuUser.status !== "Deactivated"}
            onClick={() => {
              setReactivateTarget(menuUser);
              setOpenMenu(null);
            }}
          >
            <i className="bi bi-arrow-counterclockwise"></i> Reactivate
          </button>
        </div>
      )}

      {/* Modals */}
      <CreateModeratorModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateModerator}
      />

      <ConfirmModal
        isOpen={!!reactivateTarget}
        icon="bi-arrow-counterclockwise"
        iconClass="success"
        title="Reactivate Account?"
        message={
          reactivateTarget
            ? `${reactivateTarget.name} (${reactivateTarget.id}) will regain access to the system.`
            : ""
        }
        confirmLabel="Reactivate"
        confirmClass="um-btn-brand"
        onConfirm={handleConfirmReactivate}
        onClose={() => setReactivateTarget(null)}
      />
    </div>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import '../../styles/admin/UserManagement.css';

const FILTERS = ['All', 'User', 'Moderator', 'Deactivated'];
const ITEMS_PER_PAGE = 5;

/* ------------------------------------------------------------------ */
/* Modals                                                              */
/* ------------------------------------------------------------------ */

function ConfirmModal({ isOpen, icon, iconClass, title, message, confirmLabel, confirmClass, onConfirm, onClose }) {
  if (!isOpen) return null;
  return (
    <div className="um-modal-overlay" onClick={onClose}>
      <div className="um-modal um-modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className={`um-modal-icon ${iconClass}`}>
          <i className={`bi ${icon}`}></i>
        </div>
        <h3 className="um-modal-title um-center">{title}</h3>
        <p className="um-modal-text um-center">{message}</p>
        <div className="um-modal-actions">
          <button type="button" className="um-btn um-btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className={`um-btn ${confirmClass}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_FORM = { firstName: '', lastName: '', email: '', contact: '', password: '', confirmPassword: '' };

function CreateModeratorModal({ isOpen, onClose, onCreate }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setErrors({});
      setShowPassword(false);
      setShowConfirm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const next = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required.';
    if (!form.lastName.trim()) next.lastName = 'Last name is required.';
    if (!form.email.trim()) next.email = 'Email address is required.';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address.';
    if (!form.contact.trim()) next.contact = 'Contact number is required.';
    else if (!/^09\d{9}$/.test(form.contact)) next.contact = 'Use an 11-digit number starting with 09.';
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters.';
    if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match.';
    return next;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    onCreate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      name: `${form.lastName.trim()}, ${form.firstName.trim()}`, // displayed as "Last, First"
      email: form.email.trim(),
      contact: form.contact.trim(),
      password: form.password, // BACKEND DEV NOTE: hash on the server, never store plain text
    });
  };

  return (
    <div className="um-modal-overlay" onClick={onClose}>
      <div className="um-modal" onClick={(e) => e.stopPropagation()}>
        <div className="um-modal-header">
          <div>
            <h3 className="um-modal-title">Create Moderator Account</h3>
            <p className="um-modal-text">Set up login credentials for a new Supply &amp; Property moderator.</p>
          </div>
          <button type="button" className="um-modal-close" onClick={onClose} aria-label="Close">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="um-form-row">
            <div className="um-form-group">
              <label htmlFor="um-first-name">First Name</label>
              <input id="um-first-name" name="firstName" type="text" placeholder="First name" value={form.firstName} onChange={handleChange} />
              {errors.firstName && <span className="um-error">{errors.firstName}</span>}
            </div>
            <div className="um-form-group">
              <label htmlFor="um-last-name">Last Name</label>
              <input id="um-last-name" name="lastName" type="text" placeholder="Last name" value={form.lastName} onChange={handleChange} />
              {errors.lastName && <span className="um-error">{errors.lastName}</span>}
            </div>
          </div>

          <div className="um-form-group">
            <label htmlFor="um-email">Email Address</label>
            <input id="um-email" name="email" type="email" placeholder="moderator@buksu.edu.ph" value={form.email} onChange={handleChange} />
            {errors.email && <span className="um-error">{errors.email}</span>}
          </div>

          <div className="um-form-group">
            <label htmlFor="um-contact">Contact Number</label>
            <input id="um-contact" name="contact" type="tel" maxLength={11} placeholder="09XXXXXXXXX" value={form.contact} onChange={handleChange} />
            {errors.contact && <span className="um-error">{errors.contact}</span>}
          </div>

          <div className="um-form-row">
            <div className="um-form-group">
              <label htmlFor="um-password">Password</label>
              <div className="um-input-wrap">
                <input id="um-password" name="password" type={showPassword ? 'text' : 'password'} placeholder="At least 8 characters" value={form.password} onChange={handleChange} />
                <button
                  type="button"
                  className="um-eye-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
              {errors.password && <span className="um-error">{errors.password}</span>}
            </div>
            <div className="um-form-group">
              <label htmlFor="um-confirm">Confirm Password</label>
              <div className="um-input-wrap">
                <input id="um-confirm" name="confirmPassword" type={showConfirm ? 'text' : 'password'} placeholder="Re-enter password" value={form.confirmPassword} onChange={handleChange} />
                <button
                  type="button"
                  className="um-eye-btn"
                  onClick={() => setShowConfirm((prev) => !prev)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  <i className={`bi ${showConfirm ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
              {errors.confirmPassword && <span className="um-error">{errors.confirmPassword}</span>}
            </div>
          </div>

          <div className="um-modal-actions">
            <button type="button" className="um-btn um-btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="um-btn-primary">
              <i className="bi bi-plus-lg"></i> Create Account
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
  // Dummy users. role: 'Student' | 'Staff' | 'Moderator'  |  status: 'Active' | 'Deactivated'
  const [users, setUsers] = useState([
    { id: '2401105626', name: 'Gamboa, Sharmagne Faith', role: 'Student', email: '2401105626@student.buksu.edu.ph', contact: '09067386392', status: 'Active' },
    { id: '2401105630', name: 'Miasco, Gwyneth', role: 'Student', email: '2401105630@student.buksu.edu.ph', contact: '09067386392', status: 'Deactivated' },
    { id: 'P-4353', name: 'Dummy You', role: 'Moderator', email: 'moderator@buksu.edu.ph', contact: '09128563025', status: 'Active' },
    { id: 'S-2011', name: 'Abobo, James', role: 'Staff', email: 'james.abobo@buksu.edu.ph', contact: '09171234567', status: 'Active' },
    { id: '2401105701', name: 'Dela Cruz, Maria', role: 'Student', email: '2401105701@student.buksu.edu.ph', contact: '09281234567', status: 'Active' },
    { id: 'S-2034', name: 'Santos, Ricardo', role: 'Staff', email: 'ricardo.santos@buksu.edu.ph', contact: '09351234567', status: 'Deactivated' },
    { id: 'P-4410', name: 'Reyes, Angela', role: 'Moderator', email: 'angela.reyes@buksu.edu.ph', contact: '09451234567', status: 'Active' },
    { id: '2401105745', name: 'Lopez, Daniel', role: 'Student', email: '2401105745@student.buksu.edu.ph', contact: '09561234567', status: 'Active' },
    { id: '2401105812', name: 'Tan, Kristine', role: 'Student', email: '2401105812@student.buksu.edu.ph', contact: '09671234567', status: 'Active' },
    { id: 'S-2050', name: 'Villanueva, Mark', role: 'Staff', email: 'mark.villanueva@buksu.edu.ph', contact: '09781234567', status: 'Active' },
    { id: 'P-4502', name: 'Navarro, Paolo', role: 'Moderator', email: 'paolo.navarro@buksu.edu.ph', contact: '09891234567', status: 'Deactivated' },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  // Kebab (three dots) menu: { id, top, right } or null
  const [openMenu, setOpenMenu] = useState(null);

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [reactivateTarget, setReactivateTarget] = useState(null);

  /* ---- Close the row menu on outside click / scroll / resize ---- */
  useEffect(() => {
    if (!openMenu) return undefined;
    const close = () => setOpenMenu(null);
    document.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [openMenu]);

  /* ---- Filtering + search ---- */
  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((u) => {
      let matchesFilter = true;
      if (activeFilter === 'User') matchesFilter = u.role === 'Student' || u.role === 'Staff';
      else if (activeFilter === 'Moderator') matchesFilter = u.role === 'Moderator';
      else if (activeFilter === 'Deactivated') matchesFilter = u.status === 'Deactivated';

      const matchesSearch = !term || u.id.toLowerCase().includes(term) || u.name.toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [users, activeFilter, searchTerm]);

  /* ---- Pagination ---- */
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

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

  const menuUser = openMenu ? users.find((u) => u.id === openMenu.id) : null;

  /* ---- Actions ---- */
  const handleCreateModerator = (data) => {
    // BACKEND DEV NOTE: POST /api/admin/users/moderators  (server generates the P-#### ID)
    const newModerator = {
      id: `P-${Math.floor(1000 + Math.random() * 9000)}`,
      name: data.name,
      role: 'Moderator',
      email: data.email,
      contact: data.contact,
      status: 'Active',
    };
    setUsers((prev) => [newModerator, ...prev]);
    setCreateModalOpen(false);
    setActiveFilter('All');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleConfirmReactivate = () => {
    if (reactivateTarget) {
      // BACKEND DEV NOTE: PATCH /api/admin/users/:id/reactivate
      setUsers((prev) => prev.map((u) => (u.id === reactivateTarget.id ? { ...u, status: 'Active' } : u)));
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
            Manage user accounts and system access for <strong>BukSU Supply &amp; Property Management</strong>. Create new moderator credentials or monitor active staff and student accounts, and manage deactivated accounts.
          </p>
        </div>
        <button type="button" onClick={() => setCreateModalOpen(true)} className="um-btn-primary um-create-btn">
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
              className={`um-pill ${activeFilter === filter ? 'active' : ''}`}
              onClick={() => handleFilterChange(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

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
              {/*
                BACKEND DEVELOPER INTEGRATION GUIDE (Users Table):
                1. Fetch users from: GET /api/admin/users?filter=${activeFilter}&search=${searchTerm}&page=${currentPage}&limit=${ITEMS_PER_PAGE}
              */}
              {currentUsers.length > 0 ? (
                currentUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="um-id-cell">{u.id}</td>
                    <td>
                      <div className="um-name">{u.name}</div>
                      <div className="um-role">{u.role}</div>
                    </td>
                    <td>{u.email}</td>
                    <td>{u.contact}</td>
                    <td>
                      <span className={`um-badge ${u.status.toLowerCase()}`}>{u.status}</span>
                    </td>
                    <td className="um-actions-cell">
                      <button
                        type="button"
                        className="um-kebab-btn"
                        onClick={(e) => handleMenuToggle(e, u.id)}
                        aria-label={`Actions for ${u.name}`}
                        aria-haspopup="menu"
                        aria-expanded={openMenu?.id === u.id}
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
            Showing {currentUsers.length} of {filteredUsers.length} Users
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
            disabled={menuUser.status !== 'Deactivated'}
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
        message={reactivateTarget ? `${reactivateTarget.name} (${reactivateTarget.id}) will regain access to the system.` : ''}
        confirmLabel="Reactivate"
        confirmClass="um-btn-brand"
        onConfirm={handleConfirmReactivate}
        onClose={() => setReactivateTarget(null)}
      />

    </div>
  );
}
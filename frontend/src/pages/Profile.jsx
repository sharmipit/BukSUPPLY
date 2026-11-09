import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import LogoutModal from "../components/LogoutModal";
import DeactivateModal from "../components/DeactivateModal";
import TwoFactorSetup from "../components/TwoFactorSetup"; // 2FA
import { saveProfile, deactivateAccount } from "../api/user";
import bannerImg from "../assets/buksu-museum.jpg";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../styles/Profile.css";

import { DEFAULT_AVATAR, getAvatar } from "../utils/avatar";

// Accepts 09XXXXXXXXX or +639XXXXXXXXX
const PH_MOBILE = /^(09|\+639)\d{9}$/;

const LEGAL = {
  terms: {
    title: "Terms & Conditions",
    sections: [
      [
        "1. Acceptance of Terms",
        "By creating a BukSUPPLY account, you agree to follow these terms and all applicable BukSU policies.",
      ],
      [
        "2. Eligibility",
        "Accounts are limited to currently enrolled students and active BukSU personnel with a valid institutional email address.",
      ],
      [
        "3. Account Responsibility",
        "You are responsible for keeping your password confidential and for all activity under your account. Report unauthorized use to PSMO immediately.",
      ],
      [
        "4. Requisitions & Reservations",
        "Requests must be accurate and made for official university purposes only. PSMO may approve, modify, or decline any request.",
      ],
      [
        "5. Acceptable Use",
        "You may not misuse the system, submit false information, or attempt to access data or accounts that are not yours.",
      ],
      [
        "6. Suspension",
        "PSMO may suspend or terminate accounts that violate these terms.",
      ],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      [
        "1. Information We Collect",
        "Your name, institutional email, ID number, and records of your requisitions and reservations.",
      ],
      [
        "2. How We Use It",
        "To verify your identity, process requests, and keep records for inventory and audit purposes.",
      ],
      [
        "3. Google Sign-In",
        "If you sign up with Google, we receive your name and email from Google. We do not receive your Google password.",
      ],
      [
        "4. Data Sharing",
        "Your data is shared only with authorized BukSU offices and is never sold to third parties.",
      ],
      [
        "5. Your Rights",
        "Under the Data Privacy Act of 2012 (RA 10173), you may access, correct, or request deletion of your personal data by contacting PSMO.",
      ],
      [
        "6. Security",
        "We apply reasonable technical and organizational safeguards, but no system is completely secure.",
      ],
    ],
  },
};

// Terms & Conditions / Privacy Policy dialog matched to application modal standards
function LegalModal({ type, onClose }) {
  useEffect(() => {
    if (!type) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [type, onClose]);

  if (!type) return null;
  const doc = LEGAL[type];

  return (
    <div className="pf-overlay active" onClick={onClose}>
      <div
        className="req-modal-card pf-legal-card"
        role="dialog"
        aria-modal="true"
        aria-label={doc.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="req-modal-header">
          <div>
            <h3 className="req-modal-title">{doc.title}</h3>
            <p className="req-modal-subtitle">BukSU Supply & Property Management Office guidelines.</p>
          </div>
          <button
            type="button"
            className="req-modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="req-modal-body">
          {doc.sections.map(([heading, text]) => (
            <div className="pf-legal-section" key={heading}>
              <h4>{heading}</h4>
              <p>{text}</p>
            </div>
          ))}
        </div>

        <div className="details-modal-footer">
          <button type="button" className="btn-modal-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Builds the editable values from the logged-in user
const getInitialValues = (user) => ({
  firstName: user?.firstName || user?.name || "",
  lastName: user?.lastName || "",
  contactNumber: user?.contactNumber || user?.phone || "",
});

export default function Profile() {
  useEffect(() => {
    document.title = "Profile | BukSUPPLY";
  }, []);

  const { user, updateUser, setUser, logout } = useAuth();

  // Saved values (what the page shows) and draft values (while editing)
  const [values, setValues] = useState(() => getInitialValues(user));
  const [draft, setDraft] = useState(values);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(null); // 'terms' | 'privacy' | null
  const [notice, setNotice] = useState(null);

  // Keep in sync if the user loads/changes (but never overwrite an edit in progress)
  useEffect(() => {
    if (editing) return;
    const next = getInitialValues(user);
    setValues(next);
    setDraft(next);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-hide the toast after 5 seconds
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const displayName =
    [values.firstName, values.lastName].filter(Boolean).join(" ") ||
    user?.name ||
    "User";

  const roleText = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
    : "Member";

  // Administrators cannot deactivate their own account
  const canDeactivate = !["administrator"].includes(user?.role?.toLowerCase());

  const idNumber = user?.idNumber || user?.studentId || "N/A";
  const avatarSrc = getAvatar(user);
  const email = user?.email || "";

  /* ---------- Edit profile ---------- */
  const startEdit = () => {
    setDraft(values);
    setErrors({});
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(values);
    setErrors({});
    setEditing(false);
  };

  const handleChange = (field) => (e) => {
    let value = e.target.value;
    if (field === "contactNumber") value = value.replace(/[^\d+]/g, "");
    setDraft((d) => ({ ...d, [field]: value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!draft.firstName.trim()) next.firstName = "First name is required.";
    if (!draft.lastName.trim()) next.lastName = "Last name is required.";
    if (draft.contactNumber && !PH_MOBILE.test(draft.contactNumber)) {
      next.contactNumber = "Use a valid PH number, e.g. 09123456789.";
    }
    return next;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const found = validate();
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }

    const cleaned = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      contactNumber: draft.contactNumber.trim(),
    };

    setSaving(true);
    try {
      const { user: saved } = await saveProfile(cleaned);

      const next = getInitialValues(saved);
      setValues(next);
      setDraft(next);

      // Update the shared user so the sidebar footer, the top-bar dropdown
      // and this page all show the new name right away.
      if (typeof updateUser === "function") {
        updateUser(saved);
      } else if (typeof setUser === "function") {
        setUser({ ...user, ...saved });
      }

      setEditing(false);
      setErrors({});
      setNotice({ type: "success", text: "Your profile has been updated." });
    } catch (err) {
      if (err.fieldErrors) setErrors(err.fieldErrors);
      setNotice({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Other actions ---------- */
  const handleDeactivateConfirm = async () => {
    if (deactivating) return;
    setDeactivating(true);
    try {
      await deactivateAccount();
      setDeactivateOpen(false);
      setNotice({ type: "error", text: "Your account has been deactivated." });
      // Stays locked on success: the user is being logged out
      setTimeout(() => logout?.(), 1500);
    } catch (err) {
      setDeactivateOpen(false);
      setNotice({ type: "error", text: err.message });
      setDeactivating(false);
    }
  };

  const current = editing ? draft : values;

  const field = (id, label, key, props = {}) => (
    <div className="pf-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={`pf-input${errors[key] ? " invalid" : ""}`}
        value={current[key]}
        onChange={handleChange(key)}
        readOnly={!editing}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `${id}-error` : undefined}
        {...props}
      />
      {errors[key] && (
        <span className="pf-error" id={`${id}-error`}>
          {errors[key]}
        </span>
      )}
    </div>
  );

  return (
    <div className="profile-page">
      {/* Campus banner (the top bar sits transparently over it) */}
      <div
        className="profile-banner"
        style={{ backgroundImage: `url(${bannerImg})` }}
      />

      <div className="profile-wrap">
        {/* Identity card */}
        <section className="profile-card profile-main">
          <img
            src={avatarSrc}
            alt={displayName}
            className="profile-avatar"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = DEFAULT_AVATAR;
            }}
          />

          <h1 className="profile-name">{displayName}</h1>
          <div className="profile-meta">
            <span className="profile-role-tag">{roleText}</span>
            <span className="profile-id">ID Number: {idNumber}</span>
          </div>
        </section>

        {/* Personal information (inline edit) */}
        <section className="profile-section">
          <h2 className="profile-section-label">Personal Information</h2>
          <form
            className="profile-card profile-form"
            onSubmit={handleSave}
            noValidate
          >
            {field("pf-first", "First Name", "firstName", {
              autoComplete: "given-name",
            })}
            {field("pf-last", "Last Name", "lastName", {
              autoComplete: "family-name",
            })}

            <div className="pf-field">
              <label htmlFor="pf-email">
                Email Account{editing ? " (Cannot be changed)" : ""}
              </label>
              <input
                id="pf-email"
                className="pf-input"
                type="email"
                value={email}
                disabled={editing}
                readOnly
              />
            </div>

            {field("pf-contact", "Contact Number", "contactNumber", {
              type: "tel",
              inputMode: "tel",
              maxLength: 13,
              placeholder: "09XXXXXXXXX",
              autoComplete: "tel",
            })}

            <div className="pf-actions">
              {editing ? (
                <>
                  <button
                    type="button"
                    className="pf-btn outline"
                    onClick={cancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="pf-btn brown"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="pf-btn brown"
                  onClick={startEdit}
                >
                  <i className="bi bi-pencil"></i>
                  Edit Profile
                </button>
              )}
            </div>
          </form>
        </section>

        {/* 2FA: Two-step verification (renders only for Administrators) */}
        <section className="profile-section">
          <h2 className="profile-section-label">Two-Step Verification</h2>
          <TwoFactorSetup />
        </section>

        {/* More settings */}
        <section className="profile-section">
          <h2 className="profile-section-label">More Settings</h2>
          <div className="profile-card profile-settings">
            {canDeactivate && (
              <button
                type="button"
                className="profile-btn brown"
                onClick={() => setDeactivateOpen(true)}
              >
                <i className="bi bi-slash-circle"></i>
                Deactivate Account
              </button>
            )}
            <button
              type="button"
              className="profile-btn red"
              onClick={() => setLogoutOpen(true)}
            >
              <i className="bi bi-box-arrow-right"></i>
              Logout
            </button>
          </div>
        </section>

        {/* Legal links upgraded to prominent buttons */}
        <div className="profile-legal-links">
          <button type="button" onClick={() => setLegalOpen("terms")}>
            Terms &amp; Conditions
          </button>
          <span aria-hidden="true">•</span>
          <button type="button" onClick={() => setLegalOpen("privacy")}>
            Privacy Policy
          </button>
        </div>
      </div>

      {/* Toast: bottom-right, disappears after 5 seconds */}
      {notice && (
        <div className={`profile-notice ${notice.type}`} role="status">
          <i
            className={`bi ${
              notice.type === "success"
                ? "bi-check-circle-fill"
                : "bi-exclamation-circle-fill"
            }`}
          ></i>
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      <LegalModal type={legalOpen} onClose={() => setLegalOpen(null)} />

      <DeactivateModal
        isOpen={canDeactivate && deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={handleDeactivateConfirm}
        busy={deactivating}
      />

      <LogoutModal isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>
  );
}
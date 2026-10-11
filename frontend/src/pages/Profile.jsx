import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import LogoutModal from "../components/LogoutModal";
import bannerImg from "../assets/BUKSU.jpg";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../styles/Profile.css";

const DEFAULT_AVATAR = "https://lh3.googleusercontent.com/a/default-user";

const LEGAL = {
  terms: {
    title: "Terms & Conditions",
    sections: [
      ["1. Acceptance of Terms", "By creating a BukSUPPLY account, you agree to follow these terms and all applicable BukSU policies."],
      ["2. Eligibility", "Accounts are limited to currently enrolled students and active BukSU personnel with a valid institutional email address."],
      ["3. Account Responsibility", "You are responsible for keeping your password confidential and for all activity under your account. Report unauthorized use to PSMO immediately."],
      ["4. Requisitions & Reservations", "Requests must be accurate and made for official university purposes only. PSMO may approve, modify, or decline any request."],
      ["5. Acceptable Use", "You may not misuse the system, submit false information, or attempt to access data or accounts that are not yours."],
      ["6. Suspension", "PSMO may suspend or terminate accounts that violate these terms."],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      ["1. Information We Collect", "Your name, institutional email, ID number, and records of your requisitions and reservations."],
      ["2. How We Use It", "To verify your identity, process requests, and keep records for inventory and audit purposes."],
      ["3. Google Sign-In", "If you sign up with Google, we receive your name and email from Google. We do not receive your Google password."],
      ["4. Data Sharing", "Your data is shared only with authorized BukSU offices and is never sold to third parties."],
      ["5. Your Rights", "Under the Data Privacy Act of 2012 (RA 10173), you may access, correct, or request deletion of your personal data by contacting PSMO."],
      ["6. Security", "We apply reasonable technical and organizational safeguards, but no system is completely secure."],
    ],
  },
};

// Small confirm dialog used by Reset Password / Deactivate Account
function ConfirmModal({ open, icon, title, message, confirmText, danger, onConfirm, onClose }) {
  if (!open) return null;
  return (
    <div className="pf-overlay" onClick={onClose}>
      <div
        className="pf-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pf-modal-icon">
          <i className={`bi ${icon}`}></i>
        </div>
        <h3 className="pf-modal-title">{title}</h3>
        <p className="pf-modal-desc">{message}</p>
        <div className="pf-modal-actions">
          <button type="button" className="pf-modal-btn cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`pf-modal-btn confirm ${danger ? "danger" : ""}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Terms & Conditions / Privacy Policy dialog
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
    <div className="pf-overlay" onClick={onClose}>
      <div
        className="pf-modal pf-legal"
        role="dialog"
        aria-modal="true"
        aria-label={doc.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pf-legal-header">
          <h3 className="pf-legal-title">{doc.title}</h3>
          <button
            type="button"
            className="pf-legal-x"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="pf-legal-body">
          {doc.sections.map(([heading, text]) => (
            <div className="pf-legal-section" key={heading}>
              <h4>{heading}</h4>
              <p>{text}</p>
            </div>
          ))}
        </div>

        <button type="button" className="pf-legal-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();

  const [resetOpen, setResetOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(null); // 'terms' | 'privacy' | null
  const [notice, setNotice] = useState(null);

  // Auto-hide the toast after 5 seconds
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.name ||
    "User";

  const roleText = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
    : "Member";

  const idNumber = user?.idNumber || user?.studentId || user?.id || "N/A";
  const avatarSrc = user?.avatar || DEFAULT_AVATAR;

  const handleResetConfirm = () => {
    // BACKEND DEV NOTE: POST /api/auth/forgot-password with { email: user.email }
    setResetOpen(false);
    setNotice({
      type: "success",
      text: "A password reset link has been sent to your institutional email.",
    });
  };

  const handleDeactivateConfirm = () => {
    // BACKEND DEV NOTE: PUT /api/user/deactivate, then log the user out
    setDeactivateOpen(false);
    setNotice({
      type: "error",
      text: "Your deactivation request has been submitted.",
    });
  };

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
          <span className="profile-role-tag">{roleText}</span>

          <img
            src={avatarSrc}
            alt={displayName}
            className="profile-avatar"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = DEFAULT_AVATAR;
            }}
          />

          <h1 className="profile-name">{displayName}</h1>
          <hr className="profile-name-line" />
          <p className="profile-id">ID Number: {idNumber}</p>

          <div className="profile-links">
            <button type="button" onClick={() => setLegalOpen("terms")}>
              Terms &amp; Conditions
            </button>
            <span className="profile-links-sep" />
            <button type="button" onClick={() => setLegalOpen("privacy")}>
              Privacy Policy
            </button>
          </div>
        </section>

        {/* Settings & Security */}
        <section className="profile-card profile-settings">
          <h2 className="profile-settings-title">Settings &amp; Security</h2>


          <button
            type="button"
            className="profile-btn brown"
            onClick={() => setResetOpen(true)}
          >
            Reset Password
          </button>
          <button
            type="button"
            className="profile-btn brown"
            onClick={() => setDeactivateOpen(true)}
          >
            Deactivate Account
          </button>
          <button
            type="button"
            className="profile-btn red"
            onClick={() => setLogoutOpen(true)}
          >
            Logout
          </button>
        </section>
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

      <ConfirmModal
        open={resetOpen}
        icon="bi-key"
        title="Reset Password?"
        message="We will send a password reset link to your institutional email address."
        confirmText="Send Link"
        onConfirm={handleResetConfirm}
        onClose={() => setResetOpen(false)}
      />

      <ConfirmModal
        open={deactivateOpen}
        icon="bi-person-x"
        title="Deactivate Account?"
        message="Your account will be disabled and you will no longer be able to file requisition slips. This action should only be done if you are sure."
        confirmText="Deactivate"
        danger
        onConfirm={handleDeactivateConfirm}
        onClose={() => setDeactivateOpen(false)}
      />

      <LogoutModal isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>
  );
}
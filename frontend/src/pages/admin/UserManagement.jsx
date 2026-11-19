import React, { useState, useEffect } from "react";
import FilterDropdown from "../../components/FilterDropdown";
import "../../styles/admin/UserManagement.css";

const ITEMS_PER_PAGE = 5;

// Quick comments the administrator can pick instead of typing
const DEACTIVATE_SUGGESTIONS = [
  "Violated the rules stated in the Terms and Conditions.",
  "Misuse of the system or of requisition slips.",
  "Sharing the account with another person.",
  "Providing false or misleading information.",
  "The account is no longer needed (graduated or separated from the university).",
];

const DECLINE_SUGGESTIONS = [
  "Your account was deactivated for violating the Terms and Conditions.",
  "Please visit the Property Window to settle this matter first.",
  "Your request is incomplete or unclear. Please send a new request with more details.",
  "We could not verify your identity. Please bring a valid ID to the Property Window.",
  "Your account will stay deactivated for now. You may send a new request later.",
];

// Works whether or not VITE_API_URL ends in "/api"
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5001")
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

// Dates are shown in Philippine time, like the rest of the system
const fmtDateTime = (v) =>
  v
    ? new Date(v).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      })
    : "";
const fmtDay = (v) =>
  v
    ? new Date(v).toLocaleDateString("en-PH", {
        dateStyle: "medium",
        timeZone: "Asia/Manila",
      })
    : "";

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

/**
 * Asks for a written reason / note before an action (deactivate, decline a request).
 * onConfirm(text) may throw: the message is shown inside the pop-up.
 * `message` can be plain text or JSX (so the user's name can be bold).
 */
function ReasonModal({
  isOpen,
  title,
  message,
  label,
  placeholder,
  required,
  minLength = 5,
  maxLength = 300,
  confirmLabel,
  danger,
  suggestions = [],
  hint,
  onConfirm,
  onClose,
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setText("");
      setError("");
      setBusy(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (required && value.length < minLength) {
      setError(`Please enter at least ${minLength} characters.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onConfirm(value);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="um-modal-backdrop" onClick={onClose}>
      <div
        className="um-modal um-modal-reason"
        role="dialog"
        aria-modal="true"
        aria-labelledby="um-reason-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um-modal-header">
          <h3 id="um-reason-title">{title}</h3>
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
            <p className="um-confirm-text">{message}</p>

            <div className="um-field">
              <label htmlFor="um-reason">
                {label} {!required && <span className="um-optional">(optional)</span>}
              </label>
              {suggestions.length > 0 && (
                <div
                  className="um-chips"
                  role="group"
                  aria-label="Suggested comments"
                >
                  {suggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      className={`um-chip${text === sug ? " selected" : ""}`}
                      onClick={() => {
                        setText(sug);
                        setError("");
                      }}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                id="um-reason"
                className="um-input um-textarea"
                rows={4}
                maxLength={maxLength}
                placeholder={placeholder}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError("");
                }}
              />
              <div className="um-field-meta">
                {hint ? <span className="um-hint">{hint}</span> : <span />}
                <span className="um-char-count">
                  {text.length}/{maxLength}
                </span>
              </div>
              {error && <span className="um-field-error">{error}</span>}
            </div>
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
              className={danger ? "um-btn-danger" : "um-btn-primary"}
              disabled={busy}
            >
              {busy ? "Please wait..." : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// One label + value pair inside a detail card
// multiline = long free text that may wrap
function DetailRow({ label, children, multiline }) {
  return (
    <div className={`um-detail-row${multiline ? " multiline" : ""}`}>
      <dt>{label}</dt>
      <dd title={typeof children === "string" ? children : undefined}>
        {children}
      </dd>
    </div>
  );
}

/** Account details pop-up. Shows the row's data at once and loads the rest. */
function UserDetailsModal({
  user,
  onClose,
  onDeactivate,
  onReactivate,
  onDecline,
  onArchive,
  onUnarchive,
}) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return undefined;
    const controller = new AbortController();
    setDetails(null);
    setError("");
    setLoading(true);
    apiFetch(`/${user._id}`, { signal: controller.signal })
      .then((data) => setDetails(data.user))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user]);

  if (!user) return null;

  const d = details || user;
  const isDeactivated = d.status === "Deactivated";
  const isArchived = !!d.archived;
  const statusLabel = isArchived ? "Archived" : d.status;
  const hasRequest = details ? !!details.request : !!user.hasRequest;
  const initials = d.name
    .split(" ")
    .filter((w) => w && /\p{L}/u.test(w[0]))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const extra = (value) => (loading ? "Loading..." : value || "—");

  return (
    <div className="um-modal-backdrop" onClick={onClose}>
      <div
        className="um-modal um-modal-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="um-details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um-modal-header">
          <div>
            <h3 id="um-details-title">Account details</h3>
            <p className="um-modal-subtitle">
              Information saved for this account.
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

        <div className="um-modal-body">
          <div className="um-detail-top">
            <div className="um-avatar" aria-hidden="true">
              {initials || <i className="bi bi-person"></i>}
            </div>
            <div className="um-detail-who">
              <div className="um-detail-name" title={d.name}>
                {d.name}
              </div>
              <div className="um-role">{d.role}</div>
            </div>
            <span className={`um-badge ${statusLabel.toLowerCase()}`}>
              {statusLabel}
            </span>
          </div>

          {error && (
            <div className="um-error-box" role="alert">
              {error}
            </div>
          )}

          {/* Main account information */}
          <div className="um-detail-card">
            <dl className="um-detail-grid">
              <DetailRow label="ID number">{d.id}</DetailRow>
              <DetailRow label="Role">{d.role}</DetailRow>
              <DetailRow label="Contact number">{d.contact || "—"}</DetailRow>
              <DetailRow label="Sign-in method">
                {extra(details && details.signInMethod)}
              </DetailRow>
              <DetailRow label="Account created">
                {fmtDateTime(d.createdAt) || "—"}
              </DetailRow>
              <DetailRow label="Last sign-in">
                {extra(fmtDateTime(details && details.lastSignIn))}
              </DetailRow>
            </dl>
            <dl className="um-detail-long">
              <DetailRow label="Email address">{d.email}</DetailRow>
            </dl>
          </div>

          {isDeactivated && details && (
            <section className="um-detail-section">
              <h4>
                <i className="bi bi-person-x"></i> Deactivation
              </h4>
              <div className="um-detail-card">
                <dl className="um-detail-grid">
                  <DetailRow label="Deactivated on">
                    {fmtDateTime(
                      details.deactivation && details.deactivation.date
                    ) || "—"}
                  </DetailRow>
                  <DetailRow label="Deactivated by">
                    {details.deactivation &&
                    details.deactivation.source === "self"
                      ? "The account owner"
                      : (details.deactivation && details.deactivation.byName) ||
                        "—"}
                  </DetailRow>
                  {isArchived && (
                    <DetailRow label="Archived on">
                      {fmtDateTime(details.archivedAt) || "—"}
                    </DetailRow>
                  )}
                </dl>
                <dl className="um-detail-long">
                  <DetailRow label="Reason" multiline>
                    {(details.deactivation && details.deactivation.reason) ||
                      "No reason was recorded."}
                  </DetailRow>
                </dl>
              </div>
            </section>
          )}

          {isDeactivated && details && details.request && (
            <section className="um-detail-section">
              <h4>
                <i className="bi bi-envelope-paper"></i> Reactivation request
              </h4>
              <div className="um-detail-card">
                <dl className="um-detail-grid">
                  <DetailRow label="Sent on">
                    {fmtDateTime(details.request.date)}
                  </DetailRow>
                </dl>
                <dl className="um-detail-long">
                  <DetailRow label="Message" multiline>
                    {details.request.message}
                  </DetailRow>
                </dl>
              </div>
            </section>
          )}

          {isDeactivated &&
            details &&
            !details.request &&
            details.lastDecline && (
              <div className="um-note-card">
                <h4 className="um-note-title">Last request declined</h4>
                <p className="um-note-text">
                  The last request was declined on{" "}
                  {fmtDay(details.lastDecline.date)}
                  {details.lastDecline.note
                    ? `. Note: ${details.lastDecline.note}`
                    : "."}
                </p>
              </div>
            )}
        </div>

        <div className="um-modal-footer">
          <button type="button" className="um-btn-secondary" onClick={onClose}>
            Close
          </button>
          {isArchived ? (
            <button
              type="button"
              className="um-btn-primary"
              onClick={() => onUnarchive(user)}
            >
              <i className="bi bi-box-arrow-up"></i> Unarchive
            </button>
          ) : isDeactivated ? (
            <>
              {hasRequest && (
                <button
                  type="button"
                  className="um-btn-secondary"
                  onClick={() => onDecline(user)}
                >
                  Decline request
                </button>
              )}
              {!hasRequest && (
                <button
                  type="button"
                  className="um-btn-secondary"
                  onClick={() => onArchive(user)}
                >
                  <i className="bi bi-archive"></i> Archive
                </button>
              )}
              <button
                type="button"
                className="um-btn-primary"
                onClick={() => onReactivate(user)}
              >
                {hasRequest ? "Approve & reactivate" : "Reactivate"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="um-btn-danger"
              onClick={() => onDeactivate(user)}
            >
              <i className="bi bi-person-x"></i> Deactivate account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Create moderator: input limits and formats ---- */
const LIMITS = {
  idNumber: { min: 3, max: 15 },
  name: { min: 2, max: 50 },
  email: { max: 100 },
  password: { min: 8, max: 64 },
};

// Typing filters: characters that are not allowed are dropped as the admin types
const FILTERS_BY_FIELD = {
  // letters, numbers and hyphens only, always uppercase (e.g. P-1234)
  idNumber: (v) => v.replace(/[^A-Za-z0-9-]/g, "").toUpperCase(),
  // letters (any language), spaces, hyphens, apostrophes and periods only
  firstName: (v) => v.replace(/[^\p{L}\s.'’-]/gu, "").replace(/\s{2,}/g, " "),
  lastName: (v) => v.replace(/[^\p{L}\s.'’-]/gu, "").replace(/\s{2,}/g, " "),
  // no spaces in an email address
  email: (v) => v.replace(/\s/g, ""),
  // no spaces in a password
  password: (v) => v.replace(/\s/g, ""),
  confirmPassword: (v) => v.replace(/\s/g, ""),
};

const NAME_PATTERN = /^\p{L}+(?:[ .'’-]\p{L}+)*\.?$/u; // starts with a letter, no doubled symbols
const ID_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/; // e.g. P-1234 (no leading, trailing or double hyphens)
// Moderators use the staff address of the university
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@buksu\.edu\.ph$/i;

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
    const { name } = e.target;
    const filter = FILTERS_BY_FIELD[name];
    const value = filter ? filter(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setServerError("");
  };

  const validateName = (value, label) => {
    const v = value.trim();
    if (!v) return `${label} is required.`;
    if (v.length < LIMITS.name.min)
      return `${label} must be at least ${LIMITS.name.min} letters.`;
    if (v.length > LIMITS.name.max)
      return `${label} must be ${LIMITS.name.max} characters or fewer.`;
    if (!NAME_PATTERN.test(v))
      return `${label} may only have letters, spaces, hyphens, apostrophes and periods.`;
    return "";
  };

  const validate = () => {
    const next = {};

    const id = form.idNumber.trim();
    if (!id) next.idNumber = "ID number is required.";
    else if (id.length < LIMITS.idNumber.min || id.length > LIMITS.idNumber.max)
      next.idNumber = `Use ${LIMITS.idNumber.min}-${LIMITS.idNumber.max} characters.`;
    else if (!ID_PATTERN.test(id))
      next.idNumber = "Use only letters, numbers and single hyphens (e.g. P-1234).";

    const firstErr = validateName(form.firstName, "First name");
    if (firstErr) next.firstName = firstErr;
    const lastErr = validateName(form.lastName, "Last name");
    if (lastErr) next.lastName = lastErr;

    const mail = form.email.trim();
    if (!mail) next.email = "Email address is required.";
    else if (mail.length > LIMITS.email.max)
      next.email = `Email must be ${LIMITS.email.max} characters or fewer.`;
    else if (!EMAIL_PATTERN.test(mail))
      next.email = "Use a BukSU staff email ending in @buksu.edu.ph.";

    // if (!form.contact.trim()) next.contact = "Contact number is required.";
    // else if (!/^09\d{9}$/.test(form.contact))
    //   next.contact = "Use an 11-digit number starting with 09.";

    const pw = form.password;
    if (pw.length < LIMITS.password.min)
      next.password = `Password must be at least ${LIMITS.password.min} characters.`;
    else if (pw.length > LIMITS.password.max)
      next.password = `Password must be ${LIMITS.password.max} characters or fewer.`;
    else if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw))
      next.password = "Password must include at least one letter and one number.";

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
        firstName: form.firstName.trim().replace(/\s+/g, " "),
        lastName: form.lastName.trim().replace(/\s+/g, " "),
        email: form.email.trim().toLowerCase(),
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
        className="um-modal um-modal-create"
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
                maxLength={LIMITS.idNumber.max}
                autoComplete="off"
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
                  maxLength={LIMITS.name.max}
                  autoComplete="off"
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
                  maxLength={LIMITS.name.max}
                  autoComplete="off"
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
                maxLength={LIMITS.email.max}
                autoComplete="off"
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
                    placeholder="8+ characters, letter & number"
                    maxLength={LIMITS.password.max}
                    autoComplete="new-password"
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
                    maxLength={LIMITS.password.max}
                    autoComplete="new-password"
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
  const [pendingRequests, setPendingRequests] = useState(0);
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
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [unarchiveTarget, setUnarchiveTarget] = useState(null);

  // Three-dots menu: { user, top, left } (drawn with position: fixed so the table never clips it)
  const [menu, setMenu] = useState(null);

  // Toast notice
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Options for the Filter Dropdown. The values are what the API expects;
  // only the labels (and the small colour dots) are for display.
  const filterOptions = [
    { value: "All", label: "All accounts" },
    { value: "User", label: "Users" },
    { value: "Moderator", label: "Moderators" },
    { value: "Deactivated", label: "Deactivated", tone: "denied" },
    { value: "Archived", label: "Archived", tone: "cancelled" },
    {
      value: "Requests",
      label:
        pendingRequests > 0
          ? `Reactivation requests (${pendingRequests})`
          : "Reactivation requests",
      tone: "pending",
    },
  ];

  /* ---- Three-dots menu: open, place, close ---- */
  const openMenu = (e, u) => {
    e.stopPropagation(); // the row itself opens the details pop-up
    if (menu && menu.user._id === u._id) {
      setMenu(null);
      return;
    }
    const MENU_W = 190;
    const MENU_H = 150;
    const r = e.currentTarget.getBoundingClientRect();
    const top =
      r.bottom + 6 + MENU_H > window.innerHeight
        ? Math.max(8, r.top - MENU_H - 6) // not enough room below: open upward
        : r.bottom + 6;
    const left = Math.max(
      8,
      Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8)
    );
    setMenu({ user: u, top, left });
  };

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onKey = (e) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

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
        // Last row of a page was just removed from this filter: go back one page
        if (data.users.length === 0 && currentPage > 1) {
          setCurrentPage((p) => Math.max(p - 1, 1));
          return;
        }
        setUsers(data.users);
        setTotal(data.total);
        setPendingRequests(data.pendingRequests || 0);
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

  // Throws on error; the pop-up shows the message
  const handleConfirmDeactivate = async (reason) => {
    const target = deactivateTarget;
    await apiFetch(`/${target._id}/deactivate`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    });
    setDeactivateTarget(null);
    setRefreshKey((k) => k + 1);
    setNotice({
      type: "success",
      text: `${target.name} (${target.id}) was deactivated.`,
    });
  };

  const handleConfirmDecline = async (note) => {
    const target = declineTarget;
    await apiFetch(`/${target._id}/decline-request`, {
      method: "PATCH",
      body: JSON.stringify({ note }),
    });
    setDeclineTarget(null);
    setRefreshKey((k) => k + 1);
    setNotice({
      type: "success",
      text: `The request of ${target.name} (${target.id}) was declined.`,
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

  // Archive: hides a deactivated account from the normal lists (it is never deleted)
  const handleConfirmArchive = async () => {
    if (archiveTarget) {
      try {
        await apiFetch(`/${archiveTarget._id}/archive`, { method: "PATCH" });
        setRefreshKey((k) => k + 1);
        setNotice({
          type: "success",
          text: `${archiveTarget.name} (${archiveTarget.id}) was archived.`,
        });
      } catch (err) {
        setLoadError(err.message);
      }
    }
    setArchiveTarget(null);
  };

  const handleConfirmUnarchive = async () => {
    if (unarchiveTarget) {
      try {
        await apiFetch(`/${unarchiveTarget._id}/unarchive`, { method: "PATCH" });
        setRefreshKey((k) => k + 1);
        setNotice({
          type: "success",
          text: `${unarchiveTarget.name} (${unarchiveTarget.id}) was unarchived.`,
        });
      } catch (err) {
        setLoadError(err.message);
      }
    }
    setUnarchiveTarget(null);
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
            Create moderators, monitor staff and students, and deactivate, reactivate, 
            or archive accounts with sign-in reactivation requests.
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

      {/* Search + filter dropdown */}
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

        <FilterDropdown
          options={filterOptions}
          value={activeFilter}
          onChange={handleFilterChange}
          ariaLabel="Filter accounts"
          allValue="All"
        />
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
                      <tr
                        key={u._id}
                        className="um-row"
                        tabIndex={0}
                        onClick={() => setDetailsTarget(u)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.target === e.currentTarget)
                            setDetailsTarget(u);
                        }}
                      >
                        <td className="um-cell-id">{u.id}</td>
                        <td>
                          <div className="um-name um-ellipsis" title={u.name}>
                            {u.name}
                          </div>
                          <div className="um-role">{u.role}</div>
                        </td>
                        <td>
                          <div className="um-ellipsis" title={u.email}>
                            {u.email}
                          </div>
                        </td>
                        <td>{u.contact || "—"}</td>
                        <td className="um-cell-status">
                          <div className="um-status-stack">
                            <span
                              className={`um-badge ${u.archived ? "archived" : u.status.toLowerCase()}`}
                            >
                              {u.archived ? "Archived" : u.status}
                            </span>
                            {u.hasRequest && !u.archived && (
                              <span className="um-badge um-badge-request">
                                Request sent
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="um-cell-actions">
                          <button
                            type="button"
                            className={`um-kebab${menu && menu.user._id === u._id ? " open" : ""}`}
                            onClick={(e) => openMenu(e, u)}
                            aria-label={`Actions for ${u.name}`}
                            aria-haspopup="menu"
                            aria-expanded={!!(menu && menu.user._id === u._id)}
                          >
                            <i className="bi bi-three-dots-vertical"></i>
                          </button>
                        </td>
                      </tr>
                    ))
                  : activeFilter === "Archived"
                    ? messageRow(
                        "bi-archive",
                        "No Archived Accounts",
                        "Deactivated accounts that you archive will appear here."
                      )
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

      {/* Three-dots menu */}
      {menu && (
        <div
          className="um-menu"
          role="menu"
          style={{ top: menu.top, left: menu.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="um-menu-item"
            onClick={() => {
              setDetailsTarget(menu.user);
              setMenu(null);
            }}
          >
            <i className="bi bi-eye"></i> View details
          </button>
          {menu.user.archived ? (
            <button
              type="button"
              role="menuitem"
              className="um-menu-item"
              onClick={() => {
                setUnarchiveTarget(menu.user);
                setMenu(null);
              }}
            >
              <i className="bi bi-box-arrow-up"></i> Unarchive
            </button>
          ) : menu.user.status === "Deactivated" ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="um-menu-item"
                onClick={() => {
                  setReactivateTarget(menu.user);
                  setMenu(null);
                }}
              >
                <i className="bi bi-arrow-counterclockwise"></i> Reactivate
              </button>
              <button
                type="button"
                role="menuitem"
                className="um-menu-item"
                disabled={menu.user.hasRequest}
                title={
                  menu.user.hasRequest
                    ? "Approve or decline the reactivation request first"
                    : undefined
                }
                onClick={() => {
                  setArchiveTarget(menu.user);
                  setMenu(null);
                }}
              >
                <i className="bi bi-archive"></i> Archive
              </button>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="um-menu-item danger"
              onClick={() => {
                setDeactivateTarget(menu.user);
                setMenu(null);
              }}
            >
              <i className="bi bi-person-x"></i> Deactivate
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateModeratorModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateModerator}
      />

      <UserDetailsModal
        user={detailsTarget}
        onClose={() => setDetailsTarget(null)}
        onDeactivate={(u) => {
          setDetailsTarget(null);
          setDeactivateTarget(u);
        }}
        onReactivate={(u) => {
          setDetailsTarget(null);
          setReactivateTarget(u);
        }}
        onDecline={(u) => {
          setDetailsTarget(null);
          setDeclineTarget(u);
        }}
        onArchive={(u) => {
          setDetailsTarget(null);
          setArchiveTarget(u);
        }}
        onUnarchive={(u) => {
          setDetailsTarget(null);
          setUnarchiveTarget(u);
        }}
      />

      <ReasonModal
        isOpen={!!deactivateTarget}
        title="Deactivate account?"
        message={
          deactivateTarget ? (
            <>
              <strong>{deactivateTarget.name}</strong> ({deactivateTarget.id})
              will be signed out and will no longer be able to sign in. The
              reason you write is shown to them on the sign-in page and sent to
              their email.
            </>
          ) : (
            ""
          )
        }
        label="Reason for deactivation"
        placeholder="Pick a suggestion above or write your own"
        suggestions={DEACTIVATE_SUGGESTIONS}
        hint="The user will see this reason."
        required
        minLength={5}
        maxLength={300}
        confirmLabel="Deactivate"
        danger
        onConfirm={handleConfirmDeactivate}
        onClose={() => setDeactivateTarget(null)}
      />

      <ReasonModal
        isOpen={!!declineTarget}
        title="Decline request?"
        message={
          declineTarget ? (
            <>
              <strong>{declineTarget.name}</strong> ({declineTarget.id}) stays
              deactivated. They are told the request was declined and can send a
              new one later.
            </>
          ) : (
            ""
          )
        }
        label="Note to the user"
        placeholder="Pick a suggestion above or write your own"
        suggestions={DECLINE_SUGGESTIONS}
        hint="The user will see this note."
        maxLength={300}
        confirmLabel="Decline request"
        onConfirm={handleConfirmDecline}
        onClose={() => setDeclineTarget(null)}
      />

      <ConfirmModal
        isOpen={!!reactivateTarget}
        title="Reactivate account?"
        message={
          reactivateTarget ? (
            <>
              <strong>{reactivateTarget.name}</strong> ({reactivateTarget.id})
              will regain access to the system.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Reactivate"
        onConfirm={handleConfirmReactivate}
        onClose={() => setReactivateTarget(null)}
      />

      <ConfirmModal
        isOpen={!!archiveTarget}
        title="Archive account?"
        message={
          archiveTarget ? (
            <>
              <strong>{archiveTarget.name}</strong> ({archiveTarget.id}) will be
              moved out of the main list and stays deactivated. The account is
              not deleted, and you can find it under the Archived filter and
              unarchive it at any time.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Archive"
        onConfirm={handleConfirmArchive}
        onClose={() => setArchiveTarget(null)}
      />

      <ConfirmModal
        isOpen={!!unarchiveTarget}
        title="Unarchive account?"
        message={
          unarchiveTarget ? (
            <>
              <strong>{unarchiveTarget.name}</strong> ({unarchiveTarget.id}) will
              go back to the Deactivated list. The account stays deactivated
              until you reactivate it.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Unarchive"
        onConfirm={handleConfirmUnarchive}
        onClose={() => setUnarchiveTarget(null)}
      />
    </div>
  );
}
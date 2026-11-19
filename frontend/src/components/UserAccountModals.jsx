/* ==========================================================================
   BukSUPPLY - Shared user-account pop-ups (Admin)
   ========================================================================== */
   
import React, { useState, useEffect } from "react";

// Quick comments the administrator can pick instead of typing
export const DEACTIVATE_SUGGESTIONS = [
  "Violated the rules stated in the Terms and Conditions.",
  "Misuse of the system or of requisition slips.",
  "Sharing the account with another person.",
  "Providing false or misleading information.",
  "The account is no longer needed (graduated or separated from the university).",
];

export const DECLINE_SUGGESTIONS = [
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

export async function apiFetch(path, options = {}) {
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

export function ConfirmModal({
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
export function ReasonModal({
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
export function UserDetailsModal({
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
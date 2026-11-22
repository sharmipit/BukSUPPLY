// Shared user-account modals (Admin)
import React, { useState, useEffect } from "react";
import DecisionModal from "./DecisionModal";

// Predefined reason suggestions for admin actions
export const DEACTIVATE_SUGGESTIONS = [
  "Violated the rules stated in the Terms and Conditions.",
  "Misuse of the system or of requisition slips.",
  "Sharing the account with another person.",
  "Providing false or misleading information.",
  "The account is no longer needed (graduated or separated from the university).",
];

export const REACTIVATE_SUGGESTIONS = [
  "The user explained the situation and the issue has been resolved.",
  "The deactivation was made by mistake.",
  "The user settled the matter at the Property Window.",
  "The account is still needed for official university work.",
  "The user agreed to follow the Terms and Conditions.",
];

export const DECLINE_SUGGESTIONS = [
  "Your account was deactivated for violating the Terms and Conditions.",
  "Please visit the Property Window to settle this matter first.",
  "Your request is incomplete or unclear. Please send a new request with more details.",
  "We could not verify your identity. Please bring a valid ID to the Property Window.",
  "Your account will stay deactivated for now. You may send a new request later.",
];

// Normalize API base URL
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5001")
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

// Format date and time in Philippine time (Asia/Manila)
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

// Modals (both are thin wrappers around the shared DecisionModal)

// Plain confirmation (archive, unarchive)
export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}) {
  return (
    <DecisionModal
      isOpen={isOpen}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

// Reason input modal for administrative actions (deactivate, reactivate, decline)
export function ReasonModal({
  isOpen,
  title,
  message,
  label,
  placeholder,
  required,
  minLength,
  maxLength = 300,
  confirmLabel,
  danger,
  suggestions = [],
  hint,
  onConfirm,
  onClose,
}) {
  return (
    <DecisionModal
      isOpen={isOpen}
      title={title}
      message={message}
      tone={danger ? "danger" : "primary"}
      label={label}
      placeholder={placeholder}
      suggestions={suggestions}
      required={required}
      minLength={minLength}
      maxLength={maxLength}
      hint={hint}
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

// Detail row component for key-value display
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

// Account details modal: displays comprehensive user information and management actions
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
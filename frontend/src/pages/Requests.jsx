import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/Requests.css";

const STATUS_TABS = [
  "All",
  "Pending",
  "Processing",
  "Purchasing",
  "Accepted",
  "Denied",
];
const OPEN_STATUSES = ["Pending", "Processing", "Purchasing"];

// ---------- Sample data (replace with API calls later) ----------
const SAMPLE_STOCK = [
  { id: "ITM-001", name: "A4 bond paper", unit: "ream", quantity: 48 },
  { id: "ITM-002", name: "Long bond paper", unit: "ream", quantity: 12 },
  { id: "ITM-003", name: "Pencil", unit: "pcs", quantity: 120 },
  { id: "ITM-004", name: "Ballpen (Black)", unit: "pcs", quantity: 0 },
  {
    id: "ITM-005",
    name: "Whiteboard Marker (Black)",
    unit: "pcs",
    quantity: 8,
  },
  { id: "ITM-006", name: "Stapler", unit: "pcs", quantity: 22 },
  { id: "ITM-007", name: "3D Printer Filament", unit: "roll", quantity: 3 },
  { id: "ITM-008", name: "Disinfectant Spray", unit: "bottle", quantity: 35 },
];

const SAMPLE_REQUISITIONS = [
  {
    id: "REQ-2026-089",
    requestedBy: "Prof. Dela Cruz",
    department: "College of Technologies",
    title: "Term 2 supplies",
    purpose: "Monthly office supplies for the department.",
    item: "A4 bond paper (2 reams)",
    date: "2026-10-05",
    status: "Pending",
    itemsList: [
      {
        id: "ITM-001",
        name: "A4 bond paper",
        qty: 2,
        reason: "",
        maxNormal: 10,
      },
    ],
    purchaseItems: [],
  },
  {
    id: "REQ-2026-093",
    requestedBy: "Ms. Garcia",
    department: "College of Education",
    title: "Stapler for new office",
    purpose: "Setting up the new faculty room.",
    item: "Stapler (2 pcs)",
    date: "2026-10-11",
    status: "Pending",
    itemsList: [
      { id: "ITM-006", name: "Stapler", qty: 2, reason: "", maxNormal: 2 },
    ],
    purchaseItems: [],
  },
  {
    id: "REQ-2026-075",
    requestedBy: "Prof. Dela Cruz",
    department: "College of Technologies",
    title: "Laboratory Refill",
    purpose: "Midterm exams requirement.",
    item: "Long bond paper (5 reams)",
    date: "2026-09-28",
    status: "Processing",
    reviewedBy: "Mod Santos",
    reviewedAt: "2026-09-29T09:30:00",
    itemsList: [
      {
        id: "ITM-002",
        name: "Long bond paper",
        qty: 5,
        reason: "",
        maxNormal: 10,
      },
    ],
    purchaseItems: [],
  },
  {
    id: "REQ-2026-092",
    requestedBy: "Ms. Garcia",
    department: "College of Education",
    title: "Exam pens",
    purpose: "Final exam week.",
    item: "Ballpen (Black) (10 pcs)",
    date: "2026-10-10",
    status: "Processing",
    reviewedBy: "Mod Santos",
    reviewedAt: "2026-10-11T13:10:00",
    itemsList: [
      {
        id: "ITM-004",
        name: "Ballpen (Black)",
        qty: 10,
        reason: "",
        maxNormal: 20,
      },
    ],
    purchaseItems: [],
  },
  {
    id: "REQ-2026-091",
    requestedBy: "Prof. Dela Cruz",
    department: "College of Technologies",
    title: "Specialty Filament",
    purpose: "3D printing lab.",
    item: "3D Filament (5 rolls)",
    date: "2026-10-09",
    status: "Purchasing",
    reviewedBy: "Admin Reyes",
    reviewedAt: "2026-10-10T10:00:00",
    itemsList: [],
    purchaseItems: [
      { name: "3D Filament", qty: 5, reason: "Special lab requirement" },
    ],
  },
  {
    id: "REQ-2026-061",
    requestedBy: "Ms. Garcia",
    department: "College of Education",
    title: "Office Essentials",
    purpose: "Daily administrative tasks.",
    item: "Pencil (10 pcs)",
    date: "2026-09-15",
    status: "Denied",
    denyReason: "Already covered by last month's delivery.",
    reviewedBy: "Admin Reyes",
    reviewedAt: "2026-09-16T10:00:00",
    itemsList: [
      { id: "ITM-003", name: "Pencil", qty: 10, reason: "", maxNormal: 30 },
    ],
    purchaseItems: [],
  },
];

// ---------- Helpers ----------
const isOpen = (req) => OPEN_STATUSES.includes(req.status);
const hasPurchaseItems = (req) => (req.purchaseItems || []).length > 0;

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-PH", {
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

const summarize = (req) => {
  if (req.item) return req.item;
  const all = [
    ...(req.itemsList || []).map((l) => `${l.name} (${l.qty})`),
    ...(req.purchaseItems || []).map((l) => `${l.name} (${l.qty})`),
  ];
  return all.join(", ") || "—";
};

// Which buttons make sense for this request right now
const getActions = (req, check) => {
  const none = {
    acknowledge: false,
    accept: false,
    purchasing: false,
    deny: false,
  };
  if (req.status === "Pending") return { ...none, acknowledge: true };

  if (req.status === "Processing") {
    const canAccept = !check.short && !hasPurchaseItems(req);
    return { ...none, accept: canAccept, purchasing: !canAccept, deny: true };
  }

  if (req.status === "Purchasing") {
    return { ...none, accept: !check.short, deny: true };
  }
  return none;
};

// One plain sentence telling staff what to do next
const nextStepText = (req, check) => {
  if (req.status === "Pending") {
    return "Not acknowledged yet. The requester can still edit or cancel it. Acknowledge to start processing.";
  }
  if (req.status === "Processing") {
    if (hasPurchaseItems(req))
      return "This request has items to buy. Send it to purchasing, or deny it.";
    if (check.short)
      return "Not enough stock. Send it to purchasing, or deny it.";
    return "Stock is available. Accept to deduct it from inventory, or deny it.";
  }
  if (req.status === "Purchasing") {
    return check.short
      ? "Still waiting on stock. Receive it in Inventory first, or deny the request."
      : "Ready to finish. Accept to complete it, or deny it.";
  }
  return "";
};

export default function Requests() {
  useEffect(() => {
    document.title = "Requests | BukSUPPLY";
  }, []);

  const { user } = useAuth();
  // Adjust these field names to match your auth user object
  const actorName =
    user?.name || user?.fullName || user?.username || "Unknown user";

  const [items, setItems] = useState(SAMPLE_STOCK);
  const [requisitions, setRequisitions] = useState(SAMPLE_REQUISITIONS);

  // Filtering and pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Modals (store ids so they always show the latest data)
  const [detailsId, setDetailsId] = useState(null);
  const [decision, setDecision] = useState(null); // { type: "accept" | "deny", id }
  const [denyReason, setDenyReason] = useState("");

  // Banner message after an action
  const [notice, setNotice] = useState(null); // { type: "success" | "error", text }

  const detailsReq = requisitions.find((r) => r.id === detailsId) || null;
  const decisionReq = decision
    ? requisitions.find((r) => r.id === decision.id) || null
    : null;

  // Compares each requested stock line against what is on hand
  const getCheck = (req) => {
    const lines = (req.itemsList || []).map((l) => {
      const inv = items.find((i) => i.id === l.id);
      return { ...l, inv, enough: !!inv && l.qty <= inv.quantity };
    });
    return { lines, short: lines.some((l) => !l.enough) };
  };

  const detailsCheck = detailsReq ? getCheck(detailsReq) : null;
  const decisionCheck = decisionReq ? getCheck(decisionReq) : null;
  const detailsActions = detailsReq
    ? getActions(detailsReq, detailsCheck)
    : null;

  // ---------- Simulated backend actions ----------
  // Each of these becomes one API call later.
  const updateStatus = (id, status, extra = {}) =>
    setRequisitions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status, ...extra } : r)),
    );

  const stampReview = () => ({
    reviewedBy: actorName,
    reviewedAt: new Date().toISOString(),
  });

  // Pending -> Processing (locks the requester's edit and cancel)
  const acknowledgeRequisition = (id) =>
    updateStatus(id, "Processing", stampReview());

  // Processing -> Purchasing
  const sendToPurchasing = (id) =>
    updateStatus(id, "Purchasing", stampReview());

  // -> Accepted. Checks stock, deducts it, all or nothing.
  const acceptRequisition = (req) => {
    if (!getActions(req, getCheck(req)).accept) {
      return { ok: false, error: "This request can't be accepted right now." };
    }
    setItems((prev) =>
      prev.map((i) => {
        const line = (req.itemsList || []).find((l) => l.id === i.id);
        return line ? { ...i, quantity: i.quantity - line.qty } : i;
      }),
    );
    updateStatus(req.id, "Accepted", stampReview());
    return { ok: true };
  };

  // -> Denied (reason is required)
  const denyRequisition = (id, reason) =>
    updateStatus(id, "Denied", { denyReason: reason, ...stampReview() });

  const stats = useMemo(
    () => ({
      pending: requisitions.filter((r) => r.status === "Pending").length,
      inProgress: requisitions.filter(
        (r) => r.status === "Processing" || r.status === "Purchasing",
      ).length,
      accepted: requisitions.filter((r) => r.status === "Accepted").length,
      denied: requisitions.filter((r) => r.status === "Denied").length,
    }),
    [requisitions],
  );

  // Pending first, then newest
  const filteredRequests = requisitions
    .filter((req) => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        query === "" ||
        req.id.toLowerCase().includes(query) ||
        req.title.toLowerCase().includes(query) ||
        (req.requestedBy || "").toLowerCase().includes(query) ||
        (req.department || "").toLowerCase().includes(query) ||
        summarize(req).toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "All" || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const ap = a.status === "Pending" ? 0 : 1;
      const bp = b.status === "Pending" ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(b.date) - new Date(a.date);
    });

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredRequests.slice(indexOfFirst, indexOfLast);

  // ---------- Handlers ----------
  const openDecision = (type, id) => {
    setDecision({ type, id });
    setDenyReason("");
  };

  const closeDecision = () => {
    setDecision(null);
    setDenyReason("");
  };

  const handleAcknowledge = (req) => {
    acknowledgeRequisition(req.id);
    setNotice({
      type: "success",
      text: `${req.id} is now Processing. The requester can no longer edit or cancel it.`,
    });
    setDetailsId(null);
  };

  const handleSendToPurchasing = (req) => {
    sendToPurchasing(req.id);
    setNotice({ type: "success", text: `${req.id} was sent to purchasing.` });
    setDetailsId(null);
  };

  const handleConfirmDecision = () => {
    if (!decisionReq) return;

    if (decision.type === "accept") {
      const result = acceptRequisition(decisionReq);
      if (!result.ok) {
        setNotice({ type: "error", text: result.error });
      } else {
        const deducted = (decisionReq.itemsList || []).length > 0;
        setNotice({
          type: "success",
          text: deducted
            ? `${decisionReq.id} accepted. Stock was deducted from inventory.`
            : `${decisionReq.id} accepted.`,
        });
      }
    } else {
      if (!denyReason.trim()) return;
      denyRequisition(decisionReq.id, denyReason.trim());
      setNotice({ type: "success", text: `${decisionReq.id} was denied.` });
    }
    closeDecision();
    setDetailsId(null);
  };

  return (
    <div className="requests-container">
      {/* Header */}
      <div className="rq-header-card">
        <div>
          <h1 className="rq-title">Requests</h1>
          <p className="rq-subtitle">
            Pending → Processing → Accepted, Purchasing, or Denied. Click Review
            on a request to see what to do next.
          </p>
        </div>
      </div>

      {/* Notice */}
      {notice && (
        <div className={`rq-notice ${notice.type}`} role="status">
          <span>{notice.text}</span>
          <button
            className="rq-notice-close"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="rq-stats-row">
        <div className="rq-stat-card">
          <span className="rq-stat-label">Pending</span>
          <span className="rq-stat-value stat-warn">{stats.pending}</span>
        </div>
        <div className="rq-stat-card">
          <span className="rq-stat-label">In progress</span>
          <span className="rq-stat-value stat-info">{stats.inProgress}</span>
        </div>
        <div className="rq-stat-card">
          <span className="rq-stat-label">Accepted</span>
          <span className="rq-stat-value stat-ok">{stats.accepted}</span>
        </div>
        <div className="rq-stat-card">
          <span className="rq-stat-label">Denied</span>
          <span className="rq-stat-value stat-danger">{stats.denied}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="rq-filter-bar">
        <div className="rq-search-wrapper">
          <i className="bi bi-search"></i>
          <input
            type="text"
            className="form-control custom-input"
            placeholder="Search by slip ID, title, requester, or items..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="rq-status-tabs">
          {STATUS_TABS.map((status) => (
            <button
              key={status}
              className={`rq-tab-btn ${statusFilter === status ? "active" : ""}`}
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
      <div className="rq-section-card">
        <div className="rq-table-wrapper">
          <table className="rq-table">
            <thead>
              <tr>
                <th className="col-slip">Requisition Slip</th>
                <th className="col-requester">Requested By</th>
                <th className="col-title">Title & Purpose</th>
                <th className="col-items">Item & Quantity</th>
                <th className="col-status">Status</th>
                <th className="col-actions text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                currentItems.map((req) => (
                  <tr
                    key={req.id}
                    className="rq-row-clickable"
                    onClick={() => setDetailsId(req.id)}
                  >
                    <td className="align-middle nowrap-cell">
                      <div className="rq-slip-id">{req.id}</div>
                      <div className="rq-sub">{fmtDate(req.date)}</div>
                    </td>
                    <td className="align-middle">
                      <div
                        className="rq-strong cell-clamp"
                        title={req.requestedBy}
                      >
                        {req.requestedBy || "—"}
                      </div>
                      <div className="rq-sub cell-clamp" title={req.department}>
                        {req.department}
                      </div>
                    </td>
                    <td className="align-middle">
                      <div className="rq-strong cell-clamp" title={req.title}>
                        {req.title}
                      </div>
                      <div className="rq-sub cell-clamp" title={req.purpose}>
                        {req.purpose}
                      </div>
                    </td>
                    <td className="align-middle">
                      <div className="cell-clamp" title={summarize(req)}>
                        {summarize(req)}
                      </div>
                    </td>
                    <td className="align-middle nowrap-cell">
                      <span className={`rq-badge ${req.status.toLowerCase()}`}>
                        {req.status}
                      </span>
                    </td>
                    <td
                      className="text-end align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="rq-action-buttons">
                        {isOpen(req) ? (
                          <button
                            className="rq-btn-action rq-btn-review"
                            onClick={() => setDetailsId(req.id)}
                          >
                            Review
                          </button>
                        ) : (
                          <button
                            className="rq-btn-action rq-btn-view"
                            onClick={() => setDetailsId(req.id)}
                          >
                            View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="rq-empty-cell">
                    <div className="rq-empty-content">
                      <div className="rq-empty-icon">
                        <i className="bi bi-inbox"></i>
                      </div>
                      <h4>No Requests Found</h4>
                      <p>
                        No requisition slips match your search or status filter.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rq-footer-bar">
          <span>
            Showing {currentItems.length} of {filteredRequests.length} requests
          </span>
          <div className="rq-pagination">
            <button
              className="rq-btn-action rq-btn-view"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="rq-page-indicator">Page {currentPage}</span>
            <button
              className="rq-btn-action rq-btn-view"
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={indexOfLast >= filteredRequests.length}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Details / Review Modal */}
      {detailsReq && (
        <div className="rq-modal-backdrop" onClick={() => setDetailsId(null)}>
          <div
            className="rq-modal rq-modal-lg"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rq-modal-header">
              <div>
                <h3>{detailsReq.title}</h3>
                <div className="rq-sub">{detailsReq.id}</div>
              </div>
              <div className="rq-modal-header-right">
                <span className={`rq-badge ${detailsReq.status.toLowerCase()}`}>
                  {detailsReq.status}
                </span>
                <button
                  className="rq-modal-close"
                  onClick={() => setDetailsId(null)}
                  aria-label="Close"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>

            <div className="rq-modal-body">
              {isOpen(detailsReq) && (
                <div className="rq-next-step">
                  <strong>Next step</strong>
                  <p>{nextStepText(detailsReq, detailsCheck)}</p>
                </div>
              )}

              <div className="rq-meta-grid">
                <div>
                  <span className="rq-meta-label">Requested by</span>
                  <span className="rq-meta-value">
                    {detailsReq.requestedBy || "—"}
                  </span>
                </div>
                <div>
                  <span className="rq-meta-label">Department</span>
                  <span className="rq-meta-value">{detailsReq.department}</span>
                </div>
                <div>
                  <span className="rq-meta-label">Date filed</span>
                  <span className="rq-meta-value">
                    {fmtDate(detailsReq.date)}
                  </span>
                </div>
                <div>
                  <span className="rq-meta-label">Handled by</span>
                  <span className="rq-meta-value">
                    {detailsReq.reviewedBy || "Not yet"}
                  </span>
                  {detailsReq.reviewedAt && (
                    <span className="rq-meta-sub">
                      {fmtDateTime(detailsReq.reviewedAt)}
                    </span>
                  )}
                </div>
                <div className="rq-meta-wide">
                  <span className="rq-meta-label">Purpose</span>
                  <span className="rq-meta-value rq-normal">
                    {detailsReq.purpose || "—"}
                  </span>
                </div>
              </div>

              {detailsReq.status === "Denied" && detailsReq.denyReason && (
                <div className="rq-deny-box">
                  <strong>Reason for denial</strong>
                  <p>{detailsReq.denyReason}</p>
                </div>
              )}

              <h4 className="rq-section-title">Items from stock</h4>
              {detailsCheck.lines.length > 0 ? (
                <div className="rq-lines-wrap">
                  <table className="rq-lines">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Requested</th>
                        <th>On hand</th>
                        <th>Usual limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsCheck.lines.map((l, idx) => {
                        const unit = l.inv?.unit || "";
                        const showShort = isOpen(detailsReq) && !l.enough;
                        return (
                          <tr key={`${l.id}-${idx}`}>
                            <td>
                              <div className="rq-strong">
                                {l.name || l.inv?.name}
                              </div>
                              <div className="rq-sub">{l.id}</div>
                              {l.qty > l.maxNormal && (
                                <div className="rq-line-reason">
                                  Over the usual limit. Reason:{" "}
                                  {l.reason || "none given"}
                                </div>
                              )}
                            </td>
                            <td>
                              {l.qty} {unit}
                            </td>
                            <td className={showShort ? "rq-short-text" : ""}>
                              {l.inv
                                ? `${l.inv.quantity} ${unit}`
                                : "Not in inventory"}
                            </td>
                            <td>{l.maxNormal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rq-muted-text">No stock items on this request.</p>
              )}

              {hasPurchaseItems(detailsReq) && (
                <>
                  <h4 className="rq-section-title">Items to purchase</h4>
                  <ul className="rq-purchase-list">
                    {detailsReq.purchaseItems.map((p, idx) => (
                      <li key={idx}>
                        <strong>{p.name}</strong> · {p.qty}
                        {p.reason && <div className="rq-sub">{p.reason}</div>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="rq-modal-footer">
              <button
                className="rq-btn-secondary"
                onClick={() => setDetailsId(null)}
              >
                Close
              </button>

              {detailsActions.deny && (
                <button
                  className="rq-btn-danger-outline"
                  onClick={() => openDecision("deny", detailsReq.id)}
                >
                  Deny
                </button>
              )}
              {detailsActions.purchasing && (
                <button
                  className="rq-btn-secondary"
                  onClick={() => handleSendToPurchasing(detailsReq)}
                >
                  Send to purchasing
                </button>
              )}
              {detailsActions.acknowledge && (
                <button
                  className="rq-btn-primary"
                  onClick={() => handleAcknowledge(detailsReq)}
                >
                  Acknowledge
                </button>
              )}
              {detailsActions.accept && (
                <button
                  className="rq-btn-primary"
                  onClick={() => openDecision("accept", detailsReq.id)}
                >
                  Accept
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Accept / Deny Confirmation Modal */}
      {decisionReq && (
        <div
          className="rq-modal-backdrop rq-modal-backdrop-top"
          onClick={closeDecision}
        >
          <div
            className="rq-modal rq-modal-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rq-modal-header">
              <h3>
                {decision.type === "accept"
                  ? "Accept request?"
                  : "Deny request?"}
              </h3>
              <button
                className="rq-modal-close"
                onClick={closeDecision}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="rq-modal-body">
              <p className="rq-confirm-text">
                <strong>{decisionReq.id}</strong> · {decisionReq.title}
              </p>

              {decision.type === "accept" ? (
                decisionCheck.lines.length > 0 ? (
                  <>
                    <p className="rq-muted-text">
                      This will deduct from inventory:
                    </p>
                    <ul className="rq-deduct-list">
                      {decisionCheck.lines.map((l, idx) => (
                        <li key={`${l.id}-${idx}`}>
                          <span>{l.name || l.inv?.name}</span>
                          <span>
                            {l.inv.quantity} → {l.inv.quantity - l.qty}{" "}
                            {l.inv.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="rq-muted-text">
                    No stock items on this request, so nothing will be deducted.
                  </p>
                )
              ) : (
                <div className="rq-field">
                  <label htmlFor="rq-deny-reason">Reason for denial</label>
                  <textarea
                    id="rq-deny-reason"
                    className="form-control custom-input rq-textarea"
                    rows="3"
                    value={denyReason}
                    onChange={(e) => setDenyReason(e.target.value)}
                    placeholder="Explain why, so the requester knows what to fix"
                    autoFocus
                  />
                  <span className="rq-hint">
                    The requester will see this reason.
                  </span>
                </div>
              )}

              <p className="rq-audit-note">
                Recorded under <strong>{actorName}</strong>.
              </p>
            </div>

            <div className="rq-modal-footer">
              <button className="rq-btn-secondary" onClick={closeDecision}>
                Cancel
              </button>
              <button
                className={
                  decision.type === "accept"
                    ? "rq-btn-primary"
                    : "rq-btn-danger"
                }
                onClick={handleConfirmDecision}
                disabled={decision.type === "deny" && !denyReason.trim()}
              >
                {decision.type === "accept" ? "Accept request" : "Deny request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

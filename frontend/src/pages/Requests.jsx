import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import useAllRequisitions from '../hooks/useAllRequisitions';
import useInventory from '../hooks/useInventory';
import { errMsg } from '../api/client';
import '../styles/Requests.css';

const STATUS_TABS = ['All', 'Pending', 'Processing', 'Purchasing', 'Accepted', 'Denied'];
const OPEN_STATUSES = ['Pending', 'Processing', 'Purchasing'];
const DEFAULT_CATEGORIES = [
  'Paper Products',
  'Writing Supplies',
  'Office Supplies',
  'Lab Materials',
  'Cleaning Supplies',
];

// ---------- Helpers ----------
const isOpen = (req) => OPEN_STATUSES.includes(req.status);
const hasPurchaseItems = (req) => (req.purchaseItems || []).length > 0;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const summarize = (req) => {
  if (req.item) return req.item;
  const all = [
    ...(req.itemsList || []).map((l) => `${l.name} (${l.qty})`),
    ...(req.purchaseItems || []).map((l) => `${l.name} (${l.qty})`),
  ];
  return all.join(', ') || '—';
};

const norm = (s) =>
  String(s || '')
    .trim()
    .toLowerCase();

// What is stopping this request from being accepted (empty list = nothing)
const getBlockers = (check, status) => [
  ...check.lines
    .filter((l) => !l.enough)
    .map((l) =>
      l.inv
        ? `${l.name || l.inv.name}: needs ${l.qty}, only ${l.inv.quantity} ${l.inv.unit} on hand.`
        : `${l.name}: can't be found in the inventory.`
    ),
  ...(status === 'Purchasing' ? check.purchaseLines : [])
    .filter((l) => !l.enough)
    .map((l) =>
      l.inv
        ? `${l.name}: needs ${l.qty}, only ${l.inv.quantity} ${l.inv.unit} received so far.`
        : `${l.name}: not in the inventory yet. Once it arrives, add it with the “Add to inventory” button below.`
    ),
];

// Stock items that are fine (enough on hand)
const getAvailable = (check) =>
  check.lines
    .filter((l) => l.enough)
    .map(
      (l) => `${l.name || l.inv.name}: ${l.qty} requested, ${l.inv.quantity} ${l.inv.unit} on hand.`
    );

// Which buttons make sense for this request right now
const getActions = (req, check) => {
  const none = {
    acknowledge: false,
    accept: false,
    purchasing: false,
    deny: false,
    blocked: false,
  };
  if (req.status === 'Pending') return { ...none, acknowledge: true, deny: true };

  if (req.status === 'Processing') {
    const canAccept = !check.short && !hasPurchaseItems(req);
    return { ...none, accept: canAccept, purchasing: !canAccept, deny: true };
  }

  // Purchasing always keeps Accept visible. It is only disabled while stock is missing.
  if (req.status === 'Purchasing') {
    return {
      ...none,
      accept: true,
      deny: true,
      blocked: check.short || check.buyShort,
    };
  }
  return none;
};

// One plain sentence telling staff what to do next
const nextStepText = (req, check) => {
  const buy = hasPurchaseItems(req);
  if (req.status === 'Pending') {
    return "Review the request. Acknowledge it to start processing (the requester can then no longer edit it), or deny it if it can't be approved.";
  }
  if (req.status === 'Processing') {
    if (buy)
      return 'This request includes items that must be purchased. Send it to Purchasing to start buying them, or deny it.';
    if (check.short)
      return "Some items aren't available in stock. Send it to Purchasing while you restock, or deny it.";
    return 'Everything is in stock. Accept to deduct it from the inventory, or deny it.';
  }
  if (req.status === 'Purchasing') {
    if (check.short)
      return 'Waiting on stock. When the delivery arrives, record it in Inventory (Adjust, then Receive stock), then come back and accept.';
    if (check.buyShort)
      return 'The purchased items must be added to the inventory before you can accept. Use the “Add to inventory” button next to each item below.';
    if (buy)
      return 'All purchased items are in the inventory. Accept to hand them over and finish.';
    return 'Stock is ready. Accept to finish.';
  }
  return '';
};

// Progress bar: Pending > Processing > (Purchasing) > Accepted
function Stepper({ req }) {
  if (req.status === 'Denied') return null;
  const flow = [
    'Pending',
    'Processing',
    ...(hasPurchaseItems(req) || req.status === 'Purchasing' ? ['Purchasing'] : []),
    'Accepted',
  ];
  const current = flow.indexOf(req.status);
  return (
    <ol className="rq-steps" aria-label="Request progress">
      {flow.map((step, i) => {
        const done = i < current || req.status === 'Accepted';
        const cls = done ? 'done' : i === current ? 'current' : '';
        return (
          <li key={step} className={cls}>
            <span className="rq-step-dot">{done ? '✓' : i + 1}</span>
            <span className="rq-step-label">{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function Requests() {
  useEffect(() => {
    document.title = 'Requests | BukSUPPLY';
  }, []);

  const { user } = useAuth();
  // Only used for the "recorded under" note. The server records the real user.
  const actorName =
    [user?.firstName, user?.lastName].filter((n) => n && n !== '-').join(' ') ||
    user?.email ||
    'Unknown user';

  // Real data from the API
  const { requisitions, loading, error, setStatus } = useAllRequisitions();
  const {
    items,
    loading: invLoading,
    error: invError,
    refresh: refreshInventory,
    create: createInventoryItem,
    adjust: adjustInventory,
  } = useInventory();
  const invReady = !invLoading && !invError;

  // Filtering and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Modals (store ids so they always show the latest data)
  const [detailsId, setDetailsId] = useState(null);
  const [decision, setDecision] = useState(null); // { type: "accept" | "deny", id }
  const [denyReason, setDenyReason] = useState('');

  // Banner message after an action + error shown inside the open modal
  const [notice, setNotice] = useState(null); // { type: "success" | "error", text }
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  // "Add to inventory" / "Receive stock" popup for purchased items
  const [receive, setReceive] = useState(null); // { reqId, line }
  const [recvQty, setRecvQty] = useState('');
  const [recvCategory, setRecvCategory] = useState('Office Supplies');
  const [recvUnit, setRecvUnit] = useState('pcs');
  const [recvRef, setRecvRef] = useState('');
  const [recvError, setRecvError] = useState('');
  const [recvBusy, setRecvBusy] = useState(false);

  const categoryOptions = useMemo(
    () => [...new Set([...DEFAULT_CATEGORIES, ...items.map((i) => i.category).filter(Boolean)])],
    [items]
  );

  const detailsReq = requisitions.find((r) => r.id === detailsId) || null;
  const decisionReq = decision ? requisitions.find((r) => r.id === decision.id) || null : null;

  // Compares each requested stock line against what is on hand
  const getCheck = (req) => {
    const lines = (req.itemsList || []).map((l) => {
      // Match by the saved link first. Older slips have no link, so fall back to the item name.
      const inv =
        items.find((i) => i._id === String(l.inventoryItemId)) ||
        items.find((i) => norm(i.name) === norm(l.name));
      return { ...l, inv, enough: !!inv && l.qty <= inv.quantity };
    });
    // Purchased items only count once they have been received into the inventory
    const purchaseLines = (req.purchaseItems || []).map((l) => {
      const inv = items.find((i) => norm(i.name) === norm(l.name));
      return { ...l, inv, enough: !!inv && l.qty <= inv.quantity };
    });
    return {
      lines,
      purchaseLines,
      short: lines.some((l) => !l.enough),
      buyShort: purchaseLines.some((l) => !l.enough),
    };
  };

  const detailsCheck = detailsReq ? getCheck(detailsReq) : null;
  const decisionCheck = decisionReq ? getCheck(decisionReq) : null;
  const detailsActions = detailsReq ? getActions(detailsReq, detailsCheck) : null;
  const detailsBlockers =
    invReady && detailsCheck && detailsReq && isOpen(detailsReq)
      ? getBlockers(detailsCheck, detailsReq.status)
      : [];
  const detailsAvailable =
    invReady && detailsCheck && detailsReq && isOpen(detailsReq) ? getAvailable(detailsCheck) : [];

  // Runs one server call. Returns true on success, shows the server's message on failure.
  const run = async (fn) => {
    setBusy(true);
    setActionError('');
    try {
      const out = await fn();
      return out || true;
    } catch (err) {
      setActionError(errMsg(err));
      refreshInventory(); // stock may have changed since this page loaded
      return false;
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(
    () => ({
      pending: requisitions.filter((r) => r.status === 'Pending').length,
      inProgress: requisitions.filter((r) => r.status === 'Processing' || r.status === 'Purchasing')
        .length,
      accepted: requisitions.filter((r) => r.status === 'Accepted').length,
      denied: requisitions.filter((r) => r.status === 'Denied').length,
    }),
    [requisitions]
  );

  // Pending first, then newest
  const filteredRequests = requisitions
    .filter((req) => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        query === '' ||
        req.id.toLowerCase().includes(query) ||
        req.title.toLowerCase().includes(query) ||
        (req.requestedBy || '').toLowerCase().includes(query) ||
        (req.department || '').toLowerCase().includes(query) ||
        summarize(req).toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'All' || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const ap = a.status === 'Pending' ? 0 : 1;
      const bp = b.status === 'Pending' ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(b.date) - new Date(a.date);
    });

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredRequests.slice(indexOfFirst, indexOfLast);

  // ---------- Handlers ----------
  const openDetails = (id) => {
    setActionError('');
    refreshInventory(); // stock may have changed on the Inventory page
    setDetailsId(id);
  };

  const closeDetails = () => {
    setActionError('');
    setDetailsId(null);
  };

  const openDecision = (type, id) => {
    setActionError('');
    setDecision({ type, id });
    setDenyReason('');
  };

  const openReceive = (reqId, line) => {
    setRecvError('');
    setRecvCategory('Office Supplies');
    setRecvUnit('pcs');
    setRecvRef('');
    // If some are already in the inventory, suggest only the missing amount
    setRecvQty(String(line.inv ? Math.max(1, line.qty - line.inv.quantity) : line.qty));
    setReceive({ reqId, line });
  };

  const handleReceive = async () => {
    if (!receive || recvBusy) return;
    const qty = Math.floor(Number(recvQty));
    if (!(qty >= 1)) return setRecvError('Enter a quantity of 1 or more.');
    if (!receive.line.inv && !recvCategory.trim()) {
      return setRecvError('Pick or type a category.');
    }

    setRecvBusy(true);
    setRecvError('');
    try {
      let code = receive.line.inv?.id;
      if (!code) {
        // New item: create it empty, then receive the stock so the history shows the slip
        const created = await createInventoryItem({
          name: receive.line.name,
          category: recvCategory.trim(),
          unit: recvUnit.trim() || 'pcs',
          quantity: 0,
          reorderLevel: 10,
          maxNormal: 10,
          location: '',
        });
        code = created.id;
      }
      await adjustInventory(code, {
        mode: 'add',
        amount: qty,
        // Supplier's delivery/PO number if given, otherwise the slip number
        reference: recvRef.trim() || receive.reqId,
        remark: recvRef.trim()
          ? `Purchased for ${receive.reqId}`
          : 'Purchased for this requisition',
      });
      setReceive(null);
    } catch (err) {
      setRecvError(errMsg(err));
    } finally {
      setRecvBusy(false);
    }
  };

  const closeDecision = () => {
    setActionError('');
    setDecision(null);
    setDenyReason('');
  };

  const handleAcknowledge = async (req) => {
    const ok = await run(() => setStatus(req.id, 'Processing'));
    if (!ok) return;
    setNotice({
      type: 'success',
      text: `${req.id} is now Processing. The requester can no longer edit or cancel it.`,
    });
    closeDetails();
  };

  const handleSendToPurchasing = async (req) => {
    const ok = await run(() => setStatus(req.id, 'Purchasing'));
    if (!ok) return;
    setNotice({ type: 'success', text: `${req.id} was sent to purchasing.` });
    closeDetails();
  };

  const handleConfirmDecision = async () => {
    if (!decisionReq || busy) return;

    if (decision.type === 'accept') {
      // The server checks stock and deducts it. All or nothing.
      const result = await run(() => setStatus(decisionReq.id, 'Accepted'));
      if (!result) return;
      await refreshInventory();
      const moved = result.stock?.deducted || [];
      setNotice({
        type: 'success',
        text: moved.length
          ? `${decisionReq.id} accepted. Deducted from inventory: ${moved
              .map((m) => `${m.name} −${m.qty} (${m.before} → ${m.after} ${m.unit})`)
              .join(', ')}.`
          : result.stock?.skipped
            ? `${decisionReq.id} accepted. Nothing was deducted because this slip's stock was already deducted earlier.`
            : `${decisionReq.id} accepted. No inventory items were on this slip.`,
      });
    } else {
      if (!denyReason.trim()) return;
      const ok = await run(() => setStatus(decisionReq.id, 'Denied', denyReason.trim()));
      if (!ok) return;
      setNotice({ type: 'success', text: `${decisionReq.id} was denied.` });
    }
    closeDecision();
    closeDetails();
  };

  // One helper for the loading / error / empty rows
  const messageRow = (icon, title, text) => (
    <tr>
      <td colSpan="6" className="rq-empty-cell">
        <div className="rq-empty-content">
          <div className="rq-empty-icon">
            <i className={`bi ${icon}`}></i>
          </div>
          <h4>{title}</h4>
          <p>{text}</p>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="requests-container">
      {/* Header */}
      <div className="rq-header-card">
        <div>
          <h1 className="rq-title">Requests</h1>
          <p className="rq-subtitle">
            Pending → Processing → Accepted, Purchasing, or Denied. Click Review on a request to see
            what to do next.
          </p>
        </div>
      </div>

      {/* Notice */}
      {notice && (
        <div className={`rq-notice ${notice.type}`} role="status">
          <span>{notice.text}</span>
          <button className="rq-notice-close" onClick={() => setNotice(null)} aria-label="Dismiss">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      {invError && (
        <div className="rq-notice error" role="alert">
          <span>The inventory couldn't be loaded, so stock can't be checked: {invError}</span>
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
              className={`rq-tab-btn ${statusFilter === status ? 'active' : ''}`}
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
              {loading
                ? messageRow('bi-hourglass-split', 'Loading...', 'Fetching requisition slips.')
                : error
                  ? messageRow('bi-exclamation-circle', 'Could not load requests', error)
                  : currentItems.length > 0
                    ? currentItems.map((req) => (
                        <tr
                          key={req.id}
                          className="rq-row-clickable"
                          onClick={() => openDetails(req.id)}
                        >
                          <td className="align-middle nowrap-cell">
                            <div className="rq-slip-id">{req.id}</div>
                            <div className="rq-sub">{fmtDate(req.date)}</div>
                          </td>
                          <td className="align-middle">
                            <div className="rq-strong cell-clamp" title={req.requestedBy}>
                              {req.requestedBy || '—'}
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
                                  onClick={() => openDetails(req.id)}
                                >
                                  Review
                                </button>
                              ) : (
                                <button
                                  className="rq-btn-action rq-btn-view"
                                  onClick={() => openDetails(req.id)}
                                >
                                  View
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    : messageRow(
                        'bi-inbox',
                        'No Requests Found',
                        'No requisition slips match your search or status filter.'
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
        <div className="rq-modal-backdrop" onClick={closeDetails}>
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
                <button className="rq-modal-close" onClick={closeDetails} aria-label="Close">
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>

            <div className="rq-modal-body">
              {actionError && !decision && (
                <div className="rq-deny-box">
                  <strong>Could not save</strong>
                  <p>{actionError}</p>
                </div>
              )}

              <Stepper req={detailsReq} />

              {isOpen(detailsReq) && (
                <div className="rq-next-step">
                  <strong>Next step</strong>
                  <p>{nextStepText(detailsReq, detailsCheck)}</p>
                  {detailsBlockers.length > 0 && (
                    <ul className="rq-blockers">
                      {detailsBlockers.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {detailsAvailable.length > 0 && (
                    <ul className="rq-available">
                      {detailsAvailable.map((a, i) => (
                        <li key={i}>✓ {a}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="rq-meta-grid">
                <div>
                  <span className="rq-meta-label">Requested by</span>
                  <span className="rq-meta-value">{detailsReq.requestedBy || '—'}</span>
                </div>
                <div>
                  <span className="rq-meta-label">Department</span>
                  <span className="rq-meta-value">{detailsReq.department || '—'}</span>
                </div>
                <div>
                  <span className="rq-meta-label">Date filed</span>
                  <span className="rq-meta-value">{fmtDate(detailsReq.date)}</span>
                </div>
                <div>
                  <span className="rq-meta-label">Handled by</span>
                  <span className="rq-meta-value">{detailsReq.reviewedBy || 'Not yet'}</span>
                  {detailsReq.reviewedAt && (
                    <span className="rq-meta-sub">{fmtDateTime(detailsReq.reviewedAt)}</span>
                  )}
                </div>
                <div className="rq-meta-wide">
                  <span className="rq-meta-label">Purpose</span>
                  <span className="rq-meta-value rq-normal">{detailsReq.purpose || '—'}</span>
                </div>
              </div>

              {detailsReq.status === 'Denied' && detailsReq.denyReason && (
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
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsCheck.lines.map((l, idx) => {
                        const unit = l.inv?.unit || l.unit || '';
                        const showShort = isOpen(detailsReq) && !l.enough;
                        return (
                          <tr key={`${l.inventoryItemId}-${idx}`}>
                            <td>
                              <div className="rq-strong">{l.name || l.inv?.name}</div>
                              <div className="rq-sub">{l.inv?.id || ''}</div>
                              {l.qty > l.maxNormal && (
                                <div className="rq-line-reason">
                                  Over the usual limit. Reason: {l.reason || 'none given'}
                                </div>
                              )}
                            </td>
                            <td>
                              {l.qty} {unit}
                            </td>
                            <td className={showShort ? 'rq-short-text' : ''}>
                              {invLoading
                                ? 'Checking…'
                                : l.inv
                                  ? `${l.inv.quantity} ${unit}`
                                  : 'Not in inventory'}
                            </td>
                            <td>{l.maxNormal}</td>
                            <td>
                              {invLoading ? (
                                '…'
                              ) : l.enough ? (
                                <span className="rq-buy-ok">✓ In stock</span>
                              ) : l.inv ? (
                                <span className="rq-short-text">Not enough</span>
                              ) : (
                                <span className="rq-short-text">Not in inventory</span>
                              )}
                            </td>
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
                  {detailsReq.status === 'Purchasing' && (
                    <p className="rq-muted-text">
                      Once these are bought, add each one to the inventory. Then you can accept.
                    </p>
                  )}
                  <ul className="rq-purchase-list">
                    {detailsCheck.purchaseLines.map((p, idx) => (
                      <li key={idx}>
                        <strong>{p.name}</strong> · {p.qty}
                        {p.reason && <div className="rq-sub">{p.reason}</div>}
                        {detailsReq.status === 'Purchasing' && invReady && (
                          <div className="rq-buy-status">
                            {p.enough ? (
                              <span className="rq-buy-ok">
                                ✓ In inventory ({p.inv.quantity} {p.inv.unit} on hand)
                              </span>
                            ) : (
                              <>
                                <span className="rq-buy-missing">
                                  {p.inv
                                    ? `Only ${p.inv.quantity} ${p.inv.unit} received so far`
                                    : 'Not added to the inventory yet'}
                                </span>
                                <button
                                  className="rq-btn-action rq-btn-review"
                                  onClick={() => openReceive(detailsReq.id, p)}
                                >
                                  {p.inv ? 'Receive stock' : 'Add to inventory'}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="rq-modal-footer">
              <button className="rq-btn-secondary" onClick={closeDetails}>
                Close
              </button>

              {detailsActions.deny && (
                <button
                  className="rq-btn-danger-outline"
                  onClick={() => openDecision('deny', detailsReq.id)}
                  disabled={busy}
                >
                  Deny
                </button>
              )}
              {detailsActions.purchasing && (
                <button
                  className="rq-btn-secondary"
                  onClick={() => handleSendToPurchasing(detailsReq)}
                  disabled={busy}
                >
                  {busy ? 'Saving...' : 'Send to purchasing'}
                </button>
              )}
              {detailsActions.acknowledge && (
                <button
                  className="rq-btn-primary"
                  onClick={() => handleAcknowledge(detailsReq)}
                  disabled={busy}
                >
                  {busy ? 'Saving...' : 'Acknowledge'}
                </button>
              )}
              {detailsActions.accept && (
                <button
                  className="rq-btn-primary"
                  onClick={() => openDecision('accept', detailsReq.id)}
                  disabled={busy || detailsActions.blocked}
                  title={
                    detailsActions.blocked ? 'Not enough stock yet. See the list above.' : undefined
                  }
                >
                  {detailsReq.status === 'Purchasing' && hasPurchaseItems(detailsReq)
                    ? 'Items received · Accept'
                    : 'Accept'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Accept / Deny Confirmation Modal */}
      {decisionReq && (
        <div className="rq-modal-backdrop rq-modal-backdrop-top" onClick={closeDecision}>
          <div
            className="rq-modal rq-modal-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rq-modal-header">
              <h3>{decision.type === 'accept' ? 'Accept request?' : 'Deny request?'}</h3>
              <button className="rq-modal-close" onClick={closeDecision} aria-label="Close">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="rq-modal-body">
              <p className="rq-confirm-text">
                <strong>{decisionReq.id}</strong> · {decisionReq.title}
              </p>

              {decision.type === 'accept' ? (
                decisionCheck.lines.length > 0 ? (
                  <>
                    <p className="rq-muted-text">This will deduct from inventory:</p>
                    <ul className="rq-deduct-list">
                      {decisionCheck.lines.map((l, idx) => (
                        <li key={`${l.inventoryItemId}-${idx}`}>
                          <span>{l.name || l.inv?.name}</span>
                          <span>
                            {l.inv
                              ? `${l.inv.quantity} → ${l.inv.quantity - l.qty} ${l.inv.unit}`
                              : 'Not in inventory'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  !hasPurchaseItems(decisionReq) && (
                    <p className="rq-muted-text">
                      No stock items on this request, so nothing will be deducted.
                    </p>
                  )
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
                  <span className="rq-hint">The requester will see this reason.</span>
                </div>
              )}

              {decision.type === 'accept' && hasPurchaseItems(decisionReq) && (
                <>
                  <p className="rq-muted-text">Purchased items, handed out from the inventory:</p>
                  <ul className="rq-deduct-list">
                    {decisionCheck.purchaseLines.map((p, idx) => (
                      <li key={idx}>
                        <span>{p.name}</span>
                        <span>
                          {p.inv
                            ? `${p.inv.quantity} → ${p.inv.quantity - p.qty} ${p.inv.unit}`
                            : 'Not in inventory'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <p className="rq-audit-note">
                Recorded under <strong>{actorName}</strong>.
              </p>

              {actionError && (
                <div className="rq-deny-box">
                  <strong>Could not save</strong>
                  <p>{actionError}</p>
                </div>
              )}
            </div>

            <div className="rq-modal-footer">
              <button className="rq-btn-secondary" onClick={closeDecision}>
                Cancel
              </button>
              <button
                className={decision.type === 'accept' ? 'rq-btn-primary' : 'rq-btn-danger'}
                onClick={handleConfirmDecision}
                disabled={busy || (decision.type === 'deny' && !denyReason.trim())}
              >
                {busy
                  ? 'Saving...'
                  : decision.type === 'accept'
                    ? 'Accept request'
                    : 'Deny request'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add purchased item to the inventory */}
      {receive && (
        <div className="rq-modal-backdrop rq-modal-backdrop-top" onClick={() => setReceive(null)}>
          <div
            className="rq-modal rq-modal-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rq-modal-header">
              <h3>{receive.line.inv ? 'Receive stock' : 'Add to inventory'}</h3>
              <button
                className="rq-modal-close"
                onClick={() => setReceive(null)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="rq-modal-body">
              <p className="rq-confirm-text">
                <strong>{receive.line.name}</strong> · {receive.reqId}
              </p>
              <p className="rq-muted-text">
                {receive.line.inv
                  ? `${receive.line.inv.quantity} ${receive.line.inv.unit} in the inventory, ${receive.line.qty} needed.`
                  : "This item isn't in the inventory yet. Record what was bought so it can be handed out."}
              </p>

              <div className="rq-field">
                <label htmlFor="rq-recv-qty">Quantity received</label>
                <input
                  id="rq-recv-qty"
                  type="number"
                  min="1"
                  className="form-control custom-input"
                  value={recvQty}
                  onChange={(e) => setRecvQty(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="rq-field">
                <label htmlFor="rq-recv-ref">Delivery or PO reference (optional)</label>
                <input
                  id="rq-recv-ref"
                  type="text"
                  className="form-control custom-input"
                  value={recvRef}
                  onChange={(e) => setRecvRef(e.target.value)}
                  placeholder="e.g. DR-2026-114"
                />
                <span className="rq-hint">
                  From the supplier's receipt. Leave empty to use the slip number.
                </span>
              </div>

              {!receive.line.inv && (
                <>
                  <div className="rq-field">
                    <label htmlFor="rq-recv-cat">Category</label>
                    <input
                      id="rq-recv-cat"
                      type="text"
                      list="rq-category-list"
                      className="form-control custom-input"
                      value={recvCategory}
                      onChange={(e) => setRecvCategory(e.target.value)}
                    />
                    <datalist id="rq-category-list">
                      {categoryOptions.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <div className="rq-field">
                    <label htmlFor="rq-recv-unit">Unit</label>
                    <input
                      id="rq-recv-unit"
                      type="text"
                      className="form-control custom-input"
                      value={recvUnit}
                      onChange={(e) => setRecvUnit(e.target.value)}
                      placeholder="pcs, ream, box"
                    />
                  </div>
                </>
              )}

              <p className="rq-audit-note">
                Recorded under <strong>{actorName}</strong> for slip{' '}
                <strong>{receive.reqId}</strong>.
              </p>

              {recvError && (
                <div className="rq-deny-box">
                  <strong>Could not save</strong>
                  <p>{recvError}</p>
                </div>
              )}
            </div>

            <div className="rq-modal-footer">
              <button className="rq-btn-secondary" onClick={() => setReceive(null)}>
                Cancel
              </button>
              <button className="rq-btn-primary" onClick={handleReceive} disabled={recvBusy}>
                {recvBusy ? 'Saving...' : receive.line.inv ? 'Receive stock' : 'Add to inventory'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

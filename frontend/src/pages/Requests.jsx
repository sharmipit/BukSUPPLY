import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    <div className="rq-stepper-card">
      <ol className="rq-steps" aria-label="Request progress">
        {flow.map((step, i) => {
          const done = i < current || req.status === 'Accepted';
          const cls = done ? 'done' : i === current ? 'current' : '';
          return (
            <React.Fragment key={step}>
              <li className={cls}>
                <span className="rq-step-dot">{done ? <i className="bi bi-check"></i> : i + 1}</span>
                <span className="rq-step-label">{step}</span>
              </li>
              {i < flow.length - 1 && <li className={`rq-step-line ${i < current ? 'done' : ''}`} />}
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}

export default function Requests() {
  useEffect(() => {
    document.title = 'Requests | BukSUPPLY';
  }, []);

  const { user } = useAuth();
  const actorName =
    [user?.firstName, user?.lastName].filter((n) => n && n !== '-').join(' ') ||
    user?.email ||
    'Unknown user';

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

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  // Close the status dropdown on outside click or Escape
  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);

  const [detailsId, setDetailsId] = useState(null);
  const [decision, setDecision] = useState(null);
  const [denyReason, setDenyReason] = useState('');

  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  // Auto-dismiss toast timer
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      setNotice(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const [receive, setReceive] = useState(null);
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

  const getCheck = (req) => {
    const lines = (req.itemsList || []).map((l) => {
      const inv =
        items.find((i) => i._id === String(l.inventoryItemId)) ||
        items.find((i) => norm(i.name) === norm(l.name));
      return { ...l, inv, enough: !!inv && l.qty <= inv.quantity };
    });
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

  const run = async (fn) => {
    setBusy(true);
    setActionError('');
    try {
      const out = await fn();
      return out || true;
    } catch (err) {
      setActionError(errMsg(err));
      refreshInventory();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(
    () => [
      {
        title: 'Total Requests',
        count: requisitions.length,
        icon: 'bi-file-earmark-text',
        colorClass: 'stat-total',
      },
      {
        title: 'Accepted',
        count: requisitions.filter((r) => r.status === 'Accepted').length,
        icon: 'bi-check-circle',
        colorClass: 'stat-accepted',
      },
      {
        title: 'Pending',
        count: requisitions.filter((r) => r.status === 'Pending').length,
        icon: 'bi-clock-history',
        colorClass: 'stat-pending',
      },
      {
        title: 'Processing / Purchasing',
        count: requisitions.filter(
          (r) => r.status === 'Processing' || r.status === 'Purchasing'
        ).length,
        icon: 'bi-arrow-repeat',
        colorClass: 'stat-processing',
      },
    ],
    [requisitions]
  );

  const statusCounts = useMemo(() => {
    const counts = { All: requisitions.length };
    STATUS_TABS.slice(1).forEach((s) => {
      counts[s] = requisitions.filter((r) => r.status === s).length;
    });
    return counts;
  }, [requisitions]);

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

  const openDetails = (id) => {
    setActionError('');
    refreshInventory();
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
      {/* Greeting Header Card with Divider Line */}
      <div className="rq-header-card">
        <div className="rq-header-text">
          <h1 className="rq-title">Requests</h1>
          <p className="rq-subtitle">
            Manage, review, and track departmental requisition slips from initial submission to final fulfillment or denial.
          </p>
        </div>

        <div className="rq-header-divider"></div>

        <div className="stats-grid">
          {stats.map((stat) => (
            <div key={stat.title} className={`stat-card ${stat.colorClass}`}>
              <div className="stat-info">
                <span className="stat-title">{stat.title}</span>
                <h2 className="stat-count">{loading ? '–' : stat.count}</h2>
              </div>
              <div className="stat-icon-circle">
                <i className={`bi ${stat.icon}`}></i>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Bottom-Right Toast Notice */}
      {notice && (
        <div className={`rq-notice-toast ${notice.type}`} role="status">
          <span>{notice.text}</span>
          <button className="rq-notice-close" onClick={() => setNotice(null)} aria-label="Dismiss">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      {invError && (
        <div className="rq-notice-toast error" role="alert">
          <span>The inventory couldn't be loaded: {invError}</span>
        </div>
      )}

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

        <div className="rq-dropdown" ref={filterRef}>
          <button
            type="button"
            className={`rq-dropdown-trigger ${filterOpen ? 'open' : ''}`}
            onClick={() => setFilterOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={filterOpen}
            aria-label="Filter by status"
          >
            <i className="bi bi-funnel"></i>
            <span className="rq-dropdown-label">Status</span>
            <span className="rq-dropdown-value">
              <span className={`rq-dot ${statusFilter.toLowerCase()}`} />
              {statusFilter === 'All' ? 'All statuses' : statusFilter}
            </span>
            <i className="bi bi-chevron-down rq-dropdown-chevron"></i>
          </button>

          {filterOpen && (
            <ul className="rq-dropdown-menu" role="listbox">
              {STATUS_TABS.map((status) => {
                const active = statusFilter === status;
                return (
                  <li key={status} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`rq-dropdown-item ${active ? 'active' : ''}`}
                      onClick={() => {
                        setStatusFilter(status);
                        setCurrentPage(1);
                        setFilterOpen(false);
                      }}
                    >
                      <span className={`rq-dot ${status.toLowerCase()}`} />
                      <span className="rq-dropdown-item-text">
                        {status === 'All' ? 'All statuses' : status}
                      </span>
                      <span className="rq-dropdown-count">{loading ? '–' : statusCounts[status]}</span>
                      <i className={`bi bi-check2 rq-dropdown-check ${active ? 'show' : ''}`}></i>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
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
                                  <i className="bi bi-clipboard-check"></i> Review
                                </button>
                              ) : (
                                <button
                                  className="rq-btn-action rq-btn-view"
                                  onClick={() => openDetails(req.id)}
                                >
                                  <i className="bi bi-eye"></i> View
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
                        return (
                          <tr key={`${l.inventoryItemId}-${idx}`}>
                            <td>
                              <div className="rq-strong">{l.name || l.inv?.name}</div>
                              <div className="rq-sub">{l.inv?.id || ''}</div>
                              {l.qty > l.maxNormal && (
                                <div className="rq-line-reason">
                                  Over usual limit. Reason: {l.reason || 'none given'}
                                </div>
                              )}
                            </td>
                            <td>
                              {l.qty} {unit}
                            </td>
                            <td>
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
                                <span className="rq-badge accepted">In stock</span>
                              ) : l.inv ? (
                                <span className="rq-badge denied">Not enough</span>
                              ) : (
                                <span className="rq-badge denied">Unlisted</span>
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
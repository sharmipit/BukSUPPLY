import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import useAllRequisitions from '../hooks/useAllRequisitions';
import useInventory from '../hooks/useInventory';
import { errMsg } from '../api/client';
import { downloadIssuanceSlip, downloadIssuanceSlipExcel } from '../api/reports';
import { shortName } from '../utils/formatName';
import FilterDropdown from '../components/FilterDropdown';
import IssuanceSlipPreview from '../components/IssuanceSlipPreview';
import DecisionModal from '../components/DecisionModal';
import '../styles/Requests.css';

// Flow: Pending -> Processing -> Approved (ready for release) -> Accepted (claimed)
const STATUS_TABS = ['All', 'Pending', 'Processing', 'Approved', 'Accepted', 'Denied', 'Cancelled'];
const OPEN_STATUSES = ['Pending', 'Processing', 'Approved'];
const STATUS_OPTIONS = STATUS_TABS.map((s) => ({
  value: s,
  label: s === 'All' ? 'All statuses' : s,
  tone: s === 'All' ? undefined : s.toLowerCase(),
}));
const DEFAULT_CATEGORIES = [
  'Paper Products',
  'Writing Supplies',
  'Office Supplies',
  'Lab Materials',
  'Cleaning Supplies',
];
const NEW_CATEGORY = '__new__';

// Longest remark or reason a moderator can write when approving or denying
const REMARK_MAX = 300;

// Pre-written remarks (moderators can pick one, then edit it freely)
const APPROVE_PRESETS = [
  'Approved. You may claim the item(s) at the Supply Office.',
  'Approved. Please bring a valid ID and your copy of the slip when claiming.',
  'Approved. The item(s) are ready for pick-up during office hours.',
  'Approved. Please claim the item(s) within the allowed period.',
];
const DENY_PRESETS = [
  'Insufficient stock to fulfill this request.',
  'The requested quantity exceeds the allowed limit.',
  'Incomplete or unclear request details. Please resubmit with more information.',
  'The item(s) are not available from the Supply Office.',
  'The item(s) were not claimed within the allowed period.',
  'Please resubmit with a smaller quantity.',
];

// ---------- Helpers ----------
const isOpen = (req) => OPEN_STATUSES.includes(req.status);
const hasPurchaseItems = (req) => (req.purchaseItems || []).length > 0;

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

// Most recent activity on a request: the later of when it was added or last edited/updated
const lastActivity = (req) => {
  const times = [req.createdAt, req.date, req.updatedAt, req.reviewedAt]
    .map((d) => (d ? new Date(d).getTime() : 0))
    .filter((t) => !Number.isNaN(t));
  return Math.max(0, ...times);
};

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

// Where "Undo" sends a request back to
const getUndoTarget = (req) => {
  if (req.status === 'Processing') return 'Pending';
  if (req.status === 'Approved') return 'Processing';
  if (req.status === 'Accepted') return 'Approved';
  if (req.status === 'Denied') return req.previousStatus || 'Pending';
  return null;
};

const getBlockers = (check) => [
  ...check.lines
    .filter((l) => !l.enough)
    .map((l) =>
      l.inv
        ? `${l.name || l.inv.name}: needs ${l.qty}, only ${l.inv.quantity} ${l.inv.unit} on hand.`
        : `${l.name}: can't be found in the inventory.`
    ),
  ...check.purchaseLines
    .filter((l) => !l.enough)
    .map((l) =>
      l.inv
        ? `${l.name}: needs ${l.qty}, only ${l.inv.quantity} ${l.inv.unit} received so far.`
        : `${l.name}: not in the inventory yet. Once it arrives, add it with the “Add to inventory” button below.`
    ),
];

const getActions = (req, check, isAdmin) => {
  const a = {
    acknowledge: false,
    approve: false,
    release: false,
    deny: false,
    undo: false,
    blocked: false,
  };
  const stockBlocked = check.short || check.buyShort;

  if (req.status === 'Pending') {
    a.acknowledge = true;
    a.deny = true;
  } else if (req.status === 'Processing') {
    a.approve = true;
    a.deny = true;
    a.blocked = stockBlocked;
  } else if (req.status === 'Approved') {
    a.release = true;
    a.deny = true; // unclaimed items: no deduction happens on deny
    a.blocked = stockBlocked;
  }
  a.undo = isAdmin && !!getUndoTarget(req);
  return a;
};

const nextStepText = (req, check) => {
  const buy = hasPurchaseItems(req);
  if (req.status === 'Pending') {
    return "Review the request. Acknowledge it to start processing (the requester can then no longer edit it), or deny it if it can't be approved.";
  }
  if (req.status === 'Processing') {
    if (check.short || check.buyShort)
      return buy
        ? 'Some items must still be purchased or restocked. Record them in the inventory (Add to inventory / Receive stock below), then approve. You can also deny the request.'
        : 'Some items are not available in stock. Restock in Inventory (Adjust, then Receive stock), then come back and approve, or deny the request.';
    return 'Everything is available. Approve it with a remark so the requester knows they can claim the item(s), or deny it.';
  }
  if (req.status === 'Approved') {
    return 'Approved and waiting to be claimed. Once the requester picks up the item(s), mark them as claimed to deduct from the inventory. If they are never claimed, deny the request (nothing is deducted).';
  }
  return '';
};

function Stepper({ req }) {
  if (req.status === 'Denied' || req.status === 'Cancelled') return null;
  const flow = ['Pending', 'Processing', 'Approved', 'Accepted'];
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
                <span className="rq-step-dot">
                  {done ? <i className="bi bi-check"></i> : i + 1}
                </span>
                <span className="rq-step-label">{step}</span>
              </li>
              {i < flow.length - 1 && (
                <li className={`rq-step-line ${i < current ? 'done' : ''}`} />
              )}
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
  const isAdmin = user?.role === 'Administrator';
  const actorName =
    [user?.firstName, user?.lastName].filter((n) => n && n !== '-').join(' ') ||
    user?.email ||
    'Unknown user';

  // setStatus(id, status, remarks) and undo(id) must exist in the hook
  const { requisitions, loading, error, setStatus, undo } = useAllRequisitions();
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

  const [detailsId, setDetailsId] = useState(null);
  const [decision, setDecision] = useState(null); // {type: approve|release|deny|undo, id}
  const [slipId, setSlipId] = useState(null);
  const [slipBusy, setSlipBusy] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);

  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const [receive, setReceive] = useState(null);
  const [recvQty, setRecvQty] = useState('');
  const [recvCategory, setRecvCategory] = useState('Office Supplies');
  const [recvCustomCategory, setRecvCustomCategory] = useState('');
  const [recvUnit, setRecvUnit] = useState('pcs');
  const [recvRef, setRecvRef] = useState('');
  const [recvError, setRecvError] = useState('');
  const [recvBusy, setRecvBusy] = useState(false);

  const categoryOptions = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    items.forEach((i) => i.category && set.add(i.category));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const detailsReq = requisitions.find((r) => r.id === detailsId) || null;
  const decisionReq = decision ? requisitions.find((r) => r.id === decision.id) || null : null;
  const slipReq = slipId ? requisitions.find((r) => r.id === slipId) || null : null;

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
  const slipCheck = slipReq ? getCheck(slipReq) : null;
  const detailsActions = detailsReq ? getActions(detailsReq, detailsCheck, isAdmin) : null;
  const detailsBlockers =
    invReady && detailsCheck && detailsReq && isOpen(detailsReq) && detailsReq.status !== 'Pending'
      ? getBlockers(detailsCheck)
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

  const stats = useMemo(() => {
    const now = new Date();
    const monthly = requisitions.filter((r) => {
      const d = new Date(r.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const count = (s) => requisitions.filter((r) => r.status === s).length;
    return [
      {
        title: 'Monthly Total Requests',
        count: monthly,
        icon: 'bi-file-earmark-text',
        colorClass: 'stat-total',
      },
      {
        title: 'Pending',
        count: count('Pending'),
        icon: 'bi-clock-history',
        colorClass: 'stat-pending',
      },
      {
        title: 'Processing',
        count: count('Processing'),
        icon: 'bi-arrow-repeat',
        colorClass: 'stat-processing',
      },
      {
        title: 'Approved',
        count: count('Approved'),
        icon: 'bi-patch-check',
        colorClass: 'stat-approved',
      },
    ];
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
    // Newest added or most recently edited/updated first
    .sort((a, b) => lastActivity(b) - lastActivity(a));

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
  };
  const closeDecision = () => {
    setActionError('');
    setDecision(null);
  };

  const openReceive = (reqId, line) => {
    setRecvError('');
    setRecvCategory('Office Supplies');
    setRecvCustomCategory('');
    setRecvUnit('pcs');
    setRecvRef('');
    setRecvQty(String(line.inv ? Math.max(1, line.qty - line.inv.quantity) : line.qty));
    setReceive({ reqId, line });
  };

  const handleReceive = async () => {
    if (!receive || recvBusy) return;
    const qty = Math.floor(Number(recvQty));
    if (!(qty >= 1)) return setRecvError('Enter a quantity of 1 or more.');

    const recvIsNew = recvCategory === NEW_CATEGORY;
    if (!receive.line.inv && recvIsNew && !recvCustomCategory.trim()) {
      return setRecvError('Type the name of the new category.');
    }

    let category = recvCategory;
    if (recvIsNew) {
      const typed = recvCustomCategory.trim();
      category = categoryOptions.find((c) => c.toLowerCase() === typed.toLowerCase()) || typed;
    }

    setRecvBusy(true);
    setRecvError('');
    try {
      let code = receive.line.inv?.id;
      if (!code) {
        const created = await createInventoryItem({
          name: receive.line.name,
          category,
          unit: recvUnit.trim() || 'pcs',
          quantity: 0,
          reorderLevel: 10,
          maxNormal: 10,
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

  const handleAcknowledge = async (req) => {
    const ok = await run(() => setStatus(req.id, 'Processing'));
    if (!ok) return;
    setNotice({
      type: 'success',
      text: `${req.id} is now Processing. The requester can no longer edit or cancel it.`,
    });
    closeDetails();
  };

  // Called by the shared DecisionModal with the remark / reason text (empty for release and undo)
  const handleConfirmDecision = async (value) => {
    if (!decisionReq || busy) return;
    const text = String(value || '').trim();

    if (decision.type === 'approve') {
      if (!text) return;
      const ok = await run(() => setStatus(decisionReq.id, 'Approved', text));
      if (!ok) return;
      setNotice({
        type: 'success',
        text: `${decisionReq.id} approved. It's ready for release. Nothing is deducted until it's claimed.`,
      });
    } else if (decision.type === 'release') {
      const result = await run(() => setStatus(decisionReq.id, 'Accepted'));
      if (!result) return;
      await refreshInventory();
      const moved = result.stock?.deducted || [];
      setNotice({
        type: 'success',
        text: moved.length
          ? `${decisionReq.id} released. Deducted from inventory: ${moved
              .map((m) => `${m.name} −${m.qty} (${m.before} → ${m.after} ${m.unit})`)
              .join(', ')}.`
          : result.stock?.skipped
            ? `${decisionReq.id} released. Nothing was deducted because this slip's stock was already deducted earlier.`
            : `${decisionReq.id} released. No inventory items were on this slip.`,
      });
    } else if (decision.type === 'deny') {
      if (!text) return;
      const ok = await run(() => setStatus(decisionReq.id, 'Denied', text));
      if (!ok) return;
      setNotice({ type: 'success', text: `${decisionReq.id} was denied. No stock was deducted.` });
    } else if (decision.type === 'undo') {
      const target = getUndoTarget(decisionReq);
      const ok = await run(() => undo(decisionReq.id));
      if (!ok) return;
      await refreshInventory();
      setNotice({
        type: 'success',
        text: `${decisionReq.id} was moved back to ${target}.${
          decisionReq.status === 'Accepted'
            ? ' The deducted stock was returned to the inventory.'
            : ''
        }`,
      });
    }
    closeDecision();
    closeDetails();
  };

  // Downloads the issuance slip PDF from the server (same PDF pipeline as System Reports)
  const handleDownloadSlip = async () => {
    if (!slipReq || slipBusy) return;
    setSlipBusy(true);
    try {
      await downloadIssuanceSlip(slipReq.id);
      setNotice({ type: 'success', text: `Issuance slip for ${slipReq.id} downloaded.` });
      setSlipId(null);
    } catch (err) {
      setNotice({ type: 'error', text: `Could not download the slip. ${errMsg(err)}` });
    } finally {
      setSlipBusy(false);
    }
  };

  // Download editable Excel issuance slip
  const handleDownloadSlipExcel = async () => {
    if (!slipReq || excelBusy) return;
    setExcelBusy(true);
    try {
      await downloadIssuanceSlipExcel(slipReq.id);
      setNotice({
        type: 'success',
        text: `Excel slip for ${slipReq.id} downloaded. You can edit it before printing.`,
      });
      setSlipId(null); // Optional: close the modal on success just like PDF, or keep it open if desired
    } catch (err) {
      setNotice({ type: 'error', text: `Could not create the Excel file. ${errMsg(err)}` });
    } finally {
      setExcelBusy(false);
    }
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

  const decisionTitle = {
    approve: 'Approve request?',
    release: 'Mark as claimed?',
    deny: 'Deny request?',
    undo: 'Undo last action?',
  };
  const decisionButton = {
    approve: 'Approve request',
    release: 'Confirm release',
    deny: 'Deny request',
    undo: 'Undo',
  };

  // Lines shown on the issuance slip
  const slipLines = slipReq
    ? [...slipCheck.lines, ...slipCheck.purchaseLines].map((l) => ({
        code: l.inv?.id || l.inv?.code || '',
        name: l.name || l.inv?.name,
        qty: l.qty,
        unit: l.inv?.unit || l.unit || '',
      }))
    : [];

  return (
    <div className="requests-container">
      <div className="rq-header-card">
        <div className="rq-header-text">
          <h1 className="rq-title">Requests</h1>
          <p className="rq-subtitle">
            Manage, review, and track departmental requisition slips from initial submission to
            final release or denial.
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

        <div className="rq-filter-group">
          <FilterDropdown
            icon="bi-funnel"
            ariaLabel="Filter by status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

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
                              {shortName(req.requestedBy)}
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
                          <td className="text-end align-middle">
                            <div className="rq-action-buttons" onClick={(e) => e.stopPropagation()}>
                              {isOpen(req) ? (
                                <button
                                  type="button"
                                  className="rq-btn-action rq-btn-review"
                                  onClick={() => openDetails(req.id)}
                                >
                                  <i className="bi bi-clipboard-check"></i> Review
                                </button>
                              ) : (
                                <button
                                  type="button"
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
              <div className="rq-modal-title">
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

              {['Approved', 'Accepted'].includes(detailsReq.status) && detailsReq.remarks && (
                <div className="rq-note rq-note-neutral">
                  <strong>Remarks</strong>
                  <p>{detailsReq.remarks}</p>
                </div>
              )}

              {detailsReq.status === 'Denied' && detailsReq.remarks && (
                <div className="rq-deny-box">
                  <strong>Reason for denial</strong>
                  <p>{detailsReq.remarks}</p>
                </div>
              )}

              {detailsReq.status === 'Cancelled' && (
                <div className="rq-note rq-note-neutral">
                  <strong>Cancelled by the requester</strong>
                  <p>This request was cancelled before it was processed. No action is needed.</p>
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
                        const overLimit = l.qty > l.maxNormal;
                        return (
                          <React.Fragment key={`${l.inventoryItemId}-${idx}`}>
                          <tr className={overLimit ? 'rq-has-reason' : undefined}>
                            <td>
                              <div className="rq-strong">{l.name || l.inv?.name}</div>
                              <div className="rq-sub">{l.inv?.id || ''}</div>
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
                          {overLimit && (
                            <tr className="rq-reason-row">
                              <td colSpan={5}>
                                <div className="rq-reason-inner">
                                  <span className="rq-reason-label">
                                    Reason for going over the usual limit
                                  </span>
                                  <span className="rq-reason-text">
                                    {l.reason || 'No reason given'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rq-empty-line">No stock items on this request.</div>
              )}

              {hasPurchaseItems(detailsReq) && (
                <>
                  <h4 className="rq-section-title">Items to purchase</h4>
                  {detailsReq.status === 'Processing' && (
                    <p className="rq-section-hint">
                      Once these are bought, add each one to the inventory. Then you can approve.
                    </p>
                  )}
                  <ul className="rq-purchase-list">
                    {detailsCheck.purchaseLines.map((p, idx) => (
                      <li key={idx} className="rq-purchase-item">
                        <div className="rq-purchase-info">
                          <div className="rq-purchase-name">
                            <strong>{p.name}</strong>
                            <span className="rq-purchase-qty">Qty: {p.qty}</span>
                          </div>
                          {p.reason && <div className="rq-sub">{p.reason}</div>}
                        </div>

                        {detailsReq.status === 'Processing' && invReady && (
                          <div className="rq-buy-status">
                            {p.enough ? (
                              <span className="rq-buy-ok">
                                In inventory ({p.inv.quantity} {p.inv.unit} on hand)
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
                                  <i
                                    className={`bi ${p.inv ? 'bi-box-arrow-in-down' : 'bi-plus-lg'}`}
                                  ></i>
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

              {detailsActions.undo && (
                <button
                  className="rq-btn-secondary"
                  onClick={() => openDecision('undo', detailsReq.id)}
                  disabled={busy}
                  title={`Undo to ${getUndoTarget(detailsReq)} (admin only)`}
                >
                  <i className="bi bi-arrow-counterclockwise"></i> Undo
                </button>
              )}

              {detailsActions.deny && (
                <button
                  className="rq-btn-danger-outline"
                  onClick={() => openDecision('deny', detailsReq.id)}
                  disabled={busy}
                  title={
                    detailsReq.status === 'Approved'
                      ? 'Deny as unclaimed (nothing is deducted)'
                      : undefined
                  }
                >
                  Deny
                </button>
              )}

              {['Approved', 'Accepted'].includes(detailsReq.status) && (
                <button className="rq-btn-secondary" onClick={() => setSlipId(detailsReq.id)}>
                  <i className="bi bi-file-earmark-text"></i> Issuance Slip
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
              {detailsActions.approve && (
                <button
                  className="rq-btn-primary"
                  onClick={() => openDecision('approve', detailsReq.id)}
                  disabled={busy || detailsActions.blocked}
                  title={
                    detailsActions.blocked ? 'Not enough stock yet. See the list above.' : undefined
                  }
                >
                  Approve
                </button>
              )}
              {detailsActions.release && (
                <button
                  className="rq-btn-primary"
                  onClick={() => openDecision('release', detailsReq.id)}
                  disabled={busy || detailsActions.blocked}
                  title={
                    detailsActions.blocked ? 'Not enough stock yet. See the list above.' : undefined
                  }
                >
                  Mark as claimed
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve / Release / Deny / Undo confirmation (shared DecisionModal) */}
      {decisionReq && (
        <DecisionModal
          key={`${decision.type}-${decisionReq.id}`}
          title={decisionTitle[decision.type]}
          message={
            <>
              <strong>{decisionReq.id}</strong> · {decisionReq.title}
            </>
          }
          tone={decision.type === 'deny' ? 'danger' : 'primary'}
          label={
            decision.type === 'approve'
              ? 'Remarks for the requester'
              : decision.type === 'deny'
                ? 'Reason for denial'
                : undefined
          }
          placeholder="Pick a template above or write your own"
          suggestions={
            decision.type === 'approve'
              ? APPROVE_PRESETS
              : decision.type === 'deny'
                ? DENY_PRESETS
                : []
          }
          required
          minLength={5}
          maxLength={REMARK_MAX}
          hint={
            decision.type === 'approve'
              ? 'The requester will see this. Nothing is deducted until the items are claimed.'
              : decision.type === 'deny'
                ? 'The requester will see this reason.'
                : undefined
          }
          confirmLabel={decisionButton[decision.type]}
          note={
            <>
              Recorded under <strong>{actorName}</strong>.
            </>
          }
          error={actionError}
          busy={busy}
          onConfirm={handleConfirmDecision}
          onClose={closeDecision}
        >
          {decision.type === 'deny' && decisionReq.status === 'Approved' && (
            <p className="rq-muted-text">
              The items were never released, so nothing will be deducted from the inventory.
            </p>
          )}

          {decision.type === 'release' && (
            <>
              {decisionCheck.lines.length > 0 && (
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
              )}
              {hasPurchaseItems(decisionReq) && (
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
              {decisionCheck.lines.length === 0 && !hasPurchaseItems(decisionReq) && (
                <p className="rq-muted-text">
                  No stock items on this request, so nothing will be deducted.
                </p>
              )}
            </>
          )}

          {decision.type === 'undo' && (
            <p className="rq-muted-text">
              This moves the request from <strong>{decisionReq.status}</strong> back to{' '}
              <strong>{getUndoTarget(decisionReq)}</strong>.
              {decisionReq.status === 'Accepted' &&
                ' The stock that was deducted when it was claimed will be returned to the inventory.'}
            </p>
          )}
        </DecisionModal>
      )}

      {/* Issuance slip preview (same look as the System Reports PDF preview) */}
      {slipReq && (
        <IssuanceSlipPreview
          req={slipReq}
          lines={slipLines}
          generatedBy={actorName}
          busy={slipBusy}
          excelBusy={excelBusy}
          onClose={() => setSlipId(null)}
          onDownload={handleDownloadSlip}
          onDownloadExcel={() => handleDownloadSlipExcel(slipReq)}
        />
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
                    <select
                      id="rq-recv-cat"
                      className="form-control custom-input rq-select"
                      value={recvCategory}
                      onChange={(e) => setRecvCategory(e.target.value)}
                    >
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value={NEW_CATEGORY}>+ Add new category…</option>
                    </select>

                    {recvCategory === NEW_CATEGORY && (
                      <input
                        type="text"
                        className="form-control custom-input rq-new-category"
                        placeholder="e.g. Electrical Supplies"
                        value={recvCustomCategory}
                        onChange={(e) => setRecvCustomCategory(e.target.value)}
                        aria-label="New category name"
                        autoFocus
                      />
                    )}
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
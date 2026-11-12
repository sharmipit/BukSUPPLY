import React, { useState, useEffect, useMemo } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useInventory from '../../hooks/useInventory';
import useAllRequisitions from '../../hooks/useAllRequisitions';
import { errMsg } from '../../api/client';
import { downloadIssuanceSlip, downloadIssuanceSlipExcel } from '../../api/reports';
import { shortName } from '../../utils/formatName';
import IssuanceSlipPreview from '../../components/IssuanceSlipPreview';

import '../../styles/admin/Dashboard.css';
import '../../styles/Requests.css';
import '../../styles/Inventory.css';
import '../../styles/admin/UserManagement.css';

// Flow: Pending -> Processing -> Approved (ready for release) -> Accepted (claimed)
const OPEN_STATUSES = ['Pending', 'Processing', 'Approved'];

const PREVIEW_LIMIT = 5;

const DEFAULT_CATEGORIES = [
  'Paper Products',
  'Writing Supplies',
  'Office Supplies',
  'Lab Materials',
  'Cleaning Supplies',
];
const NEW_CATEGORY = '__new__';

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

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5001')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('token');
  const res = await fetch(`${API_BASE}/api/admin/users${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}

// Where each dashboard shortcut goes. Change these to match your router.
const ROUTES = {
  requests: '/admin/requests',
  inventory: '/admin/inventory',
  users: '/admin/users',
  reports: '/admin/reports-logs', // change to the path registered for ReportsLogs.jsx
};

const EMPTY_FORM = {
  name: '',
  supplier: '',
  category: DEFAULT_CATEGORIES[0],
  unit: 'pcs',
  quantity: 0,
  reorderLevel: 10,
  maxNormal: 10,
};

/* ------------------------------------------------------------------ */
/* Helpers (shared with the Requests and Inventory pages)              */
/* ------------------------------------------------------------------ */

const getStockStatus = (item) => {
  if (item.quantity <= 0) return 'Out of Stock';
  if (item.quantity <= item.reorderLevel) return 'Low Stock';
  return 'In Stock';
};

const statusClass = (status) => status.toLowerCase().replace(/\s+/g, '-');

// Items that need attention come first: out of stock, then low stock, then the rest
const STOCK_ORDER = { 'Out of Stock': 0, 'Low Stock': 1, 'In Stock': 2 };

const getStockFill = (item) => {
  if (item.reorderLevel > 0) {
    return Math.min(100, Math.round((item.quantity / (item.reorderLevel * 2)) * 100));
  }
  return item.quantity > 0 ? 100 : 0;
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

// Most recent activity on a request: the later of when it was added or last edited/updated
const lastActivity = (req) => {
  const times = [req.createdAt, req.date, req.updatedAt, req.reviewedAt]
    .map((d) => (d ? new Date(d).getTime() : 0))
    .filter((t) => !Number.isNaN(t));
  return Math.max(0, ...times);
};

// Short "Item (qty), Item (qty)" text for a slip (same as the Requests page)
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

const isOpen = (req) => OPEN_STATUSES.includes(req.status);
const hasPurchaseItems = (req) => (req.purchaseItems || []).length > 0;

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

// Preset chips + editable textarea
function RemarksField({ id, label, presets, value, onChange, hint }) {
  return (
    <div className="rq-field">
      <label htmlFor={id}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {presets.map((p) => (
          <button
            type="button"
            key={p}
            className={`rq-btn-action ${value === p ? 'rq-btn-review' : 'rq-btn-view'}`}
            style={{ textAlign: 'left', whiteSpace: 'normal' }}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <textarea
        id={id}
        className="form-control custom-input rq-textarea"
        rows="3"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Pick a template above or write your own"
      />
      {hint && <span className="rq-hint">{hint}</span>}
    </div>
  );
}

function ConfirmModal({ isOpen: open, title, message, confirmLabel, onConfirm, onClose }) {
  if (!open) return null;
  return (
    <div className="um-modal-backdrop" onClick={onClose}>
      <div
        className="um-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="db-um-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="um-modal-header">
          <h3 id="db-um-confirm-title">{title}</h3>
          <button type="button" className="um-modal-close" onClick={onClose} aria-label="Close">
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

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const Dashboard = ({
  inventory: inventoryProp, // optional: falls back to the live inventory hook
  outOfStockCount,
  activeModerators,
  onViewRequests, // optional overrides; by default they navigate to ROUTES
  onViewInventory,
  onViewUsers,
  onViewReports,
  onItemAdded = () => {},
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator';

  useEffect(() => {
    document.title = 'Dashboard | BukSUPPLY';
  }, []);
  const displayName = [user?.firstName, user?.lastName].filter((n) => n && n !== '-').join(' ');
  // Only used for the "recorded by" note. The server records the real user.
  const actorName = displayName || user?.email || 'Unknown user';

  // Live inventory (same hook and methods as the Inventory page)
  const {
    items,
    loading: invLoading,
    error: invError,
    refresh: refreshInventory,
    create: createInventoryItem,
    update: updateInventoryItem,
    adjust: adjustInventory,
    archive: archiveInventoryItem,
  } = useInventory();
  // Archived items are hidden from the dashboard (they live under Inventory > Archived).
  // This also keeps requests from being matched to an archived item.
  const activeItems = useMemo(() => items.filter((i) => !i.archived), [items]);
  const inventory = useMemo(
    () => (inventoryProp ?? items).filter((i) => !i.archived),
    [inventoryProp, items]
  );
  const invReady = !invLoading && !invError;

  // Live requisition slips (same hook as the Requests page)
  const {
    requisitions,
    loading: slipsLoading,
    error: slipsError,
    setStatus,
    undo,
  } = useAllRequisitions();

  // Newest added or most recently edited/updated first (same order as the Requests page)
  const slips = useMemo(
    () => [...requisitions].sort((a, b) => lastActivity(b) - lastActivity(a)),
    [requisitions]
  );

  // Live user accounts (same API as the User Management page)
  const [users, setUsers] = useState([]);
  const [moderatorCount, setModeratorCount] = useState(0);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setUsersLoading(true);
      setUsersError('');
      try {
        const listParams = new URLSearchParams({
          filter: 'All',
          search: '',
          page: 1,
          limit: PREVIEW_LIMIT,
        });
        const modParams = new URLSearchParams({
          filter: 'Moderator',
          search: '',
          page: 1,
          limit: 100,
        });
        const [list, mods] = await Promise.all([
          apiFetch(`?${listParams}`, { signal: controller.signal }),
          apiFetch(`?${modParams}`, { signal: controller.signal }),
        ]);
        setUsers(list.users || []);
        setModeratorCount((mods.users || []).filter((u) => u.status === 'Active').length);
      } catch (err) {
        if (err.name !== 'AbortError') setUsersError(err.message);
      } finally {
        if (!controller.signal.aborted) setUsersLoading(false);
      }
    })();
    return () => controller.abort();
  }, [usersRefreshKey]);

  // Category list = defaults + every category currently used by an item
  const categories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    inventory.forEach((i) => i.category && set.add(i.category));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [inventory]);

  // Toast notice
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  /* ================================================================ */
  /* Requisition slips: review, acknowledge, approve, release, deny    */
  /* ================================================================ */

  const [detailsId, setDetailsId] = useState(null);
  const [decision, setDecision] = useState(null); // {type: approve|release|deny|undo, id}
  const [remarks, setRemarks] = useState('');
  const [slipId, setSlipId] = useState(null);
  const [slipBusy, setSlipBusy] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  // Receive purchased stock
  const [receive, setReceive] = useState(null);
  const [recvQty, setRecvQty] = useState('');
  const [recvCategory, setRecvCategory] = useState('Office Supplies');
  const [recvCustomCategory, setRecvCustomCategory] = useState('');
  const [recvUnit, setRecvUnit] = useState('pcs');
  const [recvRef, setRecvRef] = useState('');
  const [recvError, setRecvError] = useState('');
  const [recvBusy, setRecvBusy] = useState(false);

  const detailsReq = requisitions.find((r) => r.id === detailsId) || null;
  const decisionReq = decision ? requisitions.find((r) => r.id === decision.id) || null : null;
  const slipReq = slipId ? requisitions.find((r) => r.id === slipId) || null : null;

  const getCheck = (req) => {
    const lines = (req.itemsList || []).map((l) => {
      const inv =
        activeItems.find((i) => i._id === String(l.inventoryItemId)) ||
        activeItems.find((i) => norm(i.name) === norm(l.name));
      return { ...l, inv, enough: !!inv && l.qty <= inv.quantity };
    });
    const purchaseLines = (req.purchaseItems || []).map((l) => {
      const inv = activeItems.find((i) => norm(i.name) === norm(l.name));
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
    setRemarks('');
  };

  const closeDecision = () => {
    setActionError('');
    setDecision(null);
    setRemarks('');
  };

  const categoryOptions = categories;

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

    // Resolve the category. Reuse an existing spelling if it matches ignoring case.
    let recvResolved = recvCategory;
    if (recvIsNew) {
      const typed = recvCustomCategory.trim();
      recvResolved = categories.find((c) => c.toLowerCase() === typed.toLowerCase()) || typed;
    }

    setRecvBusy(true);
    setRecvError('');
    try {
      let code = receive.line.inv?.id;
      if (!code) {
        const created = await createInventoryItem({
          name: receive.line.name,
          category: recvResolved,
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

  const handleConfirmDecision = async () => {
    if (!decisionReq || busy) return;
    const text = remarks.trim();

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

  // Downloads the issuance slip PDF from the server
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

  // Downloads the editable Excel version of the issuance slip
  const handleDownloadSlipExcel = async () => {
    if (!slipReq || excelBusy) return;
    setExcelBusy(true);
    try {
      await downloadIssuanceSlipExcel(slipReq.id);
      setNotice({
        type: 'success',
        text: `Excel slip for ${slipReq.id} downloaded. You can edit it before printing.`,
      });
      setSlipId(null);
    } catch (err) {
      setNotice({ type: 'error', text: `Could not create the Excel file. ${errMsg(err)}` });
    } finally {
      setExcelBusy(false);
    }
  };

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
        name: l.name || l.inv?.name,
        qty: l.qty,
        unit: l.inv?.unit || l.unit || '',
      }))
    : [];

  // Empty / loading / error row (same as the Requests page)
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

  /* ================================================================ */
  /* Inventory: add, edit, adjust, history, archive                     */
  /* ================================================================ */

  // Add / edit modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [customCategory, setCustomCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Adjust modal
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustMode, setAdjustMode] = useState('add');
  const [adjustReference, setAdjustReference] = useState('');
  const [adjustRemark, setAdjustRemark] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // History modal (stores the id so it always shows the latest data)
  const [historyId, setHistoryId] = useState(null);
  const historyItem = inventory.find((i) => i.id === historyId) || null;

  // Archive modal
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCustomCategory('');
    setFormError('');
    setFormModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      supplier: item.supplier || '',
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      reorderLevel: item.reorderLevel,
      maxNormal: item.maxNormal,
    });
    setCustomCategory('');
    setFormError('');
    setFormModalOpen(true);
  };

  const handleFormChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const isNewCategory = form.category === NEW_CATEGORY;
  const canSave = form.name.trim() && (!isNewCategory || customCategory.trim());

  const handleSaveItem = async () => {
    if (!canSave || saving) return;

    // Resolve the category. Reuse an existing spelling if it matches ignoring case.
    let category = form.category;
    if (isNewCategory) {
      const typed = customCategory.trim();
      category = categories.find((c) => c.toLowerCase() === typed.toLowerCase()) || typed;
    }

    const cleaned = {
      name: form.name.trim(),
      supplier: form.supplier.trim(),
      category,
      unit: form.unit.trim() || 'pcs',
      quantity: Math.max(0, Number(form.quantity) || 0),
      reorderLevel: Math.max(0, Number(form.reorderLevel) || 0),
      maxNormal: Math.max(1, Number(form.maxNormal) || 1),
    };

    setSaving(true);
    setFormError('');
    try {
      // The server records who did it and writes the history entry
      if (editingId) await updateInventoryItem(editingId, cleaned);
      else await createInventoryItem(cleaned);
      setFormModalOpen(false);
      setNotice({
        type: 'success',
        text: editingId
          ? `${cleaned.name} was updated.`
          : `${cleaned.name} was added to the inventory.`,
      });
      if (!editingId) onItemAdded(cleaned);
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const openAdjustModal = (item) => {
    setAdjustTarget(item);
    setAdjustAmount('');
    setAdjustMode('add');
    setAdjustReference('');
    setAdjustRemark('');
    setAdjustError('');
  };

  const adjustQty = Math.abs(Number(adjustAmount) || 0);
  const overWithdraw = adjustTarget && adjustMode === 'remove' && adjustQty > adjustTarget.quantity;
  const adjustPreview = adjustTarget
    ? adjustMode === 'add'
      ? adjustTarget.quantity + adjustQty
      : Math.max(0, adjustTarget.quantity - adjustQty)
    : 0;

  const handleConfirmAdjust = async () => {
    if (!adjustTarget || adjustQty === 0 || overWithdraw || adjusting) return;
    setAdjusting(true);
    setAdjustError('');
    try {
      await adjustInventory(adjustTarget.id, {
        mode: adjustMode,
        amount: adjustQty,
        reference: adjustReference.trim(),
        remark: adjustRemark.trim(),
      });
      setNotice({
        type: 'success',
        text: `${adjustTarget.name}: stock ${
          adjustMode === 'add' ? 'received' : 'withdrawn'
        } (${adjustTarget.quantity} → ${adjustPreview} ${adjustTarget.unit}).`,
      });
      setAdjustTarget(null);
    } catch (err) {
      setAdjustError(errMsg(err));
    } finally {
      setAdjusting(false);
    }
  };

  const openArchiveModal = (item) => {
    setArchiveError('');
    setArchiveTarget(item);
  };

  const closeArchiveModal = () => {
    if (archiving) return;
    setArchiveError('');
    setArchiveTarget(null);
  };

  // Archive hides the item, it is never deleted. Restore it from Inventory > Archived.
  const handleConfirmArchive = async () => {
    if (!archiveTarget || archiving) return;
    setArchiving(true);
    setArchiveError('');
    try {
      await archiveInventoryItem(archiveTarget.id);
      setNotice({
        type: 'success',
        text: `${archiveTarget.name} (${archiveTarget.id}) was archived.`,
      });
      setArchiveTarget(null);
    } catch (err) {
      setArchiveError(errMsg(err));
    } finally {
      setArchiving(false);
    }
  };

  /* ================================================================ */
  /* Users: reactivate                                                 */
  /* ================================================================ */

  const [reactivateTarget, setReactivateTarget] = useState(null);

  const handleConfirmReactivate = async () => {
    if (reactivateTarget) {
      try {
        await apiFetch(`/${reactivateTarget._id}/reactivate`, {
          method: 'PATCH',
        });
        setUsersRefreshKey((k) => k + 1);
        setNotice({
          type: 'success',
          text: `${reactivateTarget.name} (${reactivateTarget.id}) was reactivated.`,
        });
      } catch (err) {
        setUsersError(err.message);
      }
    }
    setReactivateTarget(null);
  };

  /* ================================================================ */
  /* Stats, shortcuts, preview rows                                    */
  /* ================================================================ */

  // Calculate current month's requests to match Requests.jsx precisely
  const monthlyRequestsCount = useMemo(() => {
    const now = new Date();
    return slips.filter((r) => {
      const d = new Date(r.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [slips]);

  const stats = [
    {
      id: 'total',
      label: 'Monthly Total Requests',
      value: monthlyRequestsCount,
      icon: 'bi-file-earmark-text',
    },
    {
      id: 'pending',
      label: 'Pending Requests',
      value: slips.filter((s) => s.status === 'Pending').length,
      icon: 'bi-clock-history',
    },
    {
      id: 'outofstock',
      label: 'Out of Stock Items',
      value: outOfStockCount ?? inventory.filter((i) => i.quantity <= 0).length,
      icon: 'bi-box-seam',
    },
    {
      id: 'moderators',
      label: 'Active Moderators',
      value: activeModerators ?? moderatorCount,
      icon: 'bi-people',
    },
  ];

  // Navigation shortcuts (quick action + "View ..." links in the table footers)
  const handleViewRequests = onViewRequests ?? (() => navigate(ROUTES.requests));
  const handleViewInventory = onViewInventory ?? (() => navigate(ROUTES.inventory));
  const handleViewUsers = onViewUsers ?? (() => navigate(ROUTES.users));
  const handleViewReports = onViewReports ?? (() => navigate(ROUTES.reports));

  const quickActions = [
    { id: 'process', label: 'Process Requests', onClick: handleViewRequests },
    { id: 'item', label: 'Add Item', onClick: openAddModal },
    { id: 'users', label: 'Manage Users', onClick: handleViewUsers },
    { id: 'reports', label: 'System Reports', onClick: handleViewReports },
  ];

  const currentItems = slips.slice(0, PREVIEW_LIMIT);
  const currentUsers = users.slice(0, PREVIEW_LIMIT);
  const currentInvItems = [...inventory]
    .sort(
      (a, b) =>
        STOCK_ORDER[getStockStatus(a)] - STOCK_ORDER[getStockStatus(b)] ||
        String(a.name).localeCompare(String(b.name))
    )
    .slice(0, PREVIEW_LIMIT);

  // Latest movement that has a reference number (delivery / PO / requisition slip)
  const lastRefMove = historyItem
    ? [...(historyItem.movements || [])].reverse().find((m) => m.reference)
    : null;

  return (
    <div className="dashboard">
      {/* Greeting header card */}
      <div className="db-header-card">
        <div className="db-header-text">
          <h1 className="db-title">Dashboard</h1>
          <p className="db-subtitle">
            Good day, <span className="db-name">{displayName || 'there'}</span>! Here is your daily
            operational summary for <strong>BukSU Supply &amp; Property Management</strong>. Review
            pending departmental slips, coordinate physical window issuances, or manage asset
            inventory below.
          </p>
        </div>

        <div className="db-header-divider"></div>

        <div className="db-actions-block">
          <div className="db-quick-actions">
            {quickActions.map((a) => (
              <button key={a.id} type="button" className="db-quick-btn" onClick={a.onClick}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="db-stats-grid">
        {stats.map((s) => (
          <div key={s.id} className="db-stat-card">
            <div className="db-stat-info">
              <span className="db-stat-title">{s.label}</span>
              <h2 className="db-stat-count">{s.value}</h2>
            </div>
            <div className="db-stat-icon-circle">
              <i className={`bi ${s.icon}`} aria-hidden="true"></i>
            </div>
          </div>
        ))}
      </div>

      {/* Requisition queue (same table as the Requests page) */}
      <div className="rq-section-card">
        <div className="db-card-header">
          <div>
            <h3 className="db-card-title">Recent Requisition Slips</h3>
            <p className="db-card-desc">
              Latest requisition slips from departments, newest activity first.
            </p>
          </div>
        </div>

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
              {slipsLoading
                ? messageRow('bi-hourglass-split', 'Loading...', 'Fetching requisition slips.')
                : slipsError
                  ? messageRow('bi-exclamation-circle', 'Could not load requests', slipsError)
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
                          <td
                            className="text-end align-middle"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="rq-action-buttons">
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
                        'No requisition slips have been submitted yet. New requests will appear here automatically.'
                      )}
            </tbody>
          </table>
        </div>

        <div className="db-footer-bar">
          <span>
            Showing {currentItems.length} of {slips.length} requests
          </span>
          <button type="button" className="db-view-btn" onClick={handleViewRequests}>
            View all requests
            <span className="db-view-arrow">
              <i className="bi bi-arrow-right"></i>
            </span>
          </button>
        </div>
      </div>

      {/* Inventory summary + User summary, side by side (same height) */}
      <div className="db-split-row">
        {/* Inventory summary */}
        <div className="db-section-card">
          <div className="db-card-header">
            <div>
              <h3 className="db-card-title">Inventory Overview</h3>
              <p className="db-card-desc">
                Current stock levels, with out-of-stock and low-stock items first.
              </p>
            </div>
          </div>

          <div className="db-table-wrapper">
            <table className="db-table db-inv-table">
              <thead>
                <tr>
                  <th className="col-inv-item">Item</th>
                  <th className="col-inv-category">Category</th>
                  <th className="col-inv-stock">Stock Level</th>
                  <th className="col-inv-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {invLoading ? (
                  <tr>
                    <td colSpan="4" className="db-empty-cell">
                      <div className="db-empty-content">
                        <div className="db-empty-icon">
                          <i className="bi bi-hourglass-split" aria-hidden="true"></i>
                        </div>
                        <h4>Loading...</h4>
                        <p>Fetching inventory items.</p>
                      </div>
                    </td>
                  </tr>
                ) : invError ? (
                  <tr>
                    <td colSpan="4" className="db-empty-cell">
                      <div className="db-empty-content">
                        <div className="db-empty-icon">
                          <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
                        </div>
                        <h4>Could not load inventory</h4>
                        <p>{invError}</p>
                      </div>
                    </td>
                  </tr>
                ) : currentInvItems.length > 0 ? (
                  currentInvItems.map((item) => {
                    const status = getStockStatus(item);
                    return (
                      <tr
                        key={item.id}
                        className="db-row-clickable"
                        onClick={() => setHistoryId(item.id)}
                      >
                        <td>
                          <div className="db-strong db-cell-clamp" title={item.name}>
                            {item.name}
                          </div>
                          <div className="db-sub" title={item.id}>
                            {item.id}
                          </div>
                        </td>
                        <td>
                          <div className="db-cell-clamp" title={item.category}>
                            {item.category}
                          </div>
                        </td>
                        <td>
                          <div className={`db-stock-text ${statusClass(status)}`}>
                            <strong>{item.quantity}</strong> {item.unit}
                          </div>
                          <div className={`db-stock-bar ${statusClass(status)}`} aria-hidden="true">
                            <div
                              className={`db-stock-fill ${statusClass(status)}`}
                              style={{ width: `${getStockFill(item)}%` }}
                            ></div>
                          </div>
                          <div className="db-reorder-text">Reorder at {item.reorderLevel}</div>
                        </td>
                        <td className="db-nowrap-cell">
                          <span className={`db-badge ${statusClass(status)}`}>{status}</span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="db-empty-cell">
                      <div className="db-empty-content">
                        <div className="db-empty-icon">
                          <i className="bi bi-box-seam" aria-hidden="true"></i>
                        </div>
                        <h4>No Inventory Items</h4>
                        <p>Inventory items will appear here once they are added.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="db-footer-bar">
            <button type="button" className="db-view-btn" onClick={handleViewInventory}>
              View inventory
              <span className="db-view-arrow">
                <i className="bi bi-arrow-right"></i>
              </span>
            </button>
          </div>
        </div>

        {/* User management summary */}
        <div className="db-section-card">
          <div className="db-card-header">
            <div>
              <h3 className="db-card-title">User Accounts</h3>
              <p className="db-card-desc">
                Latest accounts and their status. Click a deactivated account to reactivate it.
              </p>
            </div>
          </div>

          <div className="db-table-wrapper">
            <table className="db-table db-users-table">
              <thead>
                <tr>
                  <th className="col-user-id">ID</th>
                  <th className="col-user-name">Name</th>
                  <th className="col-user-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td colSpan="3" className="db-empty-cell">
                      <div className="db-empty-content">
                        <div className="db-empty-icon">
                          <i className="bi bi-hourglass-split" aria-hidden="true"></i>
                        </div>
                        <h4>Loading...</h4>
                        <p>Fetching user accounts.</p>
                      </div>
                    </td>
                  </tr>
                ) : usersError ? (
                  <tr>
                    <td colSpan="3" className="db-empty-cell">
                      <div className="db-empty-content">
                        <div className="db-empty-icon">
                          <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
                        </div>
                        <h4>Could not load users</h4>
                        <p>{usersError}</p>
                      </div>
                    </td>
                  </tr>
                ) : currentUsers.length > 0 ? (
                  currentUsers.map((u) => (
                    <tr
                      key={u._id || u.id}
                      className={u.status === 'Deactivated' ? 'db-row-clickable' : undefined}
                      title={
                        u.status === 'Deactivated' ? 'Click to reactivate this account' : undefined
                      }
                      onClick={
                        u.status === 'Deactivated' ? () => setReactivateTarget(u) : undefined
                      }
                    >
                      <td className="db-user-id">{u.id}</td>
                      <td>
                        <div className="db-strong db-cell-clamp" title={u.name}>
                          {shortName(u.name)}
                        </div>
                        <div className="db-sub db-cell-clamp" title={u.role}>
                          {u.role}
                        </div>
                      </td>
                      <td className="db-nowrap-cell">
                        <span className={`db-badge ${u.status.toLowerCase()}`}>{u.status}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="db-empty-cell">
                      <div className="db-empty-content">
                        <div className="db-empty-icon">
                          <i className="bi bi-people" aria-hidden="true"></i>
                        </div>
                        <h4>No Users Found</h4>
                        <p>User accounts will appear here once they exist.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="db-footer-bar">
            <button type="button" className="db-view-btn" onClick={handleViewUsers}>
              View users
              <span className="db-view-arrow">
                <i className="bi bi-arrow-right"></i>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating bottom-right toast */}
      {notice && (
        <div className={`db-notice-toast ${notice.type}`} role="status">
          <span>{notice.text}</span>
          <button
            type="button"
            className="db-notice-close"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* Requisition: details / review modal                           */}
      {/* ============================================================ */}
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
                <button
                  type="button"
                  className="rq-modal-close"
                  onClick={closeDetails}
                  aria-label="Close"
                >
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
                <div className="rq-next-step">
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
                <div className="rq-deny-box">
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
                  {detailsReq.status === 'Processing' && (
                    <p className="rq-muted-text">
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
                                <i className="bi bi-check-circle-fill"></i> In inventory (
                                {p.inv.quantity} {p.inv.unit} on hand)
                              </span>
                            ) : (
                              <>
                                <span className="rq-buy-missing">
                                  {p.inv
                                    ? `Only ${p.inv.quantity} ${p.inv.unit} received so far`
                                    : 'Not added to the inventory yet'}
                                </span>
                                <button
                                  type="button"
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
              <button type="button" className="rq-btn-secondary" onClick={closeDetails}>
                Close
              </button>

              {detailsActions.undo && (
                <button
                  type="button"
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
                  type="button"
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
                <button
                  type="button"
                  className="rq-btn-secondary"
                  onClick={() => setSlipId(detailsReq.id)}
                >
                  <i className="bi bi-file-earmark-text"></i> Issuance Slip
                </button>
              )}

              {detailsActions.acknowledge && (
                <button
                  type="button"
                  className="rq-btn-primary"
                  onClick={() => handleAcknowledge(detailsReq)}
                  disabled={busy}
                >
                  {busy ? 'Saving...' : 'Acknowledge'}
                </button>
              )}
              {detailsActions.approve && (
                <button
                  type="button"
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
                  type="button"
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

      {/* Approve / Release / Deny / Undo confirmation */}
      {decisionReq && (
        <div className="rq-modal-backdrop rq-modal-backdrop-top" onClick={closeDecision}>
          <div
            className="rq-modal rq-modal-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rq-modal-header">
              <h3>{decisionTitle[decision.type]}</h3>
              <button
                type="button"
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

              {decision.type === 'approve' && (
                <RemarksField
                  id="db-approve-remarks"
                  label="Remarks for the requester"
                  presets={APPROVE_PRESETS}
                  value={remarks}
                  onChange={setRemarks}
                  hint="The requester will see this. Nothing is deducted until the items are claimed."
                />
              )}

              {decision.type === 'deny' && (
                <>
                  {decisionReq.status === 'Approved' && (
                    <p className="rq-muted-text">
                      The items were never released, so nothing will be deducted from the inventory.
                    </p>
                  )}
                  <RemarksField
                    id="db-deny-reason"
                    label="Reason for denial"
                    presets={DENY_PRESETS}
                    value={remarks}
                    onChange={setRemarks}
                    hint="The requester will see this reason."
                  />
                </>
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
                      <p className="rq-muted-text">
                        Purchased items, handed out from the inventory:
                      </p>
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
              <button type="button" className="rq-btn-secondary" onClick={closeDecision}>
                Cancel
              </button>
              <button
                type="button"
                className={decision.type === 'deny' ? 'rq-btn-danger' : 'rq-btn-primary'}
                onClick={handleConfirmDecision}
                disabled={busy || (['approve', 'deny'].includes(decision.type) && !remarks.trim())}
              >
                {busy ? 'Saving...' : decisionButton[decision.type]}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issuance slip preview */}
      {slipReq && (
        <IssuanceSlipPreview
          req={slipReq}
          lines={slipLines}
          generatedBy={actorName}
          busy={slipBusy}
          excelBusy={excelBusy}
          onClose={() => setSlipId(null)}
          onDownload={handleDownloadSlip}
          onDownloadExcel={handleDownloadSlipExcel}
        />
      )}

      {/* Receive purchased item into the inventory */}
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
                type="button"
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
                <label htmlFor="db-recv-qty">Quantity received</label>
                <input
                  id="db-recv-qty"
                  type="number"
                  min="1"
                  className="form-control custom-input"
                  value={recvQty}
                  onChange={(e) => setRecvQty(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="rq-field">
                <label htmlFor="db-recv-ref">Delivery or PO reference (optional)</label>
                <input
                  id="db-recv-ref"
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
                    <label htmlFor="db-recv-cat">Category</label>
                    <select
                      id="db-recv-cat"
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
                    <label htmlFor="db-recv-unit">Unit</label>
                    <input
                      id="db-recv-unit"
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
              <button type="button" className="rq-btn-secondary" onClick={() => setReceive(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="rq-btn-primary"
                onClick={handleReceive}
                disabled={recvBusy}
              >
                {recvBusy ? 'Saving...' : receive.line.inv ? 'Receive stock' : 'Add to inventory'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Inventory: add / edit modal                                   */}
      {/* ============================================================ */}
      {formModalOpen && (
        <div className="db-modal-backdrop" onClick={() => setFormModalOpen(false)}>
          <div
            className="db-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="db-modal-header">
              <h3>{editingId ? 'Edit item' : 'Add item'}</h3>
              <button
                type="button"
                className="db-modal-close"
                onClick={() => setFormModalOpen(false)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="db-modal-body">
              <div className="db-field">
                <label htmlFor="db-name">Item name</label>
                <input
                  id="db-name"
                  type="text"
                  className="db-input"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g. A4 bond paper"
                />
              </div>

              <div className="db-field">
                <label htmlFor="db-supplier">Supplier name (optional)</label>
                <input
                  id="db-supplier"
                  type="text"
                  className="db-input"
                  value={form.supplier}
                  onChange={(e) => handleFormChange('supplier', e.target.value)}
                  placeholder="e.g. Cagayan Office Depot"
                  maxLength={120}
                />
                <span className="db-field-hint">Who usually delivers or sells this item.</span>
              </div>

              <div className="db-field-row">
                <div className="db-field">
                  <label htmlFor="db-category">Category</label>
                  <select
                    id="db-category"
                    className="db-input db-select"
                    value={form.category}
                    onChange={(e) => handleFormChange('category', e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value={NEW_CATEGORY}>+ Add new category…</option>
                  </select>

                  {isNewCategory && (
                    <input
                      type="text"
                      className="db-input db-new-category"
                      placeholder="e.g. Electrical Supplies"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      aria-label="New category name"
                      autoFocus
                    />
                  )}
                </div>
                <div className="db-field">
                  <label htmlFor="db-unit">Unit</label>
                  <input
                    id="db-unit"
                    type="text"
                    className="db-input"
                    value={form.unit}
                    onChange={(e) => handleFormChange('unit', e.target.value)}
                    placeholder="pcs, ream, box"
                  />
                </div>
              </div>

              <div className="db-field-row">
                <div className="db-field">
                  <label htmlFor="db-qty">Quantity on hand</label>
                  <input
                    id="db-qty"
                    type="number"
                    min="0"
                    className="db-input"
                    value={form.quantity}
                    onChange={(e) => handleFormChange('quantity', e.target.value)}
                  />
                </div>
                <div className="db-field">
                  <label htmlFor="db-reorder">Reorder level</label>
                  <input
                    id="db-reorder"
                    type="number"
                    min="0"
                    className="db-input"
                    value={form.reorderLevel}
                    onChange={(e) => handleFormChange('reorderLevel', e.target.value)}
                  />
                </div>
              </div>

              <div className="db-field">
                <label htmlFor="db-max">Normal limit per request</label>
                <input
                  id="db-max"
                  type="number"
                  min="1"
                  className="db-input"
                  value={form.maxNormal}
                  onChange={(e) => handleFormChange('maxNormal', e.target.value)}
                />
                <span className="db-field-hint">
                  Users can still request more, but they must explain why.
                </span>
              </div>

              <p className="db-audit-note">
                {editingId ? 'This edit will be recorded' : 'This item will be recorded as added'}{' '}
                by <strong>{actorName}</strong>.
              </p>

              {formError && (
                <div className="db-error-box">
                  <strong>Could not save</strong>
                  <p>{formError}</p>
                </div>
              )}
            </div>

            <div className="db-modal-footer">
              <button
                type="button"
                className="db-btn-secondary"
                onClick={() => setFormModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="db-btn-primary"
                onClick={handleSaveItem}
                disabled={!canSave || saving}
              >
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory: adjust stock */}
      {adjustTarget && (
        <div className="inv-modal-backdrop" onClick={() => setAdjustTarget(null)}>
          <div
            className="inv-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-header">
              <h3>Adjust stock</h3>
              <button
                type="button"
                className="inv-modal-close"
                onClick={() => setAdjustTarget(null)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="inv-modal-body">
              <p className="inv-adjust-item">
                <strong>{adjustTarget.name}</strong> · {adjustTarget.quantity} {adjustTarget.unit}{' '}
                on hand
              </p>

              <div className="inv-segmented">
                <button
                  type="button"
                  className={adjustMode === 'add' ? 'active' : ''}
                  onClick={() => setAdjustMode('add')}
                >
                  <i className="bi bi-box-arrow-in-down"></i> Receive stock
                </button>
                <button
                  type="button"
                  className={adjustMode === 'remove' ? 'active' : ''}
                  onClick={() => setAdjustMode('remove')}
                >
                  <i className="bi bi-box-arrow-up"></i> Withdraw stock
                </button>
              </div>

              <div className="inv-field">
                <label htmlFor="db-adjust-amount">Quantity ({adjustTarget.unit})</label>
                <input
                  id="db-adjust-amount"
                  type="number"
                  min="1"
                  className="form-control custom-input"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
                {overWithdraw && (
                  <span className="inv-field-error">
                    Only {adjustTarget.quantity} {adjustTarget.unit} on hand. Enter a smaller
                    quantity.
                  </span>
                )}
              </div>

              <div className="inv-field">
                <label htmlFor="db-adjust-ref">
                  {adjustMode === 'add' ? 'Delivery or PO reference' : 'Requisition slip'}{' '}
                  (optional)
                </label>
                <input
                  id="db-adjust-ref"
                  type="text"
                  className="form-control custom-input"
                  value={adjustReference}
                  onChange={(e) => setAdjustReference(e.target.value)}
                  placeholder={adjustMode === 'add' ? 'e.g. DR-2026-114' : 'e.g. REQ-2026-075'}
                />
              </div>

              <div className="inv-field">
                <label htmlFor="db-adjust-remark">Remark (optional)</label>
                <textarea
                  id="db-adjust-remark"
                  className="form-control custom-input inv-textarea"
                  rows="2"
                  value={adjustRemark}
                  onChange={(e) => setAdjustRemark(e.target.value)}
                  placeholder="Anything worth noting about this change"
                />
              </div>

              <p className="inv-adjust-preview">
                New stock level:{' '}
                <strong>
                  {adjustPreview} {adjustTarget.unit}
                </strong>{' '}
                · recorded by <strong>{actorName}</strong>
              </p>

              {adjustError && (
                <div className="inv-error-box">
                  <strong>Could not save</strong>
                  <p>{adjustError}</p>
                </div>
              )}
            </div>

            <div className="inv-modal-footer">
              <button
                type="button"
                className="inv-btn-secondary"
                onClick={() => setAdjustTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inv-btn-primary"
                onClick={handleConfirmAdjust}
                disabled={adjustQty === 0 || overWithdraw || adjusting}
              >
                {adjusting
                  ? 'Saving...'
                  : adjustMode === 'add'
                    ? 'Receive stock'
                    : 'Withdraw stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory: item details and movement history */}
      {historyItem && (
        <div className="inv-modal-backdrop" onClick={() => setHistoryId(null)}>
          <div
            className="inv-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-header">
              <div>
                <h3>{historyItem.name}</h3>
                <div className="inv-item-id">
                  {historyItem.id} · {historyItem.category}
                </div>
              </div>
              <button
                type="button"
                className="inv-modal-close"
                onClick={() => setHistoryId(null)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="inv-modal-body">
              <div className="inv-detail-group">
                <h4 className="inv-detail-card-title">Stock</h4>
                <div className="inv-detail-card">
                  <div className="inv-meta-grid">
                    <div>
                      <span className="inv-meta-label">On hand</span>
                      <span className="inv-meta-value">
                        {historyItem.quantity} {historyItem.unit}
                      </span>
                    </div>
                    <div>
                      <span className="inv-meta-label">Reorder level</span>
                      <span className="inv-meta-value">
                        {historyItem.reorderLevel} {historyItem.unit}
                      </span>
                    </div>
                    <div>
                      <span className="inv-meta-label">Usual limit per request</span>
                      <span className="inv-meta-value">
                        {historyItem.maxNormal} {historyItem.unit}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="inv-detail-group">
                <h4 className="inv-detail-card-title">Item info</h4>
                <div className="inv-detail-card">
                  <div className="inv-meta-grid">
                    <div>
                      <span className="inv-meta-label">Category</span>
                      <span className="inv-meta-value">{historyItem.category}</span>
                    </div>
                    <div>
                      <span className="inv-meta-label">Supplier</span>
                      <span className="inv-meta-value">{historyItem.supplier || 'Not set'}</span>
                    </div>
                    <div>
                      <span className="inv-meta-label">Last reference no.</span>
                      <span className="inv-meta-value">
                        {lastRefMove ? lastRefMove.reference : '—'}
                      </span>
                      {lastRefMove && (
                        <span className="inv-meta-sub">
                          {lastRefMove.type} · {fmtDateTime(lastRefMove.date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="inv-detail-group">
                <h4 className="inv-detail-card-title">Activity</h4>
                <div className="inv-detail-card">
                  <div className="inv-meta-grid">
                    <div>
                      <span className="inv-meta-label">Added by</span>
                      <span className="inv-meta-value">{historyItem.addedBy}</span>
                      <span className="inv-meta-sub">{fmtDateTime(historyItem.dateAdded)}</span>
                    </div>
                    <div>
                      <span className="inv-meta-label">Last updated by</span>
                      <span className="inv-meta-value">{historyItem.updatedBy}</span>
                      <span className="inv-meta-sub">{fmtDateTime(historyItem.updated)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <h4 className="inv-history-title">Stock history</h4>
              <ul className="inv-timeline">
                {[...(historyItem.movements || [])].reverse().map((m) => (
                  <li key={m.id} className="inv-timeline-item">
                    <span className={`inv-move-dot ${m.type.toLowerCase()}`}></span>
                    <div className="inv-move-head">
                      <span className={`inv-move-badge ${m.type.toLowerCase()}`}>{m.type}</span>
                      <span className="inv-move-qty">
                        {m.type === 'Received' && `+${m.qty}`}
                        {m.type === 'Withdrawn' && `−${m.qty}`}
                        {m.type === 'Created' && `${m.after} ${historyItem.unit}`}
                        {m.type === 'Edited' &&
                          (m.before !== m.after
                            ? `${m.before} → ${m.after}`
                            : 'No quantity change')}
                      </span>
                      <span className="inv-move-date">{fmtDateTime(m.date)}</span>
                    </div>
                    <div className="inv-move-meta">
                      by {m.by}
                      {m.type !== 'Created' &&
                        m.type !== 'Edited' &&
                        ` · ${m.before} → ${m.after} ${historyItem.unit}`}
                      {m.reference && ` · Ref: ${m.reference}`}
                    </div>
                    {m.remark && <div className="inv-move-remark">{m.remark}</div>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="inv-modal-footer">
              <button
                type="button"
                className="inv-btn-secondary"
                onClick={() => setHistoryId(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="inv-btn-quiet"
                onClick={() => {
                  setHistoryId(null);
                  openArchiveModal(historyItem);
                }}
              >
                <i className="bi bi-archive"></i>
                Archive
              </button>
              <button
                type="button"
                className="inv-btn-secondary"
                onClick={() => {
                  setHistoryId(null);
                  openEditModal(historyItem);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="inv-btn-primary"
                onClick={() => {
                  setHistoryId(null);
                  openAdjustModal(historyItem);
                }}
              >
                Adjust stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory: archive confirmation */}
      {archiveTarget && (
        <div className="inv-modal-backdrop inv-modal-backdrop-top" onClick={closeArchiveModal}>
          <div
            className="inv-modal inv-modal-auto"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="db-archive-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-header">
              <h3 id="db-archive-title">Archive inventory item?</h3>
              <button
                type="button"
                className="inv-modal-close"
                onClick={closeArchiveModal}
                aria-label="Close"
                disabled={archiving}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="inv-modal-body">
              <p className="inv-confirm-text">
                <strong>{archiveTarget.name}</strong> · {archiveTarget.id}
              </p>

              <div className="inv-note-box">
                <strong>The item will be hidden, not deleted</strong>
                <p>
                  It will no longer appear in requests or in the stock counts, but its details and
                  stock history are kept. You can restore it anytime from the Archived filter on the
                  Inventory page.
                  {archiveTarget.quantity > 0 &&
                    ` It still has ${archiveTarget.quantity} ${archiveTarget.unit} on hand.`}
                </p>
              </div>

              {archiveError && (
                <div className="inv-error-box">
                  <strong>Could not archive</strong>
                  <p>{archiveError}</p>
                </div>
              )}
            </div>

            <div className="inv-modal-footer">
              <button
                type="button"
                className="inv-btn-secondary"
                onClick={closeArchiveModal}
                disabled={archiving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inv-btn-primary"
                onClick={handleConfirmArchive}
                disabled={archiving}
              >
                {archiving ? 'Archiving...' : 'Archive item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Users: reactivate confirmation                                */}
      {/* ============================================================ */}
      <ConfirmModal
        isOpen={!!reactivateTarget}
        title="Reactivate account?"
        message={
          reactivateTarget
            ? `${reactivateTarget.name} (${reactivateTarget.id}) will regain access to the system.`
            : ''
        }
        confirmLabel="Reactivate"
        onConfirm={handleConfirmReactivate}
        onClose={() => setReactivateTarget(null)}
      />
    </div>
  );
};

export default Dashboard;
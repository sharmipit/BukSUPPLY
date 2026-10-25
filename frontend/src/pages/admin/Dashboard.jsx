import React, { useState, useEffect, useMemo } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useInventory from '../../hooks/useInventory';
import useAllRequisitions from '../../hooks/useAllRequisitions';
import { errMsg } from '../../api/client';
// Dashboard styles first, then the page styles whose modals are reused below.
// If your build already loads these globally, the extra imports are harmless.
import '../../styles/admin/Dashboard.css';
import '../../styles/Requests.css';
import '../../styles/Inventory.css';
import '../../styles/admin/UserManagement.css';

const OPEN_STATUSES = ['Pending', 'Processing', 'Purchasing'];
// Each summary table only previews the first few rows
const PREVIEW_LIMIT = 5;

// Starting categories. Any category typed into the form is added automatically.
const DEFAULT_CATEGORIES = [
  'Paper Products',
  'Writing Supplies',
  'Office Supplies',
  'Lab Materials',
  'Cleaning Supplies',
];
const NEW_CATEGORY = '__new__';

// Works whether or not VITE_API_URL ends in "/api" (same as User Management)
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
    remove: removeInventoryItem,
  } = useInventory();
  const inventory = inventoryProp ?? items;
  const invReady = !invLoading && !invError;

  // Live requisition slips (same hook as the Requests page)
  const {
    requisitions,
    loading: slipsLoading,
    error: slipsError,
    setStatus,
  } = useAllRequisitions();

  // Pending first, then newest (same order as the Requests page)
  const slips = useMemo(
    () =>
      [...requisitions].sort((a, b) => {
        const ap = a.status === 'Pending' ? 0 : 1;
        const bp = b.status === 'Pending' ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return new Date(b.date) - new Date(a.date);
      }),
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
  /* Requisition slips: review, acknowledge, purchase, accept, deny    */
  /* ================================================================ */

  const [detailsId, setDetailsId] = useState(null);
  const [decision, setDecision] = useState(null);
  const [denyReason, setDenyReason] = useState('');
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

  const closeDecision = () => {
    setActionError('');
    setDecision(null);
    setDenyReason('');
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

  /* ================================================================ */
  /* Inventory: add, edit, adjust, history, delete                     */
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

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  const openDeleteModal = (item) => {
    setDeleteError('');
    setDeleteTarget(item);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteError('');
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await removeInventoryItem(deleteTarget.id);
      setNotice({
        type: 'success',
        text: `${deleteTarget.name} (${deleteTarget.id}) was deleted.`,
      });
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(errMsg(err));
    } finally {
      setDeleting(false);
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

  const stats = [
    {
      id: 'total',
      label: 'Total Requests',
      value: slips.length,
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
    { id: 'reports', label: 'Reports & Logs', onClick: handleViewReports },
  ];

  const currentItems = slips.slice(0, PREVIEW_LIMIT);
  const currentInvItems = inventory.slice(0, PREVIEW_LIMIT);
  const currentUsers = users.slice(0, PREVIEW_LIMIT);

  return (
    <div className="dashboard">
      {/* Greeting header card */}
      <div className="db-header-card">
        <div className="db-header-text">
          <h1 className="db-title">
            Good day! <span className="db-name">{displayName || 'there'}!</span>
          </h1>
          <p className="db-subtitle">
            Here is your daily operational summary for{' '}
            <strong>BukSU Supply &amp; Property Management</strong>. Review pending departmental
            slips, coordinate physical window issuances, or manage asset inventory below.
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

      {/* Requisition queue */}
      <div className="db-section-card">
        <div className="db-table-wrapper">
          <table className="db-table">
            <thead>
              <tr>
                <th className="col-slip">Requisition Slip</th>
                <th className="col-requester">Requested By</th>
                <th className="col-title">Title &amp; Purpose</th>
                <th className="col-items">Item &amp; Quantity</th>
                <th className="col-status">Status</th>
                <th className="col-actions db-text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {slipsLoading ? (
                <tr>
                  <td colSpan="6" className="db-empty-cell">
                    <div className="db-empty-content">
                      <div className="db-empty-icon">
                        <i className="bi bi-hourglass-split" aria-hidden="true"></i>
                      </div>
                      <h4>Loading...</h4>
                      <p>Fetching requisition slips.</p>
                    </div>
                  </td>
                </tr>
              ) : slipsError ? (
                <tr>
                  <td colSpan="6" className="db-empty-cell">
                    <div className="db-empty-content">
                      <div className="db-empty-icon">
                        <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
                      </div>
                      <h4>Could not load requests</h4>
                      <p>{slipsError}</p>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length > 0 ? (
                currentItems.map((req) => (
                  <tr key={req.id} className="db-row-clickable" onClick={() => openDetails(req.id)}>
                    <td className="db-nowrap-cell">
                      <div className="db-slip-id">{req.id}</div>
                      <div className="db-sub">{fmtDate(req.date)}</div>
                    </td>
                    <td>
                      <div className="db-strong db-cell-clamp" title={req.requestedBy}>
                        {req.requestedBy || '—'}
                      </div>
                      <div className="db-sub db-cell-clamp" title={req.department}>
                        {req.department}
                      </div>
                    </td>
                    <td>
                      <div className="db-strong db-cell-clamp" title={req.title}>
                        {req.title}
                      </div>
                      <div className="db-sub db-cell-clamp" title={req.purpose}>
                        {req.purpose}
                      </div>
                    </td>
                    <td>
                      <div className="db-cell-clamp" title={summarize(req)}>
                        {summarize(req)}
                      </div>
                    </td>
                    <td className="db-nowrap-cell">
                      <span className={`db-badge ${req.status.toLowerCase()}`}>{req.status}</span>
                    </td>
                    <td className="db-text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="db-action-buttons">
                        {isOpen(req) ? (
                          <button
                            type="button"
                            className="db-btn-action db-btn-review"
                            onClick={() => openDetails(req.id)}
                          >
                            <i className="bi bi-clipboard-check"></i> Review
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="db-btn-action db-btn-view"
                            onClick={() => openDetails(req.id)}
                          >
                            <i className="bi bi-eye"></i> View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="db-empty-cell">
                    <div className="db-empty-content">
                      <div className="db-empty-icon">
                        <i className="bi bi-check-circle" aria-hidden="true"></i>
                      </div>
                      <h4>No Requests Found</h4>
                      <p>
                        No requisition slips have been submitted yet. New requests will appear here
                        automatically.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="db-footer-bar">
          <button type="button" className="db-view-btn" onClick={handleViewRequests}>
            View all requests
            <span className="db-view-arrow">
              <i className="bi bi-arrow-right"></i>
            </span>
          </button>
        </div>
      </div>

      {/* Inventory summary + User summary, side by side */}
      <div className="db-split-row">
        {/* Inventory summary */}
        <div className="db-section-card">
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
                {currentInvItems.length > 0 ? (
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
                          <div className="db-sub">{item.id}</div>
                        </td>
                        <td>
                          <div className="db-cell-clamp" title={item.category}>
                            {item.category}
                          </div>
                        </td>
                        <td>
                          <div className="db-stock-text">
                            <strong>{item.quantity}</strong> {item.unit}
                          </div>
                          <div className="db-stock-bar" aria-hidden="true">
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
                          {u.name}
                        </div>
                        <div className="db-sub">{u.role}</div>
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
                                  type="button"
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
              <button type="button" className="rq-btn-secondary" onClick={closeDetails}>
                Close
              </button>

              {detailsActions.deny && (
                <button
                  type="button"
                  className="rq-btn-danger-outline"
                  onClick={() => openDecision('deny', detailsReq.id)}
                  disabled={busy}
                >
                  Deny
                </button>
              )}
              {detailsActions.purchasing && (
                <button
                  type="button"
                  className="rq-btn-secondary"
                  onClick={() => handleSendToPurchasing(detailsReq)}
                  disabled={busy}
                >
                  {busy ? 'Saving...' : 'Send to purchasing'}
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
              {detailsActions.accept && (
                <button
                  type="button"
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

      {/* Accept / Deny confirmation */}
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
                  <label htmlFor="db-deny-reason">Reason for denial</label>
                  <textarea
                    id="db-deny-reason"
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
              <button type="button" className="rq-btn-secondary" onClick={closeDecision}>
                Cancel
              </button>
              <button
                type="button"
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
              <div className="inv-meta-grid">
                <div>
                  <span className="inv-meta-label">On hand</span>
                  <span className="inv-meta-value">
                    {historyItem.quantity} {historyItem.unit}
                  </span>
                </div>
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
                className="inv-btn-danger"
                onClick={() => {
                  setHistoryId(null);
                  openDeleteModal(historyItem);
                }}
              >
                Delete
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

      {/* Inventory: delete confirmation */}
      {deleteTarget && (
        <div className="inv-modal-backdrop inv-modal-backdrop-top" onClick={closeDeleteModal}>
          <div
            className="inv-modal inv-modal-auto"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="db-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-header">
              <h3 id="db-delete-title">Delete inventory item?</h3>
              <button
                type="button"
                className="inv-modal-close"
                onClick={closeDeleteModal}
                aria-label="Close"
                disabled={deleting}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="inv-modal-body">
              <p className="inv-confirm-text">
                <strong>{deleteTarget.name}</strong> · {deleteTarget.id}
              </p>

              <div className="inv-error-box">
                <strong>This action cannot be undone</strong>
                <p>
                  Are you sure you want to delete item {deleteTarget.id}?
                  {deleteTarget.quantity > 0 &&
                    ` It still has ${deleteTarget.quantity} ${deleteTarget.unit} on hand.`}
                </p>
              </div>

              {deleteError && (
                <div className="inv-error-box">
                  <strong>Could not delete</strong>
                  <p>{deleteError}</p>
                </div>
              )}
            </div>

            <div className="inv-modal-footer">
              <button
                type="button"
                className="inv-btn-secondary"
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inv-btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete item'}
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

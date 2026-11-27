import React, { useState, useEffect, useMemo, useRef } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useInventory from '../../hooks/useInventory';
import useAllRequisitions from '../../hooks/useAllRequisitions';
import api, { errMsg } from '../../api/client';
import { downloadIssuanceSlip, downloadIssuanceSlipExcel } from '../../api/reports';
import { shortName } from '../../utils/formatName';
import IssuanceSlipPreview from '../../components/IssuanceSlipPreview';
import DecisionModal from '../../components/DecisionModal';

import '../../styles/moderator/Dashboard.css';
import '../../styles/Requests.css';
import '../../styles/Inventory.css';

// Longest remark or reason a moderator can write when approving or denying
const REMARK_MAX = 300;

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

const ROUTES = {
  requests: '/staff/requests',
  inventory: '/staff/inventory',
  activity: '/staff/activity',
  reports: '/staff/reports-logs',
};

// Starting units. Any unit typed into the form is added automatically.
const DEFAULT_UNITS = [
  'bottle',
  'box',
  'bundle',
  'cartridge',
  'dozen',
  'gallon',
  'kg',
  'liter',
  'meter',
  'pack',
  'pair',
  'pcs',
  'ream',
  'roll',
  'set',
  'sheet',
];
const NEW_UNIT = '__new__';

// Nothing is pre-filled: the person has to choose or type every value.
const EMPTY_FORM = {
  name: '',
  supplier: '',
  category: '',
  unit: '',
  quantity: '',
  reorderLevel: '',
  maxNormal: '',
};

// ---------- Field rules ----------
// Same rules as the Inventory page and the top of routes/inventory.js (the server has the final say).
const LIMITS = {
  name: 80,
  supplier: 120,
  category: 40,
  unit: 15,
  reference: 40,
  remark: 200,
  maxQty: 100000, // largest quantity / reorder level / limit allowed
};

// Characters that are NOT allowed. They are removed as the person types or pastes.
// Units are letters, numbers, spaces and hyphens only (for example "pcs", "box of 10", "A4-pack").
const STRIP = {
  name: /[^\p{L}\p{N} .,'’"()\-/&#+%:]/gu,
  category: /[^\p{L}\p{N} .,'’()\-/&]/gu,
  unit: /[^\p{L}\p{N} -]/gu,
  reference: /[^A-Za-z0-9 ._\-/#]/g,
  remark: /[<>{}`\\\u0000-\u001F\u007F]/g,
};
const isClean = (value, strip) => value.replace(strip, '') === value;

// Shown only at the moment a disallowed character is typed or pasted
const BLOCK_MSG = {
  name: 'Only letters, numbers and basic punctuation are allowed here.',
  category: 'Only letters, numbers and . , \' ( ) - / & are allowed here.',
  unit: 'Only letters, numbers, spaces and hyphens are allowed in a unit.',
  reference: 'Only letters, numbers and - _ / . # are allowed here.',
  remark: 'Symbols such as < > { } ` \\ are not allowed here.',
};

// Trim and collapse repeated spaces
const squash = (v) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim();

// While typing: drop disallowed characters, leading spaces and double spaces, and cap the length
const cleanTyping = (v, strip, max) =>
  String(v ?? '')
    .replace(strip, '')
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, max);

const fmtQty = (n) => Number(n).toLocaleString('en-PH');

const textProblem = (value, { label, max, strip, required = false, min = 1, needsLetter = false }) => {
  if (!value) return required ? `${label} is required.` : '';
  if (value.length < min) return `${label} must be at least ${min} characters.`;
  if (value.length > max) return `${label} must be ${max} characters or fewer.`;
  if (!isClean(value, strip)) return `${label} has characters that are not allowed.`;
  if (needsLetter && !/[\p{L}\p{N}]/u.test(value)) {
    return `${label} must contain at least one letter or number.`;
  }
  return '';
};

// Whole numbers only. Nothing is silently corrected: a bad value shows a message instead.
const numberProblem = (raw, { label, min, max }) => {
  const s = String(raw ?? '');
  if (s === '') return `${label} is required.`;
  if (!/^\d+$/.test(s)) return `${label} must be a whole number.`;
  const n = Number(s);
  if (n < min) return `${label} must be at least ${min}.`;
  if (n > max) return `${label} cannot be more than ${fmtQty(max)}.`;
  return '';
};

// Returns { fieldName: 'message' } for every field that is not valid yet
const validateForm = (form, { isNewCategory, customCategory, isNewUnit, customUnit }) => {
  const e = {};

  const name = squash(form.name);
  const nameMsg = textProblem(name, {
    label: 'Item name', max: LIMITS.name, strip: STRIP.name, required: true, min: 2, needsLetter: true,
  });
  if (nameMsg) e.name = nameMsg;

  const supplierMsg = textProblem(squash(form.supplier), {
    label: 'Supplier name', max: LIMITS.supplier, strip: STRIP.name,
  });
  if (supplierMsg) e.supplier = supplierMsg;

  if (!form.category) {
    e.category = 'Choose a category.';
  } else if (isNewCategory) {
    const msg = textProblem(squash(customCategory), {
      label: 'Category name', max: LIMITS.category, strip: STRIP.category, required: true, min: 2, needsLetter: true,
    });
    if (msg) e.newCategory = msg;
  }

  if (!form.unit) {
    e.unit = 'Choose a unit.';
  } else if (isNewUnit) {
    const msg = textProblem(squash(customUnit), {
      label: 'Unit name', max: LIMITS.unit, strip: STRIP.unit, required: true, min: 1, needsLetter: true,
    });
    if (msg) e.newUnit = msg;
  }

  const q = numberProblem(form.quantity, { label: 'Quantity', min: 0, max: LIMITS.maxQty });
  if (q) e.quantity = q;
  const r = numberProblem(form.reorderLevel, { label: 'Reorder level', min: 0, max: LIMITS.maxQty });
  if (r) e.reorderLevel = r;
  const m = numberProblem(form.maxNormal, { label: 'Normal limit', min: 1, max: LIMITS.maxQty });
  if (m) e.maxNormal = m;

  return e;
};

// Text box that only accepts digits (no minus sign, decimal point or "e"), so negatives,
// decimals and scientific notation cannot even be typed or pasted.
// baseClass lets the Add / Edit form use its own input look (db-input).
function NumberInput({ value, onChange, invalid, baseClass = 'form-control custom-input', ...rest }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      className={`${baseClass}${invalid ? ' inv-input-invalid' : ''}`}
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (/^\d*$/.test(v)) onChange(v.replace(/^0+(?=\d)/, '')); // also drops leading zeros
      }}
      {...rest}
    />
  );
}

// Dropdown with the same look and chevron animation as the Inventory page form.
// The list opens inside the form so the modal does not clip it.
function FormSelect({
  id,
  value,
  options,
  placeholder,
  onChange,
  invalid,
  triggerClass = 'form-control custom-input',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    menuRef.current?.scrollIntoView({ block: 'nearest' });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`inv-dd${open ? ' open' : ''}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`${triggerClass} inv-dd-trigger${open ? ' open' : ''}${
          invalid ? ' inv-input-invalid' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`inv-dd-text${selected ? '' : ' placeholder'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <i className="bi bi-chevron-down inv-dd-chevron" aria-hidden="true"></i>
      </button>

      {open && (
        <ul className="inv-dd-menu" role="listbox" ref={menuRef}>
          {options.map((o) => (
            <li key={o.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`inv-dd-item${o.value === value ? ' active' : ''}${
                  o.action ? ' action' : ''
                }`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span className="inv-dd-item-text">{o.label}</span>
                <i
                  className={`bi bi-check2 inv-dd-check${o.value === value ? ' show' : ''}`}
                  aria-hidden="true"
                ></i>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const getStockStatus = (item) => {
  if (item.quantity <= 0) return 'Out of Stock';
  if (item.quantity <= item.reorderLevel) return 'Low Stock';
  return 'In Stock';
};

const statusClass = (status) => status.toLowerCase().replace(/\s+/g, '-');

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

const isOpen = (req) => OPEN_STATUSES.includes(req.status);
const hasPurchaseItems = (req) => (req.purchaseItems || []).length > 0;

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

const getActions = (req, check) => {
  const a = {
    acknowledge: false,
    approve: false,
    release: false,
    deny: false,
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

/* ------------------------------------------------------------------ */
/* Main Component                                                     */
/* ------------------------------------------------------------------ */

const Dashboard = ({
  inventory: inventoryProp,
  outOfStockCount,
  onViewRequests,
  onViewInventory,
  onViewActivity,
  onViewReports,
  onItemAdded = () => {},
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    document.title = 'Dashboard | BukSUPPLY';
  }, []);
  const displayName = [user?.firstName, user?.lastName].filter((n) => n && n !== '-').join(' ');
  const actorName = displayName || user?.email || 'Unknown user';
  // Greeting card: first word + last word of the name (see utils/formatName.js)
  const greetingName = displayName ? shortName(displayName) : '';

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

  const {
    requisitions,
    loading: slipsLoading,
    error: slipsError,
    setStatus,
  } = useAllRequisitions();

  const slips = useMemo(
    () => [...requisitions].sort((a, b) => lastActivity(b) - lastActivity(a)),
    [requisitions]
  );

  const categories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    inventory.forEach((i) => i.category && set.add(i.category));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [inventory]);

  // Unit list = defaults + every unit currently used by an item (same spelling counted once)
  const units = useMemo(() => {
    const seen = new Map();
    [...DEFAULT_UNITS, ...inventory.map((i) => i.unit)].forEach((u) => {
      const s = squash(u);
      if (s && !seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
    });
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [inventory]);

  const categoryOptions = useMemo(
    () => [
      ...categories.map((c) => ({ value: c, label: c })),
      { value: NEW_CATEGORY, label: '+ Add new category…', action: true },
    ],
    [categories]
  );

  const unitOptions = useMemo(
    () => [
      ...units.map((u) => ({ value: u, label: u })),
      { value: NEW_UNIT, label: '+ Add new unit…', action: true },
    ],
    [units]
  );

  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  /* ================================================================ */
  /* Requisition Slips State and Actions                              */
  /* ================================================================ */

  const [detailsId, setDetailsId] = useState(null);
  const [decision, setDecision] = useState(null); // { type: 'approve' | 'release' | 'deny', id }
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const [slipId, setSlipId] = useState(null);
  const [slipBusy, setSlipBusy] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);

  // Receive purchased stock
  const [receive, setReceive] = useState(null);
  const [recvQty, setRecvQty] = useState('');
  const [recvCategory, setRecvCategory] = useState('Office Supplies');
  const [recvCustomCategory, setRecvCustomCategory] = useState('');
  const [recvUnit, setRecvUnit] = useState('pcs');
  const [recvCustomUnit, setRecvCustomUnit] = useState('');
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
  const detailsActions = detailsReq ? getActions(detailsReq, detailsCheck) : null;
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
    setRecvCustomUnit('');
    setRecvRef('');
    setBlocked({});
    setRecvQty(String(line.inv ? Math.max(1, line.qty - line.inv.quantity) : line.qty));
    setReceive({ reqId, line });
  };

  const handleReceive = async () => {
    if (!receive || recvBusy) return;

    // Same rules as the Inventory page: whole numbers only, clean text, no oversized stock
    const qtyMsg = numberProblem(recvQty, {
      label: 'Quantity received',
      min: 1,
      max: LIMITS.maxQty,
    });
    if (qtyMsg) return setRecvError(qtyMsg);
    const qty = Number(recvQty);

    const onHand = receive.line.inv?.quantity ?? 0;
    if (onHand + qty > LIMITS.maxQty) {
      return setRecvError(
        `Stock cannot go over ${fmtQty(LIMITS.maxQty)}. You can receive at most ${fmtQty(
          Math.max(0, LIMITS.maxQty - onHand)
        )} more.`
      );
    }

    const recvIsNew = recvCategory === NEW_CATEGORY;
    const recvUnitIsNew = recvUnit === NEW_UNIT;

    if (!receive.line.inv) {
      if (!recvCategory) return setRecvError('Choose a category.');
      if (recvIsNew) {
        const msg = textProblem(squash(recvCustomCategory), {
          label: 'Category name',
          max: LIMITS.category,
          strip: STRIP.category,
          required: true,
          min: 2,
          needsLetter: true,
        });
        if (msg) return setRecvError(msg);
      }
      if (!recvUnit) return setRecvError('Choose a unit.');
      if (recvUnitIsNew) {
        const msg = textProblem(squash(recvCustomUnit), {
          label: 'Unit name',
          max: LIMITS.unit,
          strip: STRIP.unit,
          required: true,
          min: 1,
          needsLetter: true,
        });
        if (msg) return setRecvError(msg);
      }
    }

    const refMsg = textProblem(squash(recvRef), {
      label: 'Reference',
      max: LIMITS.reference,
      strip: STRIP.reference,
    });
    if (refMsg) return setRecvError(refMsg);

    // Resolve the category and unit. Reuse an existing spelling if it matches ignoring case.
    let recvResolved = recvCategory;
    if (recvIsNew) {
      const typed = squash(recvCustomCategory);
      recvResolved = categories.find((c) => c.toLowerCase() === typed.toLowerCase()) || typed;
    }
    let recvUnitResolved = recvUnit;
    if (recvUnitIsNew) {
      const typed = squash(recvCustomUnit);
      recvUnitResolved = units.find((u) => u.toLowerCase() === typed.toLowerCase()) || typed;
    }

    const ref = squash(recvRef).toUpperCase();

    setRecvBusy(true);
    setRecvError('');
    try {
      let code = receive.line.inv?.id;
      if (!code) {
        const created = await createInventoryItem({
          name: squash(receive.line.name),
          category: recvResolved,
          unit: recvUnitResolved,
          quantity: 0,
          reorderLevel: 10,
          maxNormal: 10,
        });
        code = created.id;
      }
      await adjustInventory(code, {
        mode: 'add',
        amount: qty,
        reference: ref || receive.reqId,
        remark: ref ? `Purchased for ${receive.reqId}` : 'Purchased for this requisition',
      });
      setReceive(null);
    } catch (err) {
      setRecvError(errMsg(err));
    } finally {
      setRecvBusy(false);
    }
  };

  const handleAcknowledge = async (req) => {
    const ok = await run(() => setStatus(req.id, 'Processing', '', req.status));
    if (!ok) return;
    setNotice({
      type: 'success',
      text: `${req.id} is now Processing. The requester can no longer edit or cancel it.`,
    });
    closeDetails();
  };

  // Called by the shared DecisionModal with the remark / reason text (empty for release)
  const handleConfirmDecision = async (value) => {
    if (!decisionReq || busy) return;
    const text = String(value || '').trim();

    if (decision.type === 'approve') {
      if (!text) return;
      const ok = await run(() => setStatus(decisionReq.id, 'Approved', text, decisionReq.status));
      if (!ok) return;
      setNotice({
        type: 'success',
        text: `${decisionReq.id} approved. It's ready for release. Nothing is deducted until it's claimed.`,
      });
    } else if (decision.type === 'release') {
      const result = await run(() => setStatus(decisionReq.id, 'Accepted', '', decisionReq.status));
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
      const ok = await run(() => setStatus(decisionReq.id, 'Denied', text, decisionReq.status));
      if (!ok) return;
      setNotice({ type: 'success', text: `${decisionReq.id} was denied. No stock was deducted.` });
    }
    closeDecision();
    closeDetails();
  };

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
  };
  const decisionButton = {
    approve: 'Approve request',
    release: 'Confirm release',
    deny: 'Deny request',
  };

  const slipLines = slipReq
    ? [...slipCheck.lines, ...slipCheck.purchaseLines].map((l) => ({
        code: l.inv?.id || l.inv?.code || '',
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
  /* Inventory Management State and Actions                           */
  /* ================================================================ */

  // Add / edit modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingUpdatedAt, setEditingUpdatedAt] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [customCategory, setCustomCategory] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showAll, setShowAll] = useState(false); // true after pressing Save: show every problem
  // Messages that appear only when a disallowed character was just typed or pasted
  const [blocked, setBlocked] = useState({});

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

  // Archive modal. It opens on top of the details modal, so Cancel goes back to the details.
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  // Open requests (Pending / Processing / Approved) that still include the item being archived
  const [archiveCheck, setArchiveCheck] = useState({ loading: false, list: [] });
  const archiveTargetRef = useRef(null);

  // ---------- Disallowed-character messages ----------
  // Sets a message only while the last keystroke / paste contained a disallowed character.
  const flagBlocked = (field, raw, kind) => {
    const msg =
      String(raw ?? '').replace(STRIP[kind], '') !== String(raw ?? '') ? BLOCK_MSG[kind] : '';
    setBlocked((b) => ((b[field] || '') === msg ? b : { ...b, [field]: msg }));
  };

  // ---------- Add / edit ----------
  const resetFormState = () => {
    setCustomCategory('');
    setCustomUnit('');
    setFormError('');
    setShowAll(false);
    setBlocked({});
  };

  const openAddModal = () => {
    setEditingId(null);
    setEditingUpdatedAt(null);
    setForm(EMPTY_FORM);
    resetFormState();
    setFormModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setEditingUpdatedAt(item.updated ?? null);
    setForm({
      name: item.name,
      supplier: item.supplier || '',
      category: item.category,
      // Use the spelling from the unit list so "Pcs" and "pcs" are not two different units
      unit: units.find((u) => u.toLowerCase() === squash(item.unit).toLowerCase()) || item.unit,
      quantity: String(item.quantity),
      reorderLevel: String(item.reorderLevel),
      maxNormal: String(item.maxNormal),
    });
    resetFormState();
    setFormModalOpen(true);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormError('');
  };
  // kind = which rule set applies (a key of STRIP)
  const handleText = (field, value, kind, max) => {
    flagBlocked(field, value, kind);
    handleFormChange(field, cleanTyping(value, STRIP[kind], max));
  };

  const isNewCategory = form.category === NEW_CATEGORY;
  const isNewUnit = form.unit === NEW_UNIT;

  const formErrors = useMemo(
    () => validateForm(form, { isNewCategory, customCategory, isNewUnit, customUnit }),
    [form, isNewCategory, customCategory, isNewUnit, customUnit]
  );

  // A problem is shown only after the person typed something into that field,
  // or after they pressed Save. Nothing appears just because a field is empty.
  const errFor = (field) => {
    const msg = formErrors[field];
    if (!msg) return '';
    const typed =
      field === 'newCategory' ? customCategory : field === 'newUnit' ? customUnit : form[field];
    return showAll || String(typed ?? '') !== '' ? msg : '';
  };
  const fieldMsg = (field) => {
    const text = errFor(field) || blocked[field];
    return text ? <span className="db-field-error">{text}</span> : null;
  };
  const inputClass = (field) => `db-input${errFor(field) ? ' inv-input-invalid' : ''}`;

  const handleSaveItem = async () => {
    if (saving) return;

    setShowAll(true);
    if (Object.keys(formErrors).length) {
      setFormError('Please fix the highlighted fields.');
      return;
    }

    // Resolve the category. Reuse an existing spelling if it matches ignoring case.
    let category = form.category;
    if (isNewCategory) {
      const typed = squash(customCategory);
      category = categories.find((c) => c.toLowerCase() === typed.toLowerCase()) || typed;
    }

    // Same for the unit, so "Box" and "box" never become two units
    let unit = form.unit;
    if (isNewUnit) {
      const typed = squash(customUnit);
      unit = units.find((u) => u.toLowerCase() === typed.toLowerCase()) || typed;
    }

    const cleaned = {
      name: squash(form.name),
      supplier: squash(form.supplier),
      category,
      unit,
      quantity: Number(form.quantity),
      reorderLevel: Number(form.reorderLevel),
      maxNormal: Number(form.maxNormal),
    };

    setSaving(true);
    setFormError('');
    try {
      // The server records who did it and writes the history entry
      if (editingId) {
        await updateInventoryItem(
          editingId,
          editingUpdatedAt ? { ...cleaned, updatedAt: editingUpdatedAt } : cleaned
        );
      } else await createInventoryItem(cleaned);
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

  // ---------- Adjust stock ----------
  const openAdjustModal = (item) => {
    setAdjustTarget(item);
    setAdjustAmount('');
    setAdjustMode('add');
    setAdjustReference('');
    setAdjustRemark('');
    setAdjustError('');
    setBlocked({});
  };

  const adjustQty = Number(adjustAmount) || 0; // the box only accepts digits
  const overWithdraw = adjustTarget && adjustMode === 'remove' && adjustQty > adjustTarget.quantity;
  const overMax =
    adjustTarget && adjustMode === 'add' && adjustTarget.quantity + adjustQty > LIMITS.maxQty;
  const adjustPreview = adjustTarget
    ? adjustMode === 'add'
      ? adjustTarget.quantity + adjustQty
      : Math.max(0, adjustTarget.quantity - adjustQty)
    : 0;

  const handleConfirmAdjust = async () => {
    if (!adjustTarget || adjustQty === 0 || overWithdraw || overMax || adjusting) return;
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
        } (${fmtQty(adjustTarget.quantity)} → ${fmtQty(adjustPreview)} ${adjustTarget.unit}).`,
      });
      setAdjustTarget(null);
    } catch (err) {
      setAdjustError(errMsg(err));
    } finally {
      setAdjusting(false);
    }
  };

  // ---------- Archive. Nothing is deleted from the database. ----------
  const archiveBlocked = archiveCheck.list.length > 0;
  archiveTargetRef.current = archiveTarget ? archiveTarget.id : null;

  // The details modal stays open underneath, so pressing Cancel returns to it.
  const openArchiveModal = (item) => {
    setArchiveError('');
    setArchiveTarget(item);
    setArchiveCheck({ loading: true, list: [] });

    // Ask the server which open requests still include this item.
    // If this check fails, the server still refuses the archive when the button is pressed.
    api
      .get(`/inventory/${encodeURIComponent(item.id)}/open-requests`)
      .then(({ data }) => {
        if (archiveTargetRef.current === item.id) {
          setArchiveCheck({ loading: false, list: data.openRequests || [] });
        }
      })
      .catch(() => {
        if (archiveTargetRef.current === item.id) setArchiveCheck({ loading: false, list: [] });
      });
  };

  const closeArchiveModal = () => {
    if (archiving) return;
    setArchiveError('');
    setArchiveTarget(null);
    setArchiveCheck({ loading: false, list: [] });
  };

  // Archive hides the item, it is never deleted. Restore it from Inventory > Archived.
  const handleConfirmArchive = async () => {
    if (!archiveTarget || archiving || archiveBlocked || archiveCheck.loading) return;
    setArchiving(true);
    setArchiveError('');
    try {
      await archiveInventoryItem(archiveTarget.id);
      setNotice({
        type: 'success',
        text: `${archiveTarget.name} (${archiveTarget.id}) was archived.`,
      });
      setArchiveTarget(null);
      setHistoryId(null); // the item is archived now, so its details close too
    } catch (err) {
      // The server found open requests we did not know about yet (for example a new one just came in)
      const blockers = err.response?.data?.openRequests;
      if (blockers?.length) setArchiveCheck({ loading: false, list: blockers });
      setArchiveError(errMsg(err));
    } finally {
      setArchiving(false);
    }
  };

  /* ================================================================ */
  /* Stats and Quick Actions                                         */
  /* ================================================================ */

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
      id: 'lowstock',
      label: 'Low Stock Items',
      value: inventory.filter((i) => getStockStatus(i) === 'Low Stock').length,
      icon: 'bi-exclamation-triangle',
    },
  ];

  const handleViewRequests = onViewRequests ?? (() => navigate(ROUTES.requests));
  const handleViewInventory = onViewInventory ?? (() => navigate(ROUTES.inventory));
  const handleViewActivity = onViewActivity ?? (() => navigate(ROUTES.activity));
  const handleViewReports = onViewReports ?? (() => navigate(ROUTES.reports));

  const quickActions = [
    { id: 'process', label: 'Process Requests', onClick: handleViewRequests },
    { id: 'item', label: 'Add Item', onClick: openAddModal },
    { id: 'activity', label: 'Activity Log', onClick: handleViewActivity },
    { id: 'reports', label: 'System Reports', onClick: handleViewReports },
  ];

  const currentItems = slips.slice(0, PREVIEW_LIMIT);
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
      {/* Header */}
      <div className="db-header-card">
        <div className="db-header-text">
          <h1 className="db-title">Dashboard</h1>
          <p className="db-subtitle">
            Good day, <span className="db-name">{greetingName || 'there'}</span>! Here is your daily
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

      {/* Stats Cards */}
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

      {/* Requisitions Table (same table as the Requests page) */}
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

      {/* Inventory Overview Table */}
      <div className="db-section-card">
        <div className="db-card-header">
          <div>
            <h3 className="db-card-title">Inventory Overview</h3>
            <p className="db-card-desc">
              Current stock levels, with out-of-stock and low-stock items shown first.
            </p>
          </div>
        </div>

        <div className="db-table-wrapper">
          <table className="db-table db-inv-table db-inv-wide">
            <thead>
              <tr>
                <th className="col-inv-item">Item</th>
                <th className="col-inv-category">Category</th>
                <th className="col-inv-stock">Stock Level</th>
                <th className="col-inv-updated">Last Updated</th>
                <th className="col-inv-status">Status</th>
              </tr>
            </thead>
            <tbody>
              {invLoading ? (
                <tr>
                  <td colSpan="5" className="db-empty-cell">
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
                  <td colSpan="5" className="db-empty-cell">
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
                      <td>
                        <div className="db-nowrap-cell">{fmtDate(item.updated)}</div>
                        <div className="db-sub db-cell-clamp" title={item.updatedBy}>
                          by {shortName(item.updatedBy)}
                        </div>
                      </td>
                      <td className="db-nowrap-cell">
                        <span className={`db-badge ${statusClass(status)}`}>{status}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="db-empty-cell">
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

      {/* Toast Notification */}
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

      {/* Details & Review Modal */}
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

            {actionError && !decision && (
              <div className="rq-deny-box rq-error-top" role="alert">
                <strong>Could not save</strong>
                <p>{actionError}</p>
              </div>
            )}

            <div className="rq-modal-body">
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

      {/* Approve / Release / Deny confirmation (shared DecisionModal) */}
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
        </DecisionModal>
      )}

      {/* Issuance Slip Preview Modal */}
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

      {/* Receive Purchased Stock Modal */}
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

            {recvError && (
              <div className="rq-deny-box rq-error-top" role="alert">
                <strong>Could not save</strong>
                <p>{recvError}</p>
              </div>
            )}

            <div className="rq-modal-body">
              <p className="rq-confirm-text">
                <strong>{receive.line.name}</strong> · {receive.reqId}
              </p>
              <p className="rq-muted-text">
                {receive.line.inv
                  ? `${fmtQty(receive.line.inv.quantity)} ${receive.line.inv.unit} in the inventory, ${fmtQty(receive.line.qty)} needed.`
                  : "This item isn't in the inventory yet. Record what was bought so it can be handed out."}
              </p>

              <div className="rq-field">
                <label htmlFor="db-recv-qty">Quantity received</label>
                <NumberInput
                  id="db-recv-qty"
                  value={recvQty}
                  onChange={(v) => {
                    setRecvQty(v);
                    setRecvError('');
                  }}
                  placeholder="e.g. 50"
                  autoFocus
                />
              </div>

              <div className="rq-field">
                <label htmlFor="db-recv-ref">Delivery or PO reference (optional)</label>
                <input
                  id="db-recv-ref"
                  type="text"
                  autoComplete="off"
                  className="form-control custom-input"
                  value={recvRef}
                  maxLength={LIMITS.reference}
                  onChange={(e) => {
                    flagBlocked('recvRef', e.target.value, 'reference');
                    setRecvRef(
                      cleanTyping(e.target.value, STRIP.reference, LIMITS.reference).toUpperCase()
                    );
                    setRecvError('');
                  }}
                  placeholder="e.g. DR-2026-114"
                />
                {blocked.recvRef && <span className="inv-field-error">{blocked.recvRef}</span>}
                <span className="rq-hint">
                  From the supplier's receipt. Leave empty to use the slip number.
                </span>
              </div>

              {!receive.line.inv && (
                <>
                  <div className="rq-field">
                    <label htmlFor="db-recv-cat">Category</label>
                    <FormSelect
                      id="db-recv-cat"
                      value={recvCategory}
                      options={categoryOptions}
                      placeholder="Select a category"
                      onChange={(value) => {
                        setRecvCategory(value);
                        setRecvError('');
                      }}
                    />
                    {recvCategory === NEW_CATEGORY && (
                      <input
                        type="text"
                        autoComplete="off"
                        className="form-control custom-input inv-new-category"
                        placeholder="e.g. Electrical Supplies"
                        value={recvCustomCategory}
                        maxLength={LIMITS.category}
                        onChange={(e) => {
                          flagBlocked('recvNewCategory', e.target.value, 'category');
                          setRecvCustomCategory(
                            cleanTyping(e.target.value, STRIP.category, LIMITS.category)
                          );
                          setRecvError('');
                        }}
                        aria-label="New category name"
                        autoFocus
                      />
                    )}
                    {recvCategory === NEW_CATEGORY && blocked.recvNewCategory && (
                      <span className="inv-field-error">{blocked.recvNewCategory}</span>
                    )}
                  </div>

                  <div className="rq-field">
                    <label htmlFor="db-recv-unit">Unit</label>
                    <FormSelect
                      id="db-recv-unit"
                      value={recvUnit}
                      options={unitOptions}
                      placeholder="Select a unit"
                      onChange={(value) => {
                        setRecvUnit(value);
                        setRecvError('');
                      }}
                    />
                    {recvUnit === NEW_UNIT && (
                      <input
                        type="text"
                        autoComplete="off"
                        className="form-control custom-input inv-new-category"
                        placeholder="e.g. tube"
                        value={recvCustomUnit}
                        maxLength={LIMITS.unit}
                        onChange={(e) => {
                          flagBlocked('recvNewUnit', e.target.value, 'unit');
                          setRecvCustomUnit(cleanTyping(e.target.value, STRIP.unit, LIMITS.unit));
                          setRecvError('');
                        }}
                        aria-label="New unit name"
                        autoFocus
                      />
                    )}
                    {recvUnit === NEW_UNIT && blocked.recvNewUnit && (
                      <span className="inv-field-error">{blocked.recvNewUnit}</span>
                    )}
                  </div>
                </>
              )}

              <p className="rq-audit-note">
                Recorded under <strong>{actorName}</strong> for slip{' '}
                <strong>{receive.reqId}</strong>.
              </p>
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

      {/* Inventory: add / edit modal */}
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

            {formError && (
              <div className="db-error-box db-error-top" role="alert">
                <strong>Could not save</strong>
                <p>{formError}</p>
              </div>
            )}

            <div className="db-modal-body">
              <div className="db-field">
                <label htmlFor="db-name">Item name</label>
                <input
                  id="db-name"
                  type="text"
                  autoComplete="off"
                  className={inputClass('name')}
                  value={form.name}
                  maxLength={LIMITS.name}
                  onChange={(e) => handleText('name', e.target.value, 'name', LIMITS.name)}
                  placeholder="e.g. A4 bond paper"
                />
                {fieldMsg('name')}
              </div>

              <div className="db-field">
                <label htmlFor="db-supplier">Supplier name (optional)</label>
                <input
                  id="db-supplier"
                  type="text"
                  autoComplete="off"
                  className={inputClass('supplier')}
                  value={form.supplier}
                  maxLength={LIMITS.supplier}
                  onChange={(e) =>
                    handleText('supplier', e.target.value, 'name', LIMITS.supplier)
                  }
                  placeholder="e.g. Cagayan Office Depot"
                />
                {fieldMsg('supplier')}
              </div>

              <div className="db-field-row">
                <div className="db-field">
                  <label htmlFor="db-category">Category</label>
                  <FormSelect
                    id="db-category"
                    triggerClass="db-input"
                    value={form.category}
                    options={categoryOptions}
                    placeholder="Select a category"
                    invalid={!!errFor('category')}
                    onChange={(value) => handleFormChange('category', value)}
                  />

                  {isNewCategory && (
                    <input
                      type="text"
                      autoComplete="off"
                      className={`${inputClass('newCategory')} db-new-category`}
                      placeholder="e.g. Electrical Supplies"
                      value={customCategory}
                      maxLength={LIMITS.category}
                      onChange={(e) => {
                        flagBlocked('newCategory', e.target.value, 'category');
                        setCustomCategory(
                          cleanTyping(e.target.value, STRIP.category, LIMITS.category)
                        );
                        setFormError('');
                      }}
                      aria-label="New category name"
                      autoFocus
                    />
                  )}

                  {fieldMsg('category')}
                  {isNewCategory && fieldMsg('newCategory')}
                </div>

                <div className="db-field">
                  <label htmlFor="db-unit">Unit</label>
                  <FormSelect
                    id="db-unit"
                    triggerClass="db-input"
                    value={form.unit}
                    options={unitOptions}
                    placeholder="Select a unit"
                    invalid={!!errFor('unit')}
                    onChange={(value) => handleFormChange('unit', value)}
                  />

                  {isNewUnit && (
                    <input
                      type="text"
                      autoComplete="off"
                      className={`${inputClass('newUnit')} db-new-category`}
                      placeholder="e.g. tube"
                      value={customUnit}
                      maxLength={LIMITS.unit}
                      onChange={(e) => {
                        flagBlocked('newUnit', e.target.value, 'unit');
                        setCustomUnit(cleanTyping(e.target.value, STRIP.unit, LIMITS.unit));
                        setFormError('');
                      }}
                      aria-label="New unit name"
                      autoFocus
                    />
                  )}

                  {fieldMsg('unit')}
                  {isNewUnit && fieldMsg('newUnit')}
                </div>
              </div>

              <div className="db-field-row">
                <div className="db-field">
                  <label htmlFor="db-qty">Quantity on hand</label>
                  <NumberInput
                    id="db-qty"
                    baseClass="db-input"
                    value={form.quantity}
                    invalid={!!errFor('quantity')}
                    onChange={(v) => handleFormChange('quantity', v)}
                    placeholder="e.g. 50"
                  />
                  {fieldMsg('quantity')}
                </div>
                <div className="db-field">
                  <label htmlFor="db-reorder">Reorder level</label>
                  <NumberInput
                    id="db-reorder"
                    baseClass="db-input"
                    value={form.reorderLevel}
                    invalid={!!errFor('reorderLevel')}
                    onChange={(v) => handleFormChange('reorderLevel', v)}
                    placeholder="e.g. 10"
                  />
                  {fieldMsg('reorderLevel')}
                </div>
              </div>

              <div className="db-field">
                <label htmlFor="db-max">Normal limit per request</label>
                <NumberInput
                  id="db-max"
                  baseClass="db-input"
                  value={form.maxNormal}
                  invalid={!!errFor('maxNormal')}
                  onChange={(v) => handleFormChange('maxNormal', v)}
                  placeholder="e.g. 10"
                />
                {fieldMsg('maxNormal')}
              </div>

              <p className="db-audit-note">
                {editingId ? 'This edit will be recorded' : 'This item will be recorded as added'}{' '}
                by <strong>{actorName}</strong>.
              </p>
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
                disabled={saving}
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

            {adjustError && (
              <div className="inv-error-box inv-error-top" role="alert">
                <strong>Could not save</strong>
                <p>{adjustError}</p>
              </div>
            )}

            <div className="inv-modal-body">
              <p className="inv-adjust-item">
                <strong>{adjustTarget.name}</strong> · {fmtQty(adjustTarget.quantity)}{' '}
                {adjustTarget.unit} on hand
              </p>

              <div className="inv-segmented">
                <button
                  type="button"
                  className={adjustMode === 'add' ? 'active' : ''}
                  onClick={() => setAdjustMode('add')}
                >
                  <i className="bi bi-box-arrow-in-down"></i>
                  <span>Receive stock</span>
                </button>
                <button
                  type="button"
                  className={adjustMode === 'remove' ? 'active' : ''}
                  onClick={() => setAdjustMode('remove')}
                >
                  <i className="bi bi-box-arrow-up"></i>
                  <span>Withdraw stock</span>
                </button>
              </div>

              <div className="inv-field">
                <label htmlFor="db-adjust-amount">Quantity ({adjustTarget.unit})</label>
                <NumberInput
                  id="db-adjust-amount"
                  value={adjustAmount}
                  invalid={!!(overWithdraw || overMax)}
                  onChange={setAdjustAmount}
                  placeholder="0"
                  autoFocus
                />
                {overMax && (
                  <span className="inv-field-error">
                    Stock cannot go over {fmtQty(LIMITS.maxQty)}. You can receive at most{' '}
                    {fmtQty(Math.max(0, LIMITS.maxQty - adjustTarget.quantity))} more.
                  </span>
                )}
                {overWithdraw && (
                  <span className="inv-field-error">
                    Only {fmtQty(adjustTarget.quantity)} {adjustTarget.unit} on hand. Enter a
                    smaller quantity.
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
                  maxLength={LIMITS.reference}
                  autoComplete="off"
                  onChange={(e) => {
                    flagBlocked('reference', e.target.value, 'reference');
                    setAdjustReference(
                      cleanTyping(e.target.value, STRIP.reference, LIMITS.reference).toUpperCase()
                    );
                  }}
                  placeholder={adjustMode === 'add' ? 'e.g. DR-2026-114' : 'e.g. REQ-2026-075'}
                />
                {blocked.reference && <span className="inv-field-error">{blocked.reference}</span>}
              </div>

              <div className="inv-field">
                <label htmlFor="db-adjust-remark">Remark (optional)</label>
                <textarea
                  id="db-adjust-remark"
                  className="form-control custom-input inv-textarea"
                  rows="2"
                  value={adjustRemark}
                  maxLength={LIMITS.remark}
                  onChange={(e) => {
                    flagBlocked('remark', e.target.value, 'remark');
                    setAdjustRemark(cleanTyping(e.target.value, STRIP.remark, LIMITS.remark));
                  }}
                  placeholder="Anything worth noting about this change"
                />
                {blocked.remark && <span className="inv-field-error">{blocked.remark}</span>}
                {/* The counter only appears when the person is close to the limit */}
                {adjustRemark.length >= LIMITS.remark * 0.8 && (
                  <span className="inv-field-hint inv-counter">
                    {adjustRemark.length}/{LIMITS.remark} characters
                  </span>
                )}
              </div>

              <p className="inv-adjust-preview">
                New stock level:{' '}
                <strong>
                  {fmtQty(adjustPreview)} {adjustTarget.unit}
                </strong>{' '}
                · recorded by <strong>{actorName}</strong>
              </p>
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
                disabled={adjustQty === 0 || overWithdraw || overMax || adjusting}
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
                        {(m.type === 'Archived' || m.type === 'Restored') &&
                          `${m.after} ${historyItem.unit} on hand`}
                      </span>
                      <span className="inv-move-date">{fmtDateTime(m.date)}</span>
                    </div>
                    <div className="inv-move-meta">
                      by {m.by}
                      {(m.type === 'Received' || m.type === 'Withdrawn') &&
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
              {/* The details stay open behind the archive confirmation, so Cancel comes back here */}
              <button
                type="button"
                className="inv-btn-quiet"
                onClick={() => openArchiveModal(historyItem)}
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

      {/* Inventory: archive confirmation (sits on top of the details modal) */}
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

            {archiveError && (
              <div className="inv-error-box inv-error-top" role="alert">
                <strong>Could not archive</strong>
                <p>{archiveError}</p>
              </div>
            )}

            <div className="inv-modal-body">
              <p className="inv-confirm-text">
                <strong>{archiveTarget.name}</strong> · {archiveTarget.id}
              </p>

              {archiveBlocked ? (
                <div className="inv-warn-box">
                  <strong>This item can&apos;t be archived yet</strong>
                  <p>
                    It is on {archiveCheck.list.length} open request
                    {archiveCheck.list.length > 1 ? 's' : ''}. Archive it after{' '}
                    {archiveCheck.list.length > 1 ? 'they are' : 'it is'} completed, denied, or
                    cancelled.
                  </p>
                  <ul className="inv-blocker-list">
                    {archiveCheck.list.map((r) => (
                      <li key={r.slip}>
                        <span className="inv-blocker-slip">{r.slip}</span>
                        <span className={`inv-blocker-status ${String(r.status).toLowerCase()}`}>
                          {r.status}
                        </span>
                        {r.title && (
                          <span className="inv-blocker-title" title={r.title}>
                            {r.title}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="inv-note-box">
                  <strong>The item will be hidden, not deleted</strong>
                  <p>
                    It will no longer appear in requests or in the stock counts, but its details
                    and stock history are kept. You can restore it anytime from the Archived filter
                    on the Inventory page.
                    {archiveTarget.quantity > 0 &&
                      ` It still has ${archiveTarget.quantity} ${archiveTarget.unit} on hand.`}
                  </p>
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
                {archiveBlocked ? 'Close' : 'Cancel'}
              </button>
              <button
                type="button"
                className="inv-btn-primary"
                onClick={handleConfirmArchive}
                disabled={archiving || archiveBlocked || archiveCheck.loading}
              >
                {archiving
                  ? 'Archiving...'
                  : archiveCheck.loading
                    ? 'Checking requests...'
                    : 'Archive item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
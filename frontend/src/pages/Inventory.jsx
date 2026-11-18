import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import useInventory from '../hooks/useInventory';
import FilterDropdown from '../components/FilterDropdown';
import api, { errMsg } from '../api/client';
import '../styles/Inventory.css';

// Starting categories. Any category typed into the form is added automatically.
const DEFAULT_CATEGORIES = [
  'Paper Products',
  'Writing Supplies',
  'Office Supplies',
  'Lab Materials',
  'Cleaning Supplies',
];
const NEW_CATEGORY = '__new__';

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

// "tone" picks the colour of the dot in the shared FilterDropdown
const STATUS_OPTIONS = [
  { value: 'All', label: 'All statuses' },
  { value: 'In Stock', label: 'In Stock', tone: 'accepted' },
  { value: 'Low Stock', label: 'Low Stock', tone: 'pending' },
  { value: 'Out of Stock', label: 'Out of Stock', tone: 'denied' },
  { value: 'Archived', label: 'Archived', tone: 'cancelled' },
];

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
// Keep these in sync with the top of routes/inventory.js (the server has the final say).
const LIMITS = {
  name: 80,
  supplier: 120,
  category: 40,
  unit: 15,
  reference: 40,
  remark: 200,
  search: 60,
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
function NumberInput({ value, onChange, invalid, className = '', ...rest }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      className={`form-control custom-input${invalid ? ' inv-input-invalid' : ''} ${className}`}
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (/^\d*$/.test(v)) onChange(v.replace(/^0+(?=\d)/, '')); // also drops leading zeros
      }}
      {...rest}
    />
  );
}

// Dropdown for the add / edit form. Same look and chevron animation as FilterDropdown,
// but the list opens inside the form so the modal does not clip it.
function FormSelect({ id, value, options, placeholder, onChange, invalid }) {
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
        className={`form-control custom-input inv-dd-trigger${open ? ' open' : ''}${
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

const getStockStatus = (item) => {
  if (item.quantity <= 0) return 'Out of Stock';
  if (item.quantity <= item.reorderLevel) return 'Low Stock';
  return 'In Stock';
};

// Archived items show "Archived" instead of a stock status
const getItemStatus = (item) => (item.archived ? 'Archived' : getStockStatus(item));

const statusClass = (status) => status.toLowerCase().replace(/\s+/g, '-');

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-PH', {
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

export default function Inventory() {
  useEffect(() => {
    document.title = 'Inventory | BukSUPPLY';
  }, []);

  const { user } = useAuth();
  // Only used for the "recorded by" note. The server records the real user.
  const actorName =
    [user?.firstName, user?.lastName].filter((n) => n && n !== '-').join(' ') ||
    user?.email ||
    'Unknown user';

  // Real data from the API. This page needs archived items too, so it uses allItems.
  const {
    allItems: items,
    loading,
    error,
    create,
    update,
    adjust,
    archive,
    restore,
  } = useInventory();

  // Items that are not archived (used for the stat cards)
  const activeItems = useMemo(() => items.filter((i) => !i.archived), [items]);

  // Category list = defaults + every category currently used by an item
  const categories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    items.forEach((i) => i.category && set.add(i.category));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Unit list = defaults + every unit currently used by an item (same spelling counted once)
  const units = useMemo(() => {
    const seen = new Map();
    [...DEFAULT_UNITS, ...items.map((i) => i.unit)].forEach((u) => {
      const s = squash(u);
      if (s && !seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
    });
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const categoryFilterOptions = useMemo(
    () => [
      { value: 'All', label: 'All categories' },
      ...categories.map((c) => ({ value: c, label: c })),
    ],
    [categories]
  );

  // Filtering and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // If the selected category no longer exists, reset
  useEffect(() => {
    if (categoryFilter !== 'All' && !categories.includes(categoryFilter)) {
      setCategoryFilter('All');
    }
  }, [categories, categoryFilter]);

  // Toast notice
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Add / edit modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
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
  const historyItem = items.find((i) => i.id === historyId) || null;

  // Archive modal (available to both admin and moderator)
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  // Open requests (Pending / Processing / Approved) that still include the item being archived
  const [archiveCheck, setArchiveCheck] = useState({ loading: false, list: [] });
  const archiveTargetRef = useRef(null);

  // Restore modal (asks for confirmation first)
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [restoreError, setRestoreError] = useState('');

  const stats = useMemo(() => {
    const low = activeItems.filter((i) => getStockStatus(i) === 'Low Stock').length;
    const out = activeItems.filter((i) => getStockStatus(i) === 'Out of Stock').length;
    return { total: activeItems.length, inStock: activeItems.length - low - out, low, out };
  }, [activeItems]);

  const statCards = [
    { title: 'Total Items', count: stats.total, icon: 'bi-boxes' },
    { title: 'In Stock', count: stats.inStock, icon: 'bi-check-circle' },
    { title: 'Low Stock', count: stats.low, icon: 'bi-exclamation-triangle' },
    { title: 'Out of Stock', count: stats.out, icon: 'bi-x-octagon' },
  ];

  const filteredItems = items.filter((item) => {
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch =
      query === '' ||
      item.id.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      (item.supplier || '').toLowerCase().includes(query);

    // "All" shows active items only. Archived items live under the "Archived" filter.
    let matchesStatus;
    if (statusFilter === 'All') matchesStatus = !item.archived;
    else if (statusFilter === 'Archived') matchesStatus = !!item.archived;
    else matchesStatus = !item.archived && getStockStatus(item) === statusFilter;

    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Clear filters (same idea as the Activity Log page)
  const hasFilters = searchTerm.trim() !== '' || categoryFilter !== 'All' || statusFilter !== 'All';
  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('All');
    setStatusFilter('All');
    setCurrentPage(1);
  };

  // If the current page disappears (e.g. the last item on it was archived), step back
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filteredItems.length, currentPage]);

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirst, indexOfLast);

  // ---------- Disallowed-character messages ----------
  // Sets a message only while the last keystroke / paste contained a disallowed character.
  const flagBlocked = (field, raw, kind) => {
    const msg = String(raw ?? '').replace(STRIP[kind], '') !== String(raw ?? '') ? BLOCK_MSG[kind] : '';
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
    setForm(EMPTY_FORM);
    resetFormState();
    setFormModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
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
    return text ? <span className="inv-field-error">{text}</span> : null;
  };
  const inputClass = (field) =>
    `form-control custom-input${errFor(field) ? ' inv-input-invalid' : ''}`;

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
      if (editingId) await update(editingId, cleaned);
      else await create(cleaned);
      setFormModalOpen(false);
      setNotice({
        type: 'success',
        text: editingId
          ? `${cleaned.name} was updated.`
          : `${cleaned.name} was added to the inventory.`,
      });
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
      await adjust(adjustTarget.id, {
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

  // ---------- Archive (admin and moderator). Nothing is deleted from the database. ----------
  const archiveBlocked = archiveCheck.list.length > 0;
  archiveTargetRef.current = archiveTarget ? archiveTarget.id : null;

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

  const handleConfirmArchive = async () => {
    if (!archiveTarget || archiving || archiveBlocked || archiveCheck.loading) return;
    setArchiving(true);
    setArchiveError('');
    try {
      await archive(archiveTarget.id);
      setNotice({
        type: 'success',
        text: `${archiveTarget.name} (${archiveTarget.id}) was archived.`,
      });
      setArchiveTarget(null);
    } catch (err) {
      // The server found open requests we did not know about yet (for example a new one just came in)
      const blockers = err.response?.data?.openRequests;
      if (blockers?.length) setArchiveCheck({ loading: false, list: blockers });
      setArchiveError(errMsg(err));
    } finally {
      setArchiving(false);
    }
  };

  // ---------- Restore ----------
  const openRestoreModal = (item) => {
    setRestoreError('');
    setRestoreTarget(item);
  };

  const closeRestoreModal = () => {
    if (restoringId) return;
    setRestoreError('');
    setRestoreTarget(null);
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget || restoringId) return;
    setRestoringId(restoreTarget.id);
    setRestoreError('');
    try {
      await restore(restoreTarget.id);
      setNotice({
        type: 'success',
        text: `${restoreTarget.name} (${restoreTarget.id}) was restored to the inventory.`,
      });
      setRestoreTarget(null);
    } catch (err) {
      setRestoreError(errMsg(err));
    } finally {
      setRestoringId(null);
    }
  };

  // Latest movement that has a reference number (delivery / PO / requisition slip)
  const lastRefMove = historyItem
    ? [...(historyItem.movements || [])].reverse().find((m) => m.reference)
    : null;

  // One helper for the loading / error / empty rows
  const messageRow = (icon, title, text) => (
    <tr>
      <td colSpan="6" className="inv-empty-cell">
        <div className="inv-empty-content">
          <div className="inv-empty-icon">
            <i className={`bi ${icon}`}></i>
          </div>
          <h4>{title}</h4>
          <p>{text}</p>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="inventory-container">
      {/* Header card with divider and stats */}
      <div className="inv-header-card">
        <div className="inv-header-top">
          <div className="inv-header-text">
            <h1 className="inv-title">Inventory</h1>
            <p className="inv-subtitle">
              Track supply stock levels, record deliveries and withdrawals, and see who changed
              what.
            </p>
          </div>
          <button className="inv-btn-add" onClick={openAddModal}>
            <i className="bi bi-plus-lg"></i> Add Item
          </button>
        </div>

        <div className="inv-header-divider"></div>

        <div className="inv-stats-grid">
          {statCards.map((stat) => (
            <div key={stat.title} className="inv-stat-card">
              <div className="inv-stat-info">
                <span className="inv-stat-title">{stat.title}</span>
                <h2 className="inv-stat-count">{loading ? '–' : stat.count}</h2>
              </div>
              <div className="inv-stat-icon-circle">
                <i className={`bi ${stat.icon}`}></i>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating bottom-right toast */}
      {notice && (
        <div className={`inv-notice-toast ${notice.type}`} role="status">
          <span>{notice.text}</span>
          <button className="inv-notice-close" onClick={() => setNotice(null)} aria-label="Dismiss">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="inv-filter-bar">
        <div className="inv-search-wrapper">
          <i className="bi bi-search"></i>
          <input
            type="text"
            className="form-control custom-input"
            placeholder="Search by item ID, name, or supplier..."
            maxLength={LIMITS.search}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="inv-filter-group">
          <FilterDropdown
            icon="bi-tag"
            ariaLabel="Filter by category"
            options={categoryFilterOptions}
            value={categoryFilter}
            onChange={(value) => {
              setCategoryFilter(value);
              setCurrentPage(1);
            }}
          />

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

      {/* Table */}
      <div className="inv-section-card">
        <div className="inv-table-wrapper">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="inv-col-item">Item</th>
                <th className="inv-col-category">Category</th>
                <th className="inv-col-stock">Stock Level</th>
                <th className="inv-col-updated">Last Updated</th>
                <th className="inv-col-status">Status</th>
                <th className="inv-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? messageRow('bi-hourglass-split', 'Loading...', 'Fetching inventory items.')
                : error
                  ? messageRow('bi-exclamation-circle', 'Could not load inventory', error)
                  : currentItems.length > 0
                    ? currentItems.map((item) => {
                        const status = getItemStatus(item);
                        const fill =
                          item.reorderLevel > 0
                            ? Math.min(
                                100,
                                Math.round((item.quantity / (item.reorderLevel * 2)) * 100)
                              )
                            : item.quantity > 0
                              ? 100
                              : 0;

                        return (
                          <tr
                            key={item.id}
                            className={`inv-row-clickable ${item.archived ? 'inv-row-archived' : ''}`}
                            onClick={() => setHistoryId(item.id)}
                          >
                            <td className="inv-cell-item">
                              <div className="inv-item-name inv-clamp" title={item.name}>
                                {item.name}
                              </div>
                              <div className="inv-item-id">{item.id}</div>
                            </td>
                            <td>
                              <div className="inv-clamp" title={item.category}>
                                {item.category}
                              </div>
                            </td>
                            <td className="inv-cell-stock">
                              <div className={`inv-stock-text ${statusClass(status)}`}>
                                <strong>{item.quantity}</strong> {item.unit}
                              </div>
                              <div className={`inv-stock-bar ${statusClass(status)}`} aria-hidden="true">
                                <div
                                  className={`inv-stock-fill ${statusClass(status)}`}
                                  style={{ width: `${fill}%` }}
                                ></div>
                              </div>
                              <div className="inv-reorder-text">
                                Reorder at {item.reorderLevel} · Usual limit {item.maxNormal} per
                                request
                              </div>
                            </td>
                            <td>
                              <div className="inv-nowrap">{fmtDate(item.updated)}</div>
                              <div className="inv-updated-by inv-clamp" title={item.updatedBy}>
                                by {item.updatedBy}
                              </div>
                            </td>
                            <td>
                              <span className={`inv-badge ${statusClass(status)}`}>{status}</span>
                            </td>
                            <td className="inv-cell-actions" onClick={(e) => e.stopPropagation()}>
                              <div className="inv-action-buttons">
                                {item.archived ? (
                                  <button
                                    className="inv-btn-action inv-btn-restore"
                                    onClick={() => openRestoreModal(item)}
                                    disabled={restoringId === item.id}
                                  >
                                    <i className="bi bi-arrow-counterclockwise"></i>
                                    Restore
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      className="inv-btn-action inv-btn-icon inv-btn-adjust"
                                      onClick={() => openAdjustModal(item)}
                                      title="Adjust stock"
                                      aria-label="Adjust stock"
                                    >
                                      <i className="bi bi-arrow-down-up"></i>
                                    </button>
                                    <button
                                      className="inv-btn-action inv-btn-icon inv-btn-neutral"
                                      onClick={() => openEditModal(item)}
                                      title="Edit item"
                                      aria-label="Edit item"
                                    >
                                      <i className="bi bi-pencil-square"></i>
                                    </button>
                                    <button
                                      className="inv-btn-action inv-btn-icon inv-btn-archive"
                                      onClick={() => openArchiveModal(item)}
                                      title="Archive item"
                                      aria-label="Archive item"
                                    >
                                      <i className="bi bi-archive"></i>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    : messageRow(
                        statusFilter === 'Archived' ? 'bi-archive' : 'bi-box-seam',
                        statusFilter === 'Archived' ? 'No Archived Items' : 'No Items Found',
                        statusFilter === 'Archived'
                          ? 'Items you archive will show up here, and you can restore them anytime.'
                          : activeItems.length === 0 && items.length === 0
                            ? 'The inventory is empty. Click Add Item to create the first one.'
                            : 'No inventory items match your search, category, or status filter.'
                      )}
            </tbody>
          </table>
        </div>

        <div className="inv-footer-bar">
          <div className="inv-footer-info">
            <span>
              Showing {currentItems.length} of {filteredItems.length} items
            </span>
            {hasFilters && (
              <button type="button" className="inv-clear-btn" onClick={resetFilters}>
                Clear filters
              </button>
            )}
          </div>
          <div className="inv-pagination">
            <button
              className="inv-btn-action inv-btn-neutral"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="inv-page-indicator">Page {currentPage}</span>
            <button
              className="inv-btn-action inv-btn-neutral"
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={indexOfLast >= filteredItems.length}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {formModalOpen && (
        <div className="inv-modal-backdrop" onClick={() => setFormModalOpen(false)}>
          <div
            className="inv-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-header">
              <h3>{editingId ? 'Edit item' : 'Add item'}</h3>
              <button
                className="inv-modal-close"
                onClick={() => setFormModalOpen(false)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="inv-modal-body">
              <div className="inv-field">
                <label htmlFor="inv-name">Item name</label>
                <input
                  id="inv-name"
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

              <div className="inv-field">
                <label htmlFor="inv-supplier">Supplier name (optional)</label>
                <input
                  id="inv-supplier"
                  type="text"
                  autoComplete="off"
                  className={inputClass('supplier')}
                  value={form.supplier}
                  onChange={(e) =>
                    handleText('supplier', e.target.value, 'name', LIMITS.supplier)
                  }
                  placeholder="e.g. Cagayan Office Depot"
                  maxLength={LIMITS.supplier}
                />
                {fieldMsg('supplier')}
              </div>

              <div className="inv-field-row">
                <div className="inv-field">
                  <label htmlFor="inv-category">Category</label>
                  <FormSelect
                    id="inv-category"
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
                      className={`${inputClass('newCategory')} inv-new-category`}
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

                <div className="inv-field">
                  <label htmlFor="inv-unit">Unit</label>
                  <FormSelect
                    id="inv-unit"
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
                      className={`${inputClass('newUnit')} inv-new-category`}
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

              <div className="inv-field-row">
                <div className="inv-field">
                  <label htmlFor="inv-qty">Quantity on hand</label>
                  <NumberInput
                    id="inv-qty"
                    value={form.quantity}
                    invalid={!!errFor('quantity')}
                    onChange={(v) => handleFormChange('quantity', v)}
                    placeholder="e.g. 50"
                  />
                  {fieldMsg('quantity')}
                </div>
                <div className="inv-field">
                  <label htmlFor="inv-reorder">Reorder level</label>
                  <NumberInput
                    id="inv-reorder"
                    value={form.reorderLevel}
                    invalid={!!errFor('reorderLevel')}
                    onChange={(v) => handleFormChange('reorderLevel', v)}
                    placeholder="e.g. 10"
                  />
                  {fieldMsg('reorderLevel')}
                </div>
              </div>

              <div className="inv-field">
                <label htmlFor="inv-max">Normal limit per request</label>
                <NumberInput
                  id="inv-max"
                  value={form.maxNormal}
                  invalid={!!errFor('maxNormal')}
                  onChange={(v) => handleFormChange('maxNormal', v)}
                  placeholder="e.g. 10"
                />
                {fieldMsg('maxNormal')}
              </div>

              <p className="inv-audit-note">
                {editingId ? 'This edit will be recorded' : 'This item will be recorded as added'}{' '}
                by <strong>{actorName}</strong>.
              </p>

              {formError && (
                <div className="inv-error-box">
                  <strong>Could not save</strong>
                  <p>{formError}</p>
                </div>
              )}
            </div>

            <div className="inv-modal-footer">
              <button className="inv-btn-secondary" onClick={() => setFormModalOpen(false)}>
                Cancel
              </button>
              <button
                className="inv-btn-primary"
                onClick={handleSaveItem}
                disabled={saving}
              >
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
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
                className="inv-modal-close"
                onClick={() => setAdjustTarget(null)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="inv-modal-body">
              <p className="inv-adjust-item">
                <strong>{adjustTarget.name}</strong> · {fmtQty(adjustTarget.quantity)} {adjustTarget.unit}{' '}
                on hand
              </p>

              <div className="inv-segmented">
                <button
                  className={adjustMode === 'add' ? 'active' : ''}
                  onClick={() => setAdjustMode('add')}
                >
                  <i className="bi bi-box-arrow-in-down"></i>
                  <span>Receive stock</span>
                </button>
                <button
                  className={adjustMode === 'remove' ? 'active' : ''}
                  onClick={() => setAdjustMode('remove')}
                >
                  <i className="bi bi-box-arrow-up"></i>
                  <span>Withdraw stock</span>
                </button>
              </div>

              <div className="inv-field">
                <label htmlFor="inv-adjust-amount">Quantity ({adjustTarget.unit})</label>
                <NumberInput
                  id="inv-adjust-amount"
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
                    Only {fmtQty(adjustTarget.quantity)} {adjustTarget.unit} on hand. Enter a smaller
                    quantity.
                  </span>
                )}
              </div>

              <div className="inv-field">
                <label htmlFor="inv-adjust-ref">
                  {adjustMode === 'add' ? 'Delivery or PO reference' : 'Requisition slip'}{' '}
                  (optional)
                </label>
                <input
                  id="inv-adjust-ref"
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
                <label htmlFor="inv-adjust-remark">Remark (optional)</label>
                <textarea
                  id="inv-adjust-remark"
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

              {adjustError && (
                <div className="inv-error-box">
                  <strong>Could not save</strong>
                  <p>{adjustError}</p>
                </div>
              )}
            </div>

            <div className="inv-modal-footer">
              <button className="inv-btn-secondary" onClick={() => setAdjustTarget(null)}>
                Cancel
              </button>
              <button
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

      {/* Item Details & Movement History Modal */}
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
                {historyItem.archived && (
                  <span className="inv-badge archived inv-header-badge">Archived</span>
                )}
              </div>
              <button
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
                      <span className="inv-meta-value">{historyItem.quantity} {historyItem.unit}</span>
                    </div>
                    <div>
                      <span className="inv-meta-label">Reorder level</span>
                      <span className="inv-meta-value">{historyItem.reorderLevel} {historyItem.unit}</span>
                    </div>
                    <div>
                      <span className="inv-meta-label">Usual limit per request</span>
                      <span className="inv-meta-value">{historyItem.maxNormal} {historyItem.unit}</span>
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
                      <span className="inv-meta-value">{lastRefMove ? lastRefMove.reference : '—'}</span>
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
                    {historyItem.archived && (
                      <div>
                        <span className="inv-meta-label">Archived by</span>
                        <span className="inv-meta-value">{historyItem.archivedBy || '—'}</span>
                        <span className="inv-meta-sub">{fmtDateTime(historyItem.archivedAt)}</span>
                      </div>
                    )}
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
              <button className="inv-btn-secondary" onClick={() => setHistoryId(null)}>
                Close
              </button>
              {historyItem.archived ? (
                <button
                  className="inv-btn-primary"
                  onClick={() => {
                    setHistoryId(null);
                    openRestoreModal(historyItem);
                  }}
                >
                  Restore item
                </button>
              ) : (
                <button
                  className="inv-btn-quiet"
                  onClick={() => {
                    setHistoryId(null);
                    openArchiveModal(historyItem);
                  }}
                >
                  <i className="bi bi-archive"></i>
                  Archive
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal (admin and moderator).
          Same width as the others, but its height fits the content. */}
      {archiveTarget && (
        <div className="inv-modal-backdrop inv-modal-backdrop-top" onClick={closeArchiveModal}>
          <div
            className="inv-modal inv-modal-auto"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="inv-archive-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-header">
              <h3 id="inv-archive-title">Archive inventory item?</h3>
              <button
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
                  It will no longer appear in requests or in the stock counts, but its details and
                  stock history are kept. You can restore it anytime from the Archived filter.
                  {archiveTarget.quantity > 0 &&
                    ` It still has ${archiveTarget.quantity} ${archiveTarget.unit} on hand.`}
                </p>
              </div>
              )}

              {archiveError && (
                <div className="inv-error-box">
                  <strong>Could not archive</strong>
                  <p>{archiveError}</p>
                </div>
              )}
            </div>

            <div className="inv-modal-footer">
              <button className="inv-btn-secondary" onClick={closeArchiveModal} disabled={archiving}>
                {archiveBlocked ? 'Close' : 'Cancel'}
              </button>
              <button
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

      {/* Restore Confirmation Modal */}
      {restoreTarget && (
        <div className="inv-modal-backdrop inv-modal-backdrop-top" onClick={closeRestoreModal}>
          <div
            className="inv-modal inv-modal-auto"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="inv-restore-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-header">
              <h3 id="inv-restore-title">Restore inventory item?</h3>
              <button
                className="inv-modal-close"
                onClick={closeRestoreModal}
                aria-label="Close"
                disabled={!!restoringId}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="inv-modal-body">
              <p className="inv-confirm-text">
                <strong>{restoreTarget.name}</strong> · {restoreTarget.id}
              </p>

              <div className="inv-note-box">
                <strong>The item will go back to the active inventory</strong>
                <p>
                  It will appear again in requests and in the stock counts, with its details and
                  stock history unchanged.
                  {restoreTarget.quantity > 0 &&
                    ` It has ${restoreTarget.quantity} ${restoreTarget.unit} on hand.`}
                </p>
              </div>

              {restoreError && (
                <div className="inv-error-box">
                  <strong>Could not restore</strong>
                  <p>{restoreError}</p>
                </div>
              )}
            </div>

            <div className="inv-modal-footer">
              <button
                className="inv-btn-secondary"
                onClick={closeRestoreModal}
                disabled={!!restoringId}
              >
                Cancel
              </button>
              <button
                className="inv-btn-primary"
                onClick={handleConfirmRestore}
                disabled={!!restoringId}
              >
                {restoringId ? 'Restoring...' : 'Restore item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
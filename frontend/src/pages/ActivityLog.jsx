import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import FilterDropdown from '../components/FilterDropdown';
import '../styles/ActivityLog.css';

const STAFF_ROLES = ['Moderator', 'Administrator'];
const PAGE_SIZE = 10;

// Responsive breakpoint widths (px) to switch table to stacked rows
const STACK_BELOW = 840;
const STACK_BELOW_WITH_USER = 1000;

// Action badge labels and tone styling
const ACTION_META = {
  SIGN_IN: { label: 'Signed in', tone: 'info' },
  SIGN_OUT: { label: 'Signed out', tone: 'neutral' },
  SIGN_UP: { label: 'Account created', tone: 'success' },
  PROFILE_UPDATED: { label: 'Profile updated', tone: 'info' },
  ACCOUNT_DEACTIVATED: { label: 'Account deactivated', tone: 'danger' },
  REQUISITION_FILED: { label: 'Slip filed', tone: 'success' },
  REQUISITION_EDITED: { label: 'Slip edited', tone: 'info' },
  REQUISITION_CANCELLED: { label: 'Slip cancelled', tone: 'danger' },
  REQUISITION_STATUS: { label: 'Status changed', tone: 'info' },
};
const FALLBACK_META = { label: 'Activity', tone: 'neutral' };

const USER_CATEGORIES = [
  { value: 'All', label: 'All activities' },
  { value: 'Account', label: 'Account' },
  { value: 'Requisition', label: 'Requisitions' },
];

const STAFF_CATEGORIES = [
  ...USER_CATEGORIES,
  { value: 'Inventory', label: 'Inventory' },
  { value: 'Report', label: 'Reports' },
  { value: 'User Management', label: 'User management' },
];

// Calendar date format helpers (YYYY-MM-DD)
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (n) => String(n).padStart(2, '0');
const toISO = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
const todayISO = () => {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth(), now.getDate());
};
const formatDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Format user display name (First and Last name)
const shortName = (fullName) => {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '-';
  if (parts.length <= 2) return parts.join(' ');
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

export default function ActivityLog() {
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role);

  useEffect(() => {
    document.title = 'Activity Log | BukSUPPLY';
  }, []);

  // Staff can switch between everyone's activity and their own
  const [scope, setScope] = useState(isStaff ? 'all' : 'mine');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  // Calendar popup: which field is open and which month it is showing
  const [openPicker, setOpenPicker] = useState(null); // 'from' | 'to' | null
  const [view, setView] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const datesRef = useRef(null);

  // The row whose full details are shown in the modal
  const [selectedLog, setSelectedLog] = useState(null);

  // Width of the table card, used to decide between the table and stacked layouts
  const cardRef = useRef(null);
  const [cardWidth, setCardWidth] = useState(0);

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const showUserColumn = isStaff && scope === 'all';
  const stacked = cardWidth > 0 && cardWidth < (showUserColumn ? STACK_BELOW_WITH_USER : STACK_BELOW);

  // Keep track of the table card's width (changes with the window and the sidebar)
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return undefined;

    setCardWidth(el.clientWidth);

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => setCardWidth(el.clientWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    const observer = new ResizeObserver(() => setCardWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Wait a moment after typing so we don't call the server on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Close the calendar when clicking outside of it or pressing Escape
  useEffect(() => {
    if (!openPicker) return undefined;

    const handleMouseDown = (e) => {
      if (datesRef.current && !datesRef.current.contains(e.target)) setOpenPicker(null);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenPicker(null);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPicker]);

  // Details modal: close on Escape and stop the page behind it from scrolling
  useEffect(() => {
    if (!selectedLog) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedLog(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedLog]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    const params = { scope, page, limit: PAGE_SIZE };
    if (category !== 'All') params.category = category;
    if (debouncedSearch) params.search = debouncedSearch;
    if (from) params.from = from;
    if (to) params.to = to;

    api
      .get('/activity', { params })
      .then((res) => {
        if (!active) return;
        setLogs(res.data.logs);
        setTotal(res.data.total);
      })
      .catch((err) => active && setError(errMsg(err)))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [scope, category, debouncedSearch, from, to, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const colCount = showUserColumn ? 5 : 4;
  const selectedMeta = selectedLog ? ACTION_META[selectedLog.action] || FALLBACK_META : null;

  const messageRow = (icon, title, text) => (
    <tr className="al-message-row">
      <td colSpan={colCount} className="al-empty-cell">
        <div className="al-empty">
          <div className="al-empty-icon">
            <i className={`bi ${icon}`}></i>
          </div>
          <h4>{title}</h4>
          <p>{text}</p>
        </div>
      </td>
    </tr>
  );

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setCategory('All');
    setFrom('');
    setTo('');
    setOpenPicker(null);
    setPage(1);
  };
  const hasFilters = search || category !== 'All' || from || to;

  // Open the details modal (skipped when the user is just selecting text in the row)
  const openDetails = (log) => {
    const selection = window.getSelection ? window.getSelection().toString() : '';
    if (selection) return;
    setSelectedLog(log);
  };

  // Calendar actions
  const togglePicker = (which) => {
    if (openPicker === which) {
      setOpenPicker(null);
      return;
    }
    const current = which === 'from' ? from : to;
    if (current) {
      const [y, m] = current.split('-').map(Number);
      setView({ year: y, month: m - 1 });
    } else {
      const now = new Date();
      setView({ year: now.getFullYear(), month: now.getMonth() });
    }
    setOpenPicker(which);
  };

  const shiftMonth = (delta) => {
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const pickDate = (which, value) => {
    if (which === 'from') setFrom(value);
    else setTo(value);
    setOpenPicker(null);
    setPage(1);
  };

  // One date field with its calendar popup
  const renderDateField = (which, label) => {
    const value = which === 'from' ? from : to;
    const minDate = which === 'to' ? from : '';
    const maxDate = which === 'from' ? to : '';
    const isOpen = openPicker === which;
    const today = todayISO();
    const isDisabled = (iso) => Boolean((minDate && iso < minDate) || (maxDate && iso > maxDate));

    const firstDay = new Date(view.year, view.month, 1).getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const cells = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    return (
      <div className={`al-date-field ${which === 'to' ? 'align-right' : ''}`}>
        <span className="al-date-label" id={`al-${which}-label`}>
          {label}
        </span>
        <button
          type="button"
          className={`al-date-btn ${isOpen ? 'open' : ''} ${value ? '' : 'placeholder'}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-labelledby={`al-${which}-label`}
          onClick={() => togglePicker(which)}
        >
          <span>{value ? formatDate(value) : 'Select date'}</span>
          <i className="bi bi-calendar3"></i>
        </button>

        {isOpen && (
          <div className="al-calendar" role="dialog" aria-label={`Choose ${label.toLowerCase()} date`}>
            <div className="al-cal-head">
              <button
                type="button"
                className="al-cal-nav"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
              >
                <i className="bi bi-chevron-left"></i>
              </button>
              <span className="al-cal-title">
                {MONTHS[view.month]} {view.year}
              </span>
              <button
                type="button"
                className="al-cal-nav"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
              >
                <i className="bi bi-chevron-right"></i>
              </button>
            </div>

            <div className="al-cal-grid al-cal-weekdays">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="al-cal-grid">
              {cells.map((day, i) => {
                if (!day) return <span key={`blank-${i}`} />;
                const iso = toISO(view.year, view.month, day);
                const classes = ['al-cal-day'];
                if (iso === today) classes.push('today');
                if (iso === from || iso === to) classes.push('selected');
                else if (from && to && iso > from && iso < to) classes.push('in-range');
                return (
                  <button
                    key={iso}
                    type="button"
                    className={classes.join(' ')}
                    disabled={isDisabled(iso)}
                    onClick={() => pickDate(which, iso)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="al-cal-foot">
              <button type="button" className="al-cal-link" onClick={() => pickDate(which, '')}>
                Clear
              </button>
              <button
                type="button"
                className="al-cal-link"
                disabled={isDisabled(today)}
                onClick={() => pickDate(which, today)}
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="al-container">
      {/* Header */}
      <div className="al-header-card">
        <div className="al-header-text">
          <h1 className="al-title">Activity Log</h1>
          <p className="al-subtitle">
            {isStaff
              ? 'A record of what users have done in BukSUPPLY, such as signing in, filing and updating requisition slips, and changing request statuses.'
              : 'A record of your own actions in BukSUPPLY, such as signing in, updating your profile, and filing, editing, or cancelling requisition slips. Only you can see this.'}
          </p>
        </div>

        {isStaff && (
          <div className="al-scope-tabs" role="tablist" aria-label="Activity scope">
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'all'}
              className={`al-scope-btn ${scope === 'all' ? 'active' : ''}`}
              onClick={() => {
                setScope('all');
                setPage(1);
              }}
            >
              All Users
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'mine'}
              className={`al-scope-btn ${scope === 'mine' ? 'active' : ''}`}
              onClick={() => {
                setScope('mine');
                setPage(1);
              }}
            >
              My Activity
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="al-filter-bar">
        <div className="al-search">
          <i className="bi bi-search"></i>
          <input
            type="text"
            className="al-input"
            placeholder={
              showUserColumn ? 'Search by user, activity, or slip number...' : 'Search activity or slip number...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="al-dates" ref={datesRef}>
          {renderDateField('from', 'From')}
          {renderDateField('to', 'To')}
        </div>

        <FilterDropdown
          icon="bi-funnel"
          ariaLabel="Filter by category"
          options={isStaff ? STAFF_CATEGORIES : USER_CATEGORIES}
          value={category}
          onChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
        />
      </div>

      {/* Table */}
      <div className="al-card" ref={cardRef}>
        <div className="al-table-wrap">
          <table className={`al-table ${showUserColumn ? 'with-user' : ''} ${stacked ? 'stacked' : ''}`}>
            <thead>
              <tr>
                <th className="al-col-date">Date &amp; Time</th>
                {showUserColumn && <th className="al-col-user">User</th>}
                <th className="al-col-activity">Activity</th>
                <th className="al-col-ref">Reference</th>
                <th className="al-col-action">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? messageRow('bi-hourglass-split', 'Loading...', 'Fetching the activity log.')
                : error
                  ? messageRow('bi-exclamation-circle', 'Could not load the activity log', error)
                  : logs.length > 0
                    ? logs.map((log) => {
                        const meta = ACTION_META[log.action] || FALLBACK_META;
                        return (
                          <tr key={log.id} className="al-row-clickable" onClick={() => openDetails(log)}>
                            <td className="al-td-date" data-label="Date & Time">
                              {log.date}
                            </td>
                            {showUserColumn && (
                              <td className="al-td-user" data-label="User">
                                <div className="al-user-name" title={log.user}>
                                  {shortName(log.user)}
                                </div>
                                <div className="al-user-role">{log.role}</div>
                              </td>
                            )}
                            <td className="al-td-activity">
                              <div className="al-activity">
                                <span className={`al-chip ${meta.tone}`}>{meta.label}</span>
                                <span className="al-desc" title={log.description}>
                                  {log.description}
                                </span>
                              </div>
                            </td>
                            <td className="al-td-ref" data-label="Reference">
                              {log.reference ? (
                                <span className="al-ref">{log.reference}</span>
                              ) : (
                                <span className="al-muted">-</span>
                              )}
                            </td>
                            <td className="al-td-action">
                              <button
                                type="button"
                                className="al-view-btn"
                                aria-label={`View details of ${meta.label} on ${log.date}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLog(log);
                                }}
                              >
                                <i className="bi bi-eye"></i> View
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    : messageRow(
                        'bi-journal-text',
                        'No Activity Found',
                        hasFilters
                          ? 'No activity matches your current search or filters.'
                          : 'Your actions in the system will show up here.'
                      )}
            </tbody>
          </table>
        </div>

        <div className="al-footer">
          <div className="al-footer-info">
            <span>
              {total} {total === 1 ? 'entry' : 'entries'}
            </span>
            {hasFilters && (
              <button type="button" className="al-clear-btn" onClick={resetFilters}>
                Clear filters
              </button>
            )}
          </div>
          <div className="al-pagination">
            <button
              type="button"
              className="al-page-btn"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1 || loading}
            >
              Previous
            </button>
            <span className="al-page-indicator">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="al-page-btn"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || loading}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Activity details modal */}
      {selectedLog && (
        <div
          className="al-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="al-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedLog(null);
          }}
        >
          <div className="al-modal-card">
            <div className="al-modal-header">
              <div>
                <h3 className="al-modal-title" id="al-modal-title">
                  Activity Details
                </h3>
                <p className="al-modal-subtitle">Full record of this action in BukSUPPLY.</p>
              </div>
              <button
                type="button"
                className="al-modal-close"
                aria-label="Close"
                onClick={() => setSelectedLog(null)}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="al-modal-body">
              <div className="al-modal-grid">
                <div className="al-modal-field">
                  <span className="al-modal-label">Date &amp; Time</span>
                  <span className="al-modal-value">{selectedLog.date || '-'}</span>
                </div>
                <div className="al-modal-field">
                  <span className="al-modal-label">Activity</span>
                  <span className={`al-chip ${selectedMeta.tone}`}>{selectedMeta.label}</span>
                </div>
                {showUserColumn && (
                  <div className="al-modal-field">
                    <span className="al-modal-label">User</span>
                    <span className="al-modal-value al-modal-strong">{selectedLog.user || '-'}</span>
                    {selectedLog.role && <span className="al-modal-sub">{selectedLog.role}</span>}
                  </div>
                )}
                <div className="al-modal-field">
                  <span className="al-modal-label">Reference</span>
                  <span>
                    {selectedLog.reference ? (
                      <span className="al-ref">{selectedLog.reference}</span>
                    ) : (
                      <span className="al-muted">-</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="al-modal-section">
                <span className="al-modal-label">Description</span>
                <div className="al-modal-box">
                  <p className="al-modal-text">{selectedLog.description || '-'}</p>
                </div>
              </div>
            </div>

            <div className="al-modal-footer">
              <button type="button" className="al-modal-btn" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
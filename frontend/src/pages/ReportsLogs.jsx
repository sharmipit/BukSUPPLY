import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useInventory from '../hooks/useInventory';
import { useAuth } from '../context/AuthContext';
import { downloadReport, fetchExportHistory, fetchReportRows, verifyReport } from '../api/reports';
import { errMsg } from '../api/client';
import FilterDropdown from '../components/FilterDropdown';
import DateField from '../components/DateField';
import '../styles/ReportsLogs.css';

const STOCK_STATUSES = ['In Stock', 'Low Stock', 'Out of Stock'];
const REQUEST_STATUSES = ['Pending', 'Processing', 'Approved', 'Accepted', 'Denied', 'Cancelled'];
const TRANSACTION_TYPES = ['Received', 'Withdrawn', 'Edited', 'Created'];
const REPORT_LABEL = {
  stocks: 'Stock',
  requests: 'Requests',
  transactions: 'Transactions',
  issuance: 'Issuance slip',
};
const REPORT_TITLE = {
  stocks: 'Stock Report',
  requests: 'Requests Report',
  transactions: 'Transactions Report',
};
const FORMAT_LABEL = { pdf: 'PDF', xlsx: 'Excel' };
const FORMAT_ICON = { pdf: 'bi-file-earmark-pdf', xlsx: 'bi-file-earmark-excel' };

// Keep these the same as ORG_NAME / SYSTEM_NAME / SYSTEM_SUBTITLE in services/reportFiles.js
const ORG_NAME = 'Bukidnon State University';
const SYSTEM_NAME = 'BukSUPPLY';
const SYSTEM_SUBTITLE = 'Supply Inventory and Requisition System';

// Dot colours reuse the FilterDropdown tones
const STOCK_TONE = { 'In Stock': 'accepted', 'Low Stock': 'pending', 'Out of Stock': 'denied' };
const REQUEST_TONE = (status) => status.toLowerCase();

// The three report cards. A filter is either a dropdown ("select") or a date.
const REPORTS = [
  {
    key: 'stocks',
    icon: 'bi-boxes',
    title: 'Stock report',
    description: 'Current stock levels for every inventory item.',
    filters: [
      { type: 'select', name: 'category', label: 'Category', icon: 'bi-tag', all: 'All categories' },
      {
        type: 'select',
        name: 'status',
        label: 'Status',
        icon: 'bi-funnel',
        all: 'All statuses',
        options: STOCK_STATUSES,
        tone: (v) => STOCK_TONE[v],
      },
    ],
  },
  {
    key: 'requests',
    icon: 'bi-file-earmark-text',
    title: 'Requests report',
    description: 'Requisition slips filed within a period.',
    filters: [
      {
        type: 'select',
        name: 'status',
        label: 'Status',
        icon: 'bi-funnel',
        all: 'All statuses',
        options: REQUEST_STATUSES,
        tone: REQUEST_TONE,
      },
      { type: 'date', name: 'from', label: 'From' },
      { type: 'date', name: 'to', label: 'To' },
    ],
  },
  {
    key: 'transactions',
    icon: 'bi-arrow-left-right',
    title: 'Transactions report',
    description: 'Every stock movement across all items within a period.',
    filters: [
      {
        type: 'select',
        name: 'type',
        label: 'Type',
        icon: 'bi-funnel',
        all: 'All types',
        options: TRANSACTION_TYPES,
      },
      { type: 'date', name: 'from', label: 'From' },
      { type: 'date', name: 'to', label: 'To' },
    ],
  },
];

// Filter for the Recent downloads section
const HISTORY_FILTER_OPTIONS = [
  { value: 'All', label: 'All reports' },
  { value: 'stocks', label: 'Stock report' },
  { value: 'requests', label: 'Requests report' },
  { value: 'transactions', label: 'Transactions report' },
  { value: 'issuance', label: 'Issuance slip' },
];
const HISTORY_FETCH_LIMIT = 30; // how many recent downloads to load
const HISTORY_PREVIEW = 5; // how many are shown before "Show all"

// [header, key, isDate]
const PREVIEW_COLUMNS = {
  stocks: [
    ['Code', 'id'],
    ['Item', 'name'],
    ['Category', 'category'],
    ['Quantity', 'quantity'],
    ['Unit', 'unit'],
    ['Reorder level', 'reorderLevel'],
    ['Status', 'status'],
  ],
  requests: [
    ['Slip #', 'id'],
    ['Requested by', 'requester'],
    ['Department', 'department'],
    ['Title', 'title'],
    ['Items', 'items'],
    ['Status', 'status'],
    ['Date filed', 'createdAt', true],
  ],
  transactions: [
    ['Date', 'createdAt', true],
    ['Code', 'code'],
    ['Item', 'item'],
    ['Type', 'type'],
    ['Qty', 'quantity'],
    ['Before', 'before'],
    ['After', 'after'],
    ['Done by', 'user'],
  ],
};

// Preview pagination (approximate, the real PDF breaks depend on how rows wrap)
const MAX_PREVIEW_ROWS = 500;
const ROWS_FIRST_PAGE = 12; // the first page also holds the report details
const ROWS_NEXT_PAGES = 18;

const paginate = (rows) => {
  const pages = [];
  let i = 0;
  let size = ROWS_FIRST_PAGE;
  while (i < rows.length) {
    pages.push(rows.slice(i, i + size));
    i += size;
    size = ROWS_NEXT_PAGES;
  }
  return pages;
};

const fmtDate = (v) =>
  v
    ? new Date(v.length === 10 ? `${v}T00:00:00` : v).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const fmtStamp = (d) =>
  new Date(d).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

// "Oct 1 – Oct 27, Low Stock" style summary of what was exported
const describeFilters = (f = {}) => {
  const parts = [];
  if (f.slip) parts.push(`Slip ${f.slip}`);
  if (f.from || f.to) parts.push(`${fmtDate(f.from) || 'Start'} – ${fmtDate(f.to) || 'Today'}`);
  ['category', 'status', 'type'].forEach((k) => {
    if (f[k] && f[k] !== 'All') parts.push(f[k]);
  });
  return parts.length ? parts.join(', ') : 'All records';
};

const colName = (i) => String.fromCharCode(65 + i); // A, B, C...

// Looks like the downloaded Excel file: one sheet, grid, row numbers, no pages
function SheetPreview({ type, rows, filters, generatedBy, openedAt }) {
  const cols = PREVIEW_COLUMNS[type];
  const span = cols.length;
  const shown = rows.slice(0, MAX_PREVIEW_ROWS);

  // Same order as the Excel file: title block, details, table, closing notes
  const items = [
    { k: 'title', text: ORG_NAME, size: 'lg' },
    { k: 'title', text: `${SYSTEM_NAME} – ${SYSTEM_SUBTITLE}` },
    { k: 'title', text: REPORT_TITLE[type], size: 'md' },
    { k: 'blank' },
    { k: 'text', text: `Report: ${REPORT_TITLE[type]}` },
    { k: 'text', text: `Filters: ${describeFilters(filters)}` },
    { k: 'text', text: `Generated on: ${fmtStamp(openedAt)}` },
    { k: 'text', text: `Generated by: ${generatedBy}` },
    { k: 'text', text: `Total records: ${rows.length}` },
    { k: 'blank' },
    { k: 'head' },
    ...shown.map((r) => ({ k: 'data', r })),
    { k: 'blank' },
    { k: 'text', text: 'Verification code: Assigned when downloaded' },
    {
      k: 'text',
      text: 'To verify this report, enter the code under System Reports > Verify a report.',
    },
    {
      k: 'text',
      text:
        rows.length > MAX_PREVIEW_ROWS
          ? `Preview shows the first ${MAX_PREVIEW_ROWS} of ${rows.length} records. The downloaded file contains all of them.`
          : '*** End of report ***',
    },
  ];

  return (
    <div className="rl-sheet">
      <div className="rl-sheet-scroll">
        <table className="rl-sheet-table">
          <thead>
            <tr>
              <th className="rl-sheet-corner"></th>
              {cols.map((_, i) => (
                <th key={i}>{colName(i)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <th className="rl-sheet-rownum" scope="row">
                  {i + 1}
                </th>
                {it.k === 'title' && (
                  <td colSpan={span} className={`rl-sheet-title ${it.size || ''}`}>
                    {it.text}
                  </td>
                )}
                {it.k === 'text' && (
                  <td colSpan={span} className="rl-sheet-text">
                    {it.text}
                  </td>
                )}
                {it.k === 'blank' && <td colSpan={span}></td>}
                {it.k === 'head' &&
                  cols.map(([h]) => (
                    <td key={h} className="rl-sheet-head">
                      {h}
                    </td>
                  ))}
                {it.k === 'data' &&
                  cols.map(([h, key, isDate]) => (
                    <td key={h} className="rl-sheet-cell">
                      {isDate ? fmtDate(it.r[key]) : String(it.r[key] ?? '')}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rl-sheet-tabs">
        <span>Report</span>
      </div>
    </div>
  );
}

// PDF: stacked pages. Excel: one spreadsheet sheet.
function ReportPreview({ preview, onClose, onConfirm }) {
  const { type, format, filters } = preview;
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [openedAt] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    fetchReportRows(type, filters)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) setError(errMsg(err));
      });
    return () => {
      cancelled = true;
    };
  }, [type, filters]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pages = useMemo(() => (rows ? paginate(rows.slice(0, MAX_PREVIEW_ROWS)) : []), [rows]);

  const cols = PREVIEW_COLUMNS[type];
  const generatedBy =
    [user?.firstName, user?.lastName].filter((n) => n && n !== '-').join(' ') ||
    user?.email ||
    'Current user';

  const infoRows = [
    ['Report', REPORT_TITLE[type]],
    ['Filters', describeFilters(filters)],
    ['Generated on', fmtStamp(openedAt)],
    ['Generated by', generatedBy],
    ['Total records', rows ? String(rows.length) : '…'],
  ];

  return (
    <div className="rl-overlay" onClick={onClose}>
      <div
        className="rl-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${REPORT_TITLE[type]} preview`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rl-modal-bar">
          <div>
            <h2>Preview – {REPORT_LABEL[type]} report</h2>
            <p className="rl-muted">
              This is how the {FORMAT_LABEL[format]} file will look
              {format === 'pdf' &&
                pages.length > 1 &&
                ` (${pages.length} pages, page breaks are approximate)`}
              .
            </p>
          </div>
          <button className="rl-modal-close" onClick={onClose} aria-label="Close preview">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {!rows && !error && <p className="rl-muted rl-modal-msg">Loading preview…</p>}
        {error && <p className="rl-field-error rl-modal-msg">{error}</p>}
        {rows && rows.length === 0 && (
          <p className="rl-muted rl-modal-msg">No records match the selected filters.</p>
        )}

        {/* PDF preview: pages */}
        {format === 'pdf' && pages.length > 0 && (
          <div className="rl-paper-wrap">
            {pages.map((pageRows, p) => (
              <article className="rl-paper" key={p}>
                {/* Header: repeats on every page */}
                <header className="rl-paper-header">
                  <div>
                    <div className="rl-paper-org">{ORG_NAME}</div>
                    <div>
                      {SYSTEM_NAME} – {SYSTEM_SUBTITLE}
                    </div>
                  </div>
                  <div className="rl-paper-title">{REPORT_TITLE[type]}</div>
                </header>

                <div className="rl-paper-body">
                  {/* Report details: first page only */}
                  {p === 0 && (
                    <table className="rl-paper-info">
                      <tbody>
                        {infoRows.map(([k, v]) => (
                          <tr key={k}>
                            <td>{k}:</td>
                            <td>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Table header repeats on every page */}
                  <table className="rl-paper-table">
                    <thead>
                      <tr>
                        {cols.map(([h]) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r, i) => (
                        <tr key={i}>
                          {cols.map(([h, k, isDate]) => (
                            <td key={h}>{isDate ? fmtDate(r[k]) : String(r[k] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {p === pages.length - 1 &&
                    (rows.length > MAX_PREVIEW_ROWS ? (
                      <p className="rl-paper-end">
                        Preview shows the first {MAX_PREVIEW_ROWS} of {rows.length} records. The
                        downloaded file contains all of them.
                      </p>
                    ) : (
                      <p className="rl-paper-end">*** End of report ***</p>
                    ))}
                </div>

                {/* Footer: repeats on every page */}
                <footer className="rl-paper-footer">
                  <div>
                    Verification code: <strong>Assigned when downloaded</strong>
                    <br />
                    To verify this report, enter the code under System Reports &gt; Verify a report.
                  </div>
                  <div className="rl-paper-footer-right">
                    Generated {fmtStamp(openedAt)} by {generatedBy}
                    <br />
                    Page {p + 1} of {pages.length}
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}

        {/* Excel preview: spreadsheet */}
        {format === 'xlsx' && rows && rows.length > 0 && (
          <div className="rl-sheet-wrap">
            <SheetPreview
              type={type}
              rows={rows}
              filters={filters}
              generatedBy={generatedBy}
              openedAt={openedAt}
            />
          </div>
        )}

        <div className="rl-card-actions rl-modal-actions">
          <button className="rl-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rl-btn-primary"
            disabled={!rows || rows.length === 0}
            onClick={onConfirm}
          >
            <i className={`bi ${FORMAT_ICON[format]}`}></i>
            Download {FORMAT_LABEL[format]}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ report, categories, busyKey, onPreview }) {
  const [values, setValues] = useState({});
  const setValue = (name) => (v) => setValues((prev) => ({ ...prev, [name]: v }));
  const badRange = values.from && values.to && values.from > values.to;

  // Dropdown options for a filter. "All" always comes first.
  const buildOptions = (f) => {
    const list = f.name === 'category' ? categories : f.options;
    return [
      { value: 'All', label: f.all },
      ...list.map((o) => ({ value: o, label: o, tone: f.tone ? f.tone(o) : undefined })),
    ];
  };

  return (
    <section className="rl-card">
      <div className="rl-card-text">
        <span className="rl-card-icon" aria-hidden="true">
          <i className={`bi ${report.icon}`}></i>
        </span>
        <div>
          <h2>{report.title}</h2>
          <p>{report.description}</p>
        </div>
      </div>

      <div className="rl-card-filters">
        {report.filters.map((f) =>
          f.type === 'date' ? (
            <DateField
              key={f.name}
              label={f.label}
              value={values[f.name] || ''}
              onChange={setValue(f.name)}
              min={f.name === 'to' ? values.from || '' : ''}
              max={f.name === 'from' ? values.to || '' : ''}
              align={f.name === 'to' ? 'right' : 'left'}
            />
          ) : (
            <div key={f.name} className="rl-field">
              <span className="rl-field-label">{f.label}</span>
              <FilterDropdown
                icon={f.icon}
                ariaLabel={f.label}
                options={buildOptions(f)}
                value={values[f.name] || 'All'}
                onChange={setValue(f.name)}
              />
            </div>
          )
        )}
      </div>

      {badRange && <p className="rl-field-error">“From” must be on or before “To”.</p>}

      <div className="rl-card-actions">
        {['pdf', 'xlsx'].map((format) => {
          const key = `${report.key}-${format}`;
          const busy = busyKey === key;

          return (
            <button
              key={format}
              className={format === 'xlsx' ? 'rl-btn-primary' : 'rl-btn-secondary'}
              onClick={() => onPreview(report.key, format, values)}
              disabled={Boolean(busyKey) || badRange}
            >
              <i className={`bi ${busy ? 'bi-hourglass-split' : FORMAT_ICON[format]}`}></i>
              {busy ? 'Preparing…' : `Preview ${FORMAT_LABEL[format]}`}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// Recent downloads: aligned columns, a report-type filter, and a "Show all" toggle
function RecentDownloads({ history, loading, error }) {
  const [reportFilter, setReportFilter] = useState('All');
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(
    () => (reportFilter === 'All' ? history : history.filter((h) => h.report === reportFilter)),
    [history, reportFilter]
  );
  const visible = expanded ? filtered : filtered.slice(0, HISTORY_PREVIEW);
  const canToggle = filtered.length > HISTORY_PREVIEW;

  const emptyText =
    history.length === 0
      ? 'No reports have been downloaded yet.'
      : 'No downloads match this filter.';

  return (
    <section className="rl-history">
      <div className="rl-section-head">
        <div>
          <h2>Recent downloads</h2>
          <p className="rl-muted">Reports downloaded from this page, newest first.</p>
        </div>
        <FilterDropdown
          icon="bi-funnel"
          ariaLabel="Filter downloads by report"
          options={HISTORY_FILTER_OPTIONS}
          value={reportFilter}
          onChange={(value) => {
            setReportFilter(value);
            setExpanded(false);
          }}
        />
      </div>

      {loading ? (
        <p className="rl-muted rl-hist-msg">Loading…</p>
      ) : error ? (
        <p className="rl-muted rl-hist-msg">Could not load the download history. {error}</p>
      ) : filtered.length === 0 ? (
        <p className="rl-muted rl-hist-msg">{emptyText}</p>
      ) : (
        <div className="rl-hist">
          <div className="rl-hist-head" aria-hidden="true">
            <span>Report</span>
            <span>Format</span>
            <span>Filters</span>
            <span>Downloaded by</span>
            <span>Date</span>
            <span>Code</span>
          </div>

          <ul className="rl-hist-list">
            {visible.map((h) => {
              const filterText = describeFilters(h.filters);
              return (
                <li key={h.id} className="rl-hist-row">
                  <div className="rl-hist-cell" data-label="Report">
                    <strong className="rl-hist-text">{REPORT_LABEL[h.report] || h.report}</strong>
                  </div>
                  <div className="rl-hist-cell" data-label="Format">
                    <span className={`rl-chip ${h.format}`}>
                      <i className={`bi ${FORMAT_ICON[h.format] || 'bi-file-earmark'}`}></i>
                      {FORMAT_LABEL[h.format] || h.format}
                    </span>
                  </div>
                  <div className="rl-hist-cell rl-hist-wide" data-label="Filters">
                    <span className="rl-hist-text rl-hist-muted" title={filterText}>
                      {filterText}
                    </span>
                  </div>
                  <div className="rl-hist-cell" data-label="Downloaded by">
                    <span className="rl-hist-text" title={h.user}>
                      {h.user}
                    </span>
                  </div>
                  <div className="rl-hist-cell" data-label="Date">
                    <span className="rl-hist-text rl-hist-nowrap">{fmtDateTime(h.createdAt)}</span>
                  </div>
                  <div className="rl-hist-cell rl-hist-wide" data-label="Code">
                    {h.code ? (
                      <span className="rl-code">{h.code}</span>
                    ) : (
                      <span className="rl-hist-muted">—</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="rl-hist-foot">
            <span className="rl-muted">
              Showing {visible.length} of {filtered.length}{' '}
              {filtered.length === 1 ? 'download' : 'downloads'}
            </span>
            {canToggle && (
              <button type="button" className="rl-link-btn" onClick={() => setExpanded((e) => !e)}>
                {expanded ? 'Show less' : `Show all ${filtered.length}`}
                <i className={`bi ${expanded ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// Checks a code printed in a report footer against the server's records
function VerifyReport() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await verifyReport(code));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rl-history">
      <div className="rl-section-head">
        <div>
          <h2>Verify a report</h2>
          <p className="rl-muted">
            Enter the verification code printed in the footer of a PDF or Excel report.
          </p>
        </div>
      </div>

      <form className="rl-verify-form" onSubmit={submit}>
        <input
          className="rl-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="BSR-2026-1A2B3C4D"
          spellCheck={false}
          aria-label="Verification code"
        />
        <button className="rl-btn-primary" type="submit" disabled={busy || !code.trim()}>
          <i className={`bi ${busy ? 'bi-hourglass-split' : 'bi-check-circle'}`}></i>
          {busy ? 'Checking…' : 'Verify'}
        </button>
      </form>

      {error && <p className="rl-field-error">{error}</p>}
      {result && (
        <p className="rl-verify-result" role="status">
          <strong>Valid.</strong> {REPORT_LABEL[result.report] || result.report}{' '}
          {result.report === 'issuance' ? '' : 'report '}(
          {FORMAT_LABEL[result.format] || result.format}), {describeFilters(result.filters)},{' '}
          {result.recordCount} record(s), generated by {result.user} on{' '}
          {new Date(result.createdAt).toLocaleString('en-PH', {
            dateStyle: 'long',
            timeStyle: 'short',
          })}
          .
        </p>
      )}
    </section>
  );
}

export default function ReportsLogs() {
  useEffect(() => {
    document.title = 'System Reports | BukSUPPLY';
  }, []);

  // Only used to fill the category dropdown
  const { items } = useInventory();
  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items]
  );

  // ---------- Export ----------
  const [busyKey, setBusyKey] = useState('');
  const [notice, setNotice] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  // ---------- Recent exports ----------
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(true);
  const [histError, setHistError] = useState('');

  const loadHistory = useCallback(async () => {
    try {
      setHistError('');
      setHistory(await fetchExportHistory(HISTORY_FETCH_LIMIT));
    } catch (err) {
      setHistError(errMsg(err));
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleExport = async (type, format, filters) => {
    setBusyKey(`${type}-${format}`);
    try {
      await downloadReport(type, format, filters);
      setNotice({ type: 'success', text: `${REPORT_LABEL[type]} report downloaded.` });
      loadHistory();
    } catch (err) {
      setNotice({ type: 'error', text: `Could not download the report. ${errMsg(err)}` });
    } finally {
      setBusyKey('');
    }
  };

  const openPreview = (type, format, filters) => setPreview({ type, format, filters });

  const closePreview = useCallback(() => setPreview(null), []);

  const confirmDownload = () => {
    const { type, format, filters } = preview;
    setPreview(null);
    handleExport(type, format, filters);
  };

  return (
    <div className="reports-container">
      <div className="rl-header-card">
        <h1 className="rl-title">System Reports</h1>
        <p className="rl-subtitle">
          Choose a report, set the filters, preview it, then download it as PDF or Excel. Every
          download is listed under Recent downloads and carries a verification code you can check
          under Verify a report.
        </p>
      </div>

      {notice && (
        <div className={`rl-toast ${notice.type}`} role="status">
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      <div className="rl-cards">
        {REPORTS.map((r) => (
          <ReportCard
            key={r.key}
            report={r}
            categories={categories}
            busyKey={busyKey}
            onPreview={openPreview}
          />
        ))}
      </div>

      <RecentDownloads history={history} loading={histLoading} error={histError} />

      <VerifyReport />

      {preview && (
        <ReportPreview preview={preview} onClose={closePreview} onConfirm={confirmDownload} />
      )}
    </div>
  );
}
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import useInventory from '../hooks/useInventory';
import { downloadReport, fetchExportHistory, fetchReportRows } from '../api/reports';
import { errMsg } from '../api/client';
import '../styles/ReportsLogs.css';

const STOCK_STATUSES = ['In Stock', 'Low Stock', 'Out of Stock'];
const REQUEST_STATUSES = ['Pending', 'Processing', 'Purchasing', 'Accepted', 'Denied', 'Cancelled'];
const TRANSACTION_TYPES = ['Received', 'Withdrawn', 'Edited', 'Created'];
const REPORT_LABEL = { stocks: 'Stock', requests: 'Requests', transactions: 'Transactions' };
const FORMAT_LABEL = { pdf: 'PDF', xlsx: 'Excel' };

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

const MAX_PREVIEW_ROWS = 50;

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
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

// "Oct 1 – Oct 27, Low Stock" style summary of what was exported
const describeFilters = (f = {}) => {
  const parts = [];
  if (f.from || f.to) parts.push(`${fmtDate(f.from) || 'Start'} – ${fmtDate(f.to) || 'Today'}`);
  ['category', 'status', 'type'].forEach((k) => {
    if (f[k] && f[k] !== 'All') parts.push(f[k]);
  });
  return parts.length ? parts.join(', ') : 'All records';
};

function ReportPreview({ preview, onClose, onConfirm }) {
  const { type, format, filters } = preview;
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

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

  const cols = PREVIEW_COLUMNS[type];

  return (
    <div className="rl-overlay" onClick={onClose}>
      <div className="rl-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Preview – {REPORT_LABEL[type]} report</h2>
        <p className="rl-muted">{describeFilters(filters)}</p>

        {!rows && !error && <p className="rl-muted">Loading preview…</p>}
        {error && <p className="rl-field-error">{error}</p>}
        {rows && rows.length === 0 && (
          <p className="rl-muted">No records match the selected filters.</p>
        )}

        {rows && rows.length > 0 && (
          <>
            <p className="rl-muted">
              {rows.length} record(s)
              {rows.length > MAX_PREVIEW_ROWS && ` – showing the first ${MAX_PREVIEW_ROWS}`}
            </p>
            <div className="rl-modal-scroll">
              <table>
                <thead>
                  <tr>
                    {cols.map(([h]) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, MAX_PREVIEW_ROWS).map((r, i) => (
                    <tr key={i}>
                      {cols.map(([h, k, isDate]) => (
                        <td key={h}>{isDate ? fmtDate(r[k]) : String(r[k] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="rl-card-actions">
          <button className="rl-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rl-btn-primary"
            disabled={!rows || rows.length === 0}
            onClick={onConfirm}
          >
            Download {FORMAT_LABEL[format]}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ report, categories, busyKey, onPreview }) {
  const [values, setValues] = useState({});
  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));
  const badRange = values.from && values.to && values.from > values.to;
  const options = (f) => (f.name === 'category' ? categories : f.options);

  return (
    <section className="rl-card">
      <div className="rl-card-text">
        <h2>{report.title}</h2>
        <p>{report.description}</p>
      </div>

      <div className="rl-card-filters">
        {report.filters.map((f) =>
          f.type === 'date' ? (
            <label key={f.name} className="rl-field">
              <span>{f.label}</span>
              <input
                type="date"
                className="rl-input"
                value={values[f.name] || ''}
                onChange={set(f.name)}
              />
            </label>
          ) : (
            <label key={f.name} className="rl-field">
              <span>{f.label}</span>
              <select
                className="rl-input rl-select"
                value={values[f.name] || 'All'}
                onChange={set(f.name)}
              >
                <option value="All">{f.all}</option>
                {options(f).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
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
              <i
                className={`bi ${
                  busy
                    ? 'bi-hourglass-split'
                    : format === 'pdf'
                      ? 'bi-file-earmark-pdf'
                      : 'bi-file-earmark-excel'
                }`}
              ></i>
              {busy ? 'Preparing…' : `Preview ${FORMAT_LABEL[format]}`}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function ReportsLogs() {
  useEffect(() => {
    document.title = 'Reports & Logs | BukSUPPLY';
  }, []);

  // Only used to fill the category dropdown
  const { items } = useInventory();
  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items]
  );

  const reports = [
    {
      key: 'stocks',
      title: 'Stock report',
      description: 'Current stock levels for every inventory item.',
      filters: [
        { name: 'category', label: 'Category', all: 'All categories' },
        { name: 'status', label: 'Status', all: 'All statuses', options: STOCK_STATUSES },
      ],
    },
    {
      key: 'requests',
      title: 'Requests report',
      description: 'Requisition slips filed within a period.',
      filters: [
        { name: 'status', label: 'Status', all: 'All statuses', options: REQUEST_STATUSES },
        { name: 'from', label: 'From', type: 'date' },
        { name: 'to', label: 'To', type: 'date' },
      ],
    },
    {
      key: 'transactions',
      title: 'Transactions report',
      description: 'Every stock movement across all items within a period.',
      filters: [
        { name: 'type', label: 'Type', all: 'All types', options: TRANSACTION_TYPES },
        { name: 'from', label: 'From', type: 'date' },
        { name: 'to', label: 'To', type: 'date' },
      ],
    },
  ];

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
      setHistory(await fetchExportHistory(5));
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

  const confirmDownload = () => {
    const { type, format, filters } = preview;
    setPreview(null);
    handleExport(type, format, filters);
  };

  return (
    <div className="reports-container">
      <div className="rl-header-card">
        <h1 className="rl-title">Reports & Logs</h1>
        <p className="rl-subtitle">
          Choose a report, set the filters, preview it, then download it as PDF or Excel. Every
          download is recorded below.
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
        {reports.map((r) => (
          <ReportCard
            key={r.key}
            report={r}
            categories={categories}
            busyKey={busyKey}
            onPreview={openPreview}
          />
        ))}
      </div>

      <section className="rl-history">
        <h2>Recent downloads</h2>
        {histLoading ? (
          <p className="rl-muted">Loading…</p>
        ) : histError ? (
          <p className="rl-muted">Could not load the download history. {histError}</p>
        ) : history.length === 0 ? (
          <p className="rl-muted">No reports have been downloaded yet.</p>
        ) : (
          <ul className="rl-history-list">
            {history.map((h) => (
              <li key={h.id}>
                <div className="rl-history-main">
                  <strong>{REPORT_LABEL[h.report] || h.report}</strong>
                  <span className="rl-chip">{FORMAT_LABEL[h.format] || h.format}</span>
                  <span className="rl-muted">{describeFilters(h.filters)}</span>
                </div>
                <div className="rl-history-meta">
                  {h.user} · {fmtDateTime(h.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {preview && (
        <ReportPreview
          preview={preview}
          onClose={() => setPreview(null)}
          onConfirm={confirmDownload}
        />
      )}
    </div>
  );
}

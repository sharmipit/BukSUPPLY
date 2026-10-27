import React, { useState, useEffect, useMemo, useCallback } from 'react';

import useInventory from '../hooks/useInventory';

import { downloadReport, fetchExportHistory } from '../api/reports';

import { errMsg } from '../api/client';

import '../styles/ReportsLogs.css';

const STOCK_STATUSES = ['In Stock', 'Low Stock', 'Out of Stock'];

const REQUEST_STATUSES = ['Pending', 'Processing', 'Purchasing', 'Accepted', 'Denied', 'Cancelled'];

const TRANSACTION_TYPES = ['Received', 'Withdrawn', 'Edited', 'Created'];

const REPORT_LABEL = { stocks: 'Stock', requests: 'Requests', transactions: 'Transactions' };

const FORMAT_LABEL = { pdf: 'PDF', xlsx: 'Excel' };

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

// "Oct 1 – Oct 27 · Low Stock" style summary of what was exported

const describeFilters = (f = {}) => {
  const parts = [];

  if (f.from || f.to) parts.push(`${fmtDate(f.from) || 'Start'} – ${fmtDate(f.to) || 'Today'}`);

  ['category', 'status', 'type'].forEach((k) => {
    if (f[k] && f[k] !== 'All') parts.push(f[k]);
  });

  return parts.length ? parts.join(', ') : 'All records';
};

function ReportCard({ report, categories, busyKey, onExport }) {
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

              onClick={() => onExport(report.key, format, values)}

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

              {busy ? 'Preparing…' : `Download ${FORMAT_LABEL[format]}`}
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

  return (
    <div className="reports-container">
      <div className="rl-header-card">
        <h1 className="rl-title">Reports & Logs</h1>

        <p className="rl-subtitle">
          Choose a report, set the filters, and download it as PDF or Excel. Every download is
          recorded below.
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

            onExport={handleExport}
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
    </div>
  );
}

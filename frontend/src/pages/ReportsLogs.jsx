import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import "../styles/ReportsLogs.css";

const TABS = [
  { key: "stocks", label: "Stocks" },
  { key: "requests", label: "Requests" },
  { key: "transactions", label: "Transactions" },
];
const STOCK_STATUSES = ["In Stock", "Low Stock", "Out of Stock"];
const REQUEST_STATUSES = [
  "Pending",
  "Processing",
  "Purchasing",
  "Accepted",
  "Denied",
];
const TRANSACTION_TYPES = ["Received", "Withdrawn", "Edited"];

// ---------- Sample data (replace with API calls later) ----------
const SAMPLE_ITEMS = [
  {
    id: "ITM-001",
    name: "A4 bond paper",
    category: "Paper Products",
    unit: "ream",
    quantity: 48,
    reorderLevel: 15,
  },
  {
    id: "ITM-002",
    name: "Long bond paper",
    category: "Paper Products",
    unit: "ream",
    quantity: 12,
    reorderLevel: 15,
  },
  {
    id: "ITM-003",
    name: "Pencil",
    category: "Writing Supplies",
    unit: "pcs",
    quantity: 120,
    reorderLevel: 40,
  },
  {
    id: "ITM-004",
    name: "Ballpen (Black)",
    category: "Writing Supplies",
    unit: "pcs",
    quantity: 0,
    reorderLevel: 30,
  },
  {
    id: "ITM-005",
    name: "Whiteboard Marker (Black)",
    category: "Writing Supplies",
    unit: "pcs",
    quantity: 8,
    reorderLevel: 10,
  },
  {
    id: "ITM-006",
    name: "Stapler",
    category: "Office Supplies",
    unit: "pcs",
    quantity: 22,
    reorderLevel: 5,
  },
  {
    id: "ITM-007",
    name: "3D Printer Filament",
    category: "Lab Materials",
    unit: "roll",
    quantity: 3,
    reorderLevel: 4,
  },
  {
    id: "ITM-008",
    name: "Disinfectant Spray",
    category: "Cleaning Supplies",
    unit: "bottle",
    quantity: 35,
    reorderLevel: 10,
  },
];

const SAMPLE_REQUESTS = [
  {
    id: "REQ-2026-061",
    requestedBy: "Ms. Garcia",
    department: "College of Education",
    title: "Office Essentials",
    items: "Pencil (10 pcs)",
    date: "2026-09-15",
    status: "Denied",
  },
  {
    id: "REQ-2026-066",
    requestedBy: "Mr. Lim",
    department: "College of Business",
    title: "Pencils for exams",
    items: "Pencil (30 pcs)",
    date: "2026-09-30",
    status: "Accepted",
  },
  {
    id: "REQ-2026-072",
    requestedBy: "Ms. Ramos",
    department: "Student Council",
    title: "Poster materials",
    items: "Ballpen (Black) (60 pcs)",
    date: "2026-10-05",
    status: "Accepted",
  },
  {
    id: "REQ-2026-075",
    requestedBy: "Prof. Dela Cruz",
    department: "College of Technologies",
    title: "Laboratory Refill",
    items: "Long bond paper (5 ream)",
    date: "2026-09-28",
    status: "Accepted",
  },
  {
    id: "REQ-2026-080",
    requestedBy: "Ms. Torres",
    department: "Registrar's Office",
    title: "Printing supplies",
    items: "A4 bond paper (12 ream)",
    date: "2026-10-10",
    status: "Accepted",
  },
  {
    id: "REQ-2026-089",
    requestedBy: "Prof. Dela Cruz",
    department: "College of Technologies",
    title: "Term 2 supplies",
    items: "A4 bond paper (2 ream)",
    date: "2026-10-05",
    status: "Pending",
  },
  {
    id: "REQ-2026-090",
    requestedBy: "Prof. Dela Cruz",
    department: "College of Technologies",
    title: "Markers replenishment",
    items: "Whiteboard Marker (Black) (9 pcs)",
    date: "2026-10-08",
    status: "Processing",
  },
  {
    id: "REQ-2026-091",
    requestedBy: "Prof. Dela Cruz",
    department: "College of Technologies",
    title: "Specialty Filament",
    items: "3D Filament (5 roll)",
    date: "2026-10-09",
    status: "Purchasing",
  },
  {
    id: "REQ-2026-092",
    requestedBy: "Ms. Garcia",
    department: "College of Education",
    title: "Exam pens",
    items: "Ballpen (Black) (10 pcs)",
    date: "2026-10-10",
    status: "Processing",
  },
];

const SAMPLE_TRANSACTIONS = [
  {
    id: "T-01",
    itemId: "ITM-001",
    item: "A4 bond paper",
    unit: "ream",
    type: "Received",
    qty: 20,
    before: 40,
    after: 60,
    by: "Admin Reyes",
    date: "2026-09-05T10:30:00",
    reference: "DR-2026-101",
  },
  {
    id: "T-02",
    itemId: "ITM-006",
    item: "Stapler",
    unit: "pcs",
    type: "Edited",
    qty: 3,
    before: 25,
    after: 22,
    by: "Admin Reyes",
    date: "2026-09-29T15:00:00",
    reference: "",
  },
  {
    id: "T-03",
    itemId: "ITM-002",
    item: "Long bond paper",
    unit: "ream",
    type: "Withdrawn",
    qty: 5,
    before: 35,
    after: 30,
    by: "Mod Santos",
    date: "2026-09-30T14:00:00",
    reference: "REQ-2026-075",
  },
  {
    id: "T-04",
    itemId: "ITM-003",
    item: "Pencil",
    unit: "pcs",
    type: "Withdrawn",
    qty: 30,
    before: 150,
    after: 120,
    by: "Mod Santos",
    date: "2026-10-02T08:45:00",
    reference: "REQ-2026-066",
  },
  {
    id: "T-05",
    itemId: "ITM-004",
    item: "Ballpen (Black)",
    unit: "pcs",
    type: "Withdrawn",
    qty: 60,
    before: 60,
    after: 0,
    by: "Admin Reyes",
    date: "2026-10-09T16:30:00",
    reference: "REQ-2026-072",
  },
  {
    id: "T-06",
    itemId: "ITM-002",
    item: "Long bond paper",
    unit: "ream",
    type: "Withdrawn",
    qty: 18,
    before: 30,
    after: 12,
    by: "Mod Santos",
    date: "2026-10-10T14:05:00",
    reference: "REQ-2026-078",
  },
  {
    id: "T-07",
    itemId: "ITM-007",
    item: "3D Printer Filament",
    unit: "roll",
    type: "Withdrawn",
    qty: 3,
    before: 6,
    after: 3,
    by: "Mod Santos",
    date: "2026-10-11T11:40:00",
    reference: "REQ-2026-077",
  },
  {
    id: "T-08",
    itemId: "ITM-001",
    item: "A4 bond paper",
    unit: "ream",
    type: "Withdrawn",
    qty: 12,
    before: 60,
    after: 48,
    by: "Admin Reyes",
    date: "2026-10-12T10:20:00",
    reference: "REQ-2026-080",
  },
];

// ---------- Helpers ----------
const getStockStatus = (item) => {
  if (item.quantity <= 0) return "Out of Stock";
  if (item.quantity <= item.reorderLevel) return "Low Stock";
  return "In Stock";
};

const slug = (text) => text.toLowerCase().replace(/\s+/g, "-");

const fmtDate = (v) =>
  new Date(v.length === 10 ? `${v}T00:00:00` : v).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });

const changeText = (t) => {
  if (t.type === "Received") return `+${t.qty} ${t.unit}`;
  if (t.type === "Withdrawn") return `−${t.qty} ${t.unit}`;
  return t.before !== t.after ? `${t.before} → ${t.after}` : "No change";
};

const pdfText = (v) =>
  String(v ?? "")
    .replace(/−/g, "-")
    .replace(/→/g, "to");

export default function ReportsLogs() {
  useEffect(() => {
    document.title = "Reports & Logs | BukSUPPLY";
  }, []);

  const [tab, setTab] = useState("stocks");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const change = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("All");
    setStatusFilter("All");
    setTypeFilter("All");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const switchTab = (next) => {
    setTab(next);
    clearFilters();
  };

  const hasFilters =
    searchTerm ||
    categoryFilter !== "All" ||
    statusFilter !== "All" ||
    typeFilter !== "All" ||
    dateFrom ||
    dateTo;

  const inRange = (value) => {
    const day = value.slice(0, 10);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  };

  const query = searchTerm.toLowerCase().trim();
  const categories = [...new Set(SAMPLE_ITEMS.map((i) => i.category))].sort();

  // ---------- Stocks ----------
  const stockRows = SAMPLE_ITEMS.map((i) => ({
    ...i,
    status: getStockStatus(i),
  })).filter((i) => {
    const matchesSearch =
      query === "" ||
      i.name.toLowerCase().includes(query) ||
      i.id.toLowerCase().includes(query) ||
      i.category.toLowerCase().includes(query);
    const matchesCategory =
      categoryFilter === "All" || i.category === categoryFilter;
    const matchesStatus = statusFilter === "All" || i.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // ---------- Requests ----------
  const requestRows = SAMPLE_REQUESTS.filter((r) => {
    const matchesSearch =
      query === "" ||
      r.id.toLowerCase().includes(query) ||
      r.title.toLowerCase().includes(query) ||
      r.requestedBy.toLowerCase().includes(query) ||
      r.department.toLowerCase().includes(query) ||
      r.items.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "All" || r.status === statusFilter;
    return matchesSearch && matchesStatus && inRange(r.date);
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  // ---------- Transactions ----------
  const transactionRows = SAMPLE_TRANSACTIONS.filter((t) => {
    const matchesSearch =
      query === "" ||
      t.item.toLowerCase().includes(query) ||
      t.itemId.toLowerCase().includes(query) ||
      t.reference.toLowerCase().includes(query) ||
      t.by.toLowerCase().includes(query);
    const matchesType = typeFilter === "All" || t.type === typeFilter;
    return matchesSearch && matchesType && inRange(t.date);
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const rowsByTab = {
    stocks: stockRows,
    requests: requestRows,
    transactions: transactionRows,
  };
  const activeRows = rowsByTab[tab];
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentRows = activeRows.slice(indexOfFirst, indexOfLast);

  // Exports every filtered row, not just the current page
  // Exports every filtered row, not just the current page
  const handleExport = () => {
    const label = TABS.find((t) => t.key === tab).label;
    const stamp = new Date().toISOString().slice(0, 10);

    let head;
    let body;
    if (tab === "stocks") {
      head = [
        [
          "Item ID",
          "Item",
          "Category",
          "Unit",
          "On hand",
          "Reorder level",
          "Status",
        ],
      ];
      body = stockRows.map((i) => [
        i.id,
        i.name,
        i.category,
        i.unit,
        i.quantity,
        i.reorderLevel,
        i.status,
      ]);
    } else if (tab === "requests") {
      head = [
        [
          "Date filed",
          "Slip",
          "Title",
          "Requested by",
          "College / Office",
          "Items",
          "Status",
        ],
      ];
      body = requestRows.map((r) => [
        fmtDate(r.date),
        r.id,
        r.title,
        r.requestedBy,
        r.department,
        r.items,
        r.status,
      ]);
    } else {
      head = [
        [
          "Date",
          "Time",
          "Item",
          "Type",
          "Change",
          "Before",
          "After",
          "Reference",
          "Done by",
        ],
      ];
      body = transactionRows.map((t) => [
        fmtDate(t.date),
        fmtTime(t.date),
        t.item,
        t.type,
        changeText(t),
        t.before,
        t.after,
        t.reference || "-",
        t.by,
      ]);
    }

    const period =
      tab === "stocks"
        ? `As of ${fmtDate(stamp)}`
        : dateFrom || dateTo
          ? `Period: ${dateFrom ? fmtDate(dateFrom) : "Start"} to ${dateTo ? fmtDate(dateTo) : "Today"}`
          : "Period: All records";

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(44, 26, 20);
    doc.text(`BukSUPPLY - ${label} Report`, 40, 44);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(89, 77, 70);
    doc.text(`${period}  |  ${body.length} records`, 40, 62);

    autoTable(doc, {
      head,
      body: body.map((row) => row.map(pdfText)),
      startY: 78,
      margin: { left: 40, right: 40, bottom: 40 },
      styles: { fontSize: 9, cellPadding: 6, textColor: [44, 26, 20] },
      headStyles: { fillColor: [140, 88, 57], textColor: 255 },
      alternateRowStyles: { fillColor: [250, 247, 242] },
    });

    // Page numbers
    const pages = doc.getNumberOfPages();
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(140, 122, 112);
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.text(`Page ${p} of ${pages}`, w - 40, h - 20, { align: "right" });
    }

    doc.save(`${label.toLowerCase()}-report-${stamp}.pdf`);
  };

  const placeholder = {
    stocks: "Search by item name, ID, or category...",
    requests: "Search by slip ID, title, requester, or items...",
    transactions: "Search by item, reference, or person...",
  }[tab];

  const emptyRow = (icon, text) => (
    <tr>
      <td colSpan="6" className="rl-empty-cell">
        <div className="rl-empty-content">
          <div className="rl-empty-icon">
            <i className={`bi ${icon}`}></i>
          </div>
          <h4>Nothing Found</h4>
          <p>{text}</p>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="reports-container">
      {/* Header */}
      <div className="rl-header-card">
        <div>
          <h1 className="rl-title">Reports & Logs</h1>
          <p className="rl-subtitle">
            Stock list, requisition slips, and stock transactions. Filter,
            export, or print what you need.
          </p>
        </div>
        <div className="rl-header-actions">
          <button className="rl-btn-secondary" onClick={() => window.print()}>
            <i className="bi bi-printer"></i> Print
          </button>
          <button
            className="rl-btn-export"
            onClick={handleExport}
            disabled={activeRows.length === 0}
          >
            <i className="bi bi-file-earmark-pdf"></i> Export PDF
          </button>
        </div>
      </div>

      {/* Shown only when printing */}
      <div className="rl-print-head">
        <h2>BukSUPPLY · {TABS.find((t) => t.key === tab).label}</h2>
        <p>
          {tab !== "stocks" && (dateFrom || dateTo)
            ? `Period: ${dateFrom ? fmtDate(dateFrom) : "Start"} – ${dateTo ? fmtDate(dateTo) : "Today"}`
            : "All records"}
        </p>
      </div>

      {/* Tabs */}
      <div className="rl-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`rl-tab-btn ${tab === t.key ? "active" : ""}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="rl-filter-bar">
        <div className="rl-search-wrapper">
          <i className="bi bi-search"></i>
          <input
            type="text"
            className="form-control custom-input"
            placeholder={placeholder}
            value={searchTerm}
            onChange={change(setSearchTerm)}
          />
        </div>

        {tab === "stocks" && (
          <>
            <select
              className="rl-select"
              value={categoryFilter}
              onChange={change(setCategoryFilter)}
              aria-label="Filter by category"
            >
              <option value="All">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="rl-select"
              value={statusFilter}
              onChange={change(setStatusFilter)}
              aria-label="Filter by status"
            >
              <option value="All">All statuses</option>
              {STOCK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </>
        )}

        {tab === "requests" && (
          <select
            className="rl-select"
            value={statusFilter}
            onChange={change(setStatusFilter)}
            aria-label="Filter by status"
          >
            <option value="All">All statuses</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        {tab === "transactions" && (
          <select
            className="rl-select"
            value={typeFilter}
            onChange={change(setTypeFilter)}
            aria-label="Filter by type"
          >
            <option value="All">All types</option>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}

        {tab !== "stocks" && (
          <>
            <label className="rl-date-field">
              <span>From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={change(setDateFrom)}
              />
            </label>
            <label className="rl-date-field">
              <span>To</span>
              <input type="date" value={dateTo} onChange={change(setDateTo)} />
            </label>
          </>
        )}

        {hasFilters && (
          <button className="rl-btn-clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rl-section-card">
        <div className="rl-table-wrapper">
          <table className="rl-table">
            <thead>
              {tab === "stocks" && (
                <tr>
                  <th className="col-main">Item</th>
                  <th className="col-wide">Category</th>
                  <th className="col-num">Unit</th>
                  <th className="col-num">On hand</th>
                  <th className="col-num">Reorder level</th>
                  <th className="col-status">Status</th>
                </tr>
              )}
              {tab === "requests" && (
                <tr>
                  <th className="col-date">Date filed</th>
                  <th className="col-slip">Slip</th>
                  <th className="col-wide">Requested by</th>
                  <th className="col-main">Items</th>
                  <th className="col-status">Status</th>
                  <th className="col-wide">College / Office</th>
                </tr>
              )}
              {tab === "transactions" && (
                <tr>
                  <th className="col-date">Date & time</th>
                  <th className="col-main">Item</th>
                  <th className="col-type">Type</th>
                  <th className="col-change">Change</th>
                  <th className="col-ref">Reference</th>
                  <th className="col-wide">Done by</th>
                </tr>
              )}
            </thead>

            <tbody>
              {currentRows.length === 0 &&
                emptyRow(
                  "bi-journal-text",
                  "No records match your search or filters.",
                )}

              {tab === "stocks" &&
                currentRows.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div className="rl-strong cell-clamp" title={i.name}>
                        {i.name}
                      </div>
                      <div className="rl-sub">{i.id}</div>
                    </td>
                    <td>
                      <div className="cell-clamp" title={i.category}>
                        {i.category}
                      </div>
                    </td>
                    <td className="nowrap-cell">{i.unit}</td>
                    <td className="nowrap-cell">
                      <strong>{i.quantity}</strong>
                    </td>
                    <td className="nowrap-cell">{i.reorderLevel}</td>
                    <td className="nowrap-cell">
                      <span className={`rl-badge ${slug(i.status)}`}>
                        {i.status}
                      </span>
                    </td>
                  </tr>
                ))}

              {tab === "requests" &&
                currentRows.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap-cell">{fmtDate(r.date)}</td>
                    <td>
                      <div className="rl-strong nowrap-cell">{r.id}</div>
                      <div className="rl-sub cell-clamp" title={r.title}>
                        {r.title}
                      </div>
                    </td>
                    <td>
                      <div className="cell-clamp" title={r.requestedBy}>
                        {r.requestedBy}
                      </div>
                    </td>
                    <td>
                      <div className="cell-clamp" title={r.items}>
                        {r.items}
                      </div>
                    </td>
                    <td className="nowrap-cell">
                      <span className={`rl-badge ${slug(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <div className="cell-clamp" title={r.department}>
                        {r.department}
                      </div>
                    </td>
                  </tr>
                ))}

              {tab === "transactions" &&
                currentRows.map((t) => (
                  <tr key={t.id}>
                    <td className="nowrap-cell">
                      <div>{fmtDate(t.date)}</div>
                      <div className="rl-sub">{fmtTime(t.date)}</div>
                    </td>
                    <td>
                      <div className="rl-strong cell-clamp" title={t.item}>
                        {t.item}
                      </div>
                      <div className="rl-sub">{t.itemId}</div>
                    </td>
                    <td className="nowrap-cell">
                      <span className={`rl-badge ${slug(t.type)}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="nowrap-cell">
                      <div className="rl-strong">{changeText(t)}</div>
                      {t.type !== "Edited" && (
                        <div className="rl-sub">
                          {t.before} → {t.after}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="cell-clamp">{t.reference || "—"}</div>
                    </td>
                    <td>
                      <div className="cell-clamp" title={t.by}>
                        {t.by}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="rl-footer-bar">
          <span>
            Showing {currentRows.length} of {activeRows.length}{" "}
            {tab === "stocks"
              ? "items"
              : tab === "requests"
                ? "requests"
                : "transactions"}
          </span>
          <div className="rl-pagination">
            <button
              className="rl-btn-action"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span className="rl-page-indicator">Page {currentPage}</span>
            <button
              className="rl-btn-action"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={indexOfLast >= activeRows.length}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

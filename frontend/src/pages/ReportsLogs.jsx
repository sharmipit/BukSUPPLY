import React, { useState, useEffect, useRef } from "react";
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

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

// "YYYY-MM-DD" <-> { y, m (0-11), d }. Built from parts so there is no timezone shift.
const pad = (n) => String(n).padStart(2, "0");
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parseISO = (v) => {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  return { y, m: m - 1, d };
};

// Filter dropdown. Same look as the category dropdown on the Inventory page.
// onChange receives the chosen value ("All" or one of the options).
function SelectFilter({ value, onChange, label, icon, allLabel, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="rl-dropdown" ref={ref}>
      <button
        type="button"
        className={`rl-dropdown-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Filter by ${label.toLowerCase()}`}
      >
        <i className={`bi ${icon}`}></i>
        <span className="rl-dropdown-label">{label}</span>
        <span className="rl-dropdown-value">
          <span className="rl-dropdown-value-text">
            {value === "All" ? allLabel : value}
          </span>
        </span>
        <i className="bi bi-chevron-down rl-dropdown-chevron"></i>
      </button>

      {open && (
        <ul className="rl-dropdown-menu" role="listbox">
          {["All", ...options].map((opt) => {
            const active = value === opt;
            return (
              <li key={opt} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`rl-dropdown-item ${active ? "active" : ""}`}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  <span className="rl-dropdown-item-text">
                    {opt === "All" ? allLabel : opt}
                  </span>
                  <i
                    className={`bi bi-check2 rl-dropdown-check ${active ? "show" : ""}`}
                  ></i>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Date capsule with a custom calendar. value and onChange use "YYYY-MM-DD" ("" = empty).
function DateFilter({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("days"); // "days" | "months"
  const ref = useRef(null);

  const selected = parseISO(value);
  const now = new Date();
  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const [view, setView] = useState({
    y: (selected || today).y,
    m: (selected || today).m,
  });

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      const base = selected || today;
      setView({ y: base.y, m: base.m });
      setMode("days");
    }
    setOpen((o) => !o);
  };

  const shiftMonth = (delta) =>
    setView((v) => {
      const total = v.m + delta;
      return { y: v.y + Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
    });

  // 6 weeks x 7 days, starting on the Sunday on or before the 1st
  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const dt = new Date(view.y, view.m, 1 - firstWeekday + i);
    return {
      y: dt.getFullYear(),
      m: dt.getMonth(),
      d: dt.getDate(),
      outside: dt.getMonth() !== view.m,
    };
  });

  const same = (a, b) => a && b && a.y === b.y && a.m === b.m && a.d === b.d;

  const pick = (c) => {
    onChange(toISO(c.y, c.m, c.d));
    setOpen(false);
  };

  return (
    <div className="rl-date-field" ref={ref}>
      <button
        type="button"
        className="rl-date-btn"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{label}</span>
        <span className={`rl-date-value ${value ? "" : "is-empty"}`}>
          {value ? fmtDate(value) : "Select date"}
        </span>
        <i className="bi bi-calendar3 rl-date-icon" aria-hidden="true"></i>
      </button>

      {open && (
        <div className="rl-calendar" role="dialog" aria-label={`${label} date`}>
          <div className="rl-cal-head">
            {mode === "days" ? (
              <button
                type="button"
                className="rl-cal-title"
                onClick={() => setMode("months")}
                aria-label="Choose month and year"
              >
                {MONTHS[view.m]} {view.y}
                <i className="bi bi-chevron-down"></i>
              </button>
            ) : (
              <button
                type="button"
                className="rl-cal-title"
                onClick={() => setMode("days")}
                aria-label="Back to days"
              >
                {view.y}
                <i className="bi bi-chevron-up"></i>
              </button>
            )}

            <div className="rl-cal-nav">
              <button
                type="button"
                className="rl-cal-nav-btn"
                onClick={() =>
                  mode === "days"
                    ? shiftMonth(-1)
                    : setView((v) => ({ ...v, y: v.y - 1 }))
                }
                aria-label={mode === "days" ? "Previous month" : "Previous year"}
              >
                <i className="bi bi-chevron-left"></i>
              </button>
              <button
                type="button"
                className="rl-cal-nav-btn"
                onClick={() =>
                  mode === "days"
                    ? shiftMonth(1)
                    : setView((v) => ({ ...v, y: v.y + 1 }))
                }
                aria-label={mode === "days" ? "Next month" : "Next year"}
              >
                <i className="bi bi-chevron-right"></i>
              </button>
            </div>
          </div>

          {mode === "days" ? (
            <>
              <div className="rl-cal-weekdays">
                {WEEKDAYS.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div className="rl-cal-grid">
                {cells.map((c) => (
                  <button
                    key={toISO(c.y, c.m, c.d)}
                    type="button"
                    className={[
                      "rl-cal-day",
                      c.outside ? "is-outside" : "",
                      same(c, today) ? "is-today" : "",
                      same(c, selected) ? "is-selected" : "",
                    ].join(" ")}
                    onClick={() => pick(c)}
                  >
                    {c.d}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="rl-cal-months">
              {MONTHS.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  className={[
                    "rl-cal-month",
                    view.m === i ? "is-selected" : "",
                    today.y === view.y && today.m === i ? "is-today" : "",
                  ].join(" ")}
                  onClick={() => {
                    setView((v) => ({ ...v, m: i }));
                    setMode("days");
                  }}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          <div className="rl-cal-foot">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button type="button" onClick={() => pick(today)}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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

  // For inputs that send an event (search box, dropdowns)
  const change = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  // For the calendar, which sends the value directly
  const changeValue = (setter) => (v) => {
    setter(v);
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

        {/* Right side: "Clear filters" first (left), then the filters */}
        <div className="rl-filter-group">
          {hasFilters && (
            <button className="rl-btn-clear" onClick={clearFilters}>
              <i className="bi bi-x-circle"></i> Clear filters
            </button>
          )}

          {tab === "stocks" && (
            <>
              <SelectFilter
                value={categoryFilter}
                onChange={changeValue(setCategoryFilter)}
                label="Category"
                icon="bi-tag"
                allLabel="All categories"
                options={categories}
              />
              <SelectFilter
                value={statusFilter}
                onChange={changeValue(setStatusFilter)}
                label="Status"
                icon="bi-funnel"
                allLabel="All statuses"
                options={STOCK_STATUSES}
              />
            </>
          )}

          {tab === "requests" && (
            <SelectFilter
              value={statusFilter}
              onChange={changeValue(setStatusFilter)}
              label="Status"
              icon="bi-funnel"
              allLabel="All statuses"
              options={REQUEST_STATUSES}
            />
          )}

          {tab === "transactions" && (
            <SelectFilter
              value={typeFilter}
              onChange={changeValue(setTypeFilter)}
              label="Type"
              icon="bi-arrow-left-right"
              allLabel="All types"
              options={TRANSACTION_TYPES}
            />
          )}

          {tab !== "stocks" && (
            <>
              <DateFilter
                label="From"
                value={dateFrom}
                onChange={changeValue(setDateFrom)}
              />
              <DateFilter
                label="To"
                value={dateTo}
                onChange={changeValue(setDateTo)}
              />
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rl-section-card">
        <div className="rl-table-wrapper">
          <table className="rl-table">
            <thead>
              {tab === "stocks" && (
                <tr>
                  <th className="rl-col-main">Item</th>
                  <th className="rl-col-wide">Category</th>
                  <th className="rl-col-num">Unit</th>
                  <th className="rl-col-num">On hand</th>
                  <th className="rl-col-num">Reorder level</th>
                  <th className="rl-col-status">Status</th>
                </tr>
              )}
              {tab === "requests" && (
                <tr>
                  <th className="rl-col-date">Date filed</th>
                  <th className="rl-col-slip">Slip</th>
                  <th className="rl-col-wide">Requested by</th>
                  <th className="rl-col-main">Items</th>
                  <th className="rl-col-status">Status</th>
                  <th className="rl-col-wide">College / Office</th>
                </tr>
              )}
              {tab === "transactions" && (
                <tr>
                  <th className="rl-col-date">Date & time</th>
                  <th className="rl-col-main">Item</th>
                  <th className="rl-col-type">Type</th>
                  <th className="rl-col-change">Change</th>
                  <th className="rl-col-ref">Reference</th>
                  <th className="rl-col-wide">Done by</th>
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
                      <div className="rl-strong rl-clamp" title={i.name}>
                        {i.name}
                      </div>
                      <div className="rl-sub">{i.id}</div>
                    </td>
                    <td>
                      <div className="rl-clamp" title={i.category}>
                        {i.category}
                      </div>
                    </td>
                    <td className="rl-nowrap">{i.unit}</td>
                    <td className="rl-nowrap">
                      <strong>{i.quantity}</strong>
                    </td>
                    <td className="rl-nowrap">{i.reorderLevel}</td>
                    <td className="rl-nowrap">
                      <span className={`rl-badge ${slug(i.status)}`}>
                        {i.status}
                      </span>
                    </td>
                  </tr>
                ))}

              {tab === "requests" &&
                currentRows.map((r) => (
                  <tr key={r.id}>
                    <td className="rl-nowrap">{fmtDate(r.date)}</td>
                    <td>
                      <div className="rl-strong rl-nowrap">{r.id}</div>
                      <div className="rl-sub rl-clamp" title={r.title}>
                        {r.title}
                      </div>
                    </td>
                    <td>
                      <div className="rl-clamp" title={r.requestedBy}>
                        {r.requestedBy}
                      </div>
                    </td>
                    <td>
                      <div className="rl-clamp" title={r.items}>
                        {r.items}
                      </div>
                    </td>
                    <td className="rl-nowrap">
                      <span className={`rl-badge ${slug(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <div className="rl-clamp" title={r.department}>
                        {r.department}
                      </div>
                    </td>
                  </tr>
                ))}

              {tab === "transactions" &&
                currentRows.map((t) => (
                  <tr key={t.id}>
                    <td className="rl-nowrap">
                      <div>{fmtDate(t.date)}</div>
                      <div className="rl-sub">{fmtTime(t.date)}</div>
                    </td>
                    <td>
                      <div className="rl-strong rl-clamp" title={t.item}>
                        {t.item}
                      </div>
                      <div className="rl-sub">{t.itemId}</div>
                    </td>
                    <td className="rl-nowrap">
                      <span className={`rl-badge ${slug(t.type)}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="rl-nowrap">
                      <div className="rl-strong">{changeText(t)}</div>
                      {t.type !== "Edited" && (
                        <div className="rl-sub">
                          {t.before} → {t.after}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="rl-clamp">{t.reference || "—"}</div>
                    </td>
                    <td>
                      <div className="rl-clamp" title={t.by}>
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
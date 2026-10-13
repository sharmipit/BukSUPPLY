import React, { useState, useMemo, useEffect } from "react";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../../styles/user/HelpSupport.css";

const CATEGORIES = [
  { key: "all", label: "All Questions" },
  { key: "general", label: "General Info" },
  { key: "requests", label: "Making Requests" },
];

const SECTIONS = {
  general: "1. General Information",
  requests: "2. Making & Justifying Requests",
};

const FAQS = [
  {
    id: 1,
    category: "general",
    icon: "bi-info-circle",
    tone: "tone-brown",
    question: "What is BukSUPPLY?",
    answer: (
      <>
        BukSUPPLY is an online supply request and management platform for
        Bukidnon State University. It allows authorized student organizations
        and staff (teaching and non-teaching) to request physical office,
        academic, and event supplies directly from the university supply
        office.
      </>
    ),
  },
  {
    id: 2,
    category: "general",
    icon: "bi-people",
    tone: "tone-brown",
    question: "Who can use BukSUPPLY?",
    answer: (
      <ul className="faq-list">
        <li>
          <strong>University Staff:</strong> All teaching (faculty) and
          non-teaching staff requiring materials for department operations or
          class instruction.
        </li>
        <li>
          <strong>Student Organizations &amp; Representatives:</strong>{" "}
          Authorized student leaders and representatives requiring materials
          for officially recognized school events, projects, or organization
          activities.
        </li>
      </ul>
    ),
  },
  {
    id: 3,
    category: "general",
    icon: "bi-shield-exclamation",
    tone: "tone-rose",
    question: "Can individual students request supplies for personal use?",
    answer: (
      <>
        <strong className="text-no">No.</strong> BukSUPPLY is strictly reserved
        for official, school-related activities, departmental operations, and
        recognized student organization events. Requests for personal academic
        or non-academic use will be automatically rejected.
      </>
    ),
  },
  {
    id: 4,
    category: "requests",
    icon: "bi-box-seam",
    tone: "tone-amber",
    question: "What kinds of items can I request?",
    answer: (
      <>
        <p>You can request two main types of items through BukSUPPLY:</p>
        <ol className="faq-list faq-list-ordered">
          <li>
            <strong>In-Stock Items:</strong> Supplies currently available in
            the university supply warehouse (e.g., standard stationery,
            printing paper, whiteboard markers).
          </li>
          <li>
            <strong>Out-of-Stock / Special Purchase Items:</strong> Supplies or
            materials not currently stored in the warehouse. If approved, the
            university will procure these items through official procurement
            channels.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: 5,
    category: "requests",
    icon: "bi-file-earmark-text",
    tone: "tone-green",
    question: "Why is a detailed reason required for every request?",
    answer: (
      <>
        To ensure university resources are managed responsibly, every request
        undergoes strict administrative evaluation. You must provide a{" "}
        <strong>valid, clear, and reasonable justification</strong> explaining
        how the requested items will be used for university or organization
        activities.
      </>
    ),
  },
  {
    id: 6,
    category: "requests",
    icon: "bi-check-circle",
    tone: "tone-tan",
    question: 'What makes a "reasonable" justification?',
    answer: (
      <>
        <div className="example example-good">
          <span className="example-label">Good Example:</span>
          <span>
            "Requesting 3 reams of A4 paper and 2 cartridges of black ink for
            printing official event paraphernalia and certificates for the
            upcoming Campus Leadership Summit on Oct 25."
          </span>
        </div>
        <div className="example example-bad">
          <span className="example-label">Poor Example:</span>
          <span>"Need paper for office use." or "For class project."</span>
        </div>
      </>
    ),
  },
];

const SEARCH_TEXT = {
  1: "BukSUPPLY is an online supply request and management platform for Bukidnon State University. authorized student organizations staff teaching non-teaching office academic event supplies supply office",
  2: "University Staff teaching faculty non-teaching department operations class instruction Student Organizations Representatives student leaders recognized school events projects",
  3: "No strictly reserved official school-related departmental recognized student organization personal academic non-academic automatically rejected",
  4: "two main types In-Stock Items warehouse stationery printing paper whiteboard markers Out-of-Stock Special Purchase procurement channels",
  5: "administrative evaluation valid clear reasonable justification university resources organization activities",
  6: "Good Example Poor Example 3 reams A4 paper black ink certificates Campus Leadership Summit Need paper for office use For class project",
};

function FAQ() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter((f) => {
      const matchesCategory = category === "all" || f.category === category;
      const haystack = `${f.question} ${SEARCH_TEXT[f.id]}`.toLowerCase();
      return matchesCategory && (q === "" || haystack.includes(q));
    });
  }, [query, category]);

  const showSections = query.trim() === "" && category === "all";

  const toggle = (id) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <div className="faq-page">
      {/* Header Banner */}
      <header className="faq-header">
        <div className="faq-header-inner">
          <span className="faq-badge">Help Center</span>
          <h1>Frequently Asked Questions</h1>
          <p>
            Everything you need to know about requesting in-stock and special
            purchase supplies for your school activities and office
            operations.
          </p>

          <div className="faq-search">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Search questions (e.g., 'In-stock', 'Justification')..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      <main className="faq-main">
        {/* Category Tabs */}
        <div className="faq-tabs">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              className={`faq-tab ${category === c.key ? "active" : ""}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Accordion */}
        <div className="faq-accordion">
          {filtered.map((f, i) => {
            const isOpen = openId === f.id;
            const prev = filtered[i - 1];
            const showHeader =
              showSections && (!prev || prev.category !== f.category);

            return (
              <div key={f.id}>
                {showHeader && (
                  <div className="faq-section-header">
                    {SECTIONS[f.category]}
                  </div>
                )}
                <div className={`faq-card ${isOpen ? "open" : ""}`}>
                  <button
                    className="faq-question"
                    onClick={() => toggle(f.id)}
                    aria-expanded={isOpen}
                  >
                    <div className="faq-question-left">
                      <span className={`faq-icon ${f.tone}`}>
                        <i className={`bi ${f.icon}`} />
                      </span>
                      <span className="faq-question-text">{f.question}</span>
                    </div>
                    <i className="bi bi-chevron-down faq-chevron" />
                  </button>
                  {isOpen && <div className="faq-answer">{f.answer}</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="faq-empty">
            <i className="bi bi-question-circle" />
            <h3>No matching questions found</h3>
            <p>Try using different search terms or clearing the filter.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function HelpSupport() {
  useEffect(() => {
    document.title = 'Help & Support | BukSUPPLY';
  }, []);

  return (
    <div>
      <FAQ />
    </div>
  );
}
import React, { useState, useMemo, useEffect } from "react";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../../styles/user/HelpSupport.css";

const CATEGORIES = [
  { key: "all", label: "All Questions" },
  { key: "general", label: "General Info" },
  { key: "requests", label: "Making Requests" },
  { key: "tracking", label: "Tracking & Pickup" },
  { key: "account", label: "Account & Activity" },
];

const SECTIONS = {
  general: "1. General Information",
  requests: "2. Making & Justifying Requests",
  tracking: "3. Tracking Your Request & Pickup",
  account: "4. Account & Activity",
};

const FAQS = [
  {
    id: 1,
    category: "general",
    icon: "bi-info-circle",
    tone: "tone-brown",
    question: "What is BukSUPPLY?",
    search:
      "online supply request management platform Bukidnon State University student organizations staff teaching non-teaching office academic event supplies supply office",
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
    search:
      "University Staff teaching faculty non-teaching department operations class instruction Student Organizations Representatives student leaders recognized school events projects",
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
    search:
      "No strictly reserved official school-related departmental recognized student organization personal academic non-academic automatically rejected",
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
    search:
      "in-stock items available inventory supply warehouse stationery printing paper whiteboard markers out of stock restock",
    answer: (
      <>
        <p>
          You can request items that are currently available in the supply
          office inventory (for example, standard stationery, printing paper,
          or whiteboard markers).
        </p>
        <p>
          When you add items to your slip, you will see how many are available.
          Items that are out of stock cannot be requested until the supply
          office restocks them, so check back later or file your request again.
        </p>
      </>
    ),
  },
  {
    id: 5,
    category: "requests",
    icon: "bi-pencil-square",
    tone: "tone-green",
    question: "How do I file a requisition slip?",
    search:
      "file new requisition department organization title purpose add items submit step by step how to",
    answer: (
      <ol className="faq-list faq-list-ordered">
        <li>
          Click <strong>File Requisition Slip</strong> (or{" "}
          <strong>File New Requisition</strong>).
        </li>
        <li>Enter your department or organization, a title, and the purpose.</li>
        <li>
          Click <strong>Add items</strong>, search the inventory, and choose the
          items and quantities you need.
        </li>
        <li>
          Click <strong>Submit Requisition</strong>. Your slip starts as{" "}
          <strong>Pending</strong>.
        </li>
      </ol>
    ),
  },
  {
    id: 6,
    category: "requests",
    icon: "bi-file-earmark-text",
    tone: "tone-green",
    question: "Why is a detailed reason required for every request?",
    search:
      "administrative evaluation valid clear reasonable justification university resources organization activities purpose",
    answer: (
      <>
        To ensure university resources are managed responsibly, every request
        undergoes administrative evaluation. You must provide a{" "}
        <strong>valid, clear, and reasonable justification</strong> explaining
        how the requested items will be used for university or organization
        activities.
      </>
    ),
  },
  {
    id: 7,
    category: "requests",
    icon: "bi-check-circle",
    tone: "tone-tan",
    question: 'What makes a "reasonable" justification?',
    search:
      "Good Example Poor Example 3 reams A4 paper black ink certificates Campus Leadership Summit Need paper for office use For class project",
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
  {
    id: 8,
    category: "requests",
    icon: "bi-sliders",
    tone: "tone-amber",
    question: "What is the usual limit per request, and can I ask for more?",
    search:
      "usual limit quantity per request maximum normal limit more than explain why over the limit",
    answer: (
      <>
        Each item has a <strong>usual limit</strong> per request, shown when
        you add it to your slip. You can still ask for more than the limit, but
        you must explain why you need the extra quantity. You also cannot
        request more than what is currently available in stock.
      </>
    ),
  },
  {
    id: 9,
    category: "tracking",
    icon: "bi-diagram-3",
    tone: "tone-brown",
    question: "What do the request statuses mean?",
    search:
      "status pending processing approved accepted denied cancelled progress stages meaning",
    answer: (
      <ul className="faq-list">
        <li>
          <strong>Pending:</strong> Submitted and waiting for review.
        </li>
        <li>
          <strong>Processing:</strong> The supply office acknowledged your slip
          and is preparing it.
        </li>
        <li>
          <strong>Approved:</strong> Your items are ready. Please go to the
          Property Window for pickup.
        </li>
        <li>
          <strong>Accepted:</strong> You received the items and the request is
          complete.
        </li>
        <li>
          <strong>Denied:</strong> The request could not be approved. The
          reason is shown on your slip.
        </li>
        <li>
          <strong>Cancelled:</strong> You cancelled the request.
        </li>
      </ul>
    ),
  },
  {
    id: 10,
    category: "tracking",
    icon: "bi-lock",
    tone: "tone-rose",
    question: "Can I edit or cancel a request after submitting it?",
    search: "edit cancel change locked pending processing acknowledged",
    answer: (
      <>
        Yes, but only while the request is <strong>Pending</strong>. Once the
        supply office acknowledges it and it becomes{" "}
        <strong>Processing</strong>, the slip is locked and can no longer be
        edited or cancelled.
      </>
    ),
  },
  {
    id: 11,
    category: "tracking",
    icon: "bi-bag-check",
    tone: "tone-green",
    question: "How do I know when I can pick up my items?",
    search:
      "pickup property window ready release notification approved received deducted inventory",
    answer: (
      <>
        When your request becomes <strong>Approved</strong>, you will get a
        notification that your items are ready. Go to the Property Window to
        receive them. After you receive the items, the supply office marks the
        request as <strong>Accepted</strong> to complete it.
      </>
    ),
  },
  {
    id: 12,
    category: "tracking",
    icon: "bi-x-octagon",
    tone: "tone-rose",
    question: "What if my request is denied or cancelled?",
    search: "denied cancelled reason request again file again new slip reuse details",
    answer: (
      <>
        For a denied request, the reason from the supply office is shown on the
        slip and in your notification. For a denied or cancelled request, you
        can use the <strong>Request Again</strong> button to file a new slip
        that starts with the same details, then fix whatever caused the
        problem.
      </>
    ),
  },
  {
    id: 13,
    category: "account",
    icon: "bi-bell",
    tone: "tone-amber",
    question: "Where do I see updates about my requests?",
    search: "notifications alerts updates unread mark as read clear",
    answer: (
      <>
        Every status change creates a notification. Open the{" "}
        <strong>Notifications</strong> page to read them, mark them as read, or
        clear them.
      </>
    ),
  },
  {
    id: 14,
    category: "account",
    icon: "bi-clock-history",
    tone: "tone-tan",
    question: "Where can I see what I have done in the system?",
    search: "activity log history actions sign in filed edited cancelled private only you",
    answer: (
      <>
        Open the <strong>Activity Log</strong> page. It lists your own actions,
        such as signing in, filing, editing, or cancelling a request. Only you
        can see your activity.
      </>
    ),
  },
  {
    id: 15,
    category: "account",
    icon: "bi-key",
    tone: "tone-brown",
    question: "How do I sign in, and what if I forget my password?",
    search:
      "sign in login google institutional email buksu.edu.ph student.buksu.edu.ph forgot password reset code verification",
    answer: (
      <>
        <p>
          Sign in with your BukSU institutional email (
          <strong>@student.buksu.edu.ph</strong> or{" "}
          <strong>@buksu.edu.ph</strong>) and password, or use{" "}
          <strong>Continue with Google</strong> with that same email.
        </p>
        <p>
          If you forgot your password, use the forgot password option on the
          sign-in page. A verification code will be sent to your email so you
          can set a new password. Accounts that sign in with Google do not use
          a password.
        </p>
      </>
    ),
  },
];

function FAQ() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter((f) => {
      const matchesCategory = category === "all" || f.category === category;
      const haystack = `${f.question} ${f.search}`.toLowerCase();
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
          <h1>Frequently Asked Questions</h1>
          <p>
            Everything you need to know about requesting supplies, tracking
            your requisition slips, and picking up your items.
          </p>

          <div className="faq-search">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Search for a question"
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